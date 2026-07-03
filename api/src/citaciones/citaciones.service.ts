import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoPermiso, Prisma, TipoPermiso } from '@prisma/client';
import { NochesService } from '../noches/noches.service';
import { PrismaService } from '../prisma/prisma.service';
import { CamaAsignacionDto } from './dto/cama-asignacion.dto';
import { CreateCitacionDto } from './dto/create-citacion.dto';
import {
  QueryCitacionesDto,
  TipoCitacionQuery,
} from './dto/query-citaciones.dto';

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

type EstadoCama =
  | 'NORMAL'
  | 'PERMISO'
  | 'PERMISO_ESPECIAL'
  | 'REEMPLAZO'
  | 'LICENCIA'
  | 'OVERRIDE';

const CITACION_INCLUDE = {
  turno: true,
  camas: {
    include: { voluntario: { select: VOLUNTARIO_SELECT } },
    orderBy: { numeroCama: 'asc' },
  },
} satisfies Prisma.CitacionInclude;

type CitacionConCamas = Prisma.CitacionGetPayload<{
  include: typeof CITACION_INCLUDE;
}>;

function parseFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

const NUMERO_CAMA_MIN = 1;
const NUMERO_CAMA_MAX = 18;

@Injectable()
export class CitacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nochesService: NochesService,
  ) {}

  private async buscarOFallar(id: string): Promise<CitacionConCamas> {
    const citacion = await this.prisma.citacion.findUnique({
      where: { id },
      include: CITACION_INCLUDE,
    });
    if (!citacion) {
      throw new NotFoundException('Citación no encontrada');
    }
    return citacion;
  }

  private validarCamas(camas: CamaAsignacionDto[]): void {
    const numeros = camas.map((c) => c.numero);
    if (numeros.some((n) => n < NUMERO_CAMA_MIN || n > NUMERO_CAMA_MAX)) {
      throw new BadRequestException(
        'El número de cama debe estar entre 1 y 18',
      );
    }
    if (new Set(numeros).size !== numeros.length) {
      throw new BadRequestException(
        'No se puede asignar más de un voluntario a la misma cama',
      );
    }
  }

  private async validarVoluntariosExisten(
    camas: CamaAsignacionDto[],
  ): Promise<void> {
    const ids = [...new Set(camas.map((c) => c.voluntarioId))];
    const total = await this.prisma.voluntario.count({
      where: { id: { in: ids } },
    });
    if (total !== ids.length) {
      throw new BadRequestException('Uno o más voluntarios no existen');
    }
  }

  async crear(dto: CreateCitacionDto): Promise<CitacionConCamas> {
    const fechaInicio = parseFecha(dto.fechaInicio);
    const fechaFin = dto.fechaFin ? parseFecha(dto.fechaFin) : null;

    if (fechaFin && fechaFin < fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior o igual a la fecha de inicio',
      );
    }

    this.validarCamas(dto.camas);
    await this.validarVoluntariosExisten(dto.camas);

    if (dto.turnoId) {
      const turno = await this.prisma.turno.findUnique({
        where: { id: dto.turnoId },
      });
      if (!turno) {
        throw new NotFoundException('Turno no encontrado');
      }
    }

    if (fechaFin) {
      const solapada = await this.prisma.citacion.findFirst({
        where: {
          AND: [
            { fechaFin: { not: null } },
            { fechaInicio: { lte: fechaFin } },
            { fechaFin: { gte: fechaInicio } },
          ],
        },
      });
      if (solapada) {
        throw new ConflictException(
          'Ya existe una citación que se solapa con ese rango de fechas',
        );
      }
    } else {
      const existente = await this.prisma.citacion.findFirst({
        where: { fechaFin: null, fechaInicio },
      });
      if (existente) {
        throw new ConflictException(
          'Ya existe una asignación diaria para esa fecha',
        );
      }
    }

    const citacionCreada = await this.prisma.citacion.create({
      data: {
        turnoId: dto.turnoId,
        fechaInicio,
        fechaFin,
        camas: {
          createMany: {
            data: dto.camas.map((c) => ({
              numeroCama: c.numero,
              voluntarioId: c.voluntarioId,
            })),
          },
        },
      },
    });

    return this.buscarOFallar(citacionCreada.id);
  }

  async listar(query: QueryCitacionesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.CitacionWhereInput =
      query.tipo === TipoCitacionQuery.CITACION
        ? { fechaFin: { not: null } }
        : query.tipo === TipoCitacionQuery.ASIGNACION
          ? { fechaFin: null }
          : {};

    const [total, citaciones] = await this.prisma.$transaction([
      this.prisma.citacion.count({ where }),
      this.prisma.citacion.findMany({
        where,
        include: CITACION_INCLUDE,
        orderBy: { fechaInicio: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: citaciones,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async actualizarCamas(
    id: string,
    camas: CamaAsignacionDto[],
  ): Promise<CitacionConCamas> {
    await this.buscarOFallar(id);
    this.validarCamas(camas);
    await this.validarVoluntariosExisten(camas);

    await this.prisma.$transaction(
      camas.map((c) =>
        this.prisma.camaAsignacion.upsert({
          where: {
            citacionId_numeroCama: { citacionId: id, numeroCama: c.numero },
          },
          create: {
            citacionId: id,
            numeroCama: c.numero,
            voluntarioId: c.voluntarioId,
          },
          update: { voluntarioId: c.voluntarioId },
        }),
      ),
    );

    return this.buscarOFallar(id);
  }

  private resolverCama(
    titularId: string,
    permisosPorSolicitante: Map<
      string,
      { tipo: TipoPermiso; reemplazanteId: string | null }
    >,
    licenciaIds: Set<string>,
  ): { voluntarioId: string | null; estado: EstadoCama } {
    let actualId: string | null = titularId;
    let estado: EstadoCama = 'NORMAL';
    const visitados = new Set<string>();

    while (actualId) {
      if (visitados.has(actualId)) {
        return { voluntarioId: null, estado };
      }
      visitados.add(actualId);

      if (licenciaIds.has(actualId)) {
        return { voluntarioId: null, estado: 'LICENCIA' };
      }

      const permiso = permisosPorSolicitante.get(actualId);
      if (!permiso) {
        return { voluntarioId: actualId, estado };
      }

      if (permiso.tipo === TipoPermiso.PERMISO) {
        return { voluntarioId: actualId, estado: 'PERMISO' };
      }
      if (permiso.tipo === TipoPermiso.PERMISO_ESPECIAL) {
        return { voluntarioId: null, estado: 'PERMISO_ESPECIAL' };
      }

      // REEMPLAZO: el reemplazante pasa a ocupar la cama; si el reemplazante
      // a su vez tiene un permiso o licencia aprobado, la cadena continúa.
      estado = 'REEMPLAZO';
      actualId = permiso.reemplazanteId;
    }

    return { voluntarioId: null, estado };
  }

  async panel(fecha: string) {
    const fechaDate = parseFecha(fecha);

    const asignacionDiaria = await this.prisma.citacion.findFirst({
      where: { fechaFin: null, fechaInicio: fechaDate },
      include: CITACION_INCLUDE,
    });

    const citacion =
      asignacionDiaria ??
      (await this.prisma.citacion.findFirst({
        where: {
          AND: [
            { fechaFin: { not: null } },
            { fechaInicio: { lte: fechaDate } },
            { fechaFin: { gte: fechaDate } },
          ],
        },
        include: CITACION_INCLUDE,
      }));

    const porNumero = new Map(
      citacion?.camas.map((c) => [c.numeroCama, c]) ?? [],
    );

    const permisosAprobados = await this.prisma.permiso.findMany({
      where: { estado: EstadoPermiso.APROBADO, fechaGuardia: fechaDate },
    });
    const permisosPorSolicitante = new Map(
      permisosAprobados.map((p) => [
        p.solicitanteId,
        { tipo: p.tipo, reemplazanteId: p.reemplazanteId },
      ]),
    );

    const licencias = await this.prisma.licencia.findMany({
      where: { fecha: fechaDate },
      select: { voluntarioId: true },
    });
    const licenciaIds = new Set(licencias.map((l) => l.voluntarioId));

    const overrides = await this.nochesService.obtenerOverridesPorFecha(fecha);

    const idsNecesarios = new Set<string>();
    citacion?.camas.forEach((c) => idsNecesarios.add(c.voluntarioId));
    permisosAprobados.forEach((p) => {
      if (p.reemplazanteId) idsNecesarios.add(p.reemplazanteId);
    });

    const voluntarios = await this.prisma.voluntario.findMany({
      where: { id: { in: [...idsNecesarios] } },
      select: VOLUNTARIO_SELECT,
    });
    const voluntarioPorId = new Map<string, VoluntarioResumen>(
      voluntarios.map((v) => [v.id, v]),
    );

    const camas = Array.from({ length: NUMERO_CAMA_MAX }, (_, i) => i + 1).map(
      (numeroCama) => {
        const asignacion = porNumero.get(numeroCama);
        const titular = asignacion?.voluntario ?? null;

        if (!titular) {
          return {
            numeroCama,
            voluntarioTitular: null,
            voluntarioEfectivo: null,
            estado: null,
          };
        }

        // El override del JG pisa completamente el cálculo automático para
        // el par (fecha, titular): override ?? cálculo automático.
        if (overrides.has(titular.id)) {
          const durmio = overrides.get(titular.id) as boolean;
          return {
            numeroCama,
            voluntarioTitular: titular,
            voluntarioEfectivo: durmio ? titular : null,
            estado: 'OVERRIDE' as const,
          };
        }

        const resuelto = this.resolverCama(
          titular.id,
          permisosPorSolicitante,
          licenciaIds,
        );

        return {
          numeroCama,
          voluntarioTitular: titular,
          voluntarioEfectivo: resuelto.voluntarioId
            ? (voluntarioPorId.get(resuelto.voluntarioId) ?? null)
            : null,
          estado: resuelto.estado,
        };
      },
    );

    return {
      fecha,
      citacionId: citacion?.id ?? null,
      camas,
    };
  }

  async conteo(id: string) {
    return this.nochesService.calcularConteoCitacion(id);
  }
}
