import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NivelAcceso,
  Prisma,
  TipoAlcanceChecklist,
  TipoFrecuenciaChecklist,
  TipoNotificacion,
  TipoPreguntaChecklist,
  TipoRecursoAcceso,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { ChecklistTemplateItemDto } from './dto/checklist-template-item.dto';
import { CreateChecklistTemplateDto } from './dto/create-checklist-template.dto';
import { CreateEjecucionDto } from './dto/create-ejecucion.dto';
import { QueryEjecucionesDto } from './dto/query-ejecuciones.dto';
import { QueryTemplatesDto } from './dto/query-templates.dto';
import { UpdateChecklistTemplateDto } from './dto/update-checklist-template.dto';

interface ConfiguracionNumero {
  min?: number;
  max?: number;
}

interface ConfiguracionSelector {
  opciones: string[];
  multiple: boolean;
}

interface ConfiguracionMatriz {
  filas: string[];
  columnas: string[];
}

interface RespuestaMatrizPar {
  fila: string;
  columna: string;
}

const VOLUNTARIO_SELECT = {
  id: true,
  nombres: true,
  apellidoP: true,
  correlativo: true,
  tipo: true,
} satisfies Prisma.VoluntarioSelect;

type TemplateAlcance = {
  id: string;
  alcanceTipo: TipoAlcanceChecklist;
  alcanceId: string;
};

function parseFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function hoyComoFecha(): Date {
  return parseFecha(new Date().toISOString().slice(0, 10));
}

