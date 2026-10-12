/**
 * Authentication and authorization root module.
 * Wires JWT cryptography, credential controllers, OAuth providers, guards, and session event emitters.
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from '../common/auth/auth.guard';
import { AppConfig } from '../config/app-config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { deriveKey } from './crypto/secrets';
import { EmailTokensService } from './email-tokens.service';
import { OAuthController } from './oauth/oauth.controller';
import { OAuthService } from './oauth/oauth.service';
import { PasswordService } from './password.service';
import { SessionEvents } from './session-events';
import { SessionGateway } from './session.gateway';
import { SessionTakeoverService } from './session-takeover.service';
import { TokensService } from './tokens.service';
import { TwoFactorService } from './two-factor.service';
import { VerificationService } from './verification.service';

/** Wires JWT cryptography, credential controllers, OAuth providers, and session guards. */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        // Derives an independent subkey strictly for JWT signing via HKDF to prevent cross-protocol key leakage.
        secret: deriveKey(config.jwtSecret, 'jwt').toString('base64'),
        signOptions: { algorithm: 'HS256', issuer: 'dev-pulse' },
        verifyOptions: { algorithms: ['HS256'], issuer: 'dev-pulse' },
      }),
    }),
  ],
  controllers: [AuthController, OAuthController],
  providers: [
    AuthService,
    TokensService,
    EmailTokensService,
    VerificationService,
    PasswordService,
    TwoFactorService,
    OAuthService,
    SessionEvents,
    SessionTakeoverService,
    SessionGateway,
    // Secure by default: every endpoint requires valid authentication unless explicitly decorated with @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  // AuthService is exported for the dev sign-in in DevModule (dev/dev.service.ts).
  exports: [AuthService, TokensService, SessionEvents],
})
export class AuthModule {}

