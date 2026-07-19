import { ForbiddenException, Injectable } from '@nestjs/common';
import { PlataformaDispositivo, Prisma, TipoNotificacion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FcmService } from './fcm.service';
import { QueryNotificacionesDto } from './dto/query-notificaciones.dto';

@Injectable()
export class NotificacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmService,
  ) {}

  /**
   * Crea el registro (siempre) e intenta el push (best-effort) a todos los
   * dispositivos registrados del voluntario. Un fallo de push (token muerto,
   * Firebase no configurado) nunca debe tumbar la acción que disparó la
   * notificación — por eso esto no propaga errores de FcmService.
   */
  async crear(
    voluntarioId: string,
    tipo: TipoNotificacion,
    titulo: string,
    cuerpo: string,
    datos?: Record<string, unknown>,
  ) {
    const notificacion = await this.prisma.notificacion.create({
      data: {
        voluntarioId,
        tipo,
        titulo,
        cuerpo,
        datos: datos as Prisma.InputJsonValue,
      },
    });

    const dispositivos = await this.prisma.dispositivoNotificacion.findMany({
      where: { voluntarioId },
      select: { token: true },
    });

    if (dispositivos.length > 0) {
      const datosString = datos
        ? Object.fromEntries(
            Object.entries(datos).map(([clave, valor]) => [clave, String(valor)]),
          )
        : undefined;
      await this.fcmService.enviarATokens(
        dispositivos.map((d) => d.token),
        titulo,
        cuerpo,
        datosString,
      );
    }

    return notificacion;
  }

  async crearParaMuchos(
    voluntarioIds: string[],
    tipo: TipoNotificacion,
    titulo: string,
    cuerpo: string,
    datos?: Record<string, unknown>,
  ): Promise<void> {
    await Promise.all(
      voluntarioIds.map((id) => this.crear(id, tipo, titulo, cuerpo, datos)),
    );
  }

  async listar(voluntarioId: string, query: QueryNotificacionesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.NotificacionWhereInput = {
      voluntarioId,
      ...(query.leida !== undefined ? { leida: query.leida } : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.notificacion.count({ where }),
      this.prisma.notificacion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async marcarLeida(voluntarioId: string, id: string) {
    const notificacion = await this.prisma.notificacion.findUnique({ where: { id } });
    if (!notificacion || notificacion.voluntarioId !== voluntarioId) {
      throw new ForbiddenException('No tienes acceso a esta notificación');
    }
    return this.prisma.notificacion.update({
      where: { id },
      data: { leida: true },
    });
  }

  async marcarTodasLeidas(voluntarioId: string) {
    await this.prisma.notificacion.updateMany({
      where: { voluntarioId, leida: false },
      data: { leida: true },
    });
    return { message: 'Notificaciones marcadas como leídas' };
  }

  async registrarDispositivo(
    voluntarioId: string,
    token: string,
    plataforma: PlataformaDispositivo,
  ) {
    return this.prisma.dispositivoNotificacion.upsert({
      where: { token },
      create: { voluntarioId, token, plataforma },
      update: { voluntarioId, plataforma },
    });
  }

  async eliminarDispositivo(voluntarioId: string, token: string): Promise<void> {
    await this.prisma.dispositivoNotificacion.deleteMany({
      where: { token, voluntarioId },
    });
  }
}
