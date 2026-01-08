import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from '@ft-trans/database';

@Module({
  imports: [PrismaModule, AuthModule],
})
export class AppModule {}
