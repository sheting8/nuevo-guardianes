import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional } from 'class-validator';

export class QueryCuarteleroDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString({ message: 'Vigente debe ser true o false' })
  vigente?: string;
}
