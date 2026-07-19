import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
  };
  let res: { cookie: jest.Mock; clearCookie: jest.Mock };

  const tokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    refreshTokenExpiresAt: new Date(Date.now() + 1000 * 60),
  };

  function req(headers: Record<string, string> = {}, cookies: Record<string, string> = {}): Request {
    return { headers, cookies } as unknown as Request;
  }

  beforeEach(() => {
    authService = {
      login: jest.fn().mockResolvedValue({ ...tokens, user: { id: 'user-1' } }),
      refresh: jest.fn().mockResolvedValue(tokens),
      logout: jest.fn().mockResolvedValue({ message: 'Sesión cerrada correctamente' }),
    };
    res = { cookie: jest.fn(), clearCookie: jest.fn() };

    controller = new AuthController(
      authService as unknown as AuthService,
      { get: jest.fn().mockReturnValue('test') } as unknown as ConfigService,
    );
  });

  describe('login', () => {
    it('no incluye refreshToken en el body para un navegador (sin header mobile)', async () => {
      const resultado = await controller.login(
        { username: '1', password: 'x' },
        req(),
        res as unknown as Response,
      );

      expect(res.cookie).toHaveBeenCalled();
      expect(resultado).not.toHaveProperty('refreshToken');
      expect(resultado.accessToken).toBe('access-token');
    });

    it('incluye refreshToken en el body cuando el header x-client-platform es mobile', async () => {
      const resultado = await controller.login(
        { username: '1', password: 'x' },
        req({ 'x-client-platform': 'mobile' }),
        res as unknown as Response,
      );

      expect(resultado).toHaveProperty('refreshToken', 'refresh-token');
    });
  });

  describe('refresh', () => {
    it('usa el refresh token de la cookie si está presente', async () => {
      await controller.refresh(req({}, { refreshToken: 'de-la-cookie' }), {}, res as unknown as Response);

      expect(authService.refresh).toHaveBeenCalledWith('de-la-cookie');
    });

    it('usa el refresh token del body si no hay cookie (cliente mobile)', async () => {
      await controller.refresh(
        req({ 'x-client-platform': 'mobile' }),
        { refreshToken: 'del-body' },
        res as unknown as Response,
      );

      expect(authService.refresh).toHaveBeenCalledWith('del-body');
    });

    it('prioriza la cookie sobre el body si ambos están presentes', async () => {
      await controller.refresh(
        req({}, { refreshToken: 'de-la-cookie' }),
        { refreshToken: 'del-body' },
        res as unknown as Response,
      );

      expect(authService.refresh).toHaveBeenCalledWith('de-la-cookie');
    });

    it('no incluye refreshToken en el body para un navegador', async () => {
      const resultado = await controller.refresh(req({}, { refreshToken: 'x' }), {}, res as unknown as Response);

      expect(resultado).not.toHaveProperty('refreshToken');
    });

    it('incluye refreshToken en el body para un cliente mobile', async () => {
      const resultado = await controller.refresh(
        req({ 'x-client-platform': 'mobile' }),
        { refreshToken: 'del-body' },
        res as unknown as Response,
      );

      expect(resultado).toHaveProperty('refreshToken', 'refresh-token');
    });
  });

  describe('logout', () => {
    it('usa el refresh token del body si no hay cookie', async () => {
      await controller.logout(
        req({ 'x-client-platform': 'mobile' }),
        { refreshToken: 'del-body' },
        res as unknown as Response,
      );

      expect(authService.logout).toHaveBeenCalledWith('del-body');
      expect(res.clearCookie).toHaveBeenCalled();
    });
  });
});
