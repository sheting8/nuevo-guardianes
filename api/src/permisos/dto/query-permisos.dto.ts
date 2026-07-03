import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoPermiso } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class QueryPermisosDto {
  @ApiPropertyOptional({ enum: EstadoPermiso })
  @IsOptional()
  @IsEnum(EstadoPermiso, {
    message: 'El estado debe ser PENDIENTE, APROBADO o RECHAZADO',
  })
  estado?: EstadoPermiso;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha "desde" debe ser una fecha válida (YYYY-MM-DD)' },
  )
  desde?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha "hasta" debe ser una fecha válida (YYYY-MM-DD)' },
  )
  hasta?: string;
}
