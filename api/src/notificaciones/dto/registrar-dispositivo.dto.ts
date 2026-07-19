import { ApiProperty } from '@nestjs/swagger';
import { PlataformaDispositivo } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class RegistrarDispositivoDto {
  @ApiProperty()
  @IsString({ message: 'El token es requerido' })
  @MinLength(1, { message: 'El token es requerido' })
  token: string;

  @ApiProperty({ enum: PlataformaDispositivo })
  @IsEnum(PlataformaDispositivo)
  plataforma: PlataformaDispositivo;
}
