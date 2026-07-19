import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolSistema } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateAutorizacionDto } from './dto/create-autorizacion.dto';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { RbacService } from './rbac.service';

// Solo ADMIN gestiona grupos/autorizaciones — es el único rol que necesita
// esta pantalla; todo lo demás (leer/gestionar inventario y checklists) se
// resuelve vía Autorizacion, no vía este controller.
@ApiTags('rbac')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN)
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('grupos')
  listarGrupos() {
    return this.rbacService.listarGrupos();
  }

  @Post('grupos')
  crearGrupo(@Body() dto: CreateGrupoDto) {
    return this.rbacService.crearGrupo(dto);
  }

  @Post('grupos/:id/miembros/:voluntarioId')
  agregarMiembro(
    @Param('id') id: string,
    @Param('voluntarioId') voluntarioId: string,
  ) {
    return this.rbacService.agregarMiembro(id, voluntarioId);
  }

  @Delete('grupos/:id/miembros/:voluntarioId')
  quitarMiembro(
    @Param('id') id: string,
    @Param('voluntarioId') voluntarioId: string,
  ) {
    return this.rbacService.quitarMiembro(id, voluntarioId);
  }

  @Get('autorizaciones')
  listarAutorizaciones() {
    return this.rbacService.listarAutorizaciones();
  }

  @Post('autorizaciones')
  crearAutorizacion(@Body() dto: CreateAutorizacionDto) {
    return this.rbacService.crearAutorizacion(dto);
  }

  @Delete('autorizaciones/:id')
  revocarAutorizacion(@Param('id') id: string) {
    return this.rbacService.revocarAutorizacion(id);
  }
}
