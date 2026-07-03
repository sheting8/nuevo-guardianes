import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AsignarConductoresDto } from './dto/asignar-conductores.dto';
import { AsignarJgsDto } from './dto/asignar-jgs.dto';
import { AsignarMensajeroDto } from './dto/asignar-mensajero.dto';

const VOLUNTARIO_SELECT = {
  id: true,
  nombres: true,
  apellidoP: true,
  correlativo: true,
  tipo: true,
} satisfies Prisma.VoluntarioSelect;

function parseFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

@Injectable()
export class GuardiaService {
  constructor(private readonly prisma: PrismaService) {}

  private async validarVoluntarioExiste(voluntarioId: string): Promise<void> {
    const existe = await this.prisma.voluntario.count({
      where: { id: voluntarioId },
    });
    if (!existe) {
      throw new BadRequestException('El voluntario no existe');
    }
  }

  private async validarVoluntariosExisten(
    voluntarioIds: string[],
  ): Promise<void> {
    const ids = [...new Set(voluntarioIds)];
    if (ids.length === 0) {
      return;
    }
    const total = await this.prisma.voluntario.count({
      where: { id: { in: ids } },
    });
    if (total !== ids.length) {
      throw new BadRequestException('Uno o más voluntarios no existen');
    }
  }

  async asignarMensajero(dto: AsignarMensajeroDto) {
    const fecha = parseFecha(dto.fecha);
    await this.validarVoluntarioExiste(dto.voluntarioId);

    return this.prisma.mensajero.upsert({
      where: { fecha },
      create: { fecha, voluntarioId: dto.voluntarioId },
      update: { voluntarioId: dto.voluntarioId },
      include: { voluntario: { select: VOLUNTARIO_SELECT } },
    });
  }

  async asignarJgs(dto: AsignarJgsDto) {
    const fecha = parseFecha(dto.fecha);
    await this.validarVoluntarioExiste(dto.voluntarioId);

    return this.prisma.jGsSubrogante.upsert({
      where: { fecha },
      create: { fecha, voluntarioId: dto.voluntarioId },
      update: { voluntarioId: dto.voluntarioId },
      include: { voluntario: { select: VOLUNTARIO_SELECT } },
    });
  }

  async asignarConductores(dto: AsignarConductoresDto) {
    const fecha = parseFecha(dto.fecha);
    await this.validarVoluntariosExisten(dto.voluntarioIds);

    const existentes = await this.prisma.conductorGuardia.findMany({
      where: { fecha },
    });
    const existentesIds = new Set(existentes.map((e) => e.voluntarioId));
    const nuevosIds = new Set(dto.voluntarioIds);

    const aEliminar = existentes
      .filter((e) => !nuevosIds.has(e.voluntarioId))
      .map((e) => e.id);
    const aCrear = dto.voluntarioIds.filter((id) => !existentesIds.has(id));

    await this.prisma.$transaction([
      ...(aEliminar.length > 0
        ? [
            this.prisma.conductorGuardia.deleteMany({
              where: { id: { in: aEliminar } },
            }),
          ]
        : []),
      ...(aCrear.length > 0
        ? [
            this.prisma.conductorGuardia.createMany({
              data: aCrear.map((voluntarioId) => ({ fecha, voluntarioId })),
            }),
          ]
        : []),
    ]);

    return this.prisma.conductorGuardia.findMany({
      where: { fecha },
      include: { voluntario: { select: VOLUNTARIO_SELECT } },
    });
  }

  async obtenerPorFecha(fecha: string) {
    const fechaDate = parseFecha(fecha);

    const [mensajero, conductores, jgs] = await Promise.all([
      this.prisma.mensajero.findUnique({
        where: { fecha: fechaDate },
        include: { voluntario: { select: VOLUNTARIO_SELECT } },
      }),
      this.prisma.conductorGuardia.findMany({
        where: { fecha: fechaDate },
        include: { voluntario: { select: VOLUNTARIO_SELECT } },
      }),
      this.prisma.jGsSubrogante.findUnique({
        where: { fecha: fechaDate },
        include: { voluntario: { select: VOLUNTARIO_SELECT } },
      }),
    ]);

    return {
      mensajero: mensajero?.voluntario ?? null,
      conductores: conductores.map((c) => c.voluntario),
      jgs: jgs?.voluntario ?? null,
    };
  }
}
