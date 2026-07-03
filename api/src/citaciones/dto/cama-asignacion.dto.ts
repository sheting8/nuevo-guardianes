import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class CamaAsignacionDto {
  @ApiProperty({ minimum: 1, maximum: 18 })
  @IsInt({ message: 'El número de cama debe ser un número entero' })
  @Min(1, { message: 'El número de cama debe estar entre 1 y 18' })
  @Max(18, { message: 'El número de cama debe estar entre 1 y 18' })
  numero: number;

  @ApiProperty()
  @IsString({ message: 'El voluntario es requerido' })
  @MinLength(1, { message: 'El voluntario es requerido' })
  voluntarioId: string;
}
