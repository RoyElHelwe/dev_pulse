import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from '../common/auth/auth.guard';
import { AppConfig } from '../config/app-config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { deriveKey } from './crypto/secrets';
import { EmailTokensService } from './email-tokens.service';
import { TokensService } from './tokens.service';
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
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensService,
    EmailTokensService,
    VerificationService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [TokensService],
})
export class AuthModule {}
