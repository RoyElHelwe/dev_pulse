import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from '../common/auth/auth.guard';
import { AppConfig } from '../config/app-config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DevLoginController } from './dev-login.controller';
import { DevLoginService } from './dev-login.service';
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

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        // A key derived for JWTs only; other features derive their own keys.
        secret: deriveKey(config.jwtSecret, 'jwt').toString('base64'),
        signOptions: { algorithm: 'HS256', issuer: 'dev-pulse' },
        verifyOptions: { algorithms: ['HS256'], issuer: 'dev-pulse' },
      }),
    }),
  ],
  controllers: [AuthController, OAuthController, DevLoginController],
  providers: [
    AuthService,
    DevLoginService,
    TokensService,
    EmailTokensService,
    VerificationService,
    PasswordService,
    TwoFactorService,
    OAuthService,
    SessionEvents,
    SessionTakeoverService,
    SessionGateway,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [TokensService, SessionEvents],
})
export class AuthModule {}
