import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const CLAVES_VALIDAS = ['C-1', 'C-2', 'C-3'] as const;

export class CreateCuarteleroDto {
  @ApiProperty()
  @IsString({ message: 'El nombre es requerido' })
  @MinLength(1, { message: 'El nombre es requerido' })
  nombre: string;

  @ApiProperty({ enum: CLAVES_VALIDAS })
  @IsIn(CLAVES_VALIDAS, { message: 'La clave debe ser C-1, C-2 o C-3' })
  clave: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601(
    {},
    { message: 'La fecha de nacimiento debe ser una fecha válida' },
  )
  nacimiento?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha de ingreso debe ser una fecha válida' })
  fechaIngreso?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean({ message: 'Vigente debe ser un valor booleano' })
  vigente?: boolean;
}
