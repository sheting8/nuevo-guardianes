import { EstadoPermiso, RolSistema, TipoNotificacion, TipoPermiso } from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermisosService } from './permisos.service';

describe('PermisosService — notificaciones', () => {
  let service: PermisosService;
  let prisma: {
    voluntario: { findUnique: jest.Mock };
    voluntarioRol: { findMany: jest.Mock };
    permiso: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    citacion: { findFirst: jest.Mock };
  };
  let notificaciones: { crear: jest.Mock; crearParaMuchos: jest.Mock };

  const solicitante = {
    id: 'vol-1',
    nombres: 'Ana',
    apellidoP: 'Pérez',
    correlativo: 1,
    tipo: 'QUINCE',
  };

  beforeEach(() => {
    prisma = {
      voluntario: { findUnique: jest.fn() },
      voluntarioRol: { findMany: jest.fn() },
      permiso: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      citacion: { findFirst: jest.fn() },
    };
    notificaciones = { crear: jest.fn(), crearParaMuchos: jest.fn() };

    service = new PermisosService(
      prisma as unknown as PrismaService,
      notificaciones as unknown as NotificacionesService,
    );
  });

  describe('crear', () => {
    const dto = { tipo: TipoPermiso.PERMISO, fechaGuardia: '2026-08-01' };

    beforeEach(() => {
      prisma.voluntario.findUnique.mockResolvedValue(solicitante);
      prisma.citacion.findFirst.mockResolvedValue({ id: 'cit-1' });
      prisma.permiso.findFirst.mockResolvedValue(null);
      prisma.permiso.create.mockResolvedValue({
        id: 'permiso-1',
        solicitanteId: 'vol-1',
        solicitante,
        tipo: TipoPermiso.PERMISO,
        fechaGuardia: new Date('2026-08-01T00:00:00.000Z'),
      });
    });

    it('notifica a todos los voluntarios con rol JEFE_GUARDIA o ADMIN', async () => {
      prisma.voluntarioRol.findMany.mockResolvedValue([
        { voluntarioId: 'jefe-1' },
        { voluntarioId: 'admin-1' },
      ]);

      await service.crear(dto, 'user-1');

      expect(prisma.voluntarioRol.findMany).toHaveBeenCalledWith({
        where: { rol: { in: [RolSistema.JEFE_GUARDIA, RolSistema.ADMIN] } },
        select: { voluntarioId: true },
      });
      expect(notificaciones.crearParaMuchos).toHaveBeenCalledWith(
        ['jefe-1', 'admin-1'],
        TipoNotificacion.PERMISO_SOLICITADO,
        expect.any(String),
        expect.any(String),
        { permisoId: 'permiso-1' },
      );
    });

    it('un fallo al notificar no impide que el permiso se cree igual', async () => {
      prisma.voluntarioRol.findMany.mockResolvedValue([{ voluntarioId: 'jefe-1' }]);
      notificaciones.crearParaMuchos.mockRejectedValue(new Error('Firebase caído'));

      const resultado = await service.crear(dto, 'user-1');
      expect(resultado.id).toBe('permiso-1');
    });
  });

  describe('actualizarEstado', () => {
    it('notifica al solicitante cuando se aprueba', async () => {
      prisma.permiso.findUnique.mockResolvedValue({
        id: 'permiso-1',
        estado: EstadoPermiso.PENDIENTE,
      });
      prisma.permiso.update.mockResolvedValue({
        id: 'permiso-1',
        solicitanteId: 'vol-1',
        tipo: TipoPermiso.PERMISO,
        fechaGuardia: new Date('2026-08-01T00:00:00.000Z'),
        estado: EstadoPermiso.APROBADO,
      });

      await service.actualizarEstado('permiso-1', { estado: EstadoPermiso.APROBADO });

      expect(notificaciones.crear).toHaveBeenCalledWith(
        'vol-1',
        TipoNotificacion.PERMISO_APROBADO,
        expect.any(String),
        expect.any(String),
        { permisoId: 'permiso-1' },
      );
    });

    it('notifica al solicitante cuando se rechaza', async () => {
      prisma.permiso.findUnique.mockResolvedValue({
        id: 'permiso-1',
        estado: EstadoPermiso.PENDIENTE,
      });
      prisma.permiso.update.mockResolvedValue({
        id: 'permiso-1',
        solicitanteId: 'vol-1',
        tipo: TipoPermiso.PERMISO,
        fechaGuardia: new Date('2026-08-01T00:00:00.000Z'),
        estado: EstadoPermiso.RECHAZADO,
      });

      await service.actualizarEstado('permiso-1', { estado: EstadoPermiso.RECHAZADO });

      expect(notificaciones.crear).toHaveBeenCalledWith(
        'vol-1',
        TipoNotificacion.PERMISO_RECHAZADO,
        expect.any(String),
        expect.any(String),
        { permisoId: 'permiso-1' },
      );
    });

    it('un fallo al notificar no impide que la actualización se retorne igual', async () => {
      prisma.permiso.findUnique.mockResolvedValue({
        id: 'permiso-1',
        estado: EstadoPermiso.PENDIENTE,
      });
      prisma.permiso.update.mockResolvedValue({
        id: 'permiso-1',
        solicitanteId: 'vol-1',
        tipo: TipoPermiso.PERMISO,
        fechaGuardia: new Date('2026-08-01T00:00:00.000Z'),
        estado: EstadoPermiso.APROBADO,
      });
      notificaciones.crear.mockRejectedValue(new Error('Firebase caído'));

      const resultado = await service.actualizarEstado('permiso-1', {
        estado: EstadoPermiso.APROBADO,
      });
      expect(resultado.id).toBe('permiso-1');
    });
  });
});
