import { ForbiddenException } from '@nestjs/common';
import { NivelAcceso, RolSistema, TipoAlcanceChecklist, TipoRecursoAcceso } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { InventarioService } from './inventario.service';

describe('InventarioService', () => {
  let inventarioService: InventarioService;
  let prisma: {
    categoriaInventario: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    ubicacion: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    itemInventario: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    checklistTemplate: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let rbacService: {
    idsAccesibles: jest.Mock;
    tieneAcceso: jest.Mock;
    limpiarRecurso: jest.Mock;
  };

  const admin: AuthenticatedUser = { sub: 'admin-1', roles: [RolSistema.ADMIN] };
  const usuario: AuthenticatedUser = { sub: 'vol-1', roles: [RolSistema.GUARDIAN] };

  beforeEach(() => {
    prisma = {
      categoriaInventario: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      ubicacion: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      itemInventario: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      checklistTemplate: { deleteMany: jest.fn() },
      $transaction: jest.fn((arg) => {
        if (Array.isArray(arg)) return Promise.all(arg);
        return arg(prisma);
      }),
    };
    rbacService = {
      idsAccesibles: jest.fn(),
      tieneAcceso: jest.fn(),
      limpiarRecurso: jest.fn(),
    };

    inventarioService = new InventarioService(
      prisma as unknown as PrismaService,
      rbacService as unknown as RbacService,
    );
  });

  describe('listar (items)', () => {
    it('un usuario con acceso LEER a una categoría solo ve items de esa categoría', async () => {
      rbacService.idsAccesibles.mockImplementation((_user, recursoTipo) => {
        if (recursoTipo === TipoRecursoAcceso.CATEGORIA_INVENTARIO) {
          return Promise.resolve({ irrestricto: false, ids: ['cat-1'] });
        }
        return Promise.resolve({ irrestricto: false, ids: [] });
      });
      prisma.itemInventario.count.mockResolvedValue(1);
      prisma.itemInventario.findMany.mockResolvedValue([
        { id: 'item-1', categoriaId: 'cat-1', ubicacionId: 'ubi-9' },
      ]);

      const resultado = await inventarioService.listar(usuario, {});

      expect(resultado.data).toEqual([
        { id: 'item-1', categoriaId: 'cat-1', ubicacionId: 'ubi-9' },
      ]);
      const [[argumentoFindMany]] = prisma.itemInventario.findMany.mock.calls;
      expect(argumentoFindMany.where).toEqual({
        OR: [
          { categoriaId: { in: ['cat-1'] } },
          { ubicacionId: { in: [] } },
        ],
      });
    });

    it('un usuario ADMIN (irrestricto) ve todos los items sin filtrar por id', async () => {
      rbacService.idsAccesibles.mockResolvedValue({ irrestricto: true, ids: [] });
      prisma.itemInventario.count.mockResolvedValue(3);
      prisma.itemInventario.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

      const resultado = await inventarioService.listar(admin, {});

      expect(resultado.meta.total).toBe(3);
      const [[argumentoFindMany]] = prisma.itemInventario.findMany.mock.calls;
      expect(argumentoFindMany.where).toEqual({});
    });

    it('un usuario sin ningún grant no ve nada', async () => {
      rbacService.idsAccesibles.mockResolvedValue({ irrestricto: false, ids: [] });
      prisma.itemInventario.count.mockResolvedValue(0);
      prisma.itemInventario.findMany.mockResolvedValue([]);

      const resultado = await inventarioService.listar(usuario, {});

      expect(resultado.data).toEqual([]);
      const [[argumentoFindMany]] = prisma.itemInventario.findMany.mock.calls;
      expect(argumentoFindMany.where).toEqual({
        OR: [{ categoriaId: { in: [] } }, { ubicacionId: { in: [] } }],
      });
    });
  });

  describe('detalle / actualizar (items) — acceso vía categoría O ubicación', () => {
    const item = { id: 'item-1', categoriaId: 'cat-1', ubicacionId: 'ubi-1' };

    it('permite el acceso si el grant viene solo de la categoría', async () => {
      prisma.itemInventario.findUnique.mockResolvedValue(item);
      rbacService.tieneAcceso.mockImplementation((_user, recursoTipo) =>
        Promise.resolve(recursoTipo === TipoRecursoAcceso.CATEGORIA_INVENTARIO),
      );

      const resultado = await inventarioService.detalle(usuario, 'item-1');

      expect(resultado).toEqual(item);
    });

    it('permite el acceso si el grant viene solo de la ubicación', async () => {
      prisma.itemInventario.findUnique.mockResolvedValue(item);
      rbacService.tieneAcceso.mockImplementation((_user, recursoTipo) =>
        Promise.resolve(recursoTipo === TipoRecursoAcceso.UBICACION),
      );

      const resultado = await inventarioService.detalle(usuario, 'item-1');

      expect(resultado).toEqual(item);
    });

    it('lanza ForbiddenException si no hay grant ni por categoría ni por ubicación', async () => {
      prisma.itemInventario.findUnique.mockResolvedValue(item);
      rbacService.tieneAcceso.mockResolvedValue(false);

      await expect(inventarioService.detalle(usuario, 'item-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('actualizar permite el acceso vía grant de categoría con nivel GESTIONAR', async () => {
      prisma.itemInventario.findUnique.mockResolvedValue(item);
      prisma.itemInventario.update.mockResolvedValue({ ...item, nombre: 'nuevo' });
      rbacService.tieneAcceso.mockImplementation((_user, recursoTipo, _id, nivel) =>
        Promise.resolve(
          recursoTipo === TipoRecursoAcceso.CATEGORIA_INVENTARIO &&
            nivel === NivelAcceso.GESTIONAR,
        ),
      );

      const resultado = await inventarioService.actualizar(usuario, 'item-1', {
        nombre: 'nuevo',
      });

      expect(resultado.nombre).toBe('nuevo');
    });

    it('actualizar permite el acceso vía grant de ubicación con nivel GESTIONAR', async () => {
      prisma.itemInventario.findUnique.mockResolvedValue(item);
      prisma.itemInventario.update.mockResolvedValue({ ...item, nombre: 'nuevo' });
      rbacService.tieneAcceso.mockImplementation((_user, recursoTipo, _id, nivel) =>
        Promise.resolve(
          recursoTipo === TipoRecursoAcceso.UBICACION && nivel === NivelAcceso.GESTIONAR,
        ),
      );

      const resultado = await inventarioService.actualizar(usuario, 'item-1', {
        nombre: 'nuevo',
      });

      expect(resultado.nombre).toBe('nuevo');
    });

    it('actualizar lanza ForbiddenException si no hay grant GESTIONAR por ningún lado', async () => {
      prisma.itemInventario.findUnique.mockResolvedValue(item);
      rbacService.tieneAcceso.mockResolvedValue(false);

      await expect(
        inventarioService.actualizar(usuario, 'item-1', { nombre: 'x' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.itemInventario.update).not.toHaveBeenCalled();
    });

    it('actualizar rechaza mover el item a una categoría que el usuario no administra (confused deputy)', async () => {
      // El usuario administra cat-1 (origen) pero NO cat-2 (destino) — mover
      // el item hacia allá no debe bastar con el grant sobre el origen.
      prisma.itemInventario.findUnique.mockResolvedValue(item);
      rbacService.tieneAcceso.mockImplementation((_user, recursoTipo, recursoId, nivel) =>
        Promise.resolve(
          recursoTipo === TipoRecursoAcceso.CATEGORIA_INVENTARIO &&
            recursoId === 'cat-1' &&
            nivel === NivelAcceso.GESTIONAR,
        ),
      );

      await expect(
        inventarioService.actualizar(usuario, 'item-1', { categoriaId: 'cat-2' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.itemInventario.update).not.toHaveBeenCalled();
    });

    it('actualizar permite mover el item si el usuario administra tanto el origen como el destino', async () => {
      prisma.itemInventario.findUnique.mockResolvedValue(item);
      prisma.itemInventario.update.mockResolvedValue({ ...item, categoriaId: 'cat-2' });
      rbacService.tieneAcceso.mockImplementation((_user, recursoTipo, recursoId, nivel) =>
        Promise.resolve(
          recursoTipo === TipoRecursoAcceso.CATEGORIA_INVENTARIO &&
            (recursoId === 'cat-1' || recursoId === 'cat-2') &&
            nivel === NivelAcceso.GESTIONAR,
        ),
      );

      const resultado = await inventarioService.actualizar(usuario, 'item-1', {
        categoriaId: 'cat-2',
      });
      expect(resultado.categoriaId).toBe('cat-2');
    });
  });

  describe('eliminarCategoria', () => {
    it('llama a rbacService.limpiarRecurso y borra los ChecklistTemplate que referencian la categoría', async () => {
      prisma.categoriaInventario.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.checklistTemplate.deleteMany.mockResolvedValue({ count: 2 });
      prisma.categoriaInventario.delete.mockResolvedValue({ id: 'cat-1' });

      await inventarioService.eliminarCategoria('cat-1');

      expect(prisma.checklistTemplate.deleteMany).toHaveBeenCalledWith({
        where: {
          alcanceTipo: TipoAlcanceChecklist.CATEGORIA_INVENTARIO,
          alcanceId: 'cat-1',
        },
      });
      expect(prisma.categoriaInventario.delete).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
      });
      expect(rbacService.limpiarRecurso).toHaveBeenCalledWith(
        TipoRecursoAcceso.CATEGORIA_INVENTARIO,
        'cat-1',
      );
    });
  });

  describe('eliminar (item)', () => {
    it('borra los ChecklistTemplate con alcanceTipo=ITEM_INVENTARIO que referencian el item, igual que categoría/ubicación', async () => {
      const item = { id: 'item-1', categoriaId: 'cat-1', ubicacionId: 'ubi-1' };
      prisma.itemInventario.findUnique.mockResolvedValue(item);
      rbacService.tieneAcceso.mockResolvedValue(true);
      prisma.checklistTemplate.deleteMany.mockResolvedValue({ count: 1 });
      prisma.itemInventario.delete.mockResolvedValue(item);

      await inventarioService.eliminar(usuario, 'item-1');

      expect(prisma.checklistTemplate.deleteMany).toHaveBeenCalledWith({
        where: {
          alcanceTipo: TipoAlcanceChecklist.ITEM_INVENTARIO,
          alcanceId: 'item-1',
        },
      });
      expect(prisma.itemInventario.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
      // A diferencia de categoría/ubicación, un item no es un TipoRecursoAcceso
      // válido — no hay Autorizacion directa sobre un item que limpiar.
      expect(rbacService.limpiarRecurso).not.toHaveBeenCalled();
    });
  });
});
