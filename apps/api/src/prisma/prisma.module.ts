/**
 * Prisma database module.
 * Globally provides and exports the shared PrismaService client instance across the application.
 */
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global: inject PrismaService anywhere without importing this module again.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
/** Global module providing database access via Prisma Client. */
export class PrismaModule {}

