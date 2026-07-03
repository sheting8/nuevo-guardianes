import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolSistema } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NochesService } from '../noches/noches.service';
import { QueryEstadisticasDto } from './dto/query-estadisticas.dto';

@ApiTags('estadisticas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolSistema.JEFE_GUARDIA, RolSistema.ADMIN)
@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly nochesService: NochesService) {}

  @Get('noches')
  noches(@Query() query: QueryEstadisticasDto) {
    return this.nochesService.calcularEstadisticas(
      query.desde,
      query.hasta,
      query.voluntarioId,
    );
  }
}
