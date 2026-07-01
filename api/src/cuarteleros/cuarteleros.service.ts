import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCuarteleroDto } from './dto/create-cuartelero.dto';
import { QueryCuarteleroDto } from './dto/query-cuarteleros.dto';
import { UpdateCuarteleroDto } from './dto/update-cuartelero.dto';

@Injectable()
export class CuartelerosService {
  constructor(private readonly prisma: PrismaService) {}

  private async buscarOFallar(id: string) {
    const cuartelero = await this.prisma.cuartelero.findUnique({
      where: { id },
    });
    if (!cuartelero) {
      throw new NotFoundException('Cuartelero no encontrado');
    }
    return cuartelero;
  }

  listar(query: QueryCuarteleroDto) {
    const where: Prisma.CuarteleroWhereInput = {
      ...(query.vigente !== undefined
        ? { vigente: query.vigente === 'true' }
        : {}),
    };
    return this.prisma.cuartelero.findMany({
      where,
      orderBy: { nombre: 'asc' },
    });
  }

  async detalle(id: string) {
    return this.buscarOFallar(id);
  }

  crear(dto: CreateCuarteleroDto) {
    return this.prisma.cuartelero.create({
      data: {
        nombre: dto.nombre,
        clave: dto.clave,
        nacimiento: dto.nacimiento,
        fechaIngreso: dto.fechaIngreso,
        ...(dto.vigente !== undefined ? { vigente: dto.vigente } : {}),
      },
    });
  }

  async actualizar(id: string, dto: UpdateCuarteleroDto) {
    await this.buscarOFallar(id);
    return this.prisma.cuartelero.update({
      where: { id },
      data: {
        ...dto,
      },
    });
  }

  async eliminar(id: string) {
    await this.buscarOFallar(id);
    await this.prisma.cuartelero.delete({ where: { id } });
    return { message: 'Cuartelero eliminado correctamente' };
  }
}
