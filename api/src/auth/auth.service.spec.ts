import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RolSistema, TipoVoluntario } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock };
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let jwtService: { sign: jest.Mock };

  const usuarioBase = {
    id: 'user-1',
    username: '1',
    passwordHash: '',
    createdAt: new Date(),
    voluntario: {
      id: 'vol-1',
      correlativo: 1,
      tipo: TipoVoluntario.QUINCE,
      nombres: 'Ana',
      apellidoP: 'Pérez',
      roles: [{ voluntarioId: 'vol-1', rol: RolSistema.ADMIN }],
    },
  };

  beforeEach(async () => {
    usuarioBase.passwordHash = await bcrypt.hash('secreto123', 10);

    prisma = {
      user: { findUnique: jest.fn() },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    jwtService = { sign: jest.fn().mockReturnValue('access-token-firmado') };

    authService = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
    );
  });

  describe('login', () => {
    it('lanza 401 con mensaje en español si el usuario no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.login('desconocido', 'x')).rejects.toThrow(
        new UnauthorizedException('Credenciales incorrectas'),
      );
    });

    it('lanza 401 si la contraseña no coincide', async () => {
      prisma.user.findUnique.mockResolvedValue(usuarioBase);

      await expect(
        authService.login('1', 'password-incorrecta'),
      ).rejects.toThrow(new UnauthorizedException('Credenciales incorrectas'));
    });

    it('retorna accessToken, refreshToken y datos del usuario cuando las credenciales son válidas', async () => {
      prisma.user.findUnique.mockResolvedValue(usuarioBase);
      prisma.refreshToken.create.mockResolvedValue({});

      const resultado = await authService.login('1', 'secreto123');

      expect(resultado.accessToken).toBe('access-token-firmado');
      expect(resultado.refreshToken).toEqual(expect.any(String));
      expect(resultado.user).toEqual({
        id: 'user-1',
        nombre: 'Ana Pérez',
        roles: [RolSistema.ADMIN],
        correlativo: 1,
        tipo: TipoVoluntario.QUINCE,
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        roles: [RolSistema.ADMIN],
      });
      const [[argumentoCreate]] = prisma.refreshToken.create.mock.calls as [
        { data: { userId: string } },
      ][];
      expect(argumentoCreate.data.userId).toBe('user-1');
    });
  });

  describe('refresh', () => {
    it('lanza 401 "Sesión expirada" si no llega token', async () => {
      await expect(authService.refresh(undefined)).rejects.toThrow(
        new UnauthorizedException('Sesión expirada'),
      );
    });

    it('lanza 401 "Sesión expirada" si el token está revocado', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        token: 'abc',
        userId: 'user-1',
        revoked: true,
        expiresAt: new Date(Date.now() + 1000 * 60),
      });

      await expect(authService.refresh('abc')).rejects.toThrow(
        new UnauthorizedException('Sesión expirada'),
      );
    });

    it('lanza 401 "Sesión expirada" si el token ya expiró', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        token: 'abc',
        userId: 'user-1',
        revoked: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(authService.refresh('abc')).rejects.toThrow(
        new UnauthorizedException('Sesión expirada'),
      );
    });

    it('rota el refresh token: revoca el anterior y crea uno nuevo', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        token: 'abc',
        userId: 'user-1',
        revoked: false,
        expiresAt: new Date(Date.now() + 1000 * 60),
      });
      prisma.user.findUnique.mockResolvedValue(usuarioBase);
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.refreshToken.update.mockResolvedValue({});

      const resultado = await authService.refresh('abc');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revoked: true },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(resultado.accessToken).toBe('access-token-firmado');
      expect(resultado.refreshToken).not.toBe('abc');
    });
  });

  describe('logout', () => {
    it('marca el refresh token como revocado y retorna el mensaje de éxito', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const resultado = await authService.logout('abc');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token: 'abc', revoked: false },
        data: { revoked: true },
      });
      expect(resultado).toEqual({ message: 'Sesión cerrada correctamente' });
    });

    it('retorna el mensaje de éxito aunque no haya cookie', async () => {
      const resultado = await authService.logout(undefined);

      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(resultado).toEqual({ message: 'Sesión cerrada correctamente' });
    });
  });

  describe('me', () => {
    it('retorna nombres, apellidoP, roles, correlativo y tipo', async () => {
      prisma.user.findUnique.mockResolvedValue(usuarioBase);

      const resultado = await authService.me('user-1');

      expect(resultado).toEqual({
        id: 'user-1',
        nombres: 'Ana',
        apellidoP: 'Pérez',
        roles: [RolSistema.ADMIN],
        correlativo: 1,
        tipo: TipoVoluntario.QUINCE,
      });
    });

    it('lanza 401 si el usuario no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.me('user-x')).rejects.toThrow(
        new UnauthorizedException('No autorizado'),
      );
    });
  });
});
