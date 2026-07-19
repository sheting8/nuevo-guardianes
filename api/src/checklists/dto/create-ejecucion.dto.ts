import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { EjecucionItemDto } from './ejecucion-item.dto';

export class CreateEjecucionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacionesGenerales?: string;

  @ApiProperty({ type: [EjecucionItemDto] })
  @IsArray({ message: 'Los items deben ser una lista' })
  @ArrayNotEmpty({ message: 'Debes registrar al menos un item' })
  @ValidateNested({ each: true })
  @Type(() => EjecucionItemDto)
  items: EjecucionItemDto[];
}
