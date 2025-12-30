import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Headers,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { Request, Response } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async register(
    @Body() body: { email: string; password: string; name?: string },
  ) {
    return this.authService.register(body.email, body.password, body.name);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.login(
      body.email,
      body.password,
      ipAddress,
      userAgent,
    );

    // Set cookies if not 2FA
    if (!result.requires2FA && result.sessionToken && result.refreshToken) {
      // Set httpOnly cookie for session token
      res.cookie('session_token', result.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/',
        domain:
          process.env.NODE_ENV === 'production'
            ? process.env.COOKIE_DOMAIN
            : 'localhost',
      });

      // Set httpOnly cookie for refresh token
      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
        domain:
          process.env.NODE_ENV === 'production'
            ? process.env.COOKIE_DOMAIN
            : 'localhost',
      });

      // Return user info without tokens
      return {
        requires2FA: false,
        user: result.user,
      };
    }

    return result;
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA token' })
  @ApiResponse({ status: 200, description: '2FA verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA token' })
  async verify2FA(
    @Body() body: { userId: string; token: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.verify2FA(
      body.userId,
      body.token,
      ipAddress,
      userAgent,
    );

    // Set httpOnly cookies
    res.cookie('session_token', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
      domain:
        process.env.NODE_ENV === 'production'
          ? process.env.COOKIE_DOMAIN
          : 'localhost',
    });

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
      domain:
        process.env.NODE_ENV === 'production'
          ? process.env.COOKIE_DOMAIN
          : 'localhost',
    });

    // Return user info without tokens
    return {
      user: result.user,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.authService.refreshToken(
      refreshToken,
      ipAddress,
      userAgent,
    );

    // Update session token cookie
    res.cookie('session_token', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
      domain:
        process.env.NODE_ENV === 'production'
          ? process.env.COOKIE_DOMAIN
          : 'localhost',
    });

    // Return user info without tokens
    return {
      user: result.user,
    };
  }

  @Post('2fa/setup')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Setup 2FA for user' })
  @ApiResponse({ status: 200, description: '2FA setup initiated' })
  async setup2FA(@Req() req: any) {
    return this.authService.setup2FA(req.user.id);
  }

  @Post('2fa/enable')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable 2FA' })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA token' })
  async enable2FA(@Body() body: { token: string }, @Req() req: any) {
    return this.authService.enable2FA(req.user.id, body.token);
  }

  @Post('2fa/disable')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA token' })
  async disable2FA(@Body() body: { token: string }, @Req() req: any) {
    return this.authService.disable2FA(req.user.id, body.token);
  }

  @Get('session')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current session info' })
  @ApiResponse({ status: 200, description: 'Session info retrieved' })
  async getSession(@Req() req: any) {
    return {
      user: req.user,
      session: req.session,
    };
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all user sessions' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved' })
  async getSessions(@Req() req: any) {
    return this.authService.getUserSessions(req.user.id);
  }

  @Delete('session/:sessionId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 204, description: 'Session revoked' })
  async revokeSession(@Req() req: any, @Body() body: { sessionId: string }) {
    return this.authService.revokeSession(req.user.id, body.sessionId);
  }

  @Delete('sessions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all sessions except current' })
  @ApiResponse({ status: 204, description: 'All sessions revoked' })
  async revokeAllSessions(@Req() req: any) {
    return this.authService.revokeAllSessions(req.user.id, req.session.id);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout current session' })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Get session token from cookie or Authorization header
    const sessionToken =
      req.cookies?.session_token ||
      req.headers.authorization?.replace('Bearer ', '');

    if (sessionToken) {
      await this.authService.logout(sessionToken);
    }

    // Clear cookies
    res.clearCookie('session_token', {
      path: '/',
      domain:
        process.env.NODE_ENV === 'production'
          ? process.env.COOKIE_DOMAIN
          : 'localhost',
    });
    res.clearCookie('refresh_token', {
      path: '/',
      domain:
        process.env.NODE_ENV === 'production'
          ? process.env.COOKIE_DOMAIN
          : 'localhost',
    });

    return { success: true };
  }
}
