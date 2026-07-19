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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { ChecklistsService } from './checklists.service';
import { CreateChecklistTemplateDto } from './dto/create-checklist-template.dto';
import { CreateEjecucionDto } from './dto/create-ejecucion.dto';
import { QueryEjecucionesDto } from './dto/query-ejecuciones.dto';
import { QueryTemplatesDto } from './dto/query-templates.dto';
import { UpdateChecklistTemplateDto } from './dto/update-checklist-template.dto';

// El control de acceso fino (LEER/GESTIONAR por alcance u OR con un grant
// directo CHECKLIST_TEMPLATE) se resuelve en el service, no con @Roles —
// mismo motivo que en inventario/items: el nivel requerido depende del
// alcance del recurso, no de un rol fijo.
@ApiTags('checklists')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('checklists')
export class ChecklistsController {
  constructor(private readonly checklistsService: ChecklistsService) {}

  @Get('templates')
  listarTemplates(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryTemplatesDto,
  ) {
    return this.checklistsService.listar(user, query);
  }

  @Post('templates')
  crearTemplate(
    @Body() dto: CreateChecklistTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checklistsService.crearTemplate(user, dto);
  }

  @Patch('templates/:id')
  actualizarTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateChecklistTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checklistsService.actualizar(user, id, dto);
  }

  @Delete('templates/:id')
  eliminarTemplate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checklistsService.eliminar(user, id);
  }

  @Post('templates/:id/ejecuciones')
  ejecutar(
    @Param('id') id: string,
    @Body() dto: CreateEjecucionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checklistsService.ejecutar(user, id, dto);
  }

  @Get('templates/:id/ejecuciones')
  historial(
    @Param('id') id: string,
    @Query() query: QueryEjecucionesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checklistsService.historial(user, id, query);
  }
}
