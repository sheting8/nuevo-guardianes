import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AsignarCuartelerosDto } from './dto/asignar-cuarteleros.dto';
import { AsignarVoluntariosDto } from './dto/asignar-voluntarios.dto';
import { CreateCarroDto } from './dto/create-carro.dto';
import { UpdateCarroDto } from './dto/update-carro.dto';

const DETALLE_INCLUDE = {
  voluntarios: { include: { voluntario: true } },
  cuarteleros: { include: { cuartelero: true } },
} as const;

@Injectable()
export class CarrosService {
  constructor(private readonly prisma: PrismaService) {}

  private async buscarOFallar(id: string) {
    const carro = await this.prisma.carro.findUnique({ where: { id } });
    if (!carro) {
      throw new NotFoundException('Carro no encontrado');
    }
    return carro;
  }

  listar() {
    return this.prisma.carro.findMany({ orderBy: { nombre: 'asc' } });
  }

  async detalle(id: string) {
    const carro = await this.prisma.carro.findUnique({
      where: { id },
      include: DETALLE_INCLUDE,
    });
    if (!carro) {
      throw new NotFoundException('Carro no encontrado');
    }
    return carro;
  }

  crear(dto: CreateCarroDto) {
    return this.prisma.carro.create({ data: { nombre: dto.nombre } });
  }

  async actualizar(id: string, dto: UpdateCarroDto) {
    await this.buscarOFallar(id);
    return this.prisma.carro.update({ where: { id }, data: dto });
  }

  async eliminar(id: string) {
    await this.buscarOFallar(id);
    await this.prisma.carro.delete({ where: { id } });
    return { message: 'Carro eliminado correctamente' };
  }

  async asignarVoluntarios(id: string, dto: AsignarVoluntariosDto) {
    await this.buscarOFallar(id);

    await this.prisma.carroVoluntario.createMany({
      data: dto.voluntarioIds.map((voluntarioId) => ({
        carroId: id,
        voluntarioId,
      })),
      skipDuplicates: true,
    });

    return this.detalle(id);
  }

  async asignarCuarteleros(id: string, dto: AsignarCuartelerosDto) {
    await this.buscarOFallar(id);

    await this.prisma.carroCuartelero.createMany({
      data: dto.cuarteleroIds.map((cuarteleroId) => ({
        carroId: id,
        cuarteleroId,
      })),
      skipDuplicates: true,
    });

    return this.detalle(id);
  }

  async quitarVoluntario(id: string, voluntarioId: string) {
    await this.buscarOFallar(id);

    const habilitacion = await this.prisma.carroVoluntario.findUnique({
      where: { carroId_voluntarioId: { carroId: id, voluntarioId } },
    });
    if (!habilitacion) {
      throw new NotFoundException(
        'El voluntario no está habilitado en este carro',
      );
    }

    await this.prisma.carroVoluntario.delete({
      where: { carroId_voluntarioId: { carroId: id, voluntarioId } },
    });

    return { message: 'Habilitación eliminada correctamente' };
  }
}
