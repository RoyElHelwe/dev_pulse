import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { migrateWallMounted } from '../office/layout/migrate';
import type { OfficeLayout } from '../office/layout/types';

@Injectable()
export class LayoutMigrationService implements OnModuleInit {
  private readonly logger = new Logger(LayoutMigrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      if (!this.prisma?.workspace?.findMany) return;
      const workspaces = await this.prisma.workspace.findMany({
        select: { id: true, layout: true },
      });
      let changedCount = 0;
      for (const ws of workspaces) {
        if (!ws.layout) continue;
        const res = migrateWallMounted(ws.layout as unknown as OfficeLayout);
        if (res.changed) {
          await this.prisma.workspace.update({
            where: { id: ws.id },
            data: {
              layout: res.layout as unknown as Prisma.InputJsonValue,
              layoutVersion: { increment: 1 },
            },
          });
          changedCount++;
        }
      }
      this.logger.log(`Migrated wall-mounted furniture across ${changedCount} workspace layouts.`);
    } catch (err) {
      this.logger.warn(`Failed to migrate wall-mounted furniture: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
