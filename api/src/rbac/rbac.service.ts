import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NivelAcceso,
  RolSistema,
  TipoRecursoAcceso,
  TipoSujetoAcceso,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAutorizacionDto } from './dto/create-autorizacion.dto';
import { CreateGrupoDto } from './dto/create-grupo.dto';

const RANGO_NIVEL: Record<NivelAcceso, number> = {
  [NivelAcceso.LEER]: 1,
  [NivelAcceso.GESTIONAR]: 2,
};

export interface IdsAccesibles {
  // Cuando irrestricto=true (ADMIN), el llamador no debe filtrar por ids —
  // filtrar por un array vacío significaría "ningún resultado", lo opuesto
  // a lo que un ADMIN espera ver.
  irrestricto: boolean;
  ids: string[];
}

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  private esAdmin(user: AuthenticatedUser): boolean {
    return user.roles.includes(RolSistema.ADMIN);
  }

  // AuthenticatedUser.sub es el User.id del JWT (ver jwt-payload.interface.ts),
  // NO el Voluntario.id que Autorizacion/GrupoMiembro usan — hay que resolverlo
  // antes de consultar grants, igual que ya hace permisos.service.ts y
  // libro-guardia.service.ts con su propio voluntarioIdDeUsuario().
  private async voluntarioIdDeUsuario(userId: string): Promise<string> {
    const voluntario = await this.prisma.voluntario.findUnique({
      where: { userId },
    });
    if (!voluntario) {
      throw new ForbiddenException(
        'El usuario autenticado no tiene un voluntario asociado',
      );
    }
    return voluntario.id;
  }

  private async grants(
    voluntarioId: string,
    recursoTipo: TipoRecursoAcceso,
    recursoId?: string,
  ) {
    return this.prisma.autorizacion.findMany({
      where: {
        recursoTipo,
        ...(recursoId ? { recursoId } : {}),
        OR: [
          { sujetoTipo: TipoSujetoAcceso.USUARIO, voluntarioId },
          {
            sujetoTipo: TipoSujetoAcceso.GRUPO,
            grupo: { miembros: { some: { voluntarioId } } },
          },
        ],
      },
      select: { recursoId: true, nivel: true },
    });
  }

  private mejorNivelPorRecurso(
    grants: { recursoId: string; nivel: NivelAcceso }[],
  ): Map<string, NivelAcceso> {
    const mejor = new Map<string, NivelAcceso>();
    for (const g of grants) {
      const actual = mejor.get(g.recursoId);
      if (!actual || RANGO_NIVEL[g.nivel] > RANGO_NIVEL[actual]) {
        mejor.set(g.recursoId, g.nivel);
      }
    }
    return mejor;
  }

  async tieneAcceso(
    user: AuthenticatedUser,
    recursoTipo: TipoRecursoAcceso,
    recursoId: string,
    nivelMinimo: NivelAcceso,
  ): Promise<boolean> {
    if (this.esAdmin(user)) return true;

    const voluntarioId = await this.voluntarioIdDeUsuario(user.sub);
    const grants = await this.grants(voluntarioId, recursoTipo, recursoId);
    const mejor = this.mejorNivelPorRecurso(grants).get(recursoId);
    return !!mejor && RANGO_NIVEL[mejor] >= RANGO_NIVEL[nivelMinimo];
  }

  /**
   * Dirección inversa de idsAccesibles(): dado un recurso puntual, qué
   * voluntarios pueden acceder a él — grants directos + miembros de
   * cualquier grupo con grant. NO incluye a los ADMIN (este método resuelve
   * grants, y los ADMIN no dependen de ellos) — el llamador que necesite
   * "todos los que deberían ser notificados" debe unir esto con
   * voluntariosConRolAdmin().
   */
  async voluntariosConAcceso(
    recursoTipo: TipoRecursoAcceso,
    recursoId: string,
    nivelMinimo: NivelAcceso,
  ): Promise<string[]> {
    const grants = await this.prisma.autorizacion.findMany({
      where: { recursoTipo, recursoId },
      select: {
        sujetoTipo: true,
        voluntarioId: true,
        grupoId: true,
        nivel: true,
      },
    });

    const relevantes = grants.filter(
      (g) => RANGO_NIVEL[g.nivel] >= RANGO_NIVEL[nivelMinimo],
    );

    const directos = relevantes
      .filter((g) => g.sujetoTipo === TipoSujetoAcceso.USUARIO && g.voluntarioId)
      .map((g) => g.voluntarioId as string);

    const grupoIds = relevantes
      .filter((g) => g.sujetoTipo === TipoSujetoAcceso.GRUPO && g.grupoId)
      .map((g) => g.grupoId as string);

    const miembrosDeGrupos = grupoIds.length
      ? await this.prisma.grupoMiembro.findMany({
          where: { grupoId: { in: grupoIds } },
          select: { voluntarioId: true },
        })
      : [];

    return [
      ...new Set([...directos, ...miembrosDeGrupos.map((m) => m.voluntarioId)]),
    ];
  }

  /** Todos los voluntarios con el rol legacy ADMIN — no depende de Autorizacion. */
  async voluntariosConRolAdmin(): Promise<string[]> {
    const roles = await this.prisma.voluntarioRol.findMany({
      where: { rol: RolSistema.ADMIN },
      select: { voluntarioId: true },
    });
    return roles.map((r) => r.voluntarioId);
  }

  async idsAccesibles(
    user: AuthenticatedUser,
    recursoTipo: TipoRecursoAcceso,
    nivelMinimo: NivelAcceso,
  ): Promise<IdsAccesibles> {
    if (this.esAdmin(user)) return { irrestricto: true, ids: [] };

    const voluntarioId = await this.voluntarioIdDeUsuario(user.sub);
    const grants = await this.grants(voluntarioId, recursoTipo);
    const mejorPorRecurso = this.mejorNivelPorRecurso(grants);
    const ids = [...mejorPorRecurso.entries()]
      .filter(([, nivel]) => RANGO_NIVEL[nivel] >= RANGO_NIVEL[nivelMinimo])
      .map(([id]) => id);

    return { irrestricto: false, ids };
  }

  /**
   * Borra las Autorizacion que apuntan a un recurso eliminado. El módulo
   * dueño del recurso (inventario, checklists) debe llamar esto al eliminar
   * una CategoriaInventario/Ubicacion/ChecklistTemplate — recursoId no tiene
   * FK de BD, así que no hay cascade-delete automático.
   */
  async limpiarRecurso(
    recursoTipo: TipoRecursoAcceso,
    recursoId: string,
  ): Promise<void> {
    await this.prisma.autorizacion.deleteMany({ where: { recursoTipo, recursoId } });
  }

  private async validarRecursoExiste(
    recursoTipo: TipoRecursoAcceso,
    recursoId: string,
  ): Promise<void> {
    const existe = await (recursoTipo === TipoRecursoAcceso.CATEGORIA_INVENTARIO
      ? this.prisma.categoriaInventario.findUnique({ where: { id: recursoId } })
      : recursoTipo === TipoRecursoAcceso.UBICACION
        ? this.prisma.ubicacion.findUnique({ where: { id: recursoId } })
        : this.prisma.checklistTemplate.findUnique({ where: { id: recursoId } }));

    if (!existe) {
      throw new BadRequestException(
        'El recurso indicado no existe para el tipo especificado',
      );
    }
  }

  private async validarSujetoExiste(dto: CreateAutorizacionDto): Promise<void> {
    if (dto.sujetoTipo === TipoSujetoAcceso.USUARIO) {
      const voluntario = await this.prisma.voluntario.findUnique({
        where: { id: dto.voluntarioId },
      });
      if (!voluntario) {
        throw new BadRequestException('El voluntario indicado no existe');
      }
      return;
    }
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: dto.grupoId },
    });
    if (!grupo) {
      throw new BadRequestException('El grupo indicado no existe');
    }
  }

  // ── Grupos ──────────────────────────────────────────────────────────────

  listarGrupos() {
    return this.prisma.grupo.findMany({
      include: { miembros: { include: { voluntario: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  crearGrupo(dto: CreateGrupoDto) {
    return this.prisma.grupo.create({
      data: { nombre: dto.nombre, descripcion: dto.descripcion },
    });
  }

  async agregarMiembro(grupoId: string, voluntarioId: string) {
    const grupo = await this.prisma.grupo.findUnique({ where: { id: grupoId } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const voluntario = await this.prisma.voluntario.findUnique({
      where: { id: voluntarioId },
    });
    if (!voluntario) throw new NotFoundException('Voluntario no encontrado');

    return this.prisma.grupoMiembro.upsert({
      where: { grupoId_voluntarioId: { grupoId, voluntarioId } },
      create: { grupoId, voluntarioId },
      update: {},
    });
  }

  async quitarMiembro(grupoId: string, voluntarioId: string) {
    await this.prisma.grupoMiembro.deleteMany({ where: { grupoId, voluntarioId } });
  }

  // ── Autorizaciones ──────────────────────────────────────────────────────

  listarAutorizaciones() {
    return this.prisma.autorizacion.findMany({
      include: { voluntario: true, grupo: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async crearAutorizacion(dto: CreateAutorizacionDto) {
    if (dto.sujetoTipo === TipoSujetoAcceso.USUARIO && !dto.voluntarioId) {
      throw new BadRequestException(
        'voluntarioId es requerido cuando sujetoTipo es USUARIO',
      );
    }
    if (dto.sujetoTipo === TipoSujetoAcceso.GRUPO && !dto.grupoId) {
      throw new BadRequestException(
        'grupoId es requerido cuando sujetoTipo es GRUPO',
      );
    }

    await this.validarSujetoExiste(dto);
    await this.validarRecursoExiste(dto.recursoTipo, dto.recursoId);

    return this.prisma.autorizacion.create({
      data: {
        sujetoTipo: dto.sujetoTipo,
        voluntarioId: dto.sujetoTipo === TipoSujetoAcceso.USUARIO ? dto.voluntarioId : null,
        grupoId: dto.sujetoTipo === TipoSujetoAcceso.GRUPO ? dto.grupoId : null,
        recursoTipo: dto.recursoTipo,
        recursoId: dto.recursoId,
        nivel: dto.nivel,
      },
    });
  }

  async revocarAutorizacion(id: string): Promise<void> {
    const autorizacion = await this.prisma.autorizacion.findUnique({ where: { id } });
    if (!autorizacion) throw new NotFoundException('Autorización no encontrada');
    await this.prisma.autorizacion.delete({ where: { id } });
  }
}
