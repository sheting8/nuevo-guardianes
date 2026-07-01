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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CuartelerosService } from './cuarteleros.service';
import { CreateCuarteleroDto } from './dto/create-cuartelero.dto';
import { QueryCuarteleroDto } from './dto/query-cuarteleros.dto';
import { UpdateCuarteleroDto } from './dto/update-cuartelero.dto';

@ApiTags('cuarteleros')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cuarteleros')
export class CuartelerosController {
  constructor(private readonly cuartelerosService: CuartelerosService) {}

  @Get()
  listar(@Query() query: QueryCuarteleroDto) {
    return this.cuartelerosService.listar(query);
  }

  @Get(':id')
  detalle(@Param('id') id: string) {
    return this.cuartelerosService.detalle(id);
  }

  @Post()
  @Roles(RolSistema.ADMIN)
  crear(@Body() dto: CreateCuarteleroDto) {
    return this.cuartelerosService.crear(dto);
  }

  @Patch(':id')
  @Roles(RolSistema.ADMIN)
  actualizar(@Param('id') id: string, @Body() dto: UpdateCuarteleroDto) {
    return this.cuartelerosService.actualizar(id, dto);
  }

  @Delete(':id')
  @Roles(RolSistema.ADMIN)
  eliminar(@Param('id') id: string) {
    return this.cuartelerosService.eliminar(id);
  }
}
