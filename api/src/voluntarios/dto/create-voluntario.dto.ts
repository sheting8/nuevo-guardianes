import { ApiProperty } from '@nestjs/swagger';
import { TipoVoluntario } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateVoluntarioDto {
  @ApiProperty({ enum: TipoVoluntario })
  @IsEnum(TipoVoluntario, { message: 'El tipo debe ser QUINCE o CONFEDERADO' })
  tipo: TipoVoluntario;

  @ApiProperty()
  @IsInt({ message: 'El correlativo debe ser un número entero' })
  @Min(1, { message: 'El correlativo debe ser mayor a 0' })
  correlativo: number;

  @ApiProperty()
  @IsString({ message: 'Los nombres son requeridos' })
  @MinLength(1, { message: 'Los nombres son requeridos' })
  nombres: string;

  @ApiProperty()
  @IsString({ message: 'El apellido paterno es requerido' })
  @MinLength(1, { message: 'El apellido paterno es requerido' })
  apellidoP: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  apellidoM?: string;

  @ApiProperty()
  @IsString({ message: 'El RUT es requerido' })
  @MinLength(1, { message: 'El RUT es requerido' })
  rut: string;

  @ApiProperty()
  @IsString({ message: 'El dígito verificador es requerido' })
  @MinLength(1, { message: 'El dígito verificador es requerido' })
  rutDigito: string;

  @ApiProperty()
  @IsInt({ message: 'La compañía debe ser un número entero' })
  company: number;

  @ApiProperty()
  @IsEmail({}, { message: 'El correo debe ser válido' })
  email: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ required: false, example: '1990-05-15' })
  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD)',
    },
  )
  fechaNacimiento?: string;
}
