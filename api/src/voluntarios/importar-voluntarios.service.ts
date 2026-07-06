import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TipoVoluntario } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';

interface FilaExcel {
  'Registro Cia'?: unknown;
  'Cía.'?: unknown;
  Rut?: unknown;
  Digito?: unknown;
  Nombre?: unknown;
  'Segundo Nombre'?: unknown;
  'Primer Apellido'?: unknown;
  'Segundo Apellido'?: unknown;
  'Fecha De Nacimiento'?: unknown;
  Email?: unknown;
  Calidad?: unknown;
  Cargo?: unknown;
}

export interface ErrorFilaImportacion {
  fila: number;
  correlativo: number | null;
  motivo: string;
}

const COMPANY_QUINCE = 15;

const ENCABEZADOS_PLANTILLA = [
  'Registro Cia',
  'Cía.',
  'Rut',
  'Digito',
  'Nombre',
  'Segundo Nombre',
  'Primer Apellido',
  'Segundo Apellido',
  'Fecha De Nacimiento',
  'Email',
  'Calidad',
  'Cargo',
];

const FILA_EJEMPLO_PLANTILLA = [
  101,
  15,
  '12345678',
  '9',
  'Juan',
  'Andrés',
  'Pérez',
  'Soto',
  new Date(1990, 4, 15),
  'juan.perez@example.com',
  'Activo',
  '-',
];

@Injectable()
export class ImportarVoluntariosService {
  constructor(private readonly prisma: PrismaService) {}

  private parseEntero(valor: unknown): number | null {
    if (valor === null || valor === undefined || valor === '') {
      return null;
    }
    const numero = Number(valor);
    return Number.isInteger(numero) ? numero : null;
  }

  private textoOVacio(valor: unknown): string {
    if (typeof valor === 'string') {
      return valor.trim();
    }
    if (typeof valor === 'number' || typeof valor === 'boolean') {
      return String(valor);
    }
    return '';
  }

  private parseFechaExcel(valor: unknown): Date | undefined {
    // xlsx (cellDates: true) codifica y decodifica el serial de fecha de forma
    // consistente en UTC (sin zona horaria real, como corresponde a una celda
    // de solo fecha); por eso se leen los componentes con los getters UTC,
    // no los locales, para no correr un día al normalizar a medianoche UTC.
    if (valor instanceof Date) {
      if (Number.isNaN(valor.getTime())) {
        return undefined;
      }
      return new Date(
        Date.UTC(
          valor.getUTCFullYear(),
          valor.getUTCMonth(),
          valor.getUTCDate(),
        ),
      );
    }
    if (typeof valor !== 'string' && typeof valor !== 'number') {
      return undefined;
    }
    const parsed = new Date(valor);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }
    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
      ),
    );
  }

  private async correlativoEnUso(
    tipo: TipoVoluntario,
    correlativo: number,
  ): Promise<boolean> {
    const existente = await this.prisma.voluntario.findFirst({
      where:
        tipo === TipoVoluntario.QUINCE
          ? { tipo: TipoVoluntario.QUINCE, correlativo }
          : { tipo: TipoVoluntario.CONFEDERADO, correlativo, activo: true },
    });
    return !!existente;
  }

  private leerFilas(file: Express.Multer.File): FilaExcel[] {
    try {
      const libro = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      return XLSX.utils.sheet_to_json<FilaExcel>(hoja, { defval: null });
    } catch {
      throw new BadRequestException('No se pudo leer el archivo Excel');
    }
  }

  private async crearFila(
    fila: FilaExcel,
  ): Promise<{ correlativo: number | null }> {
    const correlativo = this.parseEntero(fila['Registro Cia']);
    if (correlativo === null) {
      throw new Error('Registro Cia inválido o vacío');
    }

    const company = this.parseEntero(fila['Cía.']);
    if (company === null) {
      throw new Error('Cía. inválida o vacía');
    }
    const tipo =
      company === COMPANY_QUINCE
        ? TipoVoluntario.QUINCE
        : TipoVoluntario.CONFEDERADO;

    const rut = this.textoOVacio(fila.Rut);
    if (!rut) {
      throw new Error('Rut es requerido');
    }

    const rutDigito = this.textoOVacio(fila.Digito);
    if (!rutDigito) {
      throw new Error('Digito es requerido');
    }

    const nombre = this.textoOVacio(fila.Nombre);
    if (!nombre) {
      throw new Error('Nombre es requerido');
    }
    const segundoNombre = this.textoOVacio(fila['Segundo Nombre']);
    const nombres = segundoNombre ? `${nombre} ${segundoNombre}` : nombre;

    const apellidoP = this.textoOVacio(fila['Primer Apellido']);
    if (!apellidoP) {
      throw new Error('Primer Apellido es requerido');
    }
    const apellidoM = this.textoOVacio(fila['Segundo Apellido']) || undefined;

    const email = this.textoOVacio(fila.Email);
    if (!email) {
      throw new Error('Email es requerido');
    }

    const fechaNacimiento = this.parseFechaExcel(fila['Fecha De Nacimiento']);

    const cargo = this.textoOVacio(fila.Cargo);
    const cargoValido = cargo && cargo !== '-' ? cargo : null;

    if (await this.correlativoEnUso(tipo, correlativo)) {
      throw new Error('Correlativo ya existe');
    }

    const passwordHash = await bcrypt.hash(rut, 10);
    const username = String(correlativo);

    try {
      await this.prisma.$transaction(async (tx) => {
        const voluntario = await tx.voluntario.create({
          data: {
            correlativo,
            tipo,
            nombres,
            apellidoP,
            apellidoM,
            rut,
            rutDigito,
            company,
            email,
            fechaNacimiento,
            user: { create: { username, passwordHash } },
          },
        });

        if (cargoValido) {
          await tx.oficialidad.create({
            data: { voluntarioId: voluntario.id, cargo: cargoValido },
          });
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new Error('Correlativo ya existe');
      }
      throw error;
    }

    return { correlativo };
  }

  async importar(file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('Debes adjuntar un archivo Excel (.xlsx)');
    }
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('El archivo debe tener extensión .xlsx');
    }

    const filas = this.leerFilas(file);

    let creados = 0;
    const errores: ErrorFilaImportacion[] = [];

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const numeroFila = i + 2; // +1 por índice base 1, +1 por la fila de encabezado

      try {
        await this.crearFila(fila);
        creados += 1;
      } catch (error) {
        errores.push({
          fila: numeroFila,
          correlativo: this.parseEntero(fila['Registro Cia']),
          motivo: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    return { creados, errores };
  }

  generarPlantilla(): Buffer {
    const hoja = XLSX.utils.aoa_to_sheet([
      ENCABEZADOS_PLANTILLA,
      FILA_EJEMPLO_PLANTILLA,
    ]);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Voluntarios');

    return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
