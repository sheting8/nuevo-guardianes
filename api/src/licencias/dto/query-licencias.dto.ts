import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryLicenciasDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voluntarioId?: string;
}
