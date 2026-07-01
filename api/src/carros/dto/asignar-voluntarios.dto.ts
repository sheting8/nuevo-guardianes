import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AsignarVoluntariosDto {
  @ApiProperty({ type: [String] })
  @IsArray({ message: 'Los voluntarios deben ser una lista' })
  @ArrayNotEmpty({ message: 'Debes indicar al menos un voluntario' })
  @IsString({
    each: true,
    message: 'Cada voluntario debe ser un identificador válido',
  })
  voluntarioIds: string[];
}
