import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  NivelAcceso,
  Prisma,
  TipoAlcanceChecklist,
  TipoRecursoAcceso,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateUbicacionDto } from './dto/create-ubicacion.dto';
import { QueryItemsDto } from './dto/query-items.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { UpdateUbicacionDto } from './dto/update-ubicacion.dto';

@Injectable()
export class InventarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  // ── Categorías ───────────────────────────────────────────────────────────

  private async buscarCategoriaOFallar(id: string) {
    const categoria = await this.prisma.categoriaInventario.findUnique({
      where: { id },
    });
    if (!categoria) {
      throw new NotFoundException('Categoría no encontrada');
    }
    return categoria;
  }

  listarCategorias() {
    return this.prisma.categoriaInventario.findMany({
      orderBy: { nombre: 'asc' },
    });
  }

  async detalleCategoria(id: string) {
    return this.buscarCategoriaOFallar(id);
  }

  crearCategoria(dto: CreateCategoriaDto) {
    return this.prisma.categoriaInventario.create({
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });
  }

  async actualizarCategoria(id: string, dto: UpdateCategoriaDto) {
    await this.buscarCategoriaOFallar(id);
    return this.prisma.categoriaInventario.update({
      where: { id },
      data: { ...dto },
    });
  }

  async eliminarCategoria(id: string) {
    await this.buscarCategoriaOFallar(id);

    await this.prisma.$transaction([
      this.prisma.checklistTemplate.deleteMany({
        where: {
          alcanceTipo: TipoAlcanceChecklist.CATEGORIA_INVENTARIO,
          alcanceId: id,
        },
      }),
      this.prisma.categoriaInventario.delete({ where: { id } }),
    ]);
    await this.rbacService.limpiarRecurso(
      TipoRecursoAcceso.CATEGORIA_INVENTARIO,
      id,
    );

    return { message: 'Categoría eliminada correctamente' };
  }

  // ── Ubicaciones ──────────────────────────────────────────────────────────

  private async buscarUbicacionOFallar(id: string) {
    const ubicacion = await this.prisma.ubicacion.findUnique({
      where: { id },
    });
    if (!ubicacion) {
      throw new NotFoundException('Ubicación no encontrada');
    }
    return ubicacion;
  }

  listarUbicaciones() {
    return this.prisma.ubicacion.findMany({
      orderBy: { nombre: 'asc' },
    });
  }

  async detalleUbicacion(id: string) {
    return this.buscarUbicacionOFallar(id);
  }

  crearUbicacion(dto: CreateUbicacionDto) {
    return this.prisma.ubicacion.create({
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        carroId: dto.carroId,
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });
  }

  async actualizarUbicacion(id: string, dto: UpdateUbicacionDto) {
    await this.buscarUbicacionOFallar(id);
    return this.prisma.ubicacion.update({
      where: { id },
      data: { ...dto },
    });
  }

  async eliminarUbicacion(id: string) {
    await this.buscarUbicacionOFallar(id);

    await this.prisma.$transaction([
      this.prisma.checklistTemplate.deleteMany({
        where: {
          alcanceTipo: TipoAlcanceChecklist.UBICACION,
          alcanceId: id,
        },
      }),
      this.prisma.ubicacion.delete({ where: { id } }),
    ]);
    await this.rbacService.limpiarRecurso(TipoRecursoAcceso.UBICACION, id);

    return { message: 'Ubicación eliminada correctamente' };
  }

  // ── Items ────────────────────────────────────────────────────────────────

  private async buscarItemOFallar(id: string) {
    const item = await this.prisma.itemInventario.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }
    return item;
  }

  private async tieneAccesoItem(
    user: AuthenticatedUser,
    item: { categoriaId: string; ubicacionId: string },
    nivelMinimo: NivelAcceso,
  ): Promise<boolean> {
    const [porCategoria, porUbicacion] = await Promise.all([
      this.rbacService.tieneAcceso(
        user,
        TipoRecursoAcceso.CATEGORIA_INVENTARIO,
        item.categoriaId,
        nivelMinimo,
      ),
      this.rbacService.tieneAcceso(
        user,
        TipoRecursoAcceso.UBICACION,
        item.ubicacionId,
        nivelMinimo,
      ),
    ]);
    return porCategoria || porUbicacion;
  }

  async listar(user: AuthenticatedUser, query: QueryItemsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const busqueda = query.search?.trim();

    const [categoriaAcceso, ubicacionAcceso] = await Promise.all([
      this.rbacService.idsAccesibles(
        user,
        TipoRecursoAcceso.CATEGORIA_INVENTARIO,
        NivelAcceso.LEER,
      ),
      this.rbacService.idsAccesibles(
        user,
        TipoRecursoAcceso.UBICACION,
        NivelAcceso.LEER,
      ),
    ]);
    const irrestricto = categoriaAcceso.irrestricto || ubicacionAcceso.irrestricto;

    const filtros: Prisma.ItemInventarioWhereInput = {
      ...(query.categoriaId ? { categoriaId: query.categoriaId } : {}),
      ...(query.ubicacionId ? { ubicacionId: query.ubicacionId } : {}),
      ...(query.estado ? { estado: query.estado } : {}),
      ...(busqueda
        ? { nombre: { contains: busqueda, mode: 'insensitive' } }
        : {}),
    };

    const where: Prisma.ItemInventarioWhereInput = irrestricto
      ? filtros
      : {
          ...filtros,
          OR: [
            { categoriaId: { in: categoriaAcceso.ids } },
            { ubicacionId: { in: ubicacionAcceso.ids } },
          ],
        };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.itemInventario.count({ where }),
      this.prisma.itemInventario.findMany({
        where,
        orderBy: { nombre: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async detalle(user: AuthenticatedUser, id: string) {
    const item = await this.buscarItemOFallar(id);
    if (!(await this.tieneAccesoItem(user, item, NivelAcceso.LEER))) {
      throw new ForbiddenException('No tienes permisos para ver este item');
    }
    return item;
  }

  async crear(user: AuthenticatedUser, dto: CreateItemDto) {
    const categoria = await this.prisma.categoriaInventario.findUnique({
      where: { id: dto.categoriaId },
    });
    if (!categoria) {
      throw new NotFoundException('La categoría indicada no existe');
    }
    const ubicacion = await this.prisma.ubicacion.findUnique({
      where: { id: dto.ubicacionId },
    });
    if (!ubicacion) {
      throw new NotFoundException('La ubicación indicada no existe');
    }

    if (
      !(await this.tieneAccesoItem(
        user,
        { categoriaId: dto.categoriaId, ubicacionId: dto.ubicacionId },
        NivelAcceso.GESTIONAR,
      ))
    ) {
      throw new ForbiddenException(
        'No tienes permisos para crear items en esta categoría o ubicación',
      );
    }

    return this.prisma.itemInventario.create({
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        categoriaId: dto.categoriaId,
        ubicacionId: dto.ubicacionId,
        codigo: dto.codigo,
        ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
        ...(dto.cantidad !== undefined ? { cantidad: dto.cantidad } : {}),
      },
    });
  }

  async actualizar(user: AuthenticatedUser, id: string, dto: UpdateItemDto) {
    const item = await this.buscarItemOFallar(id);
    if (!(await this.tieneAccesoItem(user, item, NivelAcceso.GESTIONAR))) {
      throw new ForbiddenException(
        'No tienes permisos para actualizar este item',
      );
    }

    // Si el item se está reubicando (categoriaId/ubicacionId cambian), GESTIONAR
    // sobre el origen no basta: también se requiere GESTIONAR sobre el destino,
    // o un usuario podría mover un item hacia una categoría/ubicación que no
    // administra.
    if (dto.categoriaId !== undefined || dto.ubicacionId !== undefined) {
      const destino = {
        categoriaId: dto.categoriaId ?? item.categoriaId,
        ubicacionId: dto.ubicacionId ?? item.ubicacionId,
      };
      if (!(await this.tieneAccesoItem(user, destino, NivelAcceso.GESTIONAR))) {
        throw new ForbiddenException(
          'No tienes permisos para mover este item a la categoría o ubicación indicada',
        );
      }
    }

    return this.prisma.itemInventario.update({
      where: { id },
      data: { ...dto },
    });
  }

  async eliminar(user: AuthenticatedUser, id: string) {
    const item = await this.buscarItemOFallar(id);
    if (!(await this.tieneAccesoItem(user, item, NivelAcceso.GESTIONAR))) {
      throw new ForbiddenException(
        'No tienes permisos para eliminar este item',
      );
    }

    // Mismo cascade que eliminarCategoria()/eliminarUbicacion(): alcanceId no
    // tiene FK de BD, así que un ChecklistTemplate con alcanceTipo=ITEM_INVENTARIO
    // apuntando a este item quedaría huérfano si no se limpia explícitamente.
    // (A diferencia de categoría/ubicación, un item no puede recibir
    // Autorizacion directamente — TipoRecursoAcceso no tiene un valor
    // ITEM_INVENTARIO — así que no hay nada que limpiar en esa tabla aquí.)
    await this.prisma.$transaction([
      this.prisma.checklistTemplate.deleteMany({
        where: {
          alcanceTipo: TipoAlcanceChecklist.ITEM_INVENTARIO,
          alcanceId: id,
        },
      }),
      this.prisma.itemInventario.delete({ where: { id } }),
    ]);

    return { message: 'Item eliminado correctamente' };
  }
}
