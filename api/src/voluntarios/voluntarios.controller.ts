import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { RolSistema } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NochesService } from '../noches/noches.service';
import { CreateVoluntarioDto } from './dto/create-voluntario.dto';
import { QueryHistorialDto } from './dto/query-historial.dto';
import { QueryVoluntariosDto } from './dto/query-voluntarios.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { UpdateVoluntarioDto } from './dto/update-voluntario.dto';
import { ImportarVoluntariosService } from './importar-voluntarios.service';
import { VoluntariosService } from './voluntarios.service';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('voluntarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('voluntarios')
export class VoluntariosController {
  constructor(
    private readonly voluntariosService: VoluntariosService,
    private readonly nochesService: NochesService,
    private readonly importarVoluntariosService: ImportarVoluntariosService,
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

  @Patch(':id/eliminar')
  @Roles(RolSistema.ADMIN)
  eliminar(@Param('id') id: string) {
    return this.voluntariosService.eliminar(id);
  }

  @Patch(':id/roles')
  @Roles(RolSistema.ADMIN)
  actualizarRoles(@Param('id') id: string, @Body() dto: UpdateRolesDto) {
    return this.voluntariosService.actualizarRoles(id, dto);
  }

  @Get('importar/plantilla')
  @Roles(RolSistema.ADMIN)
  plantillaImportacion(@Res() res: Response) {
    const buffer = this.importarVoluntariosService.generarPlantilla();
    res.set({
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition':
        'attachment; filename="plantilla-voluntarios.xlsx"',
    });
    res.send(buffer);
  }

  @Post('importar')
  @Roles(RolSistema.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importar(@UploadedFile() file: Express.Multer.File) {
    return this.importarVoluntariosService.importar(file);
  }
}
