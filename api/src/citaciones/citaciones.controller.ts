import {
  Body,
  Controller,
  Get,
  Param,
  ParseArrayPipe,
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
import { CitacionesService } from './citaciones.service';
import { CamaAsignacionDto } from './dto/cama-asignacion.dto';
import { CreateCitacionDto } from './dto/create-citacion.dto';
import { PanelCitacionDto } from './dto/panel-citacion.dto';
import { QueryCitacionesDto } from './dto/query-citaciones.dto';

@ApiTags('citaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('citaciones')
export class CitacionesController {
  constructor(private readonly citacionesService: CitacionesService) {}

  @Get('panel')
  panel(@Query() query: PanelCitacionDto) {
    return this.citacionesService.panel(query.fecha);
  }

  @Get()
  listar(@Query() query: QueryCitacionesDto) {
    return this.citacionesService.listar(query);
  }

  @Post()
  @Roles(RolSistema.JEFE_GUARDIA, RolSistema.ADMIN)
  crear(@Body() dto: CreateCitacionDto) {
    return this.citacionesService.crear(dto);
  }

  @Patch(':id/camas')
  @Roles(RolSistema.JEFE_GUARDIA, RolSistema.ADMIN)
  actualizarCamas(
    @Param('id') id: string,
    @Body(new ParseArrayPipe({ items: CamaAsignacionDto }))
    camas: CamaAsignacionDto[],
  ) {
    return this.citacionesService.actualizarCamas(id, camas);
  }
}
