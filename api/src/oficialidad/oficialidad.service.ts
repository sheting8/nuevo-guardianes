import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOficialidadDto } from './dto/create-oficialidad.dto';

@Injectable()
export class OficialidadService {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.oficialidad.findMany({ include: { voluntario: true } });
  }

  async crear(dto: CreateOficialidadDto) {
    const voluntario = await this.prisma.voluntario.findUnique({
      where: { id: dto.voluntarioId },
    });
    if (!voluntario) {
      throw new NotFoundException('Voluntario no encontrado');
    }

    const existente = await this.prisma.oficialidad.findUnique({
      where: { voluntarioId: dto.voluntarioId },
    });
    if (existente) {
      throw new ConflictException(
        'Este voluntario ya tiene un cargo de oficialidad asignado',
      );
    }

    try {
      return await this.prisma.oficialidad.create({
        data: { voluntarioId: dto.voluntarioId, cargo: dto.cargo },
        include: { voluntario: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Este voluntario ya tiene un cargo de oficialidad asignado',
        );
      }
      throw error;
    }
  }

  async eliminar(id: string) {
    const oficialidad = await this.prisma.oficialidad.findUnique({
      where: { id },
    });
    if (!oficialidad) {
      throw new NotFoundException('Cargo de oficialidad no encontrado');
    }
    await this.prisma.oficialidad.delete({ where: { id } });
    return { message: 'Cargo de oficialidad eliminado correctamente' };
  }
}
