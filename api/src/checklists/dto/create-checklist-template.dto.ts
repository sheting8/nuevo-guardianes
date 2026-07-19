import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoAlcanceChecklist, TipoFrecuenciaChecklist } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ChecklistTemplateItemDto } from './checklist-template-item.dto';

export class CreateChecklistTemplateDto {
  @ApiProperty()
  @IsString({ message: 'El nombre es requerido' })
  @MinLength(1, { message: 'El nombre es requerido' })
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ enum: TipoAlcanceChecklist })
  @IsEnum(TipoAlcanceChecklist, {
    message: 'El alcance debe ser ITEM_INVENTARIO, CATEGORIA_INVENTARIO o UBICACION',
  })
  alcanceTipo: TipoAlcanceChecklist;

  @ApiProperty({
    description: 'id del ItemInventario/CategoriaInventario/Ubicacion referenciado',
  })
  @IsString({ message: 'El id del alcance es requerido' })
  @MinLength(1, { message: 'El id del alcance es requerido' })
  alcanceId: string;

  @ApiProperty({ enum: TipoFrecuenciaChecklist })
  @IsEnum(TipoFrecuenciaChecklist, {
    message: 'La frecuencia debe ser ROLLING, POR_CAMBIO_TURNO o ANTES_DE_USO',
  })
  tipoFrecuencia: TipoFrecuenciaChecklist;

  @ApiPropertyOptional({
    description: 'Requerido únicamente cuando tipoFrecuencia es ROLLING',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El intervalo debe ser un número entero de minutos' })
  @Min(1, { message: 'El intervalo debe ser mayor a 0' })
  intervaloMinutos?: number;

  @ApiProperty({ type: [ChecklistTemplateItemDto] })
  @IsArray({ message: 'Los items deben ser una lista' })
  @ArrayNotEmpty({ message: 'Debes agregar al menos un item' })
  @ValidateNested({ each: true })
  @Type(() => ChecklistTemplateItemDto)
  items: ChecklistTemplateItemDto[];
}
