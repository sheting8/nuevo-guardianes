import { ApiProperty } from '@nestjs/swagger';
import { EstadoItemInventario } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateItemDto {
  @ApiProperty()
  @IsString({ message: 'El nombre es requerido' })
  @MinLength(1, { message: 'El nombre es requerido' })
  nombre: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty()
  @IsString({ message: 'La categoría es requerida' })
  categoriaId: string;

  @ApiProperty()
  @IsString({ message: 'La ubicación es requerida' })
  ubicacionId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiProperty({ required: false, enum: EstadoItemInventario })
  @IsOptional()
  @IsEnum(EstadoItemInventario, {
    message: 'El estado debe ser un valor válido',
  })
  estado?: EstadoItemInventario;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(0, { message: 'La cantidad no puede ser negativa' })
  cantidad?: number;
}
