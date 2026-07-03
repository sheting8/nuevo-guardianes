import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class QueryHistorialDto {
  @ApiProperty({ example: '2026-06-01' })
  @IsDateString(
    {},
    { message: 'La fecha "desde" debe ser una fecha válida (YYYY-MM-DD)' },
  )
  desde: string;

  @ApiProperty({ example: '2026-06-30' })
  @IsDateString(
    {},
    { message: 'La fecha "hasta" debe ser una fecha válida (YYYY-MM-DD)' },
  )
  hasta: string;
}
