import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolSistema } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NochesService } from '../noches/noches.service';
import { CreateVoluntarioDto } from './dto/create-voluntario.dto';
import { QueryHistorialDto } from './dto/query-historial.dto';
import { QueryVoluntariosDto } from './dto/query-voluntarios.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { UpdateVoluntarioDto } from './dto/update-voluntario.dto';
import { VoluntariosService } from './voluntarios.service';

@ApiTags('voluntarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('voluntarios')
export class VoluntariosController {
  constructor(
    private readonly voluntariosService: VoluntariosService,
    private readonly nochesService: NochesService,
  ) {}

  @Get()
  listar(@Query() query: QueryVoluntariosDto) {
    return this.voluntariosService.listar(query);
  }

  @Get(':id')
  detalle(@Param('id') id: string) {
    return this.voluntariosService.detalle(id);
  }

  @Get(':id/historial')
  @Roles(RolSistema.JEFE_GUARDIA, RolSistema.ADMIN)
  historial(@Param('id') id: string, @Query() query: QueryHistorialDto) {
    return this.nochesService.calcularHistorial(id, query.desde, query.hasta);
  }

  @Post()
  @Roles(RolSistema.ADMIN)
  crear(@Body() dto: CreateVoluntarioDto) {
    return this.voluntariosService.crear(dto);
  }

  @Patch(':id')
  @Roles(RolSistema.ADMIN)
  actualizar(@Param('id') id: string, @Body() dto: UpdateVoluntarioDto) {
    return this.voluntariosService.actualizar(id, dto);
  }

  @Patch(':id/desactivar')
  @Roles(RolSistema.ADMIN)
  desactivar(@Param('id') id: string) {
    return this.voluntariosService.desactivar(id);
  }

  @Patch(':id/roles')
  @Roles(RolSistema.ADMIN)
  actualizarRoles(@Param('id') id: string, @Body() dto: UpdateRolesDto) {
    return this.voluntariosService.actualizarRoles(id, dto);
  }
}
