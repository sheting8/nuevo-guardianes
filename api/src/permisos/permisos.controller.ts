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
import { CreatePermisoDto } from './dto/create-permiso.dto';
import { QueryPermisosDto } from './dto/query-permisos.dto';
import { UpdatePermisoEstadoDto } from './dto/update-permiso-estado.dto';
import { PermisosService } from './permisos.service';

@ApiTags('permisos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('permisos')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Post()
  @Roles(RolSistema.ADMIN, RolSistema.JEFE_GUARDIA, RolSistema.GUARDIAN)
  crear(@Body() dto: CreatePermisoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.permisosService.crear(dto, user.sub);
  }

  @Get('mis')
  listarMias(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryPermisosDto,
  ) {
    return this.permisosService.listarMias(user.sub, query);
  }

  @Get()
  @Roles(RolSistema.JEFE_GUARDIA, RolSistema.ADMIN)
  listarTodos(@Query() query: QueryPermisosDto) {
    return this.permisosService.listarTodos(query);
  }

  @Patch(':id')
  @Roles(RolSistema.JEFE_GUARDIA, RolSistema.ADMIN)
  actualizarEstado(
    @Param('id') id: string,
    @Body() dto: UpdatePermisoEstadoDto,
  ) {
    return this.permisosService.actualizarEstado(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.permisosService.eliminar(id, user);
  }
}