@Injectable()
export class ChecklistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  // AuthenticatedUser.sub es el User.id del JWT, NO el Voluntario.id que
  // ChecklistEjecucion.ejecutadoPorId requiere (FK a Voluntario) — hay que
  // resolverlo, igual que ya hace permisos.service.ts.
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

  private async buscarTemplateOFallar(id: string) {
    const template = await this.prisma.checklistTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException('Checklist no encontrado');
    }
    return template;
  }

  private validarFrecuencia(
    tipoFrecuencia: TipoFrecuenciaChecklist,
    intervaloMinutos: number | null | undefined,
  ): void {
    if (
      tipoFrecuencia === TipoFrecuenciaChecklist.ROLLING &&
      (intervaloMinutos === undefined || intervaloMinutos === null)
    ) {
      throw new BadRequestException(
        'intervaloMinutos es requerido cuando la frecuencia es ROLLING',
      );
    }
    if (
      tipoFrecuencia !== TipoFrecuenciaChecklist.ROLLING &&
      intervaloMinutos !== undefined &&
      intervaloMinutos !== null
    ) {
      throw new BadRequestException(
        'intervaloMinutos solo puede indicarse cuando la frecuencia es ROLLING',
      );
    }
  }

  /**
   * Mismo patrón que validarFrecuencia(): la forma de configuracion depende
   * del valor de tipoPregunta (un campo condicionado por otro), algo que
   * class-validator no expresa limpiamente — se valida a mano acá en vez de
   * forzarlo en el DTO.
   */
  private validarConfiguracion(item: ChecklistTemplateItemDto): void {
    const tipoPregunta = item.tipoPregunta ?? TipoPreguntaChecklist.PASA_FALLA;
    const configuracion = item.configuracion as Record<string, unknown> | undefined;

    if (
      (tipoPregunta === TipoPreguntaChecklist.PASA_FALLA ||
        tipoPregunta === TipoPreguntaChecklist.TEXTO) &&
      configuracion !== undefined
    ) {
      throw new BadRequestException(
        `El item "${item.descripcion}" no admite configuracion para el tipo ${tipoPregunta}`,
      );
    }

    if (tipoPregunta === TipoPreguntaChecklist.NUMERO && configuracion !== undefined) {
      const { min, max } = configuracion as ConfiguracionNumero;
      if (min !== undefined && typeof min !== 'number') {
        throw new BadRequestException(
          `El item "${item.descripcion}": min debe ser un número`,
        );
      }
      if (max !== undefined && typeof max !== 'number') {
        throw new BadRequestException(
          `El item "${item.descripcion}": max debe ser un número`,
        );
      }
      if (min !== undefined && max !== undefined && min > max) {
        throw new BadRequestException(
          `El item "${item.descripcion}": min no puede ser mayor que max`,
        );
      }
    }

    if (tipoPregunta === TipoPreguntaChecklist.SELECTOR) {
      const { opciones, multiple } = (configuracion ?? {}) as Partial<ConfiguracionSelector>;
      if (!Array.isArray(opciones) || opciones.length === 0) {
        throw new BadRequestException(
          `El item "${item.descripcion}": SELECTOR requiere una lista de opciones no vacía`,
        );
      }
      if (typeof multiple !== 'boolean') {
        throw new BadRequestException(
          `El item "${item.descripcion}": SELECTOR requiere indicar si permite selección múltiple`,
        );
      }
    }

    if (tipoPregunta === TipoPreguntaChecklist.MATRIZ) {
      const { filas, columnas } = (configuracion ?? {}) as Partial<ConfiguracionMatriz>;
      if (!Array.isArray(filas) || filas.length === 0) {
        throw new BadRequestException(
          `El item "${item.descripcion}": MATRIZ requiere una lista de filas no vacía`,
        );
      }
      if (!Array.isArray(columnas) || columnas.length === 0) {
        throw new BadRequestException(
          `El item "${item.descripcion}": MATRIZ requiere una lista de columnas no vacía`,
        );
      }
    }
  }

  /**
   * Valida una respuesta contra la pregunta VIGENTE (nunca contra una
   * configuracion enviada por el cliente ni un snapshot previo) — igual
   * razón que el resto del código de este proyecto nunca confía en un id o
   * configuración provista por el cliente sin re-chequearla contra el
   * estado real.
   */
  private validarRespuesta(
    item: { tipoPregunta: TipoPreguntaChecklist; configuracion: Prisma.JsonValue },
    respuesta: unknown,
  ): void {
    const configuracion = item.configuracion as Record<string, unknown> | null;

    if (item.tipoPregunta === TipoPreguntaChecklist.PASA_FALLA) {
      if (typeof respuesta !== 'boolean') {
        throw new BadRequestException('La respuesta debe ser verdadero o falso');
      }
      return;
    }

    if (item.tipoPregunta === TipoPreguntaChecklist.NUMERO) {
      if (typeof respuesta !== 'number' || !Number.isFinite(respuesta)) {
        throw new BadRequestException('La respuesta debe ser un número');
      }
      return;
    }

    if (item.tipoPregunta === TipoPreguntaChecklist.TEXTO) {
      if (typeof respuesta !== 'string' || respuesta.trim().length === 0) {
        throw new BadRequestException('La respuesta de texto no puede estar vacía');
      }
      return;
    }

    if (item.tipoPregunta === TipoPreguntaChecklist.SELECTOR) {
      const { opciones, multiple } = (configuracion ?? {}) as Partial<ConfiguracionSelector>;
      const opcionesValidas = new Set(opciones ?? []);

      if (multiple) {
        if (!Array.isArray(respuesta) || respuesta.length === 0) {
          throw new BadRequestException('Debes seleccionar al menos una opción');
        }
        if (!respuesta.every((r) => typeof r === 'string' && opcionesValidas.has(r))) {
          throw new BadRequestException('Una o más opciones seleccionadas no son válidas');
        }
      } else {
        if (typeof respuesta !== 'string' || !opcionesValidas.has(respuesta)) {
          throw new BadRequestException('La opción seleccionada no es válida');
        }
      }
      return;
    }

    if (item.tipoPregunta === TipoPreguntaChecklist.MATRIZ) {
      const { filas, columnas } = (configuracion ?? {}) as Partial<ConfiguracionMatriz>;
      const filasValidas = new Set(filas ?? []);
      const columnasValidas = new Set(columnas ?? []);

      if (!Array.isArray(respuesta)) {
        throw new BadRequestException('La respuesta de matriz debe ser una lista de fila/columna');
      }
      const pares = respuesta as RespuestaMatrizPar[];
      const filasRespondidas = new Set<string>();
      for (const par of pares) {
        if (
          !par ||
          typeof par.fila !== 'string' ||
          typeof par.columna !== 'string' ||
          !filasValidas.has(par.fila) ||
          !columnasValidas.has(par.columna)
        ) {
          throw new BadRequestException('La matriz contiene una fila o columna no válida');
        }
        if (filasRespondidas.has(par.fila)) {
          throw new BadRequestException(`La fila "${par.fila}" está respondida más de una vez`);
        }
        filasRespondidas.add(par.fila);
      }
      if (filasRespondidas.size !== filasValidas.size) {
        throw new BadRequestException('Debes responder todas las filas de la matriz');
      }
    }
  }

  private async validarAlcanceExiste(
    alcanceTipo: TipoAlcanceChecklist,
    alcanceId: string,
  ): Promise<void> {
    const existe = await (alcanceTipo === TipoAlcanceChecklist.CATEGORIA_INVENTARIO
      ? this.prisma.categoriaInventario.findUnique({ where: { id: alcanceId } })
      : alcanceTipo === TipoAlcanceChecklist.UBICACION
        ? this.prisma.ubicacion.findUnique({ where: { id: alcanceId } })
        : this.prisma.itemInventario.findUnique({ where: { id: alcanceId } }));

    if (!existe) {
      throw new BadRequestException(
        'El alcance indicado no existe para el tipo especificado',
      );
    }
  }

  private mapAlcanceARecurso(
    alcanceTipo: TipoAlcanceChecklist,
  ): TipoRecursoAcceso | null {
    if (alcanceTipo === TipoAlcanceChecklist.CATEGORIA_INVENTARIO) {
      return TipoRecursoAcceso.CATEGORIA_INVENTARIO;
    }
    if (alcanceTipo === TipoAlcanceChecklist.UBICACION) {
      return TipoRecursoAcceso.UBICACION;
    }
    return null;
  }

  /**
   * ITEM_INVENTARIO no tiene un TipoRecursoAcceso propio (ver enum en
   * schema.prisma): el acceso a un alcance de ese tipo se resuelve vía la
   * categoría o ubicación del item referenciado — mismo OR que usa el
   * módulo de inventario para sus propios items.
   */
  private async tieneAccesoAlcance(
    user: AuthenticatedUser,
    alcanceTipo: TipoAlcanceChecklist,
    alcanceId: string,
    nivelMinimo: NivelAcceso,
  ): Promise<boolean> {
    const recursoTipo = this.mapAlcanceARecurso(alcanceTipo);
    if (recursoTipo) {
      return this.rbacService.tieneAcceso(user, recursoTipo, alcanceId, nivelMinimo);
    }

    const item = await this.prisma.itemInventario.findUnique({
      where: { id: alcanceId },
    });
    if (!item) return false;

    const [porCategoria, porUbicacion] = await Promise.all([
      this.rbacService.tieneAcceso(
        user,
        TipoRecursoAcceso.CATEGORIA_INVENTARIO,
        item.categoriaId,
        nivelMinimo,
      ),
      this.rbacService.tieneAcceso(
        user,
        TipoRecursoAcceso.UBICACION,
        item.ubicacionId,
        nivelMinimo,
      ),
    ]);
    return porCategoria || porUbicacion;
  }

  /**
   * Acceso a una plantilla YA EXISTENTE: OR entre (a) un grant directo/de
   * grupo de tipo CHECKLIST_TEMPLATE sobre el propio template.id, o (b)
   * acceso al alcance (categoría/ubicación, o categoría/ubicación del item)
   * al que apunta el template.
   */
  private async tieneAccesoTemplate(
    user: AuthenticatedUser,
    template: TemplateAlcance,
    nivelMinimo: NivelAcceso,
  ): Promise<boolean> {
    const porTemplate = await this.rbacService.tieneAcceso(
      user,
      TipoRecursoAcceso.CHECKLIST_TEMPLATE,
      template.id,
      nivelMinimo,
    );
    if (porTemplate) return true;

    return this.tieneAccesoAlcance(
      user,
      template.alcanceTipo,
      template.alcanceId,
      nivelMinimo,
    );
  }

  async crearTemplate(user: AuthenticatedUser, dto: CreateChecklistTemplateDto) {
    this.validarFrecuencia(dto.tipoFrecuencia, dto.intervaloMinutos);
    await this.validarAlcanceExiste(dto.alcanceTipo, dto.alcanceId);

    const tieneAcceso = await this.tieneAccesoAlcance(
      user,
      dto.alcanceTipo,
      dto.alcanceId,
      NivelAcceso.GESTIONAR,
    );
    if (!tieneAcceso) {
      throw new ForbiddenException(
        'No tienes permisos para crear un checklist en este alcance',
      );
    }

    const ordenes = dto.items.map((i) => i.orden);
    if (new Set(ordenes).size !== ordenes.length) {
      throw new BadRequestException('No puede haber items con el mismo orden');
    }

    dto.items.forEach((item) => this.validarConfiguracion(item));

    return this.prisma.checklistTemplate.create({
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        alcanceTipo: dto.alcanceTipo,
        alcanceId: dto.alcanceId,
        tipoFrecuencia: dto.tipoFrecuencia,
        intervaloMinutos:
          dto.tipoFrecuencia === TipoFrecuenciaChecklist.ROLLING
            ? dto.intervaloMinutos
            : null,
        items: {
          createMany: {
            data: dto.items.map((i) => ({
              orden: i.orden,
              descripcion: i.descripcion,
              tipoPregunta: i.tipoPregunta ?? TipoPreguntaChecklist.PASA_FALLA,
              configuracion: (i.configuracion ?? undefined) as Prisma.InputJsonValue,
            })),
          },
        },
      },
      include: { items: { orderBy: { orden: 'asc' } } },
    });
  }

  /**
   * Lista paginada, filtrada por permisos. Un template es visible si el
   * usuario tiene, al menos, LEER sobre (a) el propio template.id
   * (CHECKLIST_TEMPLATE) o (b) su alcance (categoría/ubicación directa, o
   * la categoría/ubicación del item cuando alcanceTipo=ITEM_INVENTARIO).
   *
   * Se resuelve trayendo TODOS los templates y filtrando en memoria contra
   * los sets de ids accesibles, en vez de construir un único where de
   * Prisma para esta unión de tres fuentes de acceso. Es una simplificación
   * deliberada: el volumen esperado de ChecklistTemplate es de decenas a
   * cientos, no miles, así que el costo de traer todos y filtrar en JS es
   * insignificante comparado con la complejidad de expresarlo en SQL.
   */
  async listar(user: AuthenticatedUser, query: QueryTemplatesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [templateAcceso, categoriaAcceso, ubicacionAcceso] = await Promise.all([
      this.rbacService.idsAccesibles(
        user,
        TipoRecursoAcceso.CHECKLIST_TEMPLATE,
        NivelAcceso.LEER,
      ),
      this.rbacService.idsAccesibles(
        user,
        TipoRecursoAcceso.CATEGORIA_INVENTARIO,
        NivelAcceso.LEER,
      ),
      this.rbacService.idsAccesibles(
        user,
        TipoRecursoAcceso.UBICACION,
        NivelAcceso.LEER,
      ),
    ]);
    // Los tres idsAccesibles() son irrestricto=true simultáneamente sólo
    // para ADMIN (RbacService.esAdmin es lo único que produce ese flag).
    const irrestricto = templateAcceso.irrestricto;

    const todos = await this.prisma.checklistTemplate.findMany({
      orderBy: { nombre: 'asc' },
    });

    const idsItemsAlcance = todos
      .filter((t) => t.alcanceTipo === TipoAlcanceChecklist.ITEM_INVENTARIO)
      .map((t) => t.alcanceId);
    const itemsAlcance = idsItemsAlcance.length
      ? await this.prisma.itemInventario.findMany({
          where: { id: { in: idsItemsAlcance } },
          select: { id: true, categoriaId: true, ubicacionId: true },
        })
      : [];
    const itemPorId = new Map(itemsAlcance.map((i) => [i.id, i]));

    const templateIdsSet = new Set(templateAcceso.ids);
    const categoriaIdsSet = new Set(categoriaAcceso.ids);
    const ubicacionIdsSet = new Set(ubicacionAcceso.ids);

    const accesibles = irrestricto
      ? todos
      : todos.filter((t) => {
          if (templateIdsSet.has(t.id)) return true;
          if (t.alcanceTipo === TipoAlcanceChecklist.CATEGORIA_INVENTARIO) {
            return categoriaIdsSet.has(t.alcanceId);
          }
          if (t.alcanceTipo === TipoAlcanceChecklist.UBICACION) {
            return ubicacionIdsSet.has(t.alcanceId);
          }
          const item = itemPorId.get(t.alcanceId);
          return (
            !!item &&
            (categoriaIdsSet.has(item.categoriaId) ||
              ubicacionIdsSet.has(item.ubicacionId))
          );
        });

    let filtrados = accesibles;
    if (query.vencidos) {
      const vencidosFlags = await Promise.all(
        filtrados.map((t) => this.estaVencido(t)),
      );
      filtrados = filtrados.filter((_, i) => vencidosFlags[i]);
    }

    const total = filtrados.length;
    const inicio = (page - 1) * limit;
    const data = filtrados.slice(inicio, inicio + limit);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  private async obtenerCitacionDeHoy(): Promise<{
    id: string;
    fechaInicio: Date;
  } | null> {
    const hoy = hoyComoFecha();

    const asignacionDiaria = await this.prisma.citacion.findFirst({
      where: { fechaFin: null, fechaInicio: hoy },
    });
    if (asignacionDiaria) return asignacionDiaria;

    return this.prisma.citacion.findFirst({
      where: {
        AND: [
          { fechaFin: { not: null } },
          { fechaInicio: { lte: hoy } },
          { fechaFin: { gte: hoy } },
        ],
      },
    });
  }

  /**
   * Semántica de "vencido" según tipoFrecuencia (ver plan aprobado):
   * - ROLLING: vencido si ahora >= última ejecución + intervaloMinutos, o
   *   de inmediato si nunca se ha ejecutado.
   * - POR_CAMBIO_TURNO: vencido si no hay ejecución desde el inicio de la
   *   citación/asignación que cubre hoy. Si ninguna citación cubre hoy, no
   *   hay nada a qué anclar: no aplica (no vencido).
   * - ANTES_DE_USO: nunca vencido — siempre ejecutable ad-hoc.
   */
  private async estaVencido(template: {
    id: string;
    tipoFrecuencia: TipoFrecuenciaChecklist;
    intervaloMinutos: number | null;
  }): Promise<boolean> {
    if (template.tipoFrecuencia === TipoFrecuenciaChecklist.ANTES_DE_USO) {
      return false;
    }

    if (template.tipoFrecuencia === TipoFrecuenciaChecklist.ROLLING) {
      const ultima = await this.prisma.checklistEjecucion.findFirst({
        where: { checklistTemplateId: template.id },
        orderBy: { fechaEjecucion: 'desc' },
      });
      if (!ultima) return true;

      const intervaloMs = (template.intervaloMinutos ?? 0) * 60 * 1000;
      return Date.now() >= ultima.fechaEjecucion.getTime() + intervaloMs;
    }

    // POR_CAMBIO_TURNO
    const citacion = await this.obtenerCitacionDeHoy();
    if (!citacion) return false;

    const ejecucionDesdeCitacion = await this.prisma.checklistEjecucion.findFirst({
      where: {
        checklistTemplateId: template.id,
        fechaEjecucion: { gte: citacion.fechaInicio },
      },
    });
    return !ejecucionDesdeCitacion;
  }

  /**
   * Variante de sistema de estaVencido(): recorre TODOS los templates
   * ROLLING/POR_CAMBIO_TURNO activos, sin filtrar por lo que un usuario en
   * particular puede ver (a diferencia de listar(), que sí filtra por
   * permisos del que consulta) — la usa el scheduler, no un endpoint.
   */
  async templatesVencidosParaNotificar() {
    const templates = await this.prisma.checklistTemplate.findMany({
      where: {
        activo: true,
        tipoFrecuencia: {
          in: [TipoFrecuenciaChecklist.ROLLING, TipoFrecuenciaChecklist.POR_CAMBIO_TURNO],
        },
      },
    });
    const vencidoFlags = await Promise.all(templates.map((t) => this.estaVencido(t)));
    return templates.filter((_, i) => vencidoFlags[i]);
  }

  /** Mismo OR que tieneAccesoTemplate()/tieneAccesoAlcance(), pero resuelto
   * en la dirección "quiénes" en vez de "puede este usuario" — unión de
   * grants directos sobre el template, grants sobre su alcance, y todos los
   * ADMIN (que no dependen de grants). */
  private async recipientesDelTemplate(template: TemplateAlcance): Promise<string[]> {
    const porTemplate = await this.rbacService.voluntariosConAcceso(
      TipoRecursoAcceso.CHECKLIST_TEMPLATE,
      template.id,
      NivelAcceso.LEER,
    );

    let porAlcance: string[] = [];
    const recursoTipo = this.mapAlcanceARecurso(template.alcanceTipo);
    if (recursoTipo) {
      porAlcance = await this.rbacService.voluntariosConAcceso(
        recursoTipo,
        template.alcanceId,
        NivelAcceso.LEER,
      );
    } else {
      const item = await this.prisma.itemInventario.findUnique({
        where: { id: template.alcanceId },
      });
      if (item) {
        const [porCategoria, porUbicacion] = await Promise.all([
          this.rbacService.voluntariosConAcceso(
            TipoRecursoAcceso.CATEGORIA_INVENTARIO,
            item.categoriaId,
            NivelAcceso.LEER,
          ),
          this.rbacService.voluntariosConAcceso(
            TipoRecursoAcceso.UBICACION,
            item.ubicacionId,
            NivelAcceso.LEER,
          ),
        ]);
        porAlcance = [...porCategoria, ...porUbicacion];
      }
    }

    const admins = await this.rbacService.voluntariosConRolAdmin();
    return [...new Set([...porTemplate, ...porAlcance, ...admins])];
  }

  /**
   * Dedup: reutiliza la propia tabla Notificacion como fuente de verdad en
   * vez de agregar una columna de tracking nueva — ¿ya se notificó este
   * template como vencido desde su última ejecución (o alguna vez, si nunca
   * se ha ejecutado)? Si sí, el scheduler no debe volver a notificar en
   * cada corrida mientras siga vencido.
   */
  private async yaNotificadoVencido(templateId: string, desde: Date | null): Promise<boolean> {
    const existente = await this.prisma.notificacion.findFirst({
      where: {
        tipo: TipoNotificacion.CHECKLIST_VENCIDO,
        datos: { path: ['templateId'], equals: templateId },
        ...(desde ? { createdAt: { gte: desde } } : {}),
      },
    });
    return !!existente;
  }

  /** Llamado por el scheduler (@Cron) — nunca por un endpoint. */
  async notificarVencidos(): Promise<void> {
    const vencidos = await this.templatesVencidosParaNotificar();

    for (const template of vencidos) {
      const ultima = await this.prisma.checklistEjecucion.findFirst({
        where: { checklistTemplateId: template.id },
        orderBy: { fechaEjecucion: 'desc' },
      });

      if (await this.yaNotificadoVencido(template.id, ultima?.fechaEjecucion ?? null)) {
        continue;
      }

      const destinatarios = await this.recipientesDelTemplate(template);
      if (destinatarios.length === 0) continue;

      await this.notificacionesService.crearParaMuchos(
        destinatarios,
        TipoNotificacion.CHECKLIST_VENCIDO,
        'Checklist vencido',
        `El checklist "${template.nombre}" está vencido y necesita ejecutarse`,
        { templateId: template.id },
      );
    }
  }

  async actualizar(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateChecklistTemplateDto,
  ) {
    const template = await this.buscarTemplateOFallar(id);
    if (!(await this.tieneAccesoTemplate(user, template, NivelAcceso.GESTIONAR))) {
      throw new ForbiddenException('No tienes permisos para editar este checklist');
    }

    const tipoFrecuencia = dto.tipoFrecuencia ?? template.tipoFrecuencia;
    const intervaloMinutos =
      dto.intervaloMinutos !== undefined
        ? dto.intervaloMinutos
        : template.intervaloMinutos;
    this.validarFrecuencia(tipoFrecuencia, intervaloMinutos);

    const alcanceTipo = dto.alcanceTipo ?? template.alcanceTipo;
    const alcanceId = dto.alcanceId ?? template.alcanceId;
    if (dto.alcanceTipo !== undefined || dto.alcanceId !== undefined) {
      await this.validarAlcanceExiste(alcanceTipo, alcanceId);

      // Re-alcanzar el template no debe bastar con GESTIONAR sobre el alcance
      // ORIGINAL (ya verificado arriba) — también se requiere GESTIONAR sobre
      // el alcance DESTINO, o un usuario podría repuntar un checklist que
      // administra hacia una categoría/ubicación/item que no administra.
      const tieneAccesoDestino = await this.tieneAccesoAlcance(
        user,
        alcanceTipo,
        alcanceId,
        NivelAcceso.GESTIONAR,
      );
      if (!tieneAccesoDestino) {
        throw new ForbiddenException(
          'No tienes permisos para asignar este checklist al alcance indicado',
        );
      }
    }

    return this.prisma.checklistTemplate.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
        ...(dto.descripcion !== undefined ? { descripcion: dto.descripcion } : {}),
        ...(dto.alcanceTipo !== undefined ? { alcanceTipo: dto.alcanceTipo } : {}),
        ...(dto.alcanceId !== undefined ? { alcanceId: dto.alcanceId } : {}),
        ...(dto.tipoFrecuencia !== undefined
          ? { tipoFrecuencia: dto.tipoFrecuencia }
          : {}),
        ...(dto.tipoFrecuencia !== undefined || dto.intervaloMinutos !== undefined
          ? {
              intervaloMinutos:
                tipoFrecuencia === TipoFrecuenciaChecklist.ROLLING
                  ? intervaloMinutos
                  : null,
            }
          : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });
  }

  async eliminar(user: AuthenticatedUser, id: string) {
    const template = await this.buscarTemplateOFallar(id);
    if (!(await this.tieneAccesoTemplate(user, template, NivelAcceso.GESTIONAR))) {
      throw new ForbiddenException(
        'No tienes permisos para eliminar este checklist',
      );
    }

    await this.prisma.checklistTemplate.delete({ where: { id } });
    await this.rbacService.limpiarRecurso(TipoRecursoAcceso.CHECKLIST_TEMPLATE, id);

    return { message: 'Checklist eliminado correctamente' };
  }

  async ejecutar(
    user: AuthenticatedUser,
    templateId: string,
    dto: CreateEjecucionDto,
  ) {
    const template = await this.prisma.checklistTemplate.findUnique({
      where: { id: templateId },
      include: { items: true },
    });
    if (!template) {
      throw new NotFoundException('Checklist no encontrado');
    }

    if (!(await this.tieneAccesoTemplate(user, template, NivelAcceso.LEER))) {
      throw new ForbiddenException(
        'No tienes permisos para ejecutar este checklist',
      );
    }

    const itemsPorId = new Map(template.items.map((i) => [i.id, i]));
    for (const item of dto.items) {
      const templateItem = itemsPorId.get(item.checklistTemplateItemId);
      if (!templateItem) {
        throw new BadRequestException(
          'Uno o más items no pertenecen a este checklist',
        );
      }
      // Validado contra la pregunta VIGENTE, nunca contra una configuración
      // enviada por el cliente — si un admin cambió las opciones/filas entre
      // que el usuario cargó el formulario y envió la respuesta, esto la
      // rechaza en vez de aceptar una respuesta que ya no corresponde.
      this.validarRespuesta(templateItem, item.respuesta);
    }

    const ejecutadoPorId = await this.voluntarioIdDeUsuario(user.sub);

    return this.prisma.checklistEjecucion.create({
      data: {
        checklistTemplateId: templateId,
        ejecutadoPorId,
        observacionesGenerales: dto.observacionesGenerales,
        items: {
          createMany: {
            data: dto.items.map((item) => {
              const templateItem = itemsPorId.get(item.checklistTemplateItemId)!;
              return {
                checklistTemplateItemId: item.checklistTemplateItemId,
                // Snapshot: se copia la descripción y el tipoPregunta
                // VIGENTES del ChecklistTemplateItem al momento de ejecutar —
                // no una referencia viva. Si más adelante se edita la
                // pregunta en la plantilla, este registro histórico sigue
                // mostrando lo que realmente se preguntó en su momento.
                descripcion: templateItem.descripcion,
                tipoPregunta: templateItem.tipoPregunta,
                respuesta: item.respuesta as Prisma.InputJsonValue,
                observacion: item.observacion,
              };
            }),
          },
        },
      },
      include: { items: true },
    });
  }

  async historial(
    user: AuthenticatedUser,
    templateId: string,
    query: QueryEjecucionesDto,
  ) {
    const template = await this.buscarTemplateOFallar(templateId);
    if (!(await this.tieneAccesoTemplate(user, template, NivelAcceso.LEER))) {
      throw new ForbiddenException(
        'No tienes permisos para ver el historial de este checklist',
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [total, ejecuciones] = await this.prisma.$transaction([
      this.prisma.checklistEjecucion.count({
        where: { checklistTemplateId: templateId },
      }),
      this.prisma.checklistEjecucion.findMany({
        where: { checklistTemplateId: templateId },
        include: {
          items: true,
          ejecutadoPor: { select: VOLUNTARIO_SELECT },
        },
        orderBy: { fechaEjecucion: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: ejecuciones,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    };
  }
}
