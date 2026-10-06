import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FormError } from '../common/form-error';
import { studio } from '../office/templates/studio';
import { loft } from '../office/templates/loft';
import { WorkspaceService } from './workspace.service';
import { WorkspaceEvents } from './workspace-events';

describe('WorkspaceService chill wing & canAddChill', () => {
  let service: WorkspaceService;
  let fakePrisma: any;
  let fakeMembership: any;
  let fakeDesks: any;
  let events: WorkspaceEvents;

  const workspaceId = 'ws-1';

  beforeEach(() => {
    events = new WorkspaceEvents();
    vi.spyOn(events, 'emit');

    fakeMembership = {
      require: vi.fn(),
    };

    fakeDesks = {
      sync: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
    };

    fakePrisma = {
      workspace: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      workspaceMember: {
        count: vi.fn().mockResolvedValue(1),
      },
      officeWing: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(fakePrisma)),
    };

    service = new WorkspaceService(fakePrisma, fakeMembership, events, fakeDesks);
  });

  describe('canAddChill in mine()', () => {
    it('returns canAddChill: true for OWNER when office has no chill room', async () => {
      fakeMembership.require.mockResolvedValue({
        userId: 'user-1',
        role: 'OWNER',
        workspaceId,
        deskId: 'desk-1',
        workspace: {
          id: workspaceId,
          name: 'Studio Office',
          templateId: 'studio',
          layout: studio(),
          layoutVersion: 1,
        },
      });

      const res = await service.mine('user-1');
      expect(res.canAddChill).toBe(true);
      expect(res.canExpand).toBe(false);
    });

    it('returns canAddChill: false when office already has a chill room (e.g. loft)', async () => {
      fakeMembership.require.mockResolvedValue({
        userId: 'user-1',
        role: 'OWNER',
        workspaceId,
        deskId: 'desk-1',
        workspace: {
          id: workspaceId,
          name: 'Loft Office',
          templateId: 'loft',
          layout: loft(),
          layoutVersion: 1,
        },
      });

      const res = await service.mine('user-1');
      expect(res.canAddChill).toBe(false);
      expect(res.canExpand).toBe(true);
    });

    it('returns canAddChill: false for regular MEMBER', async () => {
      fakeMembership.require.mockResolvedValue({
        userId: 'user-2',
        role: 'MEMBER',
        workspaceId,
        deskId: 'desk-1',
        workspace: {
          id: workspaceId,
          name: 'Studio Office',
          templateId: 'studio',
          layout: studio(),
          layoutVersion: 1,
        },
      });

      const res = await service.mine('user-2');
      expect(res.canAddChill).toBe(false);
    });
  });

  describe('addChillWing', () => {
    it('throws CHILL_EXISTS when layout already has a chill room', async () => {
      fakeMembership.require.mockResolvedValue({
        userId: 'user-1',
        role: 'OWNER',
        workspaceId,
        deskId: 'desk-1',
        workspace: {
          id: workspaceId,
          name: 'Loft Office',
          templateId: 'loft',
          layout: loft(),
          layoutVersion: 1,
        },
      });

      await expect(service.addChillWing('user-1', { side: 'RIGHT', version: 1 })).rejects.toMatchObject({
        response: { error: { code: 'CHILL_EXISTS' } },
      });
    });

    it('allows adding chill wing to non-loft templates (e.g. studio)', async () => {
      const studioLayout = studio();
      fakeMembership.require.mockResolvedValue({
        userId: 'user-1',
        role: 'OWNER',
        workspaceId,
        deskId: 'desk-1',
        workspace: {
          id: workspaceId,
          name: 'Studio Office',
          templateId: 'studio',
          layout: studioLayout,
          layoutVersion: 1,
        },
      });

      // Normal addWing would throw WINGS_UNSUPPORTED on studio
      await expect(service.addWing('user-1', { side: 'RIGHT', version: 1 })).rejects.toMatchObject({
        response: { error: { code: 'WINGS_UNSUPPORTED' } },
      });

      // But addChillWing succeeds on studio
      const res = await service.addChillWing('user-1', { side: 'RIGHT', version: 1 });
      expect(fakePrisma.officeWing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deskCount: 0,
            side: 'RIGHT',
          }),
        }),
      );
      expect(res).toBeDefined();
    });
  });
});
