import { RolSistema } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  roles: RolSistema[];
}

export type AuthenticatedUser = JwtPayload;
