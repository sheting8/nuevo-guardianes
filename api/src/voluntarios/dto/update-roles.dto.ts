import { ApiProperty } from '@nestjs/swagger';
import { RolSistema } from '@prisma/client';
import { ArrayUnique, IsArray, IsEnum } from 'class-validator';

export class UpdateRolesDto {
  @ApiProperty({ enum: RolSistema, isArray: true })
  @IsArray({ message: 'Los roles deben ser una lista' })
  @ArrayUnique({ message: 'No se pueden repetir roles' })
  @IsEnum(RolSistema, { each: true, message: 'Rol inválido' })
  roles: RolSistema[];
}
