import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LayoutMigrationService } from './layout-migration.service';
import { studio } from '../office/templates/studio';
import type { Furniture, OfficeLayout } from '../office/layout/types';

describe('LayoutMigrationService', () => {
  let service: LayoutMigrationService;
  let fakePrisma: any;

  beforeEach(() => {
    fakePrisma = {
      workspace: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new LayoutMigrationService(fakePrisma);
  });

  it('migrates unaligned wall-mounted items and increments layoutVersion', async () => {
    const base = studio();
    const board: Furniture = { id: 'board-off', kind: 'board', x: 32, y: 14.40625, w: 3, h: 0.5 };
    const invalidLayout: OfficeLayout = {
      ...base,
      furniture: [...base.furniture.filter((f) => f.kind !== 'board'), board],
    };

    fakePrisma.workspace.findMany.mockResolvedValue([
      { id: 'ws-1', layout: invalidLayout },
      { id: 'ws-2', layout: studio() },
    ]);
    fakePrisma.workspace.update.mockResolvedValue({});

    await service.onModuleInit();

    expect(fakePrisma.workspace.update).toHaveBeenCalledTimes(1);
    expect(fakePrisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ws-1' },
        data: expect.objectContaining({
          layoutVersion: { increment: 1 },
        }),
      }),
    );
  });

  it('does not throw on database errors', async () => {
    fakePrisma.workspace.findMany.mockRejectedValue(new Error('DB unreachable'));
    await expect(service.onModuleInit()).resolves.not.toThrow();
  });
});
