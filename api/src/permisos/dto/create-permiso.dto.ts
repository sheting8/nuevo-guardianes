import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoPermiso } from '@prisma/client';
import { IsDateString, IsEnum, IsString, ValidateIf } from 'class-validator';

export class CreatePermisoDto {
  @ApiProperty({ enum: TipoPermiso })
  @IsEnum(TipoPermiso, {
    message: 'El tipo debe ser PERMISO, PERMISO_ESPECIAL o REEMPLAZO',
  })
  tipo: TipoPermiso;

  @ApiProperty({ example: '2026-07-06' })
  @IsDateString(
    {},
    { message: 'La fecha de guardia debe ser una fecha válida (YYYY-MM-DD)' },
  )
  fechaGuardia: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: CreatePermisoDto) => dto.tipo === TipoPermiso.REEMPLAZO)
  @IsString({
    message: 'El reemplazante es requerido para un permiso de tipo REEMPLAZO',
  })
  reemplazanteId?: string;
}
