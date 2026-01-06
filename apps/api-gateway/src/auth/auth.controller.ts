import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Res,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthProxyService } from './auth-proxy.service';
import { AuthGuard } from './guards/auth.guard';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authProxyService: AuthProxyService,
    @Inject('WORKSPACE_SERVICE') private workspaceClient: ClientProxy,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async register(
    @Body()
    body: {
      email: string;
      password: string;
      name?: string;
      invitationToken?: string;
    },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    let result;
    try {
      result = await this.authProxyService.register(
        body.email,
        body.password,
        body.name,
      );
    } catch (error: any) {
      // Re-throw as appropriate NestJS exception
      if (error.statusCode === 400) {
        throw new BadRequestException(error.message || 'Registration failed');
      }
      throw error;
    }

    // If there's an invitation token, automatically log in and accept the invitation
    if (body.invitationToken) {
      try {
        // Auto-login the user
        const ipAddress = req.ip;
        const userAgent = req.headers['user-agent'];
        const loginResult = await this.authProxyService.login(
          body.email,
          body.password,
          ipAddress,
          userAgent,
        );

        // Set session cookies from auth service response
        if (loginResult.cookies) {
          loginResult.cookies.forEach((cookie: string) => {
            const [cookiePart] = cookie.split(';');
            const [name, value] = cookiePart.split('=');
            if (name === 'session_token' || name === 'refresh_token') {
              res.cookie(name, value, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge:
                  name === 'session_token'
                    ? 15 * 60 * 1000
                    : 7 * 24 * 60 * 60 * 1000,
                path: '/',
                domain:
                  process.env.NODE_ENV === 'production'
                    ? process.env.COOKIE_DOMAIN
                    : 'localhost',
              });
            }
          });

          // Accept the invitation
          await firstValueFrom(
            this.workspaceClient.send(
              { cmd: 'accept_invitation' },
              { token: body.invitationToken, userId: result.id },
            ),
          );

          return {
            ...result,
            user: loginResult.user,
            message:
              'Registration successful. You have been added to the workspace.',
          };
        }
      } catch (error) {
        // If auto-login or invitation acceptance fails, still return success for registration
        console.error('Failed to auto-accept invitation:', error);
        return {
          ...result,
          message:
            'Registration successful, but failed to auto-accept invitation. Please login and try again.',
        };
      }
    }

    return {
      ...result,
      message: 'Registration successful',
    };
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
    // Validate required fields
    if (!body.email || !body.password) {
      throw new UnauthorizedException('Email and password are required');
    }

    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    let result;
    try {
      result = await this.authProxyService.login(
        body.email,
        body.password,
        ipAddress,
        userAgent,
      );
    } catch (error: any) {
      // Re-throw as appropriate NestJS exception
      if (error.statusCode === 401) {
        throw new UnauthorizedException(error.message || 'Invalid credentials');
      }
      throw error;
    }

    // Set cookies from auth service response
    if (!result.requires2FA && result.cookies) {
      result.cookies.forEach((cookie: string) => {
        const [cookiePart] = cookie.split(';');
        const [name, value] = cookiePart.split('=');
        if (name === 'session_token' || name === 'refresh_token') {
          res.cookie(name, value, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge:
              name === 'session_token'
                ? 15 * 60 * 1000
                : 7 * 24 * 60 * 60 * 1000,
            path: '/',
            domain:
              process.env.NODE_ENV === 'production'
                ? process.env.COOKIE_DOMAIN
                : 'localhost',
          });
        }
      });

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

    let result;
    try {
      result = await this.authProxyService.verify2FA(
        body.userId,
        body.token,
        ipAddress,
        userAgent,
      );
    } catch (error: any) {
      // Re-throw as appropriate NestJS exception
      if (error.statusCode === 401) {
        throw new UnauthorizedException(error.message || 'Invalid 2FA token');
      }
      throw error;
    }

    // Set cookies from auth service response
    if (result.cookies) {
      result.cookies.forEach((cookie: string) => {
        const [cookiePart] = cookie.split(';');
        const [name, value] = cookiePart.split('=');
        if (name === 'session_token' || name === 'refresh_token') {
          res.cookie(name, value, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge:
              name === 'session_token'
                ? 15 * 60 * 1000
                : 7 * 24 * 60 * 60 * 1000,
            path: '/',
            domain:
              process.env.NODE_ENV === 'production'
                ? process.env.COOKIE_DOMAIN
                : 'localhost',
          });
        }
      });
    }

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

    const result = await this.authProxyService.refreshToken(
      refreshToken,
      ipAddress,
      userAgent,
    );

    // Set new session token cookie
    if (result.cookies) {
      result.cookies.forEach((cookie: string) => {
        const [cookiePart] = cookie.split(';');
        const [name, value] = cookiePart.split('=');
        if (name === 'session_token') {
          res.cookie(name, value, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000,
            path: '/',
            domain:
              process.env.NODE_ENV === 'production'
                ? process.env.COOKIE_DOMAIN
                : 'localhost',
          });
        }
      });
    }

    return { success: true, user: result.user };
  }

  @Post('2fa/setup')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Setup 2FA for user' })
  @ApiResponse({ status: 200, description: '2FA setup initiated' })
  async setup2FA(@Req() req: any) {
    const sessionToken = req.cookies?.session_token;
    return this.authProxyService.setup2FA(sessionToken);
  }

  @Post('2fa/enable')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable 2FA' })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA token' })
  async enable2FA(@Body() body: { token: string }, @Req() req: any) {
    const sessionToken = req.cookies?.session_token;
    return this.authProxyService.enable2FA(sessionToken, body.token);
  }

  @Post('2fa/disable')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA token' })
  async disable2FA(@Body() body: { token: string }, @Req() req: any) {
    const sessionToken = req.cookies?.session_token;
    return this.authProxyService.disable2FA(sessionToken, body.token);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'User retrieved' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getCurrentUser(@Req() req: any) {
    return {
      user: req.user,
    };
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
    const sessionToken = req.cookies?.session_token;
    return this.authProxyService.getUserSessions(sessionToken);
  }

  @Delete('session/:sessionId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 204, description: 'Session revoked' })
  async revokeSession(@Req() req: any, @Body() body: { sessionId: string }) {
    const sessionToken = req.cookies?.session_token;
    return this.authProxyService.revokeSession(sessionToken, body.sessionId);
  }

  @Delete('sessions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all sessions except current' })
  @ApiResponse({ status: 204, description: 'All sessions revoked' })
  async revokeAllSessions(@Req() req: any) {
    const sessionToken = req.cookies?.session_token;
    return this.authProxyService.revokeAllSessions(sessionToken);
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
    const refreshToken = req.cookies?.refresh_token || '';

    if (sessionToken) {
      await this.authProxyService.logout(sessionToken, refreshToken);
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

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async forgotPassword(@Body() body: { email: string }) {
    return this.authProxyService.forgotPassword(body.email);
  }

  @Get('verify-reset-token/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify password reset token' })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyResetToken(@Param('token') token: string) {
    return this.authProxyService.verifyResetToken(token);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authProxyService.resetPassword(body.token, body.newPassword);
  }
}
