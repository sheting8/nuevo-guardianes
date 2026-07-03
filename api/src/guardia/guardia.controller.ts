import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolSistema } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AsignarConductoresDto } from './dto/asignar-conductores.dto';
import { AsignarJgsDto } from './dto/asignar-jgs.dto';
import { AsignarMensajeroDto } from './dto/asignar-mensajero.dto';
import { GuardiaService } from './guardia.service';

@ApiTags('guardia')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolSistema.JEFE_GUARDIA, RolSistema.ADMIN)
@Controller('guardia')
export class GuardiaController {
  constructor(private readonly guardiaService: GuardiaService) {}

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
