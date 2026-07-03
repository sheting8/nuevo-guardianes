import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLicenciaDto } from './dto/create-licencia.dto';
import { QueryLicenciasDto } from './dto/query-licencias.dto';

const VOLUNTARIO_SELECT = {
  id: true,
  nombres: true,
  apellidoP: true,
  correlativo: true,
  tipo: true,
} satisfies Prisma.VoluntarioSelect;

const UN_DIA_MS = 24 * 60 * 60 * 1000;

function parseFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function rangoDeFechas(fechaInicio: Date, fechaFin: Date): Date[] {
  const fechas: Date[] = [];
  for (
    let actual = fechaInicio.getTime();
    actual <= fechaFin.getTime();
    actual += UN_DIA_MS
  ) {
    fechas.push(new Date(actual));
  }
  return fechas;
}

@Injectable()
export class LicenciasService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(dto: CreateLicenciaDto) {
    const fechaInicio = parseFecha(dto.fechaInicio);
    const fechaFin = parseFecha(dto.fechaFin);

    if (fechaFin < fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior o igual a la fecha de inicio',
      );
    }

    const voluntario = await this.prisma.voluntario.findUnique({
      where: { id: dto.voluntarioId },
    });
    if (!voluntario) {
      throw new NotFoundException('Voluntario no encontrado');
    }

    const solapada = await this.prisma.licencia.findFirst({
      where: {
        voluntarioId: dto.voluntarioId,
        fecha: { gte: fechaInicio, lte: fechaFin },
      },
    });
    if (solapada) {
      throw new ConflictException(
        'Ya existe una licencia que se solapa con ese rango de fechas para este voluntario',
      );
    }

    const fechas = rangoDeFechas(fechaInicio, fechaFin);
    await this.prisma.licencia.createMany({
      data: fechas.map((fecha) => ({ fecha, voluntarioId: dto.voluntarioId })),
    });

    return this.prisma.licencia.findMany({
      where: {
        voluntarioId: dto.voluntarioId,
        fecha: { gte: fechaInicio, lte: fechaFin },
      },
      include: { voluntario: { select: VOLUNTARIO_SELECT } },
      orderBy: { fecha: 'asc' },
    });
  }

  async listar(query: QueryLicenciasDto) {
    return this.prisma.licencia.findMany({
      where: query.voluntarioId ? { voluntarioId: query.voluntarioId } : {},
      include: { voluntario: { select: VOLUNTARIO_SELECT } },
      orderBy: { fecha: 'desc' },
    });
  }

  async eliminar(id: string) {
    const licencia = await this.prisma.licencia.findUnique({ where: { id } });
    if (!licencia) {
      throw new NotFoundException('Licencia no encontrada');
    }
    await this.prisma.licencia.delete({ where: { id } });
    return { message: 'Licencia eliminada correctamente' };
  }
}
