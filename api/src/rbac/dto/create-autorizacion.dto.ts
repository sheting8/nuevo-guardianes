import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NivelAcceso, TipoRecursoAcceso, TipoSujetoAcceso } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateAutorizacionDto {
  @ApiProperty({ enum: TipoSujetoAcceso })
  @IsEnum(TipoSujetoAcceso)
  sujetoTipo: TipoSujetoAcceso;

  @ApiPropertyOptional({ description: 'Requerido si sujetoTipo = USUARIO' })
  @IsOptional()
  @IsString()
  voluntarioId?: string;

  @ApiPropertyOptional({ description: 'Requerido si sujetoTipo = GRUPO' })
  @IsOptional()
  @IsString()
  grupoId?: string;

  @ApiProperty({ enum: TipoRecursoAcceso })
  @IsEnum(TipoRecursoAcceso)
  recursoTipo: TipoRecursoAcceso;

  @ApiProperty({ description: 'id de la CategoriaInventario/Ubicacion/ChecklistTemplate' })
  @IsString()
  recursoId: string;

  @ApiProperty({ enum: NivelAcceso })
  @IsEnum(NivelAcceso)
  nivel: NivelAcceso;
}
