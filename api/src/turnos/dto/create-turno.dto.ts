import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsString, MinLength } from 'class-validator';

export class CreateTurnoDto {
  @ApiProperty()
  @IsString({ message: 'El nombre es requerido' })
  @MinLength(1, { message: 'El nombre es requerido' })
  nombre: string;

  @ApiProperty({ type: [String] })
  @IsArray({ message: 'Los voluntarios deben ser una lista' })
  @ArrayUnique({ message: 'No se pueden repetir voluntarios' })
  @IsString({
    each: true,
    message: 'Cada voluntario debe ser un identificador válido',
  })
  voluntarioIds: string[];
}
