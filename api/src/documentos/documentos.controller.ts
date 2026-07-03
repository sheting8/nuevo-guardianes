import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolSistema } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ConteoQueryDto } from './dto/conteo-query.dto';
import { LibroGuardiaQueryDto } from './dto/libro-guardia-query.dto';
import { DocumentosService } from './documentos.service';

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@ApiTags('documentos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolSistema.JEFE_GUARDIA, RolSistema.ADMIN)
@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Get('libro-guardia')
  async libroGuardia(
    @Query() query: LibroGuardiaQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.documentosService.libroGuardia(query.fecha);
    res.set({
      'Content-Type': DOCX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="libro-guardia-${query.fecha}.docx"`,
    });
    res.send(buffer);
  }

  @Get('conteo')
  async conteo(@Query() query: ConteoQueryDto, @Res() res: Response) {
    const buffer = await this.documentosService.conteo(query.citacionId);
    res.set({
      'Content-Type': DOCX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="conteo-${query.citacionId}.docx"`,
    });
    res.send(buffer);
  }
}
