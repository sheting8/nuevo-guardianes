import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class QueryEstadisticasDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voluntarioId?: string;
}
