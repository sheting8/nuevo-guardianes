import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOverrideDto } from './dto/create-override.dto';

const VOLUNTARIO_SELECT = {
  id: true,
  nombres: true,
  apellidoP: true,
  correlativo: true,
  tipo: true,
} satisfies Prisma.VoluntarioSelect;

const OVERRIDE_INCLUDE = {
  voluntario: { select: VOLUNTARIO_SELECT },
  autor: { select: VOLUNTARIO_SELECT },
} satisfies Prisma.CorreccionNocheInclude;

function parseFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

@Injectable()
export class LibroGuardiaService {
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

  async crearOverride(dto: CreateOverrideDto, userId: string) {
    const autorId = await this.voluntarioIdDeUsuario(userId);
    const fecha = parseFecha(dto.fecha);

    const voluntario = await this.prisma.voluntario.findUnique({
      where: { id: dto.voluntarioId },
    });
    if (!voluntario) {
      throw new NotFoundException('Voluntario no encontrado');
    }

    return this.prisma.correccionNoche.upsert({
      where: {
        fecha_voluntarioId: { fecha, voluntarioId: dto.voluntarioId },
      },
      create: {
        fecha,
        voluntarioId: dto.voluntarioId,
        durmio: dto.durmio,
        autorId,
      },
      update: {
        durmio: dto.durmio,
        autorId,
        creadoEn: new Date(),
      },
      include: OVERRIDE_INCLUDE,
    });
  }
}
