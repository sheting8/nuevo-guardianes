import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Requerido solo para clientes móviles, que no tienen la cookie de sesión del refresh token.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
