import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipoVoluntario } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class QueryVoluntariosDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor a 0' })
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor a 0' })
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: TipoVoluntario })
  @IsOptional()
  @IsEnum(TipoVoluntario, { message: 'El tipo debe ser QUINCE o CONFEDERADO' })
  tipo?: TipoVoluntario;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString({ message: 'El estado activo debe ser true o false' })
  activo?: string;
}
