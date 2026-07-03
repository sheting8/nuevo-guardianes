import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString } from 'class-validator';

export class CreateLicenciaDto {
  @ApiProperty()
  @IsString({ message: 'El voluntario es requerido' })
  voluntarioId: string;

  @ApiProperty({ example: '2026-07-06' })
  @IsDateString(
    {},
    { message: 'La fecha de inicio debe ser una fecha válida (YYYY-MM-DD)' },
  )
  fechaInicio: string;

  @ApiProperty({ example: '2026-07-10' })
  @IsDateString(
    {},
    { message: 'La fecha de fin debe ser una fecha válida (YYYY-MM-DD)' },
  )
  fechaFin: string;
}
