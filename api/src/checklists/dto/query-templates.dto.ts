import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class QueryTemplatesDto {
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

  @ApiPropertyOptional({
    description: 'Si es true, solo devuelve checklists vencidos (fuera de ANTES_DE_USO)',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'vencidos debe ser verdadero o falso' })
  vencidos?: boolean;
}
