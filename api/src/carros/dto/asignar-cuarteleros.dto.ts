import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AsignarCuartelerosDto {
  @ApiProperty({ type: [String] })
  @IsArray({ message: 'Los cuarteleros deben ser una lista' })
  @ArrayNotEmpty({ message: 'Debes indicar al menos un cuartelero' })
  @IsString({
    each: true,
    message: 'Cada cuartelero debe ser un identificador válido',
  })
  cuarteleroIds: string[];
}
