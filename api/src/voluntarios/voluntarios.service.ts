import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoVoluntario } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVoluntarioDto } from './dto/create-voluntario.dto';
import { QueryVoluntariosDto } from './dto/query-voluntarios.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { UpdateVoluntarioDto } from './dto/update-voluntario.dto';

const QUINCE_CORRELATIVO_MIN = 1;
const QUINCE_CORRELATIVO_MAX = 999;
const CONFEDERADO_CORRELATIVO_MIN = 1000;

const DETALLE_INCLUDE = {
  roles: true,
  carrosHabilitados: { include: { carro: true } },
  oficialidad: true,
} satisfies Prisma.VoluntarioInclude;

@Injectable()
export class VoluntariosService {
  constructor(private readonly prisma: PrismaService) {}

  private validarCorrelativoPorTipo(
    tipo: TipoVoluntario,
    correlativo: number,
  ): void {
    if (
      tipo === TipoVoluntario.QUINCE &&
      (correlativo < QUINCE_CORRELATIVO_MIN ||
        correlativo > QUINCE_CORRELATIVO_MAX)
    ) {
      throw new BadRequestException(
        'El correlativo debe estar entre 1 y 999 para voluntarios de la 15a',
      );
    }
    if (
      tipo === TipoVoluntario.CONFEDERADO &&
      correlativo < CONFEDERADO_CORRELATIVO_MIN
    ) {
      throw new BadRequestException(
        'El correlativo debe ser mayor o igual a 1000 para voluntarios confederados',
      );
    }
  }

  private async correlativoEnUso(
    tipo: TipoVoluntario,
    correlativo: number,
  ): Promise<boolean> {
    const existente = await this.prisma.voluntario.findFirst({
      where:
        tipo === TipoVoluntario.QUINCE
          ? { tipo: TipoVoluntario.QUINCE, correlativo }
          : { tipo: TipoVoluntario.CONFEDERADO, correlativo, activo: true },
    });
    return !!existente;
  }

  private async buscarOFallar(id: string) {
    const voluntario = await this.prisma.voluntario.findUnique({
      where: { id },
    });
    if (!voluntario) {
      throw new NotFoundException('Voluntario no encontrado');
    }
    return voluntario;
  }

  async listar(query: QueryVoluntariosDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const busqueda = query.search?.trim();
    const busquedaComoNumero =
      busqueda && !Number.isNaN(Number(busqueda))
        ? Number(busqueda)
        : undefined;

    const where: Prisma.VoluntarioWhereInput = {
      ...(query.tipo ? { tipo: query.tipo } : {}),
      ...(query.activo !== undefined
        ? { activo: query.activo === 'true' }
        : {}),
      ...(busqueda
        ? {
            OR: [
              { nombres: { contains: busqueda, mode: 'insensitive' } },
              { apellidoP: { contains: busqueda, mode: 'insensitive' } },
              { apellidoM: { contains: busqueda, mode: 'insensitive' } },
              ...(busquedaComoNumero !== undefined
                ? [{ correlativo: busquedaComoNumero }]
                : []),
            ],
          }
        : {}),
    };

    const [total, voluntarios] = await this.prisma.$transaction([
      this.prisma.voluntario.count({ where }),
      this.prisma.voluntario.findMany({
        where,
        orderBy: { correlativo: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: voluntarios,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async detalle(id: string) {
    const voluntario = await this.prisma.voluntario.findUnique({
      where: { id },
      include: DETALLE_INCLUDE,
    });
    if (!voluntario) {
      throw new NotFoundException('Voluntario no encontrado');
    }
    return voluntario;
  }

  async crear(dto: CreateVoluntarioDto) {
    this.validarCorrelativoPorTipo(dto.tipo, dto.correlativo);

    if (await this.correlativoEnUso(dto.tipo, dto.correlativo)) {
      throw new ConflictException('El correlativo ya está en uso');
    }

    const passwordHash = await bcrypt.hash(`${dto.rut}${dto.rutDigito}`, 10);
    const username = String(dto.correlativo);

    try {
      return await this.prisma.voluntario.create({
        data: {
          correlativo: dto.correlativo,
          tipo: dto.tipo,
          nombres: dto.nombres,
          apellidoP: dto.apellidoP,
          apellidoM: dto.apellidoM,
          rut: dto.rut,
          rutDigito: dto.rutDigito,
          company: dto.company,
          email: dto.email,
          telefono: dto.telefono,
          user: {
            create: { username, passwordHash },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('El correlativo ya está en uso');
      }
      throw error;
    }
  }

  async actualizar(id: string, dto: UpdateVoluntarioDto) {
    await this.buscarOFallar(id);
    return this.prisma.voluntario.update({ where: { id }, data: dto });
  }

  async desactivar(id: string) {
    const voluntario = await this.buscarOFallar(id);
    if (voluntario.tipo === TipoVoluntario.QUINCE) {
      throw new BadRequestException(
        'Los voluntarios de la 15a no se pueden desactivar',
      );
    }

    // El username original (= correlativo) debe liberarse para que un nuevo
    // voluntario confederado pueda reutilizar ese correlativo: User.username
    // es único de forma permanente, a diferencia del índice parcial del correlativo.
    return this.prisma.$transaction(async (tx) => {
      if (voluntario.userId) {
        await tx.user.update({
          where: { id: voluntario.userId },
          data: { username: `${voluntario.correlativo}-baja-${voluntario.id}` },
        });
      }
      return tx.voluntario.update({ where: { id }, data: { activo: false } });
    });
  }

  async actualizarRoles(id: string, dto: UpdateRolesDto) {
    await this.buscarOFallar(id);

    await this.prisma.$transaction([
      this.prisma.voluntarioRol.deleteMany({ where: { voluntarioId: id } }),
      this.prisma.voluntarioRol.createMany({
        data: dto.roles.map((rol) => ({ voluntarioId: id, rol })),
        skipDuplicates: true,
      }),
    ]);

    return { roles: dto.roles };
  }
}
