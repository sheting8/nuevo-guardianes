import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { PrismaService } from '../prisma/prisma.service';
import { QueryNotificacionesDto } from './dto/query-notificaciones.dto';
import { RegistrarDispositivoDto } from './dto/registrar-dispositivo.dto';
import { NotificacionesService } from './notificaciones.service';

@ApiTags('notificaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly notificacionesService: NotificacionesService,
    private readonly prisma: PrismaService,
  ) {}

  // Igual patrón que permisos.service.ts/rbac.service.ts: user.sub es el
  // User.id del JWT, Notificacion.voluntarioId requiere el Voluntario.id.
  private async voluntarioIdDeUsuario(userId: string): Promise<string> {
    const voluntario = await this.prisma.voluntario.findUnique({
      where: { userId },
    });
    if (!voluntario) {
      throw new ForbiddenException(
        'El usuario autenticado no tiene un voluntario asociado',
      );
    }
    return voluntario.id;
  }

  @Get()
  async listar(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryNotificacionesDto,
  ) {
    const voluntarioId = await this.voluntarioIdDeUsuario(user.sub);
    return this.notificacionesService.listar(voluntarioId, query);
  }

  @Patch(':id/leer')
  async marcarLeida(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const voluntarioId = await this.voluntarioIdDeUsuario(user.sub);
    return this.notificacionesService.marcarLeida(voluntarioId, id);
  }

  @Patch('leer-todas')
  async marcarTodasLeidas(@CurrentUser() user: AuthenticatedUser) {
    const voluntarioId = await this.voluntarioIdDeUsuario(user.sub);
    return this.notificacionesService.marcarTodasLeidas(voluntarioId);
  }

  @Post('dispositivos')
  async registrarDispositivo(
    @Body() dto: RegistrarDispositivoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const voluntarioId = await this.voluntarioIdDeUsuario(user.sub);
    return this.notificacionesService.registrarDispositivo(
      voluntarioId,
      dto.token,
      dto.plataforma,
    );
  }

  @Delete('dispositivos/:token')
  async eliminarDispositivo(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const voluntarioId = await this.voluntarioIdDeUsuario(user.sub);
    await this.notificacionesService.eliminarDispositivo(voluntarioId, token);
    return { message: 'Dispositivo eliminado' };
  }
}
