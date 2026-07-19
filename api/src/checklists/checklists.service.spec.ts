import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  NivelAcceso,
  RolSistema,
  TipoAlcanceChecklist,
  TipoFrecuenciaChecklist,
  TipoNotificacion,
  TipoPreguntaChecklist,
  TipoRecursoAcceso,
} from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { ChecklistsService } from './checklists.service';

type PrismaMock = {
  checklistTemplate: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  checklistEjecucion: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
  };
  citacion: { findFirst: jest.Mock };
  categoriaInventario: { findUnique: jest.Mock };
  ubicacion: { findUnique: jest.Mock };
  itemInventario: { findUnique: jest.Mock; findMany: jest.Mock };
  voluntario: { findUnique: jest.Mock };
  notificacion: { findFirst: jest.Mock };
  $transaction: jest.Mock;
};

type RbacMock = {
  tieneAcceso: jest.Mock;
  idsAccesibles: jest.Mock;
  limpiarRecurso: jest.Mock;
  voluntariosConAcceso: jest.Mock;
  voluntariosConRolAdmin: jest.Mock;
};

type NotificacionesMock = {
  crear: jest.Mock;
  crearParaMuchos: jest.Mock;
};

const admin = { sub: 'admin-1', roles: [RolSistema.ADMIN] };
const usuario = { sub: 'user-1', roles: [RolSistema.GUARDIAN] };

const IRRESTRICTO = { irrestricto: true, ids: [] as string[] };
const ninguno = { irrestricto: false, ids: [] as string[] };

