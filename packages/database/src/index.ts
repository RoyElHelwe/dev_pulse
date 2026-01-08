// =============================================================================
// @ft-trans/database
// Shared Prisma database client for ft_transcendence
// =============================================================================

// Re-export everything from Prisma Client
export * from '@prisma/client';
export { PrismaClient } from '@prisma/client';

// Re-export the NestJS service
export { PrismaService } from './prisma.service';
export { PrismaModule } from './prisma.module';

// Export types for convenience
export type {
  User,
  Account,
  Session,
  VerificationToken,
  PasswordReset,
  Workspace,
  WorkspaceMember,
  Invitation,
  OfficeLayout,
  OfficeTemplate,
  DeskAssignment,
  MeetingRoomBooking,
  Task,
  TaskComment,
  Sprint,
  Message,
  AuditLog,
} from '@prisma/client';

// Export enums
export { GenerationMode, TemplateCategory } from '@prisma/client';
