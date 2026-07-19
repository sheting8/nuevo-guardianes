import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { MOBILE_CLIENT_HEADER, MOBILE_CLIENT_VALUE } from './auth.constants';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './types/jwt-payload.interface';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/auth';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setRefreshCookie(
    res: Response,
    token: string,
    expiresAt: Date,
  ): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      expires: expiresAt,
    });
  }

  // Apps móviles no tienen cookie jar de navegador: se identifican con este
  // header para recibir el refresh token en el body. Un request sin el
  // header (cualquier navegador) nunca lo recibe ahí.
  private esClienteMobile(req: Request): boolean {
    return req.headers[MOBILE_CLIENT_HEADER] === MOBILE_CLIENT_VALUE;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, refreshTokenExpiresAt, user } =
      await this.authService.login(dto.username, dto.password);
    this.setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    return {
      accessToken,
      user,
      ...(this.esClienteMobile(req) ? { refreshToken } : {}),
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokenActual =
      (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) ??
      dto.refreshToken;
    const { accessToken, refreshToken, refreshTokenExpiresAt } =
      await this.authService.refresh(tokenActual);
    this.setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    return {
      accessToken,
      ...(this.esClienteMobile(req) ? { refreshToken } : {}),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokenActual =
      (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) ??
      dto.refreshToken;
    const result = await this.authService.logout(tokenActual);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.sub);
  }
}
