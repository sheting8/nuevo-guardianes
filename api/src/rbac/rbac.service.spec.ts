import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { NivelAcceso, RolSistema, TipoRecursoAcceso, TipoSujetoAcceso } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from './rbac.service';

describe('RbacService', () => {
  let service: RbacService;
  let prisma: {
    autorizacion: { findMany: jest.Mock; create: jest.Mock; findUnique: jest.Mock; delete: jest.Mock; deleteMany: jest.Mock };
    grupo: { findMany: jest.Mock; create: jest.Mock; findUnique: jest.Mock };
    grupoMiembro: { upsert: jest.Mock; deleteMany: jest.Mock; findMany: jest.Mock };
    voluntario: { findUnique: jest.Mock };
    voluntarioRol: { findMany: jest.Mock };
    categoriaInventario: { findUnique: jest.Mock };
    ubicacion: { findUnique: jest.Mock };
    checklistTemplate: { findUnique: jest.Mock };
  };

  const admin = { sub: 'admin-1', roles: [RolSistema.ADMIN] };
  const usuario = { sub: 'user-1', roles: [RolSistema.GUARDIAN] };

  beforeEach(() => {
    prisma = {
      autorizacion: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      grupo: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
      grupoMiembro: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
      voluntario: { findUnique: jest.fn() },
      voluntarioRol: { findMany: jest.fn() },
      categoriaInventario: { findUnique: jest.fn() },
      ubicacion: { findUnique: jest.fn() },
      checklistTemplate: { findUnique: jest.fn() },
    };
    // user.sub es un User.id (JWT sub), no un Voluntario.id — el resolver
    // interno debe traducirlo antes de consultar grants (ver comentario en
    // rbac.service.ts). 'vol-del-usuario' es deliberadamente distinto de
    // usuario.sub ('user-1') para que un test que accidentalmente use el id
    // sin resolver falle de forma visible en vez de pasar por coincidencia.
    prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-del-usuario' });
    service = new RbacService(prisma as unknown as PrismaService);
  });

  describe('tieneAcceso', () => {
    it('ADMIN siempre tiene acceso, sin consultar Autorizacion', async () => {
      const resultado = await service.tieneAcceso(
        admin,
        TipoRecursoAcceso.UBICACION,
        'ubic-1',
        NivelAcceso.GESTIONAR,
      );
      expect(resultado).toBe(true);
      expect(prisma.autorizacion.findMany).not.toHaveBeenCalled();
    });

    it('otorga acceso por grant directo al usuario', async () => {
      prisma.autorizacion.findMany.mockResolvedValue([
        { recursoId: 'ubic-1', nivel: NivelAcceso.LEER },
      ]);

      const resultado = await service.tieneAcceso(
        usuario,
        TipoRecursoAcceso.UBICACION,
        'ubic-1',
        NivelAcceso.LEER,
      );
      expect(resultado).toBe(true);
    });

    it('GESTIONAR satisface un requerimiento de LEER (implica)', async () => {
      prisma.autorizacion.findMany.mockResolvedValue([
        { recursoId: 'ubic-1', nivel: NivelAcceso.GESTIONAR },
      ]);

      const resultado = await service.tieneAcceso(
        usuario,
        TipoRecursoAcceso.UBICACION,
        'ubic-1',
        NivelAcceso.LEER,
      );
      expect(resultado).toBe(true);
    });

    it('LEER NO satisface un requerimiento de GESTIONAR', async () => {
      prisma.autorizacion.findMany.mockResolvedValue([
        { recursoId: 'ubic-1', nivel: NivelAcceso.LEER },
      ]);

      const resultado = await service.tieneAcceso(
        usuario,
        TipoRecursoAcceso.UBICACION,
        'ubic-1',
        NivelAcceso.GESTIONAR,
      );
      expect(resultado).toBe(false);
    });

    it('sin grants, no hay acceso', async () => {
      prisma.autorizacion.findMany.mockResolvedValue([]);

      const resultado = await service.tieneAcceso(
        usuario,
        TipoRecursoAcceso.UBICACION,
        'ubic-1',
        NivelAcceso.LEER,
      );
      expect(resultado).toBe(false);
    });

    it('resuelve user.sub (User.id) al Voluntario.id real antes de consultar grants — no compara contra el User.id crudo', async () => {
      prisma.autorizacion.findMany.mockResolvedValue([]);

      await service.tieneAcceso(usuario, TipoRecursoAcceso.UBICACION, 'ubic-1', NivelAcceso.LEER);

      expect(prisma.voluntario.findUnique).toHaveBeenCalledWith({
        where: { userId: usuario.sub },
      });
      const [[arg]] = prisma.autorizacion.findMany.mock.calls as [
        { where: { OR: { voluntarioId?: string }[] } },
      ][];
      const clausulaUsuario = arg.where.OR.find((o) => 'voluntarioId' in o);
      expect(clausulaUsuario?.voluntarioId).toBe('vol-del-usuario');
      expect(clausulaUsuario?.voluntarioId).not.toBe(usuario.sub);
    });

    it('lanza ForbiddenException si el usuario autenticado no tiene un voluntario asociado', async () => {
      prisma.voluntario.findUnique.mockResolvedValue(null);

      await expect(
        service.tieneAcceso(usuario, TipoRecursoAcceso.UBICACION, 'ubic-1', NivelAcceso.LEER),
      ).rejects.toThrow(
        new ForbiddenException('El usuario autenticado no tiene un voluntario asociado'),
      );
    });
  });

  describe('idsAccesibles', () => {
    it('ADMIN es irrestricto (sin filtrar por ids)', async () => {
      const resultado = await service.idsAccesibles(
        admin,
        TipoRecursoAcceso.CATEGORIA_INVENTARIO,
        NivelAcceso.LEER,
      );
      expect(resultado).toEqual({ irrestricto: true, ids: [] });
      expect(prisma.autorizacion.findMany).not.toHaveBeenCalled();
    });

    it('combina grants directos y de grupo, dedupe por recursoId con el mejor nivel', async () => {
      prisma.autorizacion.findMany.mockResolvedValue([
        { recursoId: 'cat-1', nivel: NivelAcceso.LEER },
        { recursoId: 'cat-1', nivel: NivelAcceso.GESTIONAR }, // via grupo, pisa el LEER directo
        { recursoId: 'cat-2', nivel: NivelAcceso.LEER },
      ]);

      const resultado = await service.idsAccesibles(
        usuario,
        TipoRecursoAcceso.CATEGORIA_INVENTARIO,
        NivelAcceso.GESTIONAR,
      );

      expect(resultado.irrestricto).toBe(false);
      expect(resultado.ids).toEqual(['cat-1']); // cat-2 solo tiene LEER, no alcanza GESTIONAR
    });

    it('resuelve user.sub (User.id) al Voluntario.id real antes de consultar grants', async () => {
      prisma.autorizacion.findMany.mockResolvedValue([]);

      await service.idsAccesibles(usuario, TipoRecursoAcceso.UBICACION, NivelAcceso.LEER);

      const [[arg]] = prisma.autorizacion.findMany.mock.calls as [
        { where: { OR: { voluntarioId?: string }[] } },
      ][];
      const clausulaUsuario = arg.where.OR.find((o) => 'voluntarioId' in o);
      expect(clausulaUsuario?.voluntarioId).toBe('vol-del-usuario');
      expect(clausulaUsuario?.voluntarioId).not.toBe(usuario.sub);
    });

    it('consulta grants directos (USUARIO) y de grupo (GRUPO via GrupoMiembro) en un solo query', async () => {
      prisma.autorizacion.findMany.mockResolvedValue([]);
      await service.idsAccesibles(usuario, TipoRecursoAcceso.UBICACION, NivelAcceso.LEER);

      expect(prisma.autorizacion.findMany).toHaveBeenCalledTimes(1);
      const [[arg]] = prisma.autorizacion.findMany.mock.calls as [
        { where: { OR: unknown[] } },
      ][];
      expect(arg.where.OR).toHaveLength(2);
    });
  });

  describe('crearAutorizacion', () => {
    it('lanza 400 si sujetoTipo=USUARIO sin voluntarioId', async () => {
      await expect(
        service.crearAutorizacion({
          sujetoTipo: TipoSujetoAcceso.USUARIO,
          recursoTipo: TipoRecursoAcceso.UBICACION,
          recursoId: 'ubic-1',
          nivel: NivelAcceso.LEER,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza 400 si el recurso no existe', async () => {
      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-1' });
      prisma.ubicacion.findUnique.mockResolvedValue(null);

      await expect(
        service.crearAutorizacion({
          sujetoTipo: TipoSujetoAcceso.USUARIO,
          voluntarioId: 'vol-1',
          recursoTipo: TipoRecursoAcceso.UBICACION,
          recursoId: 'ubic-inexistente',
          nivel: NivelAcceso.LEER,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea la autorización cuando sujeto y recurso existen', async () => {
      prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-1' });
      prisma.ubicacion.findUnique.mockResolvedValue({ id: 'ubic-1' });
      prisma.autorizacion.create.mockResolvedValue({ id: 'auth-1' });

      const resultado = await service.crearAutorizacion({
        sujetoTipo: TipoSujetoAcceso.USUARIO,
        voluntarioId: 'vol-1',
        recursoTipo: TipoRecursoAcceso.UBICACION,
        recursoId: 'ubic-1',
        nivel: NivelAcceso.LEER,
      });

      expect(resultado).toEqual({ id: 'auth-1' });
      expect(prisma.autorizacion.create).toHaveBeenCalledWith({
        data: {
          sujetoTipo: TipoSujetoAcceso.USUARIO,
          voluntarioId: 'vol-1',
          grupoId: null,
          recursoTipo: TipoRecursoAcceso.UBICACION,
          recursoId: 'ubic-1',
          nivel: NivelAcceso.LEER,
        },
      });
    });
  });

  describe('voluntariosConAcceso', () => {
    it('incluye grants directos por voluntario', async () => {
      prisma.autorizacion.findMany.mockResolvedValue([
        { sujetoTipo: TipoSujetoAcceso.USUARIO, voluntarioId: 'vol-1', grupoId: null, nivel: NivelAcceso.LEER },
      ]);

      const resultado = await service.voluntariosConAcceso(
        TipoRecursoAcceso.UBICACION,
        'ubic-1',
        NivelAcceso.LEER,
      );
      expect(resultado).toEqual(['vol-1']);
    });

    it('resuelve grants de grupo a sus miembros', async () => {
      prisma.autorizacion.findMany.mockResolvedValue([
        { sujetoTipo: TipoSujetoAcceso.GRUPO, voluntarioId: null, grupoId: 'grupo-1', nivel: NivelAcceso.GESTIONAR },
      ]);
      prisma.grupoMiembro.findMany.mockResolvedValue([
        { voluntarioId: 'vol-2' },
        { voluntarioId: 'vol-3' },
      ]);

      const resultado = await service.voluntariosConAcceso(
        TipoRecursoAcceso.UBICACION,
        'ubic-1',
        NivelAcceso.LEER,
      );
      expect(resultado.sort()).toEqual(['vol-2', 'vol-3']);
    });

    it('excluye grants por debajo del nivel mínimo requerido', async () => {
      prisma.autorizacion.findMany.mockResolvedValue([
        { sujetoTipo: TipoSujetoAcceso.USUARIO, voluntarioId: 'vol-1', grupoId: null, nivel: NivelAcceso.LEER },
      ]);

      const resultado = await service.voluntariosConAcceso(
        TipoRecursoAcceso.UBICACION,
        'ubic-1',
        NivelAcceso.GESTIONAR,
      );
      expect(resultado).toEqual([]);
    });

    it('dedupe un voluntario que llega tanto directo como por grupo', async () => {
      prisma.autorizacion.findMany.mockResolvedValue([
        { sujetoTipo: TipoSujetoAcceso.USUARIO, voluntarioId: 'vol-1', grupoId: null, nivel: NivelAcceso.LEER },
        { sujetoTipo: TipoSujetoAcceso.GRUPO, voluntarioId: null, grupoId: 'grupo-1', nivel: NivelAcceso.LEER },
      ]);
      prisma.grupoMiembro.findMany.mockResolvedValue([{ voluntarioId: 'vol-1' }]);

      const resultado = await service.voluntariosConAcceso(
        TipoRecursoAcceso.UBICACION,
        'ubic-1',
        NivelAcceso.LEER,
      );
      expect(resultado).toEqual(['vol-1']);
    });
  });

  describe('voluntariosConRolAdmin', () => {
    it('retorna los voluntarioId con rol ADMIN', async () => {
      prisma.voluntarioRol.findMany.mockResolvedValue([
        { voluntarioId: 'admin-vol-1' },
        { voluntarioId: 'admin-vol-2' },
      ]);

      const resultado = await service.voluntariosConRolAdmin();
      expect(resultado).toEqual(['admin-vol-1', 'admin-vol-2']);
      expect(prisma.voluntarioRol.findMany).toHaveBeenCalledWith({
        where: { rol: RolSistema.ADMIN },
        select: { voluntarioId: true },
      });
    });
  });

  describe('limpiarRecurso', () => {
    it('borra todas las Autorizacion que apuntan a ese recurso', async () => {
      await service.limpiarRecurso(TipoRecursoAcceso.UBICACION, 'ubic-1');
      expect(prisma.autorizacion.deleteMany).toHaveBeenCalledWith({
        where: { recursoTipo: TipoRecursoAcceso.UBICACION, recursoId: 'ubic-1' },
      });
    });
  });
});