describe('ChecklistsService', () => {
  let service: ChecklistsService;
  let prisma: PrismaMock;
  let rbac: RbacMock;
  let notificaciones: NotificacionesMock;

  beforeEach(() => {
    prisma = {
      checklistTemplate: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      checklistEjecucion: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      citacion: { findFirst: jest.fn() },
      categoriaInventario: { findUnique: jest.fn() },
      ubicacion: { findUnique: jest.fn() },
      itemInventario: { findUnique: jest.fn(), findMany: jest.fn() },
      voluntario: { findUnique: jest.fn() },
      notificacion: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    rbac = {
      tieneAcceso: jest.fn(),
      idsAccesibles: jest.fn(),
      limpiarRecurso: jest.fn(),
      voluntariosConAcceso: jest.fn().mockResolvedValue([]),
      voluntariosConRolAdmin: jest.fn().mockResolvedValue([]),
    };
    notificaciones = { crear: jest.fn(), crearParaMuchos: jest.fn() };
    // user.sub es un User.id (JWT sub), no el Voluntario.id que
    // ChecklistEjecucion.ejecutadoPorId requiere — 'vol-del-usuario' es
    // deliberadamente distinto de usuario.sub para que un uso accidental del
    // id sin resolver falle de forma visible en vez de pasar por coincidencia.
    prisma.voluntario.findUnique.mockResolvedValue({ id: 'vol-del-usuario' });

    service = new ChecklistsService(
      prisma as unknown as PrismaService,
      rbac as unknown as RbacService,
      notificaciones as unknown as NotificacionesService,
    );
  });

  const template = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 't-1',
    nombre: 'Chequeo bomba',
    descripcion: null,
    alcanceTipo: TipoAlcanceChecklist.CATEGORIA_INVENTARIO,
    alcanceId: 'cat-1',
    tipoFrecuencia: TipoFrecuenciaChecklist.ROLLING,
    intervaloMinutos: 60,
    activo: true,
    ...overrides,
  });

  describe('crearTemplate', () => {
    const dto = {
      nombre: 'Chequeo bomba',
      alcanceTipo: TipoAlcanceChecklist.CATEGORIA_INVENTARIO,
      alcanceId: 'cat-1',
      tipoFrecuencia: TipoFrecuenciaChecklist.ANTES_DE_USO,
      items: [{ orden: 1, descripcion: '¿Nivel de combustible OK?' }],
    };

    it('lanza BadRequestException si ROLLING no trae intervaloMinutos', async () => {
      await expect(
        service.crearTemplate(usuario, {
          ...dto,
          tipoFrecuencia: TipoFrecuenciaChecklist.ROLLING,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si se manda intervaloMinutos sin ser ROLLING', async () => {
      await expect(
        service.crearTemplate(usuario, { ...dto, intervaloMinutos: 30 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si el alcance no existe', async () => {
      prisma.categoriaInventario.findUnique.mockResolvedValue(null);

      await expect(service.crearTemplate(usuario, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('otorga acceso vía grant directo sobre la categoría/ubicación del alcance', async () => {
      prisma.categoriaInventario.findUnique.mockResolvedValue({ id: 'cat-1' });
      rbac.tieneAcceso.mockResolvedValue(true);
      prisma.checklistTemplate.create.mockResolvedValue({ id: 't-1' });

      await service.crearTemplate(usuario, dto);

      expect(rbac.tieneAcceso).toHaveBeenCalledWith(
        usuario,
        TipoRecursoAcceso.CATEGORIA_INVENTARIO,
        'cat-1',
        NivelAcceso.GESTIONAR,
      );
      expect(prisma.checklistTemplate.create).toHaveBeenCalled();
    });

    it('lanza ForbiddenException si no hay grant GESTIONAR sobre el alcance', async () => {
      prisma.categoriaInventario.findUnique.mockResolvedValue({ id: 'cat-1' });
      rbac.tieneAcceso.mockResolvedValue(false);

      await expect(service.crearTemplate(usuario, dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.checklistTemplate.create).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si hay items con orden duplicado', async () => {
      prisma.categoriaInventario.findUnique.mockResolvedValue({ id: 'cat-1' });
      rbac.tieneAcceso.mockResolvedValue(true);

      await expect(
        service.crearTemplate(usuario, {
          ...dto,
          items: [
            { orden: 1, descripcion: 'a' },
            { orden: 1, descripcion: 'b' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('crearTemplate — validarConfiguracion por tipoPregunta', () => {
    const dtoBase = {
      nombre: 'Chequeo bomba',
      alcanceTipo: TipoAlcanceChecklist.CATEGORIA_INVENTARIO,
      alcanceId: 'cat-1',
      tipoFrecuencia: TipoFrecuenciaChecklist.ANTES_DE_USO,
    };

    beforeEach(() => {
      prisma.categoriaInventario.findUnique.mockResolvedValue({ id: 'cat-1' });
      rbac.tieneAcceso.mockResolvedValue(true);
    });

    it('PASA_FALLA por defecto no requiere configuracion', async () => {
      prisma.checklistTemplate.create.mockResolvedValue({ id: 't-1' });
      await expect(
        service.crearTemplate(usuario, {
          ...dtoBase,
          items: [{ orden: 1, descripcion: '¿OK?' }],
        }),
      ).resolves.toBeDefined();
    });

    it('rechaza NUMERO con min mayor que max', async () => {
      await expect(
        service.crearTemplate(usuario, {
          ...dtoBase,
          items: [
            {
              orden: 1,
              descripcion: 'Presión PSI',
              tipoPregunta: TipoPreguntaChecklist.NUMERO,
              configuracion: { min: 40, max: 10 },
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('acepta NUMERO sin configuracion (rango opcional)', async () => {
      prisma.checklistTemplate.create.mockResolvedValue({ id: 't-1' });
      await expect(
        service.crearTemplate(usuario, {
          ...dtoBase,
          items: [{ orden: 1, descripcion: 'Presión PSI', tipoPregunta: TipoPreguntaChecklist.NUMERO }],
        }),
      ).resolves.toBeDefined();
    });

    it('rechaza SELECTOR con opciones vacías', async () => {
      await expect(
        service.crearTemplate(usuario, {
          ...dtoBase,
          items: [
            {
              orden: 1,
              descripcion: 'Nivel de combustible',
              tipoPregunta: TipoPreguntaChecklist.SELECTOR,
              configuracion: { opciones: [], multiple: false },
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza SELECTOR sin indicar multiple', async () => {
      await expect(
        service.crearTemplate(usuario, {
          ...dtoBase,
          items: [
            {
              orden: 1,
              descripcion: 'Nivel de combustible',
              tipoPregunta: TipoPreguntaChecklist.SELECTOR,
              configuracion: { opciones: ['Lleno', 'Medio', 'Vacío'] },
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza MATRIZ con filas o columnas vacías', async () => {
      await expect(
        service.crearTemplate(usuario, {
          ...dtoBase,
          items: [
            {
              orden: 1,
              descripcion: 'Estado de neumáticos',
              tipoPregunta: TipoPreguntaChecklist.MATRIZ,
              configuracion: { filas: ['Del. izq.'], columnas: [] },
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza configuracion en un item PASA_FALLA o TEXTO', async () => {
      await expect(
        service.crearTemplate(usuario, {
          ...dtoBase,
          items: [
            {
              orden: 1,
              descripcion: '¿OK?',
              tipoPregunta: TipoPreguntaChecklist.TEXTO,
              configuracion: { algo: true },
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('acepta una plantilla con un item de cada tipo', async () => {
      prisma.checklistTemplate.create.mockResolvedValue({ id: 't-1' });
      await expect(
        service.crearTemplate(usuario, {
          ...dtoBase,
          items: [
            { orden: 1, descripcion: '¿OK?', tipoPregunta: TipoPreguntaChecklist.PASA_FALLA },
            { orden: 2, descripcion: 'PSI', tipoPregunta: TipoPreguntaChecklist.NUMERO, configuracion: { min: 28, max: 35 } },
            {
              orden: 3,
              descripcion: 'Combustible',
              tipoPregunta: TipoPreguntaChecklist.SELECTOR,
              configuracion: { opciones: ['Lleno', 'Medio', 'Vacío'], multiple: false },
            },
            {
              orden: 4,
              descripcion: 'Neumáticos',
              tipoPregunta: TipoPreguntaChecklist.MATRIZ,
              configuracion: { filas: ['Del. izq.', 'Del. der.'], columnas: ['Bueno', 'Regular', 'Malo'] },
            },
            { orden: 5, descripcion: 'Observaciones', tipoPregunta: TipoPreguntaChecklist.TEXTO },
          ],
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('actualizar / eliminar — OR-access-check', () => {
    it('permite editar por acceso directo CHECKLIST_TEMPLATE aunque no haya acceso al alcance', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(template());
      prisma.checklistTemplate.update.mockResolvedValue(template());
      rbac.tieneAcceso.mockImplementation((_u, recursoTipo: TipoRecursoAcceso) =>
        Promise.resolve(recursoTipo === TipoRecursoAcceso.CHECKLIST_TEMPLATE),
      );

      await service.actualizar(usuario, 't-1', { nombre: 'Nuevo nombre' });

      expect(rbac.tieneAcceso).toHaveBeenCalledWith(
        usuario,
        TipoRecursoAcceso.CHECKLIST_TEMPLATE,
        't-1',
        NivelAcceso.GESTIONAR,
      );
      expect(prisma.checklistTemplate.update).toHaveBeenCalled();
    });

    it('permite editar por acceso al alcance (categoría/ubicación) aunque no haya grant directo', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(template());
      prisma.checklistTemplate.update.mockResolvedValue(template());
      rbac.tieneAcceso.mockImplementation((_u, recursoTipo: TipoRecursoAcceso) =>
        Promise.resolve(recursoTipo === TipoRecursoAcceso.CATEGORIA_INVENTARIO),
      );

      await service.actualizar(usuario, 't-1', { nombre: 'Nuevo nombre' });

      expect(prisma.checklistTemplate.update).toHaveBeenCalled();
    });

    it('lanza ForbiddenException si no hay ni grant directo ni acceso al alcance', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(template());
      rbac.tieneAcceso.mockResolvedValue(false);

      await expect(
        service.actualizar(usuario, 't-1', { nombre: 'x' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.checklistTemplate.update).not.toHaveBeenCalled();
    });

    it('rechaza repuntar el alcance hacia una categoría que el usuario no administra (confused deputy)', async () => {
      // El usuario administra el alcance ORIGINAL (cat-1) pero no cat-2 — sólo
      // se checkeaba el origen antes del fix, permitiendo repuntar el
      // checklist hacia un alcance ajeno.
      prisma.checklistTemplate.findUnique.mockResolvedValue(template({ alcanceId: 'cat-1' }));
      prisma.categoriaInventario.findUnique.mockResolvedValue({ id: 'cat-2' });
      rbac.tieneAcceso.mockImplementation(
        (_u, recursoTipo: TipoRecursoAcceso, recursoId: string) =>
          Promise.resolve(
            recursoTipo === TipoRecursoAcceso.CATEGORIA_INVENTARIO && recursoId === 'cat-1',
          ),
      );

      await expect(
        service.actualizar(usuario, 't-1', { alcanceId: 'cat-2' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.checklistTemplate.update).not.toHaveBeenCalled();
    });

    it('permite repuntar el alcance si el usuario administra tanto el origen como el destino', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(template({ alcanceId: 'cat-1' }));
      prisma.categoriaInventario.findUnique.mockResolvedValue({ id: 'cat-2' });
      prisma.checklistTemplate.update.mockResolvedValue(template({ alcanceId: 'cat-2' }));
      rbac.tieneAcceso.mockImplementation(
        (_u, recursoTipo: TipoRecursoAcceso, recursoId: string) =>
          Promise.resolve(
            recursoTipo === TipoRecursoAcceso.CATEGORIA_INVENTARIO &&
              (recursoId === 'cat-1' || recursoId === 'cat-2'),
          ),
      );

      await service.actualizar(usuario, 't-1', { alcanceId: 'cat-2' });
      expect(prisma.checklistTemplate.update).toHaveBeenCalled();
    });

    it('eliminar aplica el mismo OR-check y limpia las Autorizacion del recurso', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(template());
      rbac.tieneAcceso.mockResolvedValue(true);

      await service.eliminar(usuario, 't-1');

      expect(prisma.checklistTemplate.delete).toHaveBeenCalledWith({
        where: { id: 't-1' },
      });
      expect(rbac.limpiarRecurso).toHaveBeenCalledWith(
        TipoRecursoAcceso.CHECKLIST_TEMPLATE,
        't-1',
      );
    });
  });

  describe('ejecutar', () => {
    const templateConItems = {
      ...template(),
      items: [
        {
          id: 'item-1',
          checklistTemplateId: 't-1',
          orden: 1,
          descripcion: 'Descripción vigente',
          tipoPregunta: TipoPreguntaChecklist.PASA_FALLA,
          configuracion: null,
        },
      ],
    };

    it('rechaza un checklistTemplateItemId que no pertenece al template', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(templateConItems);
      rbac.tieneAcceso.mockResolvedValue(true);

      await expect(
        service.ejecutar(usuario, 't-1', {
          items: [{ checklistTemplateItemId: 'item-ajeno', respuesta: true }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.checklistEjecucion.create).not.toHaveBeenCalled();
    });

    it('lanza ForbiddenException si no alcanza ni LEER', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(templateConItems);
      rbac.tieneAcceso.mockResolvedValue(false);

      await expect(
        service.ejecutar(usuario, 't-1', {
          items: [{ checklistTemplateItemId: 'item-1', respuesta: true }],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza ForbiddenException si el usuario autenticado no tiene un voluntario asociado', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(templateConItems);
      rbac.tieneAcceso.mockResolvedValue(true);
      prisma.voluntario.findUnique.mockResolvedValue(null);

      await expect(
        service.ejecutar(usuario, 't-1', {
          items: [{ checklistTemplateItemId: 'item-1', respuesta: true }],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.checklistEjecucion.create).not.toHaveBeenCalled();
    });

    it('copia la descripción y el tipoPregunta VIGENTES del ChecklistTemplateItem al crear la ejecución (snapshot, no referencia viva)', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(templateConItems);
      rbac.tieneAcceso.mockResolvedValue(true);
      prisma.checklistEjecucion.create.mockResolvedValue({ id: 'ej-1' });

      await service.ejecutar(usuario, 't-1', {
        observacionesGenerales: 'todo bien',
        items: [
          {
            checklistTemplateItemId: 'item-1',
            respuesta: true,
            observacion: 'ok',
          },
        ],
      });

      expect(prisma.checklistEjecucion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            // ejecutadoPorId debe ser el Voluntario.id resuelto, NUNCA el
            // User.id crudo del JWT (usuario.sub) — ChecklistEjecucion tiene
            // FK a Voluntario, no a User; usar sub directamente rompería con
            // un P2003 en la BD real (los mocks de Prisma no lo detectan).
            ejecutadoPorId: 'vol-del-usuario',
            items: {
              createMany: {
                data: [
                  {
                    checklistTemplateItemId: 'item-1',
                    // El DTO no trae "descripcion": este valor sólo puede
                    // venir de la plantilla vigente al momento de ejecutar.
                    descripcion: 'Descripción vigente',
                    tipoPregunta: TipoPreguntaChecklist.PASA_FALLA,
                    respuesta: true,
                    observacion: 'ok',
                  },
                ],
              },
            },
          }),
        }),
      );
    });

    it('si la plantilla cambia su descripción entre dos ejecuciones, cada una guarda la vigente en su momento', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValueOnce({
        ...templateConItems,
        items: [{ id: 'item-1', descripcion: 'Versión 1', tipoPregunta: TipoPreguntaChecklist.PASA_FALLA }],
      });
      rbac.tieneAcceso.mockResolvedValue(true);
      prisma.checklistEjecucion.create.mockResolvedValue({ id: 'ej-1' });

      await service.ejecutar(usuario, 't-1', {
        items: [{ checklistTemplateItemId: 'item-1', respuesta: true }],
      });
      const primeraDescripcion =
        prisma.checklistEjecucion.create.mock.calls[0][0].data.items.createMany
          .data[0].descripcion;

      prisma.checklistTemplate.findUnique.mockResolvedValueOnce({
        ...templateConItems,
        items: [{ id: 'item-1', descripcion: 'Versión 2 (editada)', tipoPregunta: TipoPreguntaChecklist.PASA_FALLA }],
      });
      await service.ejecutar(usuario, 't-1', {
        items: [{ checklistTemplateItemId: 'item-1', respuesta: false }],
      });
      const segundaDescripcion =
        prisma.checklistEjecucion.create.mock.calls[1][0].data.items.createMany
          .data[0].descripcion;

      expect(primeraDescripcion).toBe('Versión 1');
      expect(segundaDescripcion).toBe('Versión 2 (editada)');
    });
  });

  describe('ejecutar — validarRespuesta contra la pregunta VIGENTE', () => {
    function templateConItem(item: Partial<Record<string, unknown>>) {
      return {
        ...template(),
        items: [{ id: 'item-1', checklistTemplateId: 't-1', orden: 1, descripcion: 'Pregunta', ...item }],
      };
    }

    beforeEach(() => {
      rbac.tieneAcceso.mockResolvedValue(true);
      prisma.checklistEjecucion.create.mockResolvedValue({ id: 'ej-1' });
    });

    it('NUMERO: acepta un valor fuera del rango configurado (se flaggea en la UI, no se rechaza)', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(
        templateConItem({ tipoPregunta: TipoPreguntaChecklist.NUMERO, configuracion: { min: 28, max: 35 } }),
      );

      await expect(
        service.ejecutar(usuario, 't-1', { items: [{ checklistTemplateItemId: 'item-1', respuesta: 40 }] }),
      ).resolves.toBeDefined();
    });

    it('NUMERO: rechaza una respuesta que no es un número', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(
        templateConItem({ tipoPregunta: TipoPreguntaChecklist.NUMERO, configuracion: null }),
      );

      await expect(
        service.ejecutar(usuario, 't-1', { items: [{ checklistTemplateItemId: 'item-1', respuesta: 'no-numero' }] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEXTO: rechaza una respuesta vacía', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(
        templateConItem({ tipoPregunta: TipoPreguntaChecklist.TEXTO, configuracion: null }),
      );

      await expect(
        service.ejecutar(usuario, 't-1', { items: [{ checklistTemplateItemId: 'item-1', respuesta: '   ' }] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('SELECTOR (single): rechaza una opción que no existe en la configuración vigente', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(
        templateConItem({
          tipoPregunta: TipoPreguntaChecklist.SELECTOR,
          configuracion: { opciones: ['Lleno', 'Medio'], multiple: false },
        }),
      );

      await expect(
        service.ejecutar(usuario, 't-1', {
          items: [{ checklistTemplateItemId: 'item-1', respuesta: 'Vacío' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('SELECTOR (multiple): acepta un subconjunto válido de opciones', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(
        templateConItem({
          tipoPregunta: TipoPreguntaChecklist.SELECTOR,
          configuracion: { opciones: ['Extintor', 'Botiquín', 'Linterna'], multiple: true },
        }),
      );

      await expect(
        service.ejecutar(usuario, 't-1', {
          items: [{ checklistTemplateItemId: 'item-1', respuesta: ['Extintor', 'Botiquín'] }],
        }),
      ).resolves.toBeDefined();
    });

    it('MATRIZ: rechaza una submission que no cubre todas las filas', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(
        templateConItem({
          tipoPregunta: TipoPreguntaChecklist.MATRIZ,
          configuracion: { filas: ['Del. izq.', 'Del. der.'], columnas: ['Bueno', 'Regular', 'Malo'] },
        }),
      );

      await expect(
        service.ejecutar(usuario, 't-1', {
          items: [
            {
              checklistTemplateItemId: 'item-1',
              respuesta: [{ fila: 'Del. izq.', columna: 'Bueno' }],
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('MATRIZ: rechaza una columna que no está en la configuración vigente', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(
        templateConItem({
          tipoPregunta: TipoPreguntaChecklist.MATRIZ,
          configuracion: { filas: ['Del. izq.'], columnas: ['Bueno', 'Regular', 'Malo'] },
        }),
      );

      await expect(
        service.ejecutar(usuario, 't-1', {
          items: [
            { checklistTemplateItemId: 'item-1', respuesta: [{ fila: 'Del. izq.', columna: 'Excelente' }] },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('MATRIZ: acepta una submission completa y válida, guardada como array de pares', async () => {
      prisma.checklistTemplate.findUnique.mockResolvedValue(
        templateConItem({
          tipoPregunta: TipoPreguntaChecklist.MATRIZ,
          configuracion: { filas: ['Del. izq.', 'Del. der.'], columnas: ['Bueno', 'Regular', 'Malo'] },
        }),
      );
      const respuesta = [
        { fila: 'Del. izq.', columna: 'Bueno' },
        { fila: 'Del. der.', columna: 'Regular' },
      ];

      await service.ejecutar(usuario, 't-1', {
        items: [{ checklistTemplateItemId: 'item-1', respuesta }],
      });

      expect(prisma.checklistEjecucion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: {
              createMany: {
                data: [expect.objectContaining({ respuesta, tipoPregunta: TipoPreguntaChecklist.MATRIZ })],
              },
            },
          }),
        }),
      );
    });
  });

  describe('listar — vencidos', () => {
    beforeEach(() => {
      rbac.idsAccesibles.mockResolvedValue(IRRESTRICTO);
      prisma.itemInventario.findMany.mockResolvedValue([]);
    });

    it('ROLLING: vencido de inmediato si nunca se ejecutó', async () => {
      prisma.checklistTemplate.findMany.mockResolvedValue([
        template({ id: 't-rolling' }),
      ]);
      prisma.checklistEjecucion.findFirst.mockResolvedValue(null);

      const resultado = await service.listar(admin, { vencidos: true } as any);

      expect(resultado.data.map((t: any) => t.id)).toEqual(['t-rolling']);
    });

    it('ROLLING: NO vencido justo después de ejecutarse', async () => {
      prisma.checklistTemplate.findMany.mockResolvedValue([
        template({ id: 't-rolling', intervaloMinutos: 60 }),
      ]);
      prisma.checklistEjecucion.findFirst.mockResolvedValue({
        fechaEjecucion: new Date(),
      });

      const resultado = await service.listar(admin, { vencidos: true } as any);

      expect(resultado.data).toHaveLength(0);
    });

    it('ROLLING: vuelve a estar vencido una vez transcurrido intervaloMinutos', async () => {
      prisma.checklistTemplate.findMany.mockResolvedValue([
        template({ id: 't-rolling', intervaloMinutos: 60 }),
      ]);
      prisma.checklistEjecucion.findFirst.mockResolvedValue({
        fechaEjecucion: new Date(Date.now() - 61 * 60 * 1000),
      });

      const resultado = await service.listar(admin, { vencidos: true } as any);

      expect(resultado.data.map((t: any) => t.id)).toEqual(['t-rolling']);
    });

    it('POR_CAMBIO_TURNO: vencido si la asignación diaria de hoy no tiene ejecución', async () => {
      prisma.checklistTemplate.findMany.mockResolvedValue([
        template({
          id: 't-turno',
          tipoFrecuencia: TipoFrecuenciaChecklist.POR_CAMBIO_TURNO,
          intervaloMinutos: null,
        }),
      ]);
      prisma.citacion.findFirst.mockResolvedValueOnce({
        id: 'cit-1',
        fechaInicio: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
      });
      prisma.checklistEjecucion.findFirst.mockResolvedValue(null);

      const resultado = await service.listar(admin, { vencidos: true } as any);

      expect(resultado.data.map((t: any) => t.id)).toEqual(['t-turno']);
    });

    it('POR_CAMBIO_TURNO: resuelve una citación semanal cuando no hay asignación diaria', async () => {
      prisma.checklistTemplate.findMany.mockResolvedValue([
        template({
          id: 't-turno',
          tipoFrecuencia: TipoFrecuenciaChecklist.POR_CAMBIO_TURNO,
          intervaloMinutos: null,
        }),
      ]);
      prisma.citacion.findFirst
        .mockResolvedValueOnce(null) // no hay asignación diaria
        .mockResolvedValueOnce({ id: 'cit-semanal', fechaInicio: new Date('2026-07-13T00:00:00.000Z') });
      prisma.checklistEjecucion.findFirst.mockResolvedValue(null);

      const resultado = await service.listar(admin, { vencidos: true } as any);

      expect(resultado.data.map((t: any) => t.id)).toEqual(['t-turno']);
    });

    it('POR_CAMBIO_TURNO: no vencido (no aplica) si ninguna citación cubre hoy', async () => {
      prisma.checklistTemplate.findMany.mockResolvedValue([
        template({
          id: 't-turno',
          tipoFrecuencia: TipoFrecuenciaChecklist.POR_CAMBIO_TURNO,
          intervaloMinutos: null,
        }),
      ]);
      prisma.citacion.findFirst.mockResolvedValue(null);

      const resultado = await service.listar(admin, { vencidos: true } as any);

      expect(resultado.data).toHaveLength(0);
    });

    it('ANTES_DE_USO nunca aparece en la lista de vencidos', async () => {
      prisma.checklistTemplate.findMany.mockResolvedValue([
        template({
          id: 't-antes-uso',
          tipoFrecuencia: TipoFrecuenciaChecklist.ANTES_DE_USO,
          intervaloMinutos: null,
        }),
      ]);

      const resultado = await service.listar(admin, { vencidos: true } as any);

      expect(resultado.data).toHaveLength(0);
      expect(prisma.checklistEjecucion.findFirst).not.toHaveBeenCalled();
      expect(prisma.citacion.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('listar — filtrado por permisos (no vencidos)', () => {
    it('sin irrestricto, filtra por acceso directo o al alcance', async () => {
      rbac.idsAccesibles.mockImplementation(
        (_u, recursoTipo: TipoRecursoAcceso) => {
          if (recursoTipo === TipoRecursoAcceso.CATEGORIA_INVENTARIO) {
            return Promise.resolve({ irrestricto: false, ids: ['cat-1'] });
          }
          return Promise.resolve(ninguno);
        },
      );
      prisma.checklistTemplate.findMany.mockResolvedValue([
        template({ id: 't-visible', alcanceId: 'cat-1' }),
        template({ id: 't-oculto', alcanceId: 'cat-2' }),
      ]);
      prisma.itemInventario.findMany.mockResolvedValue([]);

      const resultado = await service.listar(usuario, {} as any);

      expect(resultado.data.map((t: any) => t.id)).toEqual(['t-visible']);
      expect(resultado.meta.total).toBe(1);
    });
  });

  describe('notificarVencidos (scheduler)', () => {
    it('no notifica templates que no están vencidos', async () => {
      prisma.checklistTemplate.findMany.mockResolvedValue([
        template({ id: 't-1', tipoFrecuencia: TipoFrecuenciaChecklist.ROLLING, intervaloMinutos: 60 }),
      ]);
      prisma.checklistEjecucion.findFirst.mockResolvedValue({
        fechaEjecucion: new Date(), // recién ejecutado -> no vencido
      });

      await service.notificarVencidos();

      expect(notificaciones.crearParaMuchos).not.toHaveBeenCalled();
    });

    it('notifica a quienes tienen acceso al alcance del template más a todos los ADMIN, deduplicado', async () => {
      prisma.checklistTemplate.findMany.mockResolvedValue([
        template({ id: 't-1', tipoFrecuencia: TipoFrecuenciaChecklist.ROLLING, intervaloMinutos: 60, alcanceId: 'cat-1' }),
      ]);
      prisma.checklistEjecucion.findFirst.mockResolvedValue(null); // nunca ejecutado -> vencido
      prisma.notificacion.findFirst.mockResolvedValue(null); // aún no notificado
      rbac.voluntariosConAcceso.mockImplementation(
        (recursoTipo: TipoRecursoAcceso) => {
          if (recursoTipo === TipoRecursoAcceso.CHECKLIST_TEMPLATE) return Promise.resolve(['vol-x']);
          if (recursoTipo === TipoRecursoAcceso.CATEGORIA_INVENTARIO) return Promise.resolve(['vol-y', 'admin-1']);
          return Promise.resolve([]);
        },
      );
      rbac.voluntariosConRolAdmin.mockResolvedValue(['admin-1']);

      await service.notificarVencidos();

      expect(notificaciones.crearParaMuchos).toHaveBeenCalledTimes(1);
      const [destinatarios, tipo] = notificaciones.crearParaMuchos.mock.calls[0];
      expect(destinatarios.sort()).toEqual(['admin-1', 'vol-x', 'vol-y']); // admin-1 dedupeado
      expect(tipo).toBe(TipoNotificacion.CHECKLIST_VENCIDO);
    });

    it('no vuelve a notificar si ya existe una notificación CHECKLIST_VENCIDO desde la última ejecución (dedup)', async () => {
      prisma.checklistTemplate.findMany.mockResolvedValue([
        template({ id: 't-1', tipoFrecuencia: TipoFrecuenciaChecklist.ROLLING, intervaloMinutos: 60 }),
      ]);
      prisma.checklistEjecucion.findFirst.mockResolvedValue(null);
      prisma.notificacion.findFirst.mockResolvedValue({ id: 'notif-ya-enviada' });

      await service.notificarVencidos();

      expect(notificaciones.crearParaMuchos).not.toHaveBeenCalled();
    });

    it('no notifica si no hay ningún destinatario resuelto (sin grants ni admins)', async () => {
      prisma.checklistTemplate.findMany.mockResolvedValue([
        template({ id: 't-1', tipoFrecuencia: TipoFrecuenciaChecklist.ROLLING, intervaloMinutos: 60 }),
      ]);
      prisma.checklistEjecucion.findFirst.mockResolvedValue(null);
      prisma.notificacion.findFirst.mockResolvedValue(null);
      rbac.voluntariosConAcceso.mockResolvedValue([]);
      rbac.voluntariosConRolAdmin.mockResolvedValue([]);

      await service.notificarVencidos();

      expect(notificaciones.crearParaMuchos).not.toHaveBeenCalled();
    });

    it('vuelve a notificar tras un nuevo episodio de vencimiento posterior a una ejecución', async () => {
      // Ya se había notificado una vez (vieja) — pero eso fue ANTES de la
      // última ejecución, así que yaNotificadoVencido() no debe considerarla:
      // el filtro createdAt >= última ejecución excluye la notificación
      // vieja, dejando pasar una nueva para este segundo episodio vencido.
      prisma.checklistTemplate.findMany.mockResolvedValue([
        template({ id: 't-1', tipoFrecuencia: TipoFrecuenciaChecklist.ROLLING, intervaloMinutos: 60 }),
      ]);
      const ultimaEjecucion = new Date('2026-07-10T00:00:00.000Z');
      prisma.checklistEjecucion.findFirst.mockResolvedValue({ fechaEjecucion: ultimaEjecucion });
      // Simula el filtro real: sólo cuenta si createdAt >= ultimaEjecucion.
      prisma.notificacion.findFirst.mockImplementation(
        async ({ where }: { where: { createdAt?: { gte: Date } } }) =>
          where.createdAt && where.createdAt.gte.getTime() === ultimaEjecucion.getTime()
            ? null // no hay notificación desde la última ejecución -> vuelve a notificar
            : { id: 'notif-vieja' },
      );
      rbac.voluntariosConAcceso.mockResolvedValue(['vol-1']);
      rbac.voluntariosConRolAdmin.mockResolvedValue([]);

      await service.notificarVencidos();

      expect(notificaciones.crearParaMuchos).toHaveBeenCalledWith(
        ['vol-1'],
        TipoNotificacion.CHECKLIST_VENCIDO,
        expect.any(String),
        expect.any(String),
        { templateId: 't-1' },
      );
    });
  });
});
