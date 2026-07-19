import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCategoriaDto {
  @ApiProperty()
  @IsString({ message: 'El nombre es requerido' })
  @MinLength(1, { message: 'El nombre es requerido' })
  nombre: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean({ message: 'Activo debe ser un valor booleano' })
  activo?: boolean;
}
