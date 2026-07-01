import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '123' })
  @IsString({ message: 'El usuario es requerido' })
  @MinLength(1, { message: 'El usuario es requerido' })
  username: string;

  @ApiProperty({ example: 'contraseña123' })
  @IsString({ message: 'La contraseña es requerida' })
  @MinLength(1, { message: 'La contraseña es requerida' })
  password: string;
}
