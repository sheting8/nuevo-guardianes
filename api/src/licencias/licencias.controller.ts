import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolSistema } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateLicenciaDto } from './dto/create-licencia.dto';
import { QueryLicenciasDto } from './dto/query-licencias.dto';
import { LicenciasService } from './licencias.service';

@ApiTags('licencias')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolSistema.JEFE_GUARDIA, RolSistema.ADMIN)
@Controller('licencias')
export class LicenciasController {
  constructor(private readonly licenciasService: LicenciasService) {}

  @Get()
  listar(@Query() query: QueryLicenciasDto) {
    return this.licenciasService.listar(query);
  }

  @Post()
  crear(@Body() dto: CreateLicenciaDto) {
    return this.licenciasService.crear(dto);
  }

  @Delete(':id')
  eliminar(@Param('id') id: string) {
    return this.licenciasService.eliminar(id);
  }
}
