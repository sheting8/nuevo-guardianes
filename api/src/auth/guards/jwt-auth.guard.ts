import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    info: { message?: string } | null,
  ): TUser {
    if (info?.message === 'No auth token') {
      throw new UnauthorizedException('Token requerido');
    }
    if (err || !user) {
      throw new UnauthorizedException('No autorizado');
    }
    return user;
  }
}
