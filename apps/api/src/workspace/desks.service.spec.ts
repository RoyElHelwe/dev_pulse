import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FormError } from '../common/form-error';
import { WorkspaceEvents } from './workspace-events';
import { DesksService } from './desks.service';

describe('DesksService.move', () => {
  let service: DesksService;
  let fakePrisma: any;
  let fakeMembership: any;
  let events: WorkspaceEvents;

  const workspaceId = 'ws-1';
  const layout = {
    rooms: [],
    walls: [],
    furniture: [
      { id: 'desk-1', kind: 'desk', x: 0, y: 0, w: 2, h: 1 },
      { id: 'desk-2', kind: 'desk', x: 4, y: 0, w: 2, h: 1 },
    ],
  };
  const workspace = { id: workspaceId, name: 'Dev Pulse', layout };

  beforeEach(() => {
    events = new WorkspaceEvents();
    vi.spyOn(events, 'emit');

    fakeMembership = {
      require: vi.fn().mockResolvedValue({
        userId: 'user-1',
        role: 'MEMBER',
        workspaceId,
        deskId: null,
        workspace,
      }),
    };

    fakePrisma = {
      workspaceMember: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(fakePrisma)),
    };

    service = new DesksService(fakePrisma, fakeMembership, events);
  });

  it('rejects if desk does not exist in layout', async () => {
    await expect(service.move('user-1', 'nonexistent-desk')).rejects.toThrow(FormError);
    await expect(service.move('user-1', 'nonexistent-desk')).rejects.toMatchObject({
      response: { error: { code: 'NO_SUCH_DESK' } },
    });
  });

  it('returns early when member already sits at the requested desk', async () => {
    fakeMembership.require.mockResolvedValue({
      userId: 'user-1',
      role: 'MEMBER',
      workspaceId,
      deskId: 'desk-1',
      workspace,
    });

    await expect(service.move('user-1', 'desk-1')).resolves.toBeUndefined();
    expect(fakePrisma.$transaction).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('rejects if another member already sits at the desk', async () => {
    fakePrisma.workspaceMember.findFirst.mockResolvedValue({
      userId: 'user-2',
      deskId: 'desk-1',
      workspaceId,
    });

    await expect(service.move('user-1', 'desk-1')).rejects.toThrow(FormError);
    await expect(service.move('user-1', 'desk-1')).rejects.toMatchObject({
      response: { error: { code: 'DESK_TAKEN' } },
    });
    expect(fakePrisma.workspaceMember.update).not.toHaveBeenCalled();
  });

  it('catches Prisma P2002 unique constraint violation and throws DESK_TAKEN', async () => {
    fakePrisma.workspaceMember.findFirst.mockResolvedValue(null);
    fakePrisma.workspaceMember.update.mockRejectedValue({ code: 'P2002' });

    await expect(service.move('user-1', 'desk-1')).rejects.toThrow(FormError);
    await expect(service.move('user-1', 'desk-1')).rejects.toMatchObject({
      response: { error: { code: 'DESK_TAKEN' } },
    });
  });

  it('moves member to desk and publishes desks event on success', async () => {
    fakePrisma.workspaceMember.findFirst.mockResolvedValue(null);
    fakePrisma.workspaceMember.update.mockResolvedValue({ userId: 'user-1', deskId: 'desk-1' });
    fakePrisma.workspaceMember.findMany.mockResolvedValue([
      { deskId: 'desk-1', userId: 'user-1', character: 'alex', user: { displayName: 'Alex' } },
    ]);

    await expect(service.move('user-1', 'desk-1')).resolves.toBeUndefined();

    expect(fakePrisma.workspaceMember.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { deskId: 'desk-1' },
    });
    expect(events.emit).toHaveBeenCalledWith({
      type: 'desks',
      workspaceId,
      desks: [{ deskId: 'desk-1', userId: 'user-1', name: 'Alex', character: 'alex' }],
    });
  });
});
