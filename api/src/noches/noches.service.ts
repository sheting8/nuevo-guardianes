import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoPermiso, Prisma, TipoPermiso } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const VOLUNTARIO_SELECT = {
  id: true,
  nombres: true,
  apellidoP: true,
  correlativo: true,
  tipo: true,
} satisfies Prisma.VoluntarioSelect;

type VoluntarioResumen = Prisma.VoluntarioGetPayload<{
  select: typeof VOLUNTARIO_SELECT;
}>;

export type EstadoNoche =
  | 'NORMAL'
  | 'PERMISO'
  | 'PERMISO_ESPECIAL'
  | 'REEMPLAZO'
  | 'LICENCIA'
  | 'OVERRIDE'
  | 'SIN_CITAR';

export type FuenteNoche =
  'CITACION' | 'PERMISO' | 'LICENCIA' | 'OVERRIDE' | null;

export interface ResultadoNoche {
  durmio: boolean;
  estado: EstadoNoche;
  fuente: FuenteNoche;
}

export interface TotalesNoche {
  noches: number;
  permiso: number;
  permisoEspecial: number;
  reemplazoRecibido: number;
  licencia: number;
  override: number;
}

interface ContextoDia {
  overrides: Map<string, boolean>;
  licenciaIds: Set<string>;
  permisoPorSolicitante: Map<
    string,
    { tipo: TipoPermiso; reemplazanteId: string | null }
  >;
  reemplazanteIds: Set<string>;
  citadoIds: Set<string>;
}

const UN_DIA_MS = 24 * 60 * 60 * 1000;

function parseFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function claveFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function fechasEnRango(desde: Date, hasta: Date): Date[] {
  const fechas: Date[] = [];
  for (
    let actual = desde.getTime();
    actual <= hasta.getTime();
    actual += UN_DIA_MS
  ) {
    fechas.push(new Date(actual));
  }
  return fechas;
}

@Injectable()
export class NochesService {
  constructor(private readonly prisma: PrismaService) {}

  private validarRango(desde: Date, hasta: Date): void {
    if (hasta < desde) {
      throw new BadRequestException(
        'La fecha "hasta" debe ser posterior o igual a la fecha "desde"',
      );
    }
  }

  private async cargarContextoRango(
    desde: Date,
    hasta: Date,
  ): Promise<Map<string, ContextoDia>> {
    const [overrides, permisos, licencias, citaciones] = await Promise.all([
      this.prisma.correccionNoche.findMany({
        where: { fecha: { gte: desde, lte: hasta } },
      }),
      this.prisma.permiso.findMany({
        where: {
          estado: EstadoPermiso.APROBADO,
          fechaGuardia: { gte: desde, lte: hasta },
        },
      }),
      this.prisma.licencia.findMany({
        where: { fecha: { gte: desde, lte: hasta } },
      }),
      this.prisma.citacion.findMany({
        where: {
          OR: [
            { fechaFin: null, fechaInicio: { gte: desde, lte: hasta } },
            {
              AND: [
                { fechaFin: { not: null } },
                { fechaInicio: { lte: hasta } },
                { fechaFin: { gte: desde } },
              ],
            },
          ],
        },
        include: { camas: { select: { voluntarioId: true } } },
      }),
    ]);

    const contextoPorFecha = new Map<string, ContextoDia>();

    for (const fecha of fechasEnRango(desde, hasta)) {
      const clave = claveFecha(fecha);

      const overridesDia = new Map<string, boolean>();
      overrides
        .filter((o) => claveFecha(o.fecha) === clave)
        .forEach((o) => overridesDia.set(o.voluntarioId, o.durmio));

      const licenciaIds = new Set(
        licencias
          .filter((l) => claveFecha(l.fecha) === clave)
          .map((l) => l.voluntarioId),
      );

      const permisosDia = permisos.filter(
        (p) => claveFecha(p.fechaGuardia) === clave,
      );
      const permisoPorSolicitante = new Map(
        permisosDia.map((p) => [
          p.solicitanteId,
          { tipo: p.tipo, reemplazanteId: p.reemplazanteId },
        ]),
      );
      const reemplazanteIds = new Set(
        permisosDia
          .filter((p) => p.tipo === TipoPermiso.REEMPLAZO && p.reemplazanteId)
          .map((p) => p.reemplazanteId as string),
      );

      const asignacionDiaria = citaciones.find(
        (c) => !c.fechaFin && claveFecha(c.fechaInicio) === clave,
      );
      const citacionSemanal = citaciones.find(
        (c) => c.fechaFin && c.fechaInicio <= fecha && c.fechaFin >= fecha,
      );
      const citacion = asignacionDiaria ?? citacionSemanal;
      const citadoIds = new Set(
        citacion?.camas.map((c) => c.voluntarioId) ?? [],
      );

      contextoPorFecha.set(clave, {
        overrides: overridesDia,
        licenciaIds,
        permisoPorSolicitante,
        reemplazanteIds,
        citadoIds,
      });
    }

    return contextoPorFecha;
  }

