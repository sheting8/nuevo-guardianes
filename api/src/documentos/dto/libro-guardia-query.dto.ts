import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class LibroGuardiaQueryDto {
  @ApiProperty({ example: '2026-07-06' })
  @IsDateString(
    {},
    { message: 'La fecha debe ser una fecha válida (YYYY-MM-DD)' },
  )
  fecha: string;
}
