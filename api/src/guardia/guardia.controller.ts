import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolSistema } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AsignarConductoresDto } from './dto/asignar-conductores.dto';
import { AsignarJgsDto } from './dto/asignar-jgs.dto';
import { AsignarMensajeroDto } from './dto/asignar-mensajero.dto';
import { GuardiaFechaQueryDto } from './dto/guardia-fecha-query.dto';
import { GuardiaService } from './guardia.service';

@ApiTags('guardia')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolSistema.JEFE_GUARDIA, RolSistema.ADMIN)
@Controller('guardia')
export class GuardiaController {
  constructor(private readonly guardiaService: GuardiaService) {}

  @Get()
  @Roles()
  obtener(@Query() query: GuardiaFechaQueryDto) {
    return this.guardiaService.obtenerPorFecha(query.fecha);
  }

  @Put('mensajero')
  asignarMensajero(@Body() dto: AsignarMensajeroDto) {
    return this.guardiaService.asignarMensajero(dto);
  }

  @Put('conductores')
  asignarConductores(@Body() dto: AsignarConductoresDto) {
    return this.guardiaService.asignarConductores(dto);
  }

  @Put('jgs')
  asignarJgs(@Body() dto: AsignarJgsDto) {
    return this.guardiaService.asignarJgs(dto);
  }
}