  private resolverNoche(
    voluntarioId: string,
    contexto: ContextoDia,
  ): ResultadoNoche {
    if (contexto.overrides.has(voluntarioId)) {
      return {
        durmio: contexto.overrides.get(voluntarioId) as boolean,
        estado: 'OVERRIDE',
        fuente: 'OVERRIDE',
      };
    }

    if (contexto.licenciaIds.has(voluntarioId)) {
      return { durmio: false, estado: 'LICENCIA', fuente: 'LICENCIA' };
    }

    const permiso = contexto.permisoPorSolicitante.get(voluntarioId);
    if (permiso) {
      if (permiso.tipo === TipoPermiso.PERMISO) {
        return { durmio: true, estado: 'PERMISO', fuente: 'PERMISO' };
      }
      if (permiso.tipo === TipoPermiso.PERMISO_ESPECIAL) {
        return { durmio: false, estado: 'PERMISO_ESPECIAL', fuente: 'PERMISO' };
      }
      // REEMPLAZO: el titular no llega, su cama la cubre el reemplazante.
      return { durmio: false, estado: 'REEMPLAZO', fuente: 'PERMISO' };
    }

    if (contexto.reemplazanteIds.has(voluntarioId)) {
      return { durmio: true, estado: 'REEMPLAZO', fuente: 'PERMISO' };
    }

    if (contexto.citadoIds.has(voluntarioId)) {
      return { durmio: true, estado: 'NORMAL', fuente: 'CITACION' };
    }

    return { durmio: false, estado: 'SIN_CITAR', fuente: null };
  }

  private acumularTotales(resultados: ResultadoNoche[]): TotalesNoche {
    return resultados.reduce<TotalesNoche>(
      (acc, r) => {
        if (r.durmio) acc.noches += 1;
        if (r.estado === 'PERMISO') acc.permiso += 1;
        if (r.estado === 'PERMISO_ESPECIAL') acc.permisoEspecial += 1;
        if (r.estado === 'REEMPLAZO' && r.durmio) acc.reemplazoRecibido += 1;
        if (r.estado === 'LICENCIA') acc.licencia += 1;
        if (r.fuente === 'OVERRIDE') acc.override += 1;
        return acc;
      },
      {
        noches: 0,
        permiso: 0,
        permisoEspecial: 0,
        reemplazoRecibido: 0,
        licencia: 0,
        override: 0,
      },
    );
  }

  async obtenerOverridesPorFecha(fecha: string): Promise<Map<string, boolean>> {
    const overrides = await this.prisma.correccionNoche.findMany({
      where: { fecha: parseFecha(fecha) },
    });
    return new Map(overrides.map((o) => [o.voluntarioId, o.durmio]));
  }

  async calcularHistorial(voluntarioId: string, desde: string, hasta: string) {
    const voluntario = await this.prisma.voluntario.findUnique({
      where: { id: voluntarioId },
    });
    if (!voluntario) {
      throw new NotFoundException('Voluntario no encontrado');
    }

    const desdeDate = parseFecha(desde);
    const hastaDate = parseFecha(hasta);
    this.validarRango(desdeDate, hastaDate);

    const contextoPorFecha = await this.cargarContextoRango(
      desdeDate,
      hastaDate,
    );
    const fechas = fechasEnRango(desdeDate, hastaDate);

    const detalle = fechas.map((fecha) => {
      const clave = claveFecha(fecha);
      const resultado = this.resolverNoche(
        voluntarioId,
        contextoPorFecha.get(clave) as ContextoDia,
      );
      return { fecha: clave, ...resultado };
    });

    return { detalle, totales: this.acumularTotales(detalle) };
  }

  async calcularEstadisticas(
    desde: string,
    hasta: string,
    voluntarioId?: string,
  ): Promise<{ voluntario: VoluntarioResumen; totales: TotalesNoche }[]> {
    const desdeDate = parseFecha(desde);
    const hastaDate = parseFecha(hasta);
    this.validarRango(desdeDate, hastaDate);

    const voluntarios = voluntarioId
      ? await this.prisma.voluntario.findMany({
          where: { id: voluntarioId },
          select: VOLUNTARIO_SELECT,
        })
      : await this.prisma.voluntario.findMany({
          where: { activo: true },
          select: VOLUNTARIO_SELECT,
          orderBy: { correlativo: 'asc' },
        });

    if (voluntarioId && voluntarios.length === 0) {
      throw new NotFoundException('Voluntario no encontrado');
    }

    const contextoPorFecha = await this.cargarContextoRango(
      desdeDate,
      hastaDate,
    );
    const fechas = fechasEnRango(desdeDate, hastaDate);

    const resultado = voluntarios.map((voluntario) => {
      const resultados = fechas.map((fecha) =>
        this.resolverNoche(
          voluntario.id,
          contextoPorFecha.get(claveFecha(fecha)) as ContextoDia,
        ),
      );
      return { voluntario, totales: this.acumularTotales(resultados) };
    });

    return resultado.sort((a, b) => b.totales.noches - a.totales.noches);
  }

  async calcularConteoCitacion(citacionId: string) {
    const citacion = await this.prisma.citacion.findUnique({
      where: { id: citacionId },
      include: {
        camas: { include: { voluntario: { select: VOLUNTARIO_SELECT } } },
      },
    });
    if (!citacion) {
      throw new NotFoundException('Citación no encontrada');
    }

    const desde = citacion.fechaInicio;
    const hasta = citacion.fechaFin ?? citacion.fechaInicio;

    const contextoPorFecha = await this.cargarContextoRango(desde, hasta);
    const fechas = fechasEnRango(desde, hasta);

    const titulares = new Map<string, VoluntarioResumen>(
      citacion.camas.map((c) => [c.voluntarioId, c.voluntario]),
    );

    const conteos = [...titulares.entries()].map(
      ([voluntarioId, voluntario]) => {
        const nochesEfectivas = fechas.filter(
          (fecha) =>
            this.resolverNoche(
              voluntarioId,
              contextoPorFecha.get(claveFecha(fecha)) as ContextoDia,
            ).durmio,
        ).length;
        return { voluntario, nochesEfectivas };
      },
    );

    return conteos.sort((a, b) => b.nochesEfectivas - a.nochesEfectivas);
  }
}
