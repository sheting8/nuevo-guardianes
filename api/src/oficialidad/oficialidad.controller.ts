import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolSistema } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateOficialidadDto } from './dto/create-oficialidad.dto';
import { OficialidadService } from './oficialidad.service';

@ApiTags('oficialidad')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('oficialidad')
export class OficialidadController {
  constructor(private readonly oficialidadService: OficialidadService) {}

  @Get()
  listar() {
    return this.oficialidadService.listar();
  }

  @Post()
  @Roles(RolSistema.ADMIN)
  crear(@Body() dto: CreateOficialidadDto) {
    return this.oficialidadService.crear(dto);
  }

  @Delete(':id')
  @Roles(RolSistema.ADMIN)
  eliminar(@Param('id') id: string) {
    return this.oficialidadService.eliminar(id);
  }
}
