import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstadoPermiso, TipoPermiso } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NochesService } from './noches.service';

type PrismaMock = {
  correccionNoche: { findMany: jest.Mock };
  permiso: { findMany: jest.Mock };
  licencia: { findMany: jest.Mock };
  citacion: { findMany: jest.Mock; findUnique: jest.Mock };
  voluntario: { findUnique: jest.Mock; findMany: jest.Mock };
};

const fecha = (s: string): Date => new Date(`${s}T00:00:00.000Z`);

const voluntarioResumen = (id: string, correlativo = 1) => ({
  id,
  nombres: 'Nombre',
  apellidoP: 'Apellido',
  correlativo,
  tipo: 'QUINCE',
});

describe('NochesService', () => {
  let service: NochesService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      correccionNoche: { findMany: jest.fn() },
      permiso: { findMany: jest.fn() },
      licencia: { findMany: jest.fn() },
      citacion: { findMany: jest.fn(), findUnique: jest.fn() },
      voluntario: { findUnique: jest.fn(), findMany: jest.fn() },
    };

    // Por defecto ninguno de los contextos aporta datos.
    prisma.correccionNoche.findMany.mockResolvedValue([]);
    prisma.permiso.findMany.mockResolvedValue([]);
    prisma.licencia.findMany.mockResolvedValue([]);
    prisma.citacion.findMany.mockResolvedValue([]);

    service = new NochesService(prisma as unknown as PrismaService);
  });

  describe('calcularHistorial', () => {
    it('lanza NotFoundException si el voluntario no existe', async () => {
      prisma.voluntario.findUnique.mockResolvedValue(null);

      await expect(
        service.calcularHistorial('vol-x', '2026-07-01', '2026-07-01'),
      ).rejects.toThrow(new NotFoundException('Voluntario no encontrado'));
    });

    it('lanza BadRequestException si hasta < desde', async () => {
      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-1' });

      await expect(
        service.calcularHistorial('vol-1', '2026-07-05', '2026-07-01'),
      ).rejects.toThrow(BadRequestException);
    });

    it('override con durmio=true gana sobre licencia, permiso y citación el mismo día', async () => {
      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-1' });
      prisma.correccionNoche.findMany.mockResolvedValue([
        { voluntarioId: 'vol-1', fecha: fecha('2026-07-01'), durmio: true },
      ]);
      prisma.licencia.findMany.mockResolvedValue([
        { voluntarioId: 'vol-1', fecha: fecha('2026-07-01') },
      ]);
      prisma.permiso.findMany.mockResolvedValue([
        {
          solicitanteId: 'vol-1',
          tipo: TipoPermiso.PERMISO_ESPECIAL,
          reemplazanteId: null,
          fechaGuardia: fecha('2026-07-01'),
        },
      ]);

      const { detalle } = await service.calcularHistorial(
        'vol-1',
        '2026-07-01',
        '2026-07-01',
      );

      expect(detalle).toEqual([
        { fecha: '2026-07-01', durmio: true, estado: 'OVERRIDE', fuente: 'OVERRIDE' },
      ]);
    });

    it('override con durmio=false gana sobre una citación (cama asignada)', async () => {
      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-1' });
      prisma.correccionNoche.findMany.mockResolvedValue([
        { voluntarioId: 'vol-1', fecha: fecha('2026-07-01'), durmio: false },
      ]);
      prisma.citacion.findMany.mockResolvedValue([
        {
          fechaInicio: fecha('2026-07-01'),
          fechaFin: null,
          camas: [{ voluntarioId: 'vol-1' }],
        },
      ]);

      const { detalle } = await service.calcularHistorial(
        'vol-1',
        '2026-07-01',
        '2026-07-01',
      );

      expect(detalle).toEqual([
        { fecha: '2026-07-01', durmio: false, estado: 'OVERRIDE', fuente: 'OVERRIDE' },
      ]);
    });

    it('licencia resulta en durmio=false/LICENCIA y no es sobreescrita por citación ni permiso (sin override)', async () => {
      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-1' });
      prisma.licencia.findMany.mockResolvedValue([
        { voluntarioId: 'vol-1', fecha: fecha('2026-07-01') },
      ]);
      prisma.citacion.findMany.mockResolvedValue([
        {
          fechaInicio: fecha('2026-07-01'),
          fechaFin: null,
          camas: [{ voluntarioId: 'vol-1' }],
        },
      ]);
      prisma.permiso.findMany.mockResolvedValue([
        {
          solicitanteId: 'vol-1',
          tipo: TipoPermiso.PERMISO,
          reemplazanteId: null,
          fechaGuardia: fecha('2026-07-01'),
        },
      ]);

      const { detalle } = await service.calcularHistorial(
        'vol-1',
        '2026-07-01',
        '2026-07-01',
      );

      expect(detalle).toEqual([
        { fecha: '2026-07-01', durmio: false, estado: 'LICENCIA', fuente: 'LICENCIA' },
      ]);
    });

    it('PERMISO (aprobado) resulta en durmio=true/PERMISO', async () => {
      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-1' });
      prisma.permiso.findMany.mockResolvedValue([
        {
          solicitanteId: 'vol-1',
          tipo: TipoPermiso.PERMISO,
          reemplazanteId: null,
          fechaGuardia: fecha('2026-07-01'),
        },
      ]);

      const { detalle } = await service.calcularHistorial(
        'vol-1',
        '2026-07-01',
        '2026-07-01',
      );

      expect(detalle).toEqual([
        { fecha: '2026-07-01', durmio: true, estado: 'PERMISO', fuente: 'PERMISO' },
      ]);
    });

    it('PERMISO_ESPECIAL resulta en durmio=false/PERMISO_ESPECIAL', async () => {
      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-1' });
      prisma.permiso.findMany.mockResolvedValue([
        {
          solicitanteId: 'vol-1',
          tipo: TipoPermiso.PERMISO_ESPECIAL,
          reemplazanteId: null,
          fechaGuardia: fecha('2026-07-01'),
        },
      ]);

      const { detalle } = await service.calcularHistorial(
        'vol-1',
        '2026-07-01',
        '2026-07-01',
      );

      expect(detalle).toEqual([
        {
          fecha: '2026-07-01',
          durmio: false,
          estado: 'PERMISO_ESPECIAL',
          fuente: 'PERMISO',
        },
      ]);
    });

    it('REEMPLAZO: el titular (solicitante) no duerme y el reemplazante sí', async () => {
      const permisoReemplazo = [
        {
          solicitanteId: 'vol-titular',
          tipo: TipoPermiso.REEMPLAZO,
          reemplazanteId: 'vol-reemplazante',
          fechaGuardia: fecha('2026-07-01'),
        },
      ];

      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-titular' });
      prisma.permiso.findMany.mockResolvedValue(permisoReemplazo);
      const titular = await service.calcularHistorial(
        'vol-titular',
        '2026-07-01',
        '2026-07-01',
      );
      expect(titular.detalle).toEqual([
        { fecha: '2026-07-01', durmio: false, estado: 'REEMPLAZO', fuente: 'PERMISO' },
      ]);

      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-reemplazante' });
      prisma.permiso.findMany.mockResolvedValue(permisoReemplazo);
      const reemplazante = await service.calcularHistorial(
        'vol-reemplazante',
        '2026-07-01',
        '2026-07-01',
      );
      expect(reemplazante.detalle).toEqual([
        { fecha: '2026-07-01', durmio: true, estado: 'REEMPLAZO', fuente: 'PERMISO' },
      ]);
    });

    it('citado vía CamaAsignacion sin permiso/licencia/override resulta en durmio=true/NORMAL', async () => {
      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-1' });
      prisma.citacion.findMany.mockResolvedValue([
        {
          fechaInicio: fecha('2026-07-01'),
          fechaFin: null,
          camas: [{ voluntarioId: 'vol-1' }],
        },
      ]);

      const { detalle } = await service.calcularHistorial(
        'vol-1',
        '2026-07-01',
        '2026-07-01',
      );

      expect(detalle).toEqual([
        { fecha: '2026-07-01', durmio: true, estado: 'NORMAL', fuente: 'CITACION' },
      ]);
    });

    it('sin override/licencia/permiso/citación resulta en durmio=false/SIN_CITAR', async () => {
      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-1' });

      const { detalle } = await service.calcularHistorial(
        'vol-1',
        '2026-07-01',
        '2026-07-01',
      );

      expect(detalle).toEqual([
        { fecha: '2026-07-01', durmio: false, estado: 'SIN_CITAR', fuente: null },
      ]);
    });

    it('consulta permiso.findMany filtrando por estado APROBADO (los PENDIENTE/RECHAZADO no deben afectar el resultado)', async () => {
      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-1' });
      // Simula que la base de datos ya filtró los permisos no aprobados:
      // un PENDIENTE/RECHAZADO para esta fecha nunca llegaría a este arreglo.
      prisma.permiso.findMany.mockResolvedValue([]);

      const { detalle } = await service.calcularHistorial(
        'vol-1',
        '2026-07-01',
        '2026-07-01',
      );

      expect(prisma.permiso.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estado: EstadoPermiso.APROBADO }),
        }),
      );
      // Sin permisos aprobados y sin nada más, cae a SIN_CITAR.
      expect(detalle).toEqual([
        { fecha: '2026-07-01', durmio: false, estado: 'SIN_CITAR', fuente: null },
      ]);
    });

    it('resuelve citación semanal (fechaInicio/fechaFin) para determinar citadoIds', async () => {
      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-1' });
      prisma.citacion.findMany.mockResolvedValue([
        {
          fechaInicio: fecha('2026-06-29'),
          fechaFin: fecha('2026-07-05'),
          camas: [{ voluntarioId: 'vol-1' }],
        },
      ]);

      const { detalle } = await service.calcularHistorial(
        'vol-1',
        '2026-07-01',
        '2026-07-01',
      );

      expect(detalle).toEqual([
        { fecha: '2026-07-01', durmio: true, estado: 'NORMAL', fuente: 'CITACION' },
      ]);
    });

    it('resuelve asignación diaria (fechaFin null) para determinar citadoIds', async () => {
      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-1' });
      prisma.citacion.findMany.mockResolvedValue([
        {
          fechaInicio: fecha('2026-07-01'),
          fechaFin: null,
          camas: [{ voluntarioId: 'vol-1' }],
        },
      ]);

      const { detalle } = await service.calcularHistorial(
        'vol-1',
        '2026-07-01',
        '2026-07-01',
      );

      expect(detalle).toEqual([
        { fecha: '2026-07-01', durmio: true, estado: 'NORMAL', fuente: 'CITACION' },
      ]);
    });

    it('acumula totales correctamente a través de un rango con estados mixtos', async () => {
      // Rango de 6 días para vol-1:
      // 07-01: override durmio=true            -> noches+1, override+1
      // 07-02: licencia                        -> licencia+1
      // 07-03: PERMISO                         -> noches+1, permiso+1
      // 07-04: PERMISO_ESPECIAL                -> permisoEspecial+1
      // 07-05: REEMPLAZO (vol-1 es reemplazante)-> noches+1, reemplazoRecibido+1
      // 07-06: citado NORMAL                   -> noches+1
      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-1' });
      prisma.correccionNoche.findMany.mockResolvedValue([
        { voluntarioId: 'vol-1', fecha: fecha('2026-07-01'), durmio: true },
      ]);
      prisma.licencia.findMany.mockResolvedValue([
        { voluntarioId: 'vol-1', fecha: fecha('2026-07-02') },
      ]);
      prisma.permiso.findMany.mockResolvedValue([
        {
          solicitanteId: 'vol-1',
          tipo: TipoPermiso.PERMISO,
          reemplazanteId: null,
          fechaGuardia: fecha('2026-07-03'),
        },
        {
          solicitanteId: 'vol-1',
          tipo: TipoPermiso.PERMISO_ESPECIAL,
          reemplazanteId: null,
          fechaGuardia: fecha('2026-07-04'),
        },
        {
          solicitanteId: 'vol-otro',
          tipo: TipoPermiso.REEMPLAZO,
          reemplazanteId: 'vol-1',
          fechaGuardia: fecha('2026-07-05'),
        },
      ]);
      prisma.citacion.findMany.mockResolvedValue([
        {
          fechaInicio: fecha('2026-07-06'),
          fechaFin: null,
          camas: [{ voluntarioId: 'vol-1' }],
        },
      ]);

      const { totales } = await service.calcularHistorial(
        'vol-1',
        '2026-07-01',
        '2026-07-06',
      );

      expect(totales).toEqual({
        noches: 4, // override(true), permiso, reemplazo(recibido), normal
        permiso: 1,
        permisoEspecial: 1,
        reemplazoRecibido: 1,
        licencia: 1,
        override: 1,
      });
    });

    it('no cuenta reemplazoRecibido para el titular de un REEMPLAZO (durmio=false)', async () => {
      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-titular' });
      prisma.permiso.findMany.mockResolvedValue([
        {
          solicitanteId: 'vol-titular',
          tipo: TipoPermiso.REEMPLAZO,
          reemplazanteId: 'vol-reemplazante',
          fechaGuardia: fecha('2026-07-01'),
        },
      ]);

      const { totales } = await service.calcularHistorial(
        'vol-titular',
        '2026-07-01',
        '2026-07-01',
      );

      expect(totales.reemplazoRecibido).toBe(0);
      expect(totales.noches).toBe(0);
    });
  });

  describe('calcularEstadisticas', () => {
    it('lanza BadRequestException si hasta < desde', async () => {
      await expect(
        service.calcularEstadisticas('2026-07-05', '2026-07-01'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si se pasa voluntarioId y no existe', async () => {
      prisma.voluntario.findMany.mockResolvedValue([]);

      await expect(
        service.calcularEstadisticas('2026-07-01', '2026-07-01', 'vol-x'),
      ).rejects.toThrow(new NotFoundException('Voluntario no encontrado'));

      expect(prisma.voluntario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'vol-x' } }),
      );
    });

    it('sin voluntarioId consulta solo activos y ordena por noches descendente', async () => {
      prisma.voluntario.findMany.mockResolvedValue([
        voluntarioResumen('vol-1', 1),
        voluntarioResumen('vol-2', 2),
      ]);
      prisma.citacion.findMany.mockResolvedValue([
        {
          fechaInicio: fecha('2026-07-01'),
          fechaFin: null,
          camas: [{ voluntarioId: 'vol-2' }],
        },
      ]);

      const resultado = await service.calcularEstadisticas(
        '2026-07-01',
        '2026-07-01',
      );

      expect(prisma.voluntario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { activo: true } }),
      );
      expect(resultado[0].voluntario.id).toBe('vol-2');
      expect(resultado[0].totales.noches).toBe(1);
      expect(resultado[1].voluntario.id).toBe('vol-1');
      expect(resultado[1].totales.noches).toBe(0);
    });

    it('con voluntarioId filtra solo ese voluntario', async () => {
      prisma.voluntario.findMany.mockResolvedValue([voluntarioResumen('vol-1')]);

      const resultado = await service.calcularEstadisticas(
        '2026-07-01',
        '2026-07-01',
        'vol-1',
      );

      expect(prisma.voluntario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'vol-1' } }),
      );
      expect(resultado).toHaveLength(1);
      expect(resultado[0].voluntario.id).toBe('vol-1');
    });
  });

  describe('calcularConteoCitacion', () => {
    it('lanza NotFoundException si la citación no existe', async () => {
      prisma.citacion.findUnique.mockResolvedValue(null);

      await expect(service.calcularConteoCitacion('cit-x')).rejects.toThrow(
        new NotFoundException('Citación no encontrada'),
      );
    });

    it('limita el rango a fechaInicio..fechaFin de la citación (semanal)', async () => {
      prisma.citacion.findUnique.mockResolvedValue({
        id: 'cit-1',
        fechaInicio: fecha('2026-07-01'),
        fechaFin: fecha('2026-07-03'),
        camas: [
          { voluntarioId: 'vol-1', voluntario: voluntarioResumen('vol-1') },
        ],
      });
      // La citación de la propia consulta de contexto también cubre este rango,
      // por lo que vol-1 duerme los 3 días como NORMAL.
      prisma.citacion.findMany.mockResolvedValue([
        {
          fechaInicio: fecha('2026-07-01'),
          fechaFin: fecha('2026-07-03'),
          camas: [{ voluntarioId: 'vol-1' }],
        },
      ]);

      const conteos = await service.calcularConteoCitacion('cit-1');

      expect(prisma.correccionNoche.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fecha: { gte: fecha('2026-07-01'), lte: fecha('2026-07-03') },
          }),
        }),
      );
      expect(conteos).toEqual([
        { voluntario: voluntarioResumen('vol-1'), nochesEfectivas: 3 },
      ]);
    });

    it('usa un solo día (fechaInicio) cuando fechaFin es null (asignación diaria)', async () => {
      prisma.citacion.findUnique.mockResolvedValue({
        id: 'cit-2',
        fechaInicio: fecha('2026-07-01'),
        fechaFin: null,
        camas: [
          { voluntarioId: 'vol-1', voluntario: voluntarioResumen('vol-1') },
        ],
      });
      prisma.citacion.findMany.mockResolvedValue([
        {
          fechaInicio: fecha('2026-07-01'),
          fechaFin: null,
          camas: [{ voluntarioId: 'vol-1' }],
        },
      ]);

      const conteos = await service.calcularConteoCitacion('cit-2');

      expect(prisma.correccionNoche.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fecha: { gte: fecha('2026-07-01'), lte: fecha('2026-07-01') },
          }),
        }),
      );
      expect(conteos).toEqual([
        { voluntario: voluntarioResumen('vol-1'), nochesEfectivas: 1 },
      ]);
    });

    it('cuenta solo las noches efectivas (durmio=true) por titular, ej. licencia reduce el conteo', async () => {
      prisma.citacion.findUnique.mockResolvedValue({
        id: 'cit-3',
        fechaInicio: fecha('2026-07-01'),
        fechaFin: fecha('2026-07-02'),
        camas: [
          { voluntarioId: 'vol-1', voluntario: voluntarioResumen('vol-1') },
        ],
      });
      prisma.citacion.findMany.mockResolvedValue([
        {
          fechaInicio: fecha('2026-07-01'),
          fechaFin: fecha('2026-07-02'),
          camas: [{ voluntarioId: 'vol-1' }],
        },
      ]);
      prisma.licencia.findMany.mockResolvedValue([
        { voluntarioId: 'vol-1', fecha: fecha('2026-07-02') },
      ]);

      const conteos = await service.calcularConteoCitacion('cit-3');

      expect(conteos).toEqual([
        { voluntario: voluntarioResumen('vol-1'), nochesEfectivas: 1 },
      ]);
    });
  });
});
