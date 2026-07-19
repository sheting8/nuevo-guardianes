import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoPreguntaChecklist } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class ChecklistTemplateItemDto {
  @ApiProperty({ minimum: 1 })
  @IsInt({ message: 'El orden debe ser un número entero' })
  @Min(1, { message: 'El orden debe ser mayor a 0' })
  orden: number;

  @ApiProperty()
  @IsString({ message: 'La descripción es requerida' })
  @MinLength(1, { message: 'La descripción es requerida' })
  descripcion: string;

  @ApiPropertyOptional({
    enum: TipoPreguntaChecklist,
    description: 'Por defecto PASA_FALLA si no se indica',
  })
  @IsOptional()
  @IsEnum(TipoPreguntaChecklist, {
    message: 'El tipo de pregunta debe ser PASA_FALLA, NUMERO, SELECTOR, MATRIZ o TEXTO',
  })
  tipoPregunta?: TipoPreguntaChecklist;

  @ApiPropertyOptional({
    description:
      'Forma según tipoPregunta — NUMERO: { min?, max? }, SELECTOR: { opciones: string[], multiple: boolean }, ' +
      'MATRIZ: { filas: string[], columnas: string[] }. Validado en el service, no acá.',
  })
  @IsOptional()
  @IsObject({ message: 'La configuración debe ser un objeto' })
  configuracion?: Record<string, unknown>;
}
