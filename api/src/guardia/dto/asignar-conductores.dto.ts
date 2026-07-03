import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsDateString, IsString } from 'class-validator';

export class AsignarConductoresDto {
  @ApiProperty({ example: '2026-07-06' })
  @IsDateString(
    {},
    { message: 'La fecha debe ser una fecha válida (YYYY-MM-DD)' },
  )
  fecha: string;

  @ApiProperty({ type: [String] })
  @IsArray({ message: 'Los voluntarios deben ser una lista' })
  @ArrayUnique({ message: 'No se pueden repetir voluntarios' })
  @IsString({
    each: true,
    message: 'Cada voluntario debe ser un identificador válido',
  })
  voluntarioIds: string[];
}
