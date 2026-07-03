import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoPermiso, Prisma, RolSistema, TipoPermiso } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePermisoDto } from './dto/create-permiso.dto';
import { QueryPermisosDto } from './dto/query-permisos.dto';
import { UpdatePermisoEstadoDto } from './dto/update-permiso-estado.dto';

const VOLUNTARIO_SELECT = {
  id: true,
  nombres: true,
  apellidoP: true,
  correlativo: true,
  tipo: true,
} satisfies Prisma.VoluntarioSelect;

const PERMISO_INCLUDE = {
  solicitante: { select: VOLUNTARIO_SELECT },
  reemplazante: { select: VOLUNTARIO_SELECT },
} satisfies Prisma.PermisoInclude;

const HORA_LIMITE_PARA_MANANA = 20;

function parseFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

@Injectable()
export class PermisosService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async buscarOFallar(id: string) {
    const permiso = await this.prisma.permiso.findUnique({ where: { id } });
    if (!permiso) {
      throw new NotFoundException('Permiso no encontrado');
    }
    return permiso;
  }

  private validarFechaGuardia(fechaGuardia: Date): void {
    const ahora = new Date();
    const hoy = new Date(
      Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()),
    );
    const manana = new Date(hoy.getTime() + 24 * 60 * 60 * 1000);

    if (fechaGuardia.getTime() < manana.getTime()) {
      throw new BadRequestException(
        'El permiso debe solicitarse para una fecha futura (a partir de mañana)',
      );
    }

    const esParaManana = fechaGuardia.getTime() === manana.getTime();
    if (esParaManana && ahora.getUTCHours() >= HORA_LIMITE_PARA_MANANA) {
      throw new BadRequestException(
        'No se puede pedir permiso para mañana después de las 20:00',
      );
    }
  }

  private async existeCitacionParaFecha(fecha: Date): Promise<boolean> {
    const asignacionDiaria = await this.prisma.citacion.findFirst({
      where: { fechaFin: null, fechaInicio: fecha },
    });
    if (asignacionDiaria) {
      return true;
    }

    const citacionSemanal = await this.prisma.citacion.findFirst({
      where: {
        AND: [
          { fechaFin: { not: null } },
          { fechaInicio: { lte: fecha } },
          { fechaFin: { gte: fecha } },
        ],
      },
    });
    return !!citacionSemanal;
  }

  async crear(dto: CreatePermisoDto, userId: string) {
    const solicitanteId = await this.voluntarioIdDeUsuario(userId);
    const fechaGuardia = parseFecha(dto.fechaGuardia);

    this.validarFechaGuardia(fechaGuardia);

    if (!(await this.existeCitacionParaFecha(fechaGuardia))) {
      throw new BadRequestException(
        'No existe una citación que cubra esa fecha de guardia',
      );
    }

    const duplicado = await this.prisma.permiso.findFirst({
      where: {
        solicitanteId,
        fechaGuardia,
        estado: { in: [EstadoPermiso.PENDIENTE, EstadoPermiso.APROBADO] },
      },
    });
    if (duplicado) {
      throw new ConflictException(
        'Ya existe un permiso para esa fecha de guardia',
      );
    }

    let reemplazanteId: string | undefined;
    if (dto.tipo === TipoPermiso.REEMPLAZO) {
      if (!dto.reemplazanteId) {
        throw new BadRequestException(
          'El reemplazante es requerido para un permiso de tipo REEMPLAZO',
        );
      }
      if (dto.reemplazanteId === solicitanteId) {
        throw new BadRequestException(
          'El reemplazante no puede ser el mismo solicitante',
        );
      }
      const reemplazante = await this.prisma.voluntario.findUnique({
        where: { id: dto.reemplazanteId },
      });
      if (!reemplazante || !reemplazante.activo) {
        throw new BadRequestException(
          'El reemplazante debe existir y estar activo',
        );
      }
      reemplazanteId = dto.reemplazanteId;
    }

    return this.prisma.permiso.create({
      data: {
        solicitanteId,
        tipo: dto.tipo,
        fechaGuardia,
        reemplazanteId,
      },
      include: PERMISO_INCLUDE,
    });
  }

  private construirWhere(
    query: QueryPermisosDto,
    extra: Prisma.PermisoWhereInput = {},
  ): Prisma.PermisoWhereInput {
    return {
      ...extra,
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.desde || query.hasta
        ? {
            fechaGuardia: {
              ...(query.desde ? { gte: parseFecha(query.desde) } : {}),
              ...(query.hasta ? { lte: parseFecha(query.hasta) } : {}),
            },
          }
        : {}),
    };
  }

  async listarMias(userId: string, query: QueryPermisosDto) {
    const solicitanteId = await this.voluntarioIdDeUsuario(userId);
    return this.prisma.permiso.findMany({
      where: this.construirWhere(query, { solicitanteId }),
      include: PERMISO_INCLUDE,
      orderBy: { fechaEnvio: 'desc' },
    });
  }

  async listarTodos(query: QueryPermisosDto) {
    return this.prisma.permiso.findMany({
      where: this.construirWhere(query),
      include: PERMISO_INCLUDE,
      orderBy: { fechaEnvio: 'desc' },
    });
  }

  async actualizarEstado(id: string, dto: UpdatePermisoEstadoDto) {
    const permiso = await this.buscarOFallar(id);
    if (permiso.estado !== EstadoPermiso.PENDIENTE) {
      throw new ConflictException(
        'Solo se pueden aprobar o rechazar permisos pendientes',
      );
    }

    return this.prisma.permiso.update({
      where: { id },
      data: {
        estado: dto.estado,
        comentarios: dto.comentarios,
        fechaCierre: new Date(),
      },
      include: PERMISO_INCLUDE,
    });
  }

  async eliminar(id: string, user: AuthenticatedUser) {
    const permiso = await this.buscarOFallar(id);
    const rolesGestor: RolSistema[] = [
      RolSistema.JEFE_GUARDIA,
      RolSistema.ADMIN,
    ];
    const esGestor = user.roles.some((rol) => rolesGestor.includes(rol));

    if (!esGestor) {
      const solicitanteId = await this.voluntarioIdDeUsuario(user.sub);
      if (permiso.solicitanteId !== solicitanteId) {
        throw new ForbiddenException(
          'Solo puedes eliminar tus propios permisos',
        );
      }
      if (permiso.estado !== EstadoPermiso.PENDIENTE) {
        throw new ForbiddenException(
          'Solo puedes eliminar permisos pendientes',
        );
      }
    }

    await this.prisma.permiso.delete({ where: { id } });
    return { message: 'Permiso eliminado correctamente' };
  }
}
