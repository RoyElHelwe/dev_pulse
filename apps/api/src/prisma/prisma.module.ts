import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global: inject PrismaService anywhere without importing this module again.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
