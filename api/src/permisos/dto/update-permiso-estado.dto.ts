import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoPermiso } from '@prisma/client';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdatePermisoEstadoDto {
  @ApiProperty({ enum: [EstadoPermiso.APROBADO, EstadoPermiso.RECHAZADO] })
  @IsIn([EstadoPermiso.APROBADO, EstadoPermiso.RECHAZADO], {
    message: 'El estado debe ser APROBADO o RECHAZADO',
  })
  estado: EstadoPermiso;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comentarios?: string;
}
