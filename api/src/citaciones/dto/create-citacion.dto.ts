import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CamaAsignacionDto } from './cama-asignacion.dto';

export class CreateCitacionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  turnoId?: string;

  @ApiProperty({ example: '2026-07-06' })
  @IsDateString({}, { message: 'La fecha de inicio debe ser una fecha válida' })
  fechaInicio: string;

  @ApiPropertyOptional({ example: '2026-07-12' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin debe ser una fecha válida' })
  fechaFin?: string;

  @ApiProperty({ type: [CamaAsignacionDto] })
  @IsArray({ message: 'Las camas deben ser una lista' })
  @ArrayNotEmpty({ message: 'Debes asignar al menos una cama' })
  @ValidateNested({ each: true })
  @Type(() => CamaAsignacionDto)
  camas: CamaAsignacionDto[];
}
