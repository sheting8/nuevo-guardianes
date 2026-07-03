import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTurnoDto } from './dto/create-turno.dto';
import { UpdateTurnoDto } from './dto/update-turno.dto';

const VOLUNTARIO_SELECT = {
  id: true,
  nombres: true,
  apellidoP: true,
  correlativo: true,
  tipo: true,
} satisfies Prisma.VoluntarioSelect;

const TURNO_INCLUDE = {
  voluntarios: { include: { voluntario: { select: VOLUNTARIO_SELECT } } },
} satisfies Prisma.TurnoInclude;

type TurnoConVoluntarios = Prisma.TurnoGetPayload<{
  include: typeof TURNO_INCLUDE;
}>;

function aplanarVoluntarios(turno: TurnoConVoluntarios) {
  const { voluntarios, ...resto } = turno;
  return { ...resto, voluntarios: voluntarios.map((tv) => tv.voluntario) };
}

@Injectable()
export class TurnosService {
  constructor(private readonly prisma: PrismaService) {}

  private async buscarOFallar(id: string) {
    const turno = await this.prisma.turno.findUnique({ where: { id } });
    if (!turno) {
      throw new NotFoundException('Turno no encontrado');
    }
    return turno;
  }

  async listar() {
    const turnos = await this.prisma.turno.findMany({
      include: TURNO_INCLUDE,
      orderBy: { nombre: 'asc' },
    });
    return turnos.map(aplanarVoluntarios);
  }

  async crear(dto: CreateTurnoDto) {
    const turno = await this.prisma.turno.create({
      data: {
        nombre: dto.nombre,
        voluntarios: {
          createMany: {
            data: dto.voluntarioIds.map((voluntarioId) => ({ voluntarioId })),
            skipDuplicates: true,
          },
        },
      },
      include: TURNO_INCLUDE,
    });
    return aplanarVoluntarios(turno);
  }

  async actualizar(id: string, dto: UpdateTurnoDto) {
    await this.buscarOFallar(id);

    const turno = await this.prisma.$transaction(async (tx) => {
      if (dto.nombre !== undefined) {
        await tx.turno.update({ where: { id }, data: { nombre: dto.nombre } });
      }

      if (dto.voluntarioIds !== undefined) {
        await tx.turnoVoluntario.deleteMany({ where: { turnoId: id } });
        if (dto.voluntarioIds.length > 0) {
          await tx.turnoVoluntario.createMany({
            data: dto.voluntarioIds.map((voluntarioId) => ({
              turnoId: id,
              voluntarioId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.turno.findUniqueOrThrow({
        where: { id },
        include: TURNO_INCLUDE,
      });
    });

    return aplanarVoluntarios(turno);
  }

  async eliminar(id: string) {
    await this.buscarOFallar(id);
    await this.prisma.turno.delete({ where: { id } });
    return { message: 'Turno eliminado correctamente' };
  }
}
