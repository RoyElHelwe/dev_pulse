import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Headers,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { AuthGuard } from './guards/auth.guard'
import { Request } from 'express'

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
    return this.authService.register(body.email, body.password, body.name)
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
  ) {
    const ipAddress = req.ip
    const userAgent = req.headers['user-agent']

    return this.authService.login(body.email, body.password, ipAddress, userAgent)
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA token' })
  @ApiResponse({ status: 200, description: '2FA verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA token' })
  async verify2FA(
    @Body() body: { userId: string; token: string },
    @Req() req: Request,
  ) {
    const ipAddress = req.ip
    const userAgent = req.headers['user-agent']

    return this.authService.verify2FA(body.userId, body.token, ipAddress, userAgent)
  }

  @Post('2fa/setup')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Setup 2FA for user' })
  @ApiResponse({ status: 200, description: '2FA setup initiated' })
  async setup2FA(@Req() req: any) {
    return this.authService.setup2FA(req.user.id)
  }

  @Post('2fa/enable')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable 2FA' })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA token' })
  async enable2FA(
    @Body() body: { token: string },
    @Req() req: any,
  ) {
    return this.authService.enable2FA(req.user.id, body.token)
  }

  @Post('2fa/disable')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA token' })
  async disable2FA(
    @Body() body: { token: string },
    @Req() req: any,
  ) {
    return this.authService.disable2FA(req.user.id, body.token)
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
    }
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all user sessions' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved' })
  async getSessions(@Req() req: any) {
    return this.authService.getUserSessions(req.user.id)
  }

  @Delete('session/:sessionId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 204, description: 'Session revoked' })
  async revokeSession(
    @Req() req: any,
    @Body() body: { sessionId: string },
  ) {
    return this.authService.revokeSession(req.user.id, body.sessionId)
  }

  @Delete('sessions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all sessions except current' })
  @ApiResponse({ status: 204, description: 'All sessions revoked' })
  async revokeAllSessions(@Req() req: any) {
    return this.authService.revokeAllSessions(req.user.id, req.session.id)
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout current session' })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  async logout(@Headers('authorization') auth: string) {
    const sessionToken = auth?.replace('Bearer ', '')
    return this.authService.logout(sessionToken)
  }
}
