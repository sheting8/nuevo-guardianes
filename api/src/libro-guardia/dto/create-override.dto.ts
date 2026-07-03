import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsString } from 'class-validator';

export class CreateOverrideDto {
  @ApiProperty({ example: '2026-07-06' })
  @IsDateString(
    {},
    { message: 'La fecha debe ser una fecha válida (YYYY-MM-DD)' },
  )
  fecha: string;

  @ApiProperty()
  @IsString({ message: 'El voluntario es requerido' })
  voluntarioId: string;

  @ApiProperty()
  @IsBoolean({ message: 'Durmió debe ser verdadero o falso' })
  durmio: boolean;
}
