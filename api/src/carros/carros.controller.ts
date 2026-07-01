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
import { CarrosService } from './carros.service';
import { AsignarCuartelerosDto } from './dto/asignar-cuarteleros.dto';
import { AsignarVoluntariosDto } from './dto/asignar-voluntarios.dto';
import { CreateCarroDto } from './dto/create-carro.dto';
import { UpdateCarroDto } from './dto/update-carro.dto';

@ApiTags('carros')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('carros')
export class CarrosController {
  constructor(private readonly carrosService: CarrosService) {}

  @Get()
  listar() {
    return this.carrosService.listar();
  }

  @Get(':id')
  detalle(@Param('id') id: string) {
    return this.carrosService.detalle(id);
  }

  @Post()
  @Roles(RolSistema.ADMIN)
  crear(@Body() dto: CreateCarroDto) {
    return this.carrosService.crear(dto);
  }

  @Patch(':id')
  @Roles(RolSistema.ADMIN)
  actualizar(@Param('id') id: string, @Body() dto: UpdateCarroDto) {
    return this.carrosService.actualizar(id, dto);
  }

  @Delete(':id')
  @Roles(RolSistema.ADMIN)
  eliminar(@Param('id') id: string) {
    return this.carrosService.eliminar(id);
  }

  @Post(':id/voluntarios')
  @Roles(RolSistema.ADMIN)
  asignarVoluntarios(
    @Param('id') id: string,
    @Body() dto: AsignarVoluntariosDto,
  ) {
    return this.carrosService.asignarVoluntarios(id, dto);
  }

  @Post(':id/cuarteleros')
  @Roles(RolSistema.ADMIN)
  asignarCuarteleros(
    @Param('id') id: string,
    @Body() dto: AsignarCuartelerosDto,
  ) {
    return this.carrosService.asignarCuarteleros(id, dto);
  }

  @Delete(':id/voluntarios/:voluntarioId')
  @Roles(RolSistema.ADMIN)
  quitarVoluntario(
    @Param('id') id: string,
    @Param('voluntarioId') voluntarioId: string,
  ) {
    return this.carrosService.quitarVoluntario(id, voluntarioId);
  }
}
