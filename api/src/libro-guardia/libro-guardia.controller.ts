import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolSistema } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.interface';
import { CreateOverrideDto } from './dto/create-override.dto';
import { LibroGuardiaService } from './libro-guardia.service';

@ApiTags('libro-guardia')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolSistema.JEFE_GUARDIA, RolSistema.ADMIN)
@Controller('libro-guardia')
export class LibroGuardiaController {
  constructor(private readonly libroGuardiaService: LibroGuardiaService) {}

  @Post('override')
  crearOverride(
    @Body() dto: CreateOverrideDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.libroGuardiaService.crearOverride(dto, user.sub);
  }
}
