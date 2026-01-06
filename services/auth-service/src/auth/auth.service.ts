import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async register(email: string, password: string, name?: string) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        emailVerified: false, // Should be verified via email in production
      },
    });

    // Create account with password
    await this.prisma.account.create({
      data: {
        userId: user.id,
        type: 'credentials',
        provider: 'credentials',
        providerAccountId: user.id,
        access_token: hashedPassword,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        accounts: {
          where: { provider: 'credentials' },
        },
      },
    });

    if (!user || user.accounts.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const account = user.accounts[0];
    const isValidPassword = await bcrypt.compare(
      password,
      account.access_token!,
    );

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      return {
        requires2FA: true,
        userId: user.id,
      };
    }

    // Create session
    const session = await this.createSession(user.id, ipAddress, userAgent);

    return {
      requires2FA: false,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      sessionToken: session.sessionToken,
      refreshToken: session.refreshToken,
    };
  }

  async verify2FA(
    userId: string,
    token: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA not enabled');
    }

    // Verify TOTP token
    const totp = new OTPAuth.TOTP({
      secret: user.twoFactorSecret,
      digits: 6,
      period: 30,
    });

    const isValid = totp.validate({ token, window: 1 }) !== null;

    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA token');
    }

    // Create session
    const session = await this.createSession(user.id, ipAddress, userAgent);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      sessionToken: session.sessionToken,
      refreshToken: session.refreshToken,
    };
  }

  async setup2FA(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA already enabled');
    }

    // Generate secret
    const secret = new OTPAuth.Secret();
    const totp = new OTPAuth.TOTP({
      issuer: 'ft_transcendence',
      label: user.email,
      secret,
      digits: 6,
      period: 30,
    });

    // Generate QR code
    const otpauthURL = totp.toString();
    const qrCodeDataURL = await QRCode.toDataURL(otpauthURL);

    // Store secret temporarily (will be confirmed later)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret.base32,
      },
    });

    return {
      secret: secret.base32,
      qrCode: qrCodeDataURL,
    };
  }

  async enable2FA(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA setup not initiated');
    }

    // Verify token
    const totp = new OTPAuth.TOTP({
      secret: user.twoFactorSecret,
      digits: 6,
      period: 30,
    });

    const isValid = totp.validate({ token, window: 1 }) !== null;

    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA token');
    }

    // Enable 2FA
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
      },
    });

    return { success: true };
  }

  async disable2FA(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorEnabled) {
      throw new BadRequestException('2FA not enabled');
    }

    // Verify token before disabling
    const totp = new OTPAuth.TOTP({
      secret: user.twoFactorSecret!,
      digits: 6,
      period: 30,
    });

    const isValid = totp.validate({ token, window: 1 }) !== null;

    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA token');
    }

    // Disable 2FA
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    return { success: true };
  }

  async validateSession(sessionToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    if (session.expires < new Date()) {
      await this.prisma.session.delete({
        where: { id: session.id },
      });
      throw new UnauthorizedException('Session expired');
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      },
      session: {
        id: session.id,
        expires: session.expires,
      },
    };
  }

  async logout(sessionToken: string) {
    await this.prisma.session.delete({
      where: { sessionToken },
    });

    return { success: true };
  }

  async getUserSessions(userId: string, currentSessionToken?: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { lastActivityAt: 'desc' },
    });

    return sessions.map((session) => {
      const deviceInfo = this.parseUserAgent(session.userAgent || 'Unknown');
      
      return {
        id: session.id,
        ipAddress: session.ipAddress || 'Unknown',
        userAgent: session.userAgent,
        deviceInfo,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        expiresAt: session.expires,
        isCurrent: currentSessionToken ? session.sessionToken === currentSessionToken : false,
      };
    });
  }

  private parseUserAgent(userAgent: string): string {
    // Simple user agent parsing
    const ua = userAgent.toLowerCase();
    
    // Browser detection
    let browser = 'Unknown Browser';
    if (ua.includes('edg/')) browser = 'Edge';
    else if (ua.includes('chrome/')) browser = 'Chrome';
    else if (ua.includes('firefox/')) browser = 'Firefox';
    else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari';
    
    // OS detection
    let os = 'Unknown OS';
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
    
    return `${browser} on ${os}`;
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    await this.prisma.session.delete({
      where: { id: sessionId },
    });

    return { success: true };
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string) {
    if (exceptSessionId) {
      await this.prisma.session.deleteMany({
        where: {
          userId,
          id: { not: exceptSessionId },
        },
      });
    } else {
      await this.prisma.session.deleteMany({
        where: { userId },
      });
    }

    return { success: true };
  }

  private async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const sessionToken = this.generateSessionToken();
    const refreshToken = this.generateSessionToken();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes for access token
    const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days for refresh token

    const session = await this.prisma.session.create({
      data: {
        sessionToken,
        refreshToken,
        userId,
        expires,
        refreshExpires,
        ipAddress,
        userAgent,
      },
    });

    return session;
  }

  private generateSessionToken(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 64; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  async refreshToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Find session by refresh token
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if refresh token expired
    if (session.refreshExpires < new Date()) {
      await this.prisma.session.delete({
        where: { id: session.id },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Generate new access token
    const newSessionToken = this.generateSessionToken();
    const newExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Update session with new access token
    const updatedSession = await this.prisma.session.update({
      where: { id: session.id },
      data: {
        sessionToken: newSessionToken,
        expires: newExpires,
        ipAddress: ipAddress || session.ipAddress,
        userAgent: userAgent || session.userAgent,
        updatedAt: new Date(),
      },
    });

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      },
      sessionToken: updatedSession.sessionToken,
      refreshToken: updatedSession.refreshToken,
    };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ resetToken: string }> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists or not for security
      throw new NotFoundException('If this email exists, a reset link will be sent');
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);

    // Store token with expiry (1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt,
      },
    });

    // Build reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Send email
    await this.emailService.sendPasswordResetEmail({
      to: user.email,
      resetUrl,
    });

    return { resetToken };
  }

  /**
   * Verify password reset token
   */
  async verifyResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
    // Find all non-expired reset tokens
    const resetTokens = await this.prisma.passwordReset.findMany({
      where: {
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    // Check each token
    for (const resetRecord of resetTokens) {
      const isValid = await bcrypt.compare(token, resetRecord.token);
      if (isValid) {
        return {
          valid: true,
          email: resetRecord.user.email,
        };
      }
    }

    return { valid: false };
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
    // Verify token and get user
    const resetTokens = await this.prisma.passwordReset.findMany({
      where: {
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          include: {
            accounts: {
              where: { provider: 'credentials' },
            },
          },
        },
      },
    });

    let resetRecord = null;
    for (const record of resetTokens) {
      const isValid = await bcrypt.compare(token, record.token);
      if (isValid) {
        resetRecord = record;
        break;
      }
    }

    if (!resetRecord) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    if (resetRecord.user.accounts.length > 0) {
      await this.prisma.account.update({
        where: { id: resetRecord.user.accounts[0].id },
        data: {
          access_token: hashedPassword,
        },
      });
    } else {
      // Create account if doesn't exist
      await this.prisma.account.create({
        data: {
          userId: resetRecord.user.id,
          type: 'credentials',
          provider: 'credentials',
          providerAccountId: resetRecord.user.id,
          access_token: hashedPassword,
        },
      });
    }

    // Mark token as used
    await this.prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { used: true },
    });

    // Invalidate all existing sessions for security
    await this.prisma.session.deleteMany({
      where: { userId: resetRecord.user.id },
    });

    return { success: true };
  }
}

