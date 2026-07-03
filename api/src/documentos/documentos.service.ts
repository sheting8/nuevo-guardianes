import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { CitacionesService } from '../citaciones/citaciones.service';
import { GuardiaService } from '../guardia/guardia.service';
import { NochesService } from '../noches/noches.service';
import { PrismaService } from '../prisma/prisma.service';

interface VoluntarioResumen {
  nombres: string;
  apellidoP: string;
  correlativo: number;
}

function parseFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function formatearFecha(fecha: Date): string {
  return fecha.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function nombreCompleto(v: VoluntarioResumen | null): string {
  return v ? `#${v.correlativo} ${v.nombres} ${v.apellidoP}` : '—';
}

function celda(texto: string, negrita = false): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: texto, bold: negrita })],
      }),
    ],
  });
}

function filaEncabezado(...encabezados: string[]): TableRow {
  return new TableRow({ children: encabezados.map((h) => celda(h, true)) });
}

@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly citacionesService: CitacionesService,
    private readonly guardiaService: GuardiaService,
    private readonly nochesService: NochesService,
  ) {}

  async libroGuardia(fecha: string): Promise<Buffer> {
    const [panel, guardiaNoche] = await Promise.all([
      this.citacionesService.panel(fecha),
      this.guardiaService.obtenerPorFecha(fecha),
    ]);

    const filasCamas = panel.camas.map(
      (cama) =>
        new TableRow({
          children: [
            celda(String(cama.numeroCama)),
            celda(
              cama.voluntarioTitular
                ? nombreCompleto(cama.voluntarioTitular)
                : '—',
            ),
            celda(
              cama.voluntarioEfectivo
                ? nombreCompleto(cama.voluntarioEfectivo)
                : '—',
            ),
            celda(cama.estado ?? '—'),
          ],
        }),
    );

    const tablaCamas = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        filaEncabezado('Cama', 'Titular', 'Efectivo', 'Estado'),
        ...filasCamas,
      ],
    });

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: 'Libro de Guardia',
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({ text: formatearFecha(parseFecha(fecha)) }),
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'Panel de camas',
              heading: HeadingLevel.HEADING_2,
            }),
            tablaCamas,
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'Roles nocturnos',
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              text: `Mensajero: ${nombreCompleto(guardiaNoche.mensajero)}`,
            }),
            new Paragraph({
              text: `Conductores: ${
                guardiaNoche.conductores.length
                  ? guardiaNoche.conductores.map(nombreCompleto).join(', ')
                  : '—'
              }`,
            }),
            new Paragraph({
              text: `JGS Subrogante: ${nombreCompleto(guardiaNoche.jgs)}`,
            }),
          ],
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  async conteo(citacionId: string): Promise<Buffer> {
    const citacion = await this.prisma.citacion.findUnique({
      where: { id: citacionId },
    });
    if (!citacion) {
      throw new NotFoundException('Citación no encontrada');
    }

    const conteos = await this.nochesService.calcularConteoCitacion(citacionId);

    const filas = conteos.map(
      (c) =>
        new TableRow({
          children: [
            celda(nombreCompleto(c.voluntario)),
            celda(String(c.nochesEfectivas)),
          ],
        }),
    );

    const tabla = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [filaEncabezado('Voluntario', 'Noches efectivas'), ...filas],
    });

    const rango = citacion.fechaFin
      ? `${formatearFecha(citacion.fechaInicio)} — ${formatearFecha(citacion.fechaFin)}`
      : formatearFecha(citacion.fechaInicio);

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: 'Conteo de noches',
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({ text: rango }),
            new Paragraph({ text: '' }),
            tabla,
          ],
        },
      ],
    });

    return Packer.toBuffer(doc);
  }
}
