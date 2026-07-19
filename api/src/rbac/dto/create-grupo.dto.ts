import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateGrupoDto {
  @ApiProperty({ example: 'Conductores B-1' })
  @IsString()
  @MinLength(1, { message: 'El nombre es requerido' })
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;
}
