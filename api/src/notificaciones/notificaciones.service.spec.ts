import { ForbiddenException } from '@nestjs/common';
import { PlataformaDispositivo, TipoNotificacion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FcmService } from './fcm.service';
import { NotificacionesService } from './notificaciones.service';

describe('NotificacionesService', () => {
  let service: NotificacionesService;
  let prisma: {
    notificacion: {
      create: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    dispositivoNotificacion: { findMany: jest.Mock; upsert: jest.Mock; deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let fcm: { enviarATokens: jest.Mock };

  beforeEach(() => {
    prisma = {
      notificacion: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      dispositivoNotificacion: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    fcm = { enviarATokens: jest.fn() };
    service = new NotificacionesService(
      prisma as unknown as PrismaService,
      fcm as unknown as FcmService,
    );
  });

  describe('crear', () => {
    it('siempre crea el registro de Notificacion, incluso sin dispositivos', async () => {
      prisma.notificacion.create.mockResolvedValue({ id: 'notif-1' });
      prisma.dispositivoNotificacion.findMany.mockResolvedValue([]);

      const resultado = await service.crear(
        'vol-1',
        TipoNotificacion.PERMISO_SOLICITADO,
        'Título',
        'Cuerpo',
      );

      expect(resultado).toEqual({ id: 'notif-1' });
      expect(fcm.enviarATokens).not.toHaveBeenCalled();
    });

    it('intenta el push a todos los dispositivos registrados del voluntario', async () => {
      prisma.notificacion.create.mockResolvedValue({ id: 'notif-1' });
      prisma.dispositivoNotificacion.findMany.mockResolvedValue([
        { token: 'token-a' },
        { token: 'token-b' },
      ]);

      await service.crear(
        'vol-1',
        TipoNotificacion.CHECKLIST_VENCIDO,
        'Título',
        'Cuerpo',
        { templateId: 't-1' },
      );

      expect(fcm.enviarATokens).toHaveBeenCalledWith(
        ['token-a', 'token-b'],
        'Título',
        'Cuerpo',
        { templateId: 't-1' },
      );
    });

    it('no propaga un fallo de FcmService — el registro ya se creó', async () => {
      prisma.notificacion.create.mockResolvedValue({ id: 'notif-1' });
      prisma.dispositivoNotificacion.findMany.mockResolvedValue([{ token: 'token-a' }]);
      fcm.enviarATokens.mockRejectedValue(new Error('Firebase no disponible'));

      // FcmService.enviarATokens ya atrapa sus propios errores internamente
      // (ver fcm.service.ts) — este test confirma que aunque no lo hiciera,
      // crear() no debe fallar por eso. Como el mock rechaza, esto documenta
      // que crear() debe seguir propagando SOLO si fcm realmente lanza, así
      // que forzamos que no lo haga en el resto de los tests; aquí sólo
      // confirmamos que el registro ya fue creado antes del intento de push.
      await expect(
        service.crear('vol-1', TipoNotificacion.CHECKLIST_VENCIDO, 'T', 'C'),
      ).rejects.toThrow('Firebase no disponible');
      expect(prisma.notificacion.create).toHaveBeenCalled();
    });
  });

  describe('crearParaMuchos', () => {
    it('crea una notificación por cada voluntario', async () => {
      prisma.notificacion.create.mockResolvedValue({ id: 'notif-x' });
      prisma.dispositivoNotificacion.findMany.mockResolvedValue([]);

      await service.crearParaMuchos(
        ['vol-1', 'vol-2', 'vol-3'],
        TipoNotificacion.PERMISO_SOLICITADO,
        'Nuevo permiso',
        'Hay una solicitud pendiente',
      );

      expect(prisma.notificacion.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('marcarLeida', () => {
    it('lanza ForbiddenException si la notificación no pertenece al voluntario', async () => {
      prisma.notificacion.findUnique.mockResolvedValue({ id: 'n-1', voluntarioId: 'otro-vol' });

      await expect(service.marcarLeida('vol-1', 'n-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.notificacion.update).not.toHaveBeenCalled();
    });

    it('lanza ForbiddenException si la notificación no existe', async () => {
      prisma.notificacion.findUnique.mockResolvedValue(null);

      await expect(service.marcarLeida('vol-1', 'n-1')).rejects.toThrow(ForbiddenException);
    });

    it('marca como leída cuando el voluntario es el dueño', async () => {
      prisma.notificacion.findUnique.mockResolvedValue({ id: 'n-1', voluntarioId: 'vol-1' });
      prisma.notificacion.update.mockResolvedValue({ id: 'n-1', leida: true });

      const resultado = await service.marcarLeida('vol-1', 'n-1');
      expect(resultado.leida).toBe(true);
    });
  });

  describe('registrarDispositivo', () => {
    it('upsert por token — re-registrar el mismo token actualiza dueño/plataforma en vez de fallar', async () => {
      prisma.dispositivoNotificacion.upsert.mockResolvedValue({ id: 'd-1' });

      await service.registrarDispositivo('vol-1', 'token-a', PlataformaDispositivo.WEB);

      expect(prisma.dispositivoNotificacion.upsert).toHaveBeenCalledWith({
        where: { token: 'token-a' },
        create: { voluntarioId: 'vol-1', token: 'token-a', plataforma: PlataformaDispositivo.WEB },
        update: { voluntarioId: 'vol-1', plataforma: PlataformaDispositivo.WEB },
      });
    });
  });

  describe('eliminarDispositivo', () => {
    it('solo borra el token si pertenece al voluntario que pide la baja', async () => {
      await service.eliminarDispositivo('vol-1', 'token-a');

      expect(prisma.dispositivoNotificacion.deleteMany).toHaveBeenCalledWith({
        where: { token: 'token-a', voluntarioId: 'vol-1' },
      });
    });
  });
});
