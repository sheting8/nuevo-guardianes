import { SetMetadata } from '@nestjs/common';
import { RolSistema } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RolSistema[]) => SetMetadata(ROLES_KEY, roles);
