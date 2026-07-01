import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateOficialidadDto {
  @ApiProperty()
  @IsString({ message: 'El voluntario es requerido' })
  @MinLength(1, { message: 'El voluntario es requerido' })
  voluntarioId: string;

  @ApiProperty()
  @IsString({ message: 'El cargo es requerido' })
  @MinLength(1, { message: 'El cargo es requerido' })
  cargo: string;
}
