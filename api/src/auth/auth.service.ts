import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, RolSistema } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { REFRESH_TOKEN_EXPIRES_DAYS } from './auth.constants';

type UserConVoluntario = Prisma.UserGetPayload<{
  include: { voluntario: { include: { roles: true } } };
}>;

export interface UsuarioAutenticado {
  id: string;
  nombre: string;
  roles: RolSistema[];
  correlativo: number | null;
  tipo: string | null;
}

interface TokensGenerados {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private buscarUsuarioConVoluntario(
    userId: string,
  ): Promise<UserConVoluntario | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { voluntario: { include: { roles: true } } },
    });
  }

  private mapUsuario(user: UserConVoluntario): UsuarioAutenticado {
    const voluntario = user.voluntario;
    return {
      id: user.id,
      nombre: voluntario
        ? `${voluntario.nombres} ${voluntario.apellidoP}`
        : user.username,
      roles: voluntario?.roles.map((r) => r.rol) ?? [],
      correlativo: voluntario?.correlativo ?? null,
      tipo: voluntario?.tipo ?? null,
    };
  }

  private generarAccessToken(userId: string, roles: RolSistema[]): string {
    return this.jwtService.sign({ sub: userId, roles });
  }

  private async generarRefreshToken(
    userId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    );
    await this.prisma.refreshToken.create({
      data: { token, userId, expiresAt },
    });
    return { token, expiresAt };
  }

  async login(
    username: string,
    password: string,
  ): Promise<TokensGenerados & { user: UsuarioAutenticado }> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { voluntario: { include: { roles: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const passwordValida = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValida) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const usuario = this.mapUsuario(user);
    const accessToken = this.generarAccessToken(user.id, usuario.roles);
    const { token: refreshToken, expiresAt } = await this.generarRefreshToken(
      user.id,
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
      user: usuario,
    };
  }

  async refresh(tokenActual: string | undefined): Promise<TokensGenerados> {
    if (!tokenActual) {
      throw new UnauthorizedException('Sesión expirada');
    }

    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token: tokenActual },
    });

    if (
      !refreshToken ||
      refreshToken.revoked ||
      refreshToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Sesión expirada');
    }

    const user = await this.buscarUsuarioConVoluntario(refreshToken.userId);
    if (!user) {
      throw new UnauthorizedException('Sesión expirada');
    }

    await this.prisma.refreshToken.update({
      where: { id: refreshToken.id },
      data: { revoked: true },
    });

    const usuario = this.mapUsuario(user);
    const accessToken = this.generarAccessToken(user.id, usuario.roles);
    const { token: nuevoRefreshToken, expiresAt } =
      await this.generarRefreshToken(user.id);

    return {
      accessToken,
      refreshToken: nuevoRefreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  async logout(tokenActual: string | undefined): Promise<{ message: string }> {
    if (tokenActual) {
      await this.prisma.refreshToken.updateMany({
        where: { token: tokenActual, revoked: false },
        data: { revoked: true },
      });
    }
    return { message: 'Sesión cerrada correctamente' };
  }

  async me(userId: string) {
    const user = await this.buscarUsuarioConVoluntario(userId);
    if (!user) {
      throw new UnauthorizedException('No autorizado');
    }
    const voluntario = user.voluntario;
    return {
      id: user.id,
      nombres: voluntario?.nombres ?? null,
      apellidoP: voluntario?.apellidoP ?? null,
      roles: voluntario?.roles.map((r) => r.rol) ?? [],
      correlativo: voluntario?.correlativo ?? null,
      tipo: voluntario?.tipo ?? null,
    };
  }
}
