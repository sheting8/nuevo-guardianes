import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolSistema } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTurnoDto } from './dto/create-turno.dto';
import { UpdateTurnoDto } from './dto/update-turno.dto';
import { TurnosService } from './turnos.service';

@ApiTags('turnos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('turnos')
export class TurnosController {
  constructor(private readonly turnosService: TurnosService) {}

  @Get()
  listar() {
    return this.turnosService.listar();
  }

  @Post()
  @Roles(RolSistema.JEFE_GUARDIA, RolSistema.ADMIN)
  crear(@Body() dto: CreateTurnoDto) {
    return this.turnosService.crear(dto);
  }

  @Patch(':id')
  @Roles(RolSistema.JEFE_GUARDIA, RolSistema.ADMIN)
  actualizar(@Param('id') id: string, @Body() dto: UpdateTurnoDto) {
    return this.turnosService.actualizar(id, dto);
  }

  @Delete(':id')
  @Roles(RolSistema.JEFE_GUARDIA, RolSistema.ADMIN)
  eliminar(@Param('id') id: string) {
    return this.turnosService.eliminar(id);
  }
}
