import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolSistema } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateUbicacionDto } from './dto/create-ubicacion.dto';
import { QueryItemsDto } from './dto/query-items.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { UpdateUbicacionDto } from './dto/update-ubicacion.dto';
import { InventarioService } from './inventario.service';

@ApiTags('inventario')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventario')
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  // ── Categorías ───────────────────────────────────────────────────────────

  @Get('categorias')
  listarCategorias() {
    return this.inventarioService.listarCategorias();
  }

  @Get('categorias/:id')
  detalleCategoria(@Param('id') id: string) {
    return this.inventarioService.detalleCategoria(id);
  }

  @Post('categorias')
  @Roles(RolSistema.ADMIN)
  crearCategoria(@Body() dto: CreateCategoriaDto) {
    return this.inventarioService.crearCategoria(dto);
  }

  @Patch('categorias/:id')
  @Roles(RolSistema.ADMIN)
  actualizarCategoria(
    @Param('id') id: string,
    @Body() dto: UpdateCategoriaDto,
  ) {
    return this.inventarioService.actualizarCategoria(id, dto);
  }

  @Delete('categorias/:id')
  @Roles(RolSistema.ADMIN)
  eliminarCategoria(@Param('id') id: string) {
    return this.inventarioService.eliminarCategoria(id);
  }

  // ── Ubicaciones ──────────────────────────────────────────────────────────

  @Get('ubicaciones')
  listarUbicaciones() {
    return this.inventarioService.listarUbicaciones();
  }

  @Get('ubicaciones/:id')
  detalleUbicacion(@Param('id') id: string) {
    return this.inventarioService.detalleUbicacion(id);
  }

  @Post('ubicaciones')
  @Roles(RolSistema.ADMIN)
  crearUbicacion(@Body() dto: CreateUbicacionDto) {
    return this.inventarioService.crearUbicacion(dto);
  }

  @Patch('ubicaciones/:id')
  @Roles(RolSistema.ADMIN)
  actualizarUbicacion(
    @Param('id') id: string,
    @Body() dto: UpdateUbicacionDto,
  ) {
    return this.inventarioService.actualizarUbicacion(id, dto);
  }

  @Delete('ubicaciones/:id')
  @Roles(RolSistema.ADMIN)
  eliminarUbicacion(@Param('id') id: string) {
    return this.inventarioService.eliminarUbicacion(id);
  }

  // ── Items ────────────────────────────────────────────────────────────────

  @Get('items')
  listarItems(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryItemsDto,
  ) {
    return this.inventarioService.listar(user, query);
  }

  @Get('items/:id')
  detalleItem(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.inventarioService.detalle(user, id);
  }

  @Post('items')
  crearItem(
    @Body() dto: CreateItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventarioService.crear(user, dto);
  }

  @Patch('items/:id')
  actualizarItem(
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventarioService.actualizar(user, id, dto);
  }

  @Delete('items/:id')
  eliminarItem(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.inventarioService.eliminar(user, id);
  }
}
