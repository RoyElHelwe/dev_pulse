import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FormError } from '../common/form-error';
import { WorkspaceEvents } from '../workspace/workspace-events';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  let fakePrisma: any;
  let fakeMembership: any;
  let fakeOffice: any;
  let events: WorkspaceEvents;

  const workspaceId = 'ws-1';
  const workspace = { id: workspaceId, name: 'Dev Pulse' };

  beforeEach(() => {
    events = new WorkspaceEvents();
    fakeOffice = {
      broadcast: vi.fn(),
    };
    fakeMembership = {
      require: vi.fn().mockImplementation(async (userId: string) => ({
        userId,
        role: 'MEMBER',
        workspaceId,
        workspace,
      })),
    };
    fakePrisma = {
      workspaceMember: {
        count: vi.fn(),
        findFirst: vi.fn(),
      },
      workspace: {
        findUnique: vi.fn().mockResolvedValue(workspace),
      },
      task: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        aggregate: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(fakePrisma)),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };

    service = new TasksService(fakePrisma, fakeMembership, fakeOffice, events);
    service.onModuleInit();
  });

  describe('create', () => {
    it('rejects assignee who is not a member of the workspace', async () => {
      fakePrisma.workspaceMember.count.mockResolvedValue(0);

      await expect(
        service.create('user-1', {
          title: 'New Bug',
          assigneeId: 'not-in-office',
        }),
      ).rejects.toThrow(FormError);

      expect(fakePrisma.workspaceMember.count).toHaveBeenCalledWith({
        where: { workspaceId, userId: 'not-in-office' },
      });
    });
  });

  describe('remove', () => {
    it('rejects deletion for MEMBER who is not the reporter', async () => {
      fakeMembership.require.mockResolvedValue({
        userId: 'user-other',
        role: 'MEMBER',
        workspaceId,
        workspace,
      });
      fakePrisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        workspaceId,
        reporterId: 'user-reporter',
      });

      await expect(service.remove('user-other', 'task-1')).rejects.toThrow(FormError);
    });

    it('allows deletion for reporter even if MEMBER', async () => {
      fakeMembership.require.mockResolvedValue({
        userId: 'user-reporter',
        role: 'MEMBER',
        workspaceId,
        workspace,
      });
      fakePrisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        workspaceId,
        reporterId: 'user-reporter',
      });
      fakePrisma.task.delete.mockResolvedValue({ id: 'task-1' });

      await expect(service.remove('user-reporter', 'task-1')).resolves.toBeUndefined();
      expect(fakePrisma.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
      expect(fakeOffice.broadcast).toHaveBeenCalledWith(workspaceId, 'task:deleted', { id: 'task-1' });
    });

    it('allows deletion for ADMIN even if not reporter', async () => {
      fakeMembership.require.mockResolvedValue({
        userId: 'admin-1',
        role: 'ADMIN',
        workspaceId,
        workspace,
      });
      fakePrisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        workspaceId,
        reporterId: 'user-reporter',
      });
      fakePrisma.task.delete.mockResolvedValue({ id: 'task-1' });

      await expect(service.remove('admin-1', 'task-1')).resolves.toBeUndefined();
      expect(fakePrisma.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
      expect(fakeOffice.broadcast).toHaveBeenCalledWith(workspaceId, 'task:deleted', { id: 'task-1' });
    });
  });

  describe('member-removed event', () => {
    it('unassigns tasks when member is removed and broadcasts task:updated', async () => {
      const removedUserId = 'user-left';
      fakePrisma.task.findMany
        .mockResolvedValueOnce([{ id: 'task-1' }, { id: 'task-2' }]) // initial lookup
        .mockResolvedValueOnce([
          {
            id: 'task-1',
            number: 1,
            type: 'TASK',
            title: 'Task 1',
            description: '',
            status: 'TODO',
            priority: 'MEDIUM',
            assigneeId: null,
            reporterId: 'user-1',
            dueDate: null,
            rank: 1,
            createdAt: new Date('2026-10-06T00:00:00Z'),
            updatedAt: new Date('2026-10-06T00:00:00Z'),
          },
          {
            id: 'task-2',
            number: 2,
            type: 'BUG',
            title: 'Task 2',
            description: '',
            status: 'IN_PROGRESS',
            priority: 'HIGH',
            assigneeId: null,
            reporterId: 'user-1',
            dueDate: null,
            rank: 2,
            createdAt: new Date('2026-10-06T00:00:00Z'),
            updatedAt: new Date('2026-10-06T00:00:00Z'),
          },
        ]); // re-read

      events.emit({
        type: 'member-removed',
        workspaceId,
        userId: removedUserId,
      });

      // Allow microtasks to resolve
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(fakePrisma.task.updateMany).toHaveBeenCalledWith({
        where: { workspaceId, assigneeId: removedUserId },
        data: { assigneeId: null },
      });
      expect(fakeOffice.broadcast).toHaveBeenCalledTimes(2);
      expect(fakeOffice.broadcast).toHaveBeenCalledWith(
        workspaceId,
        'task:updated',
        expect.objectContaining({ id: 'task-1', key: 'DP-1', assigneeId: null }),
      );
      expect(fakeOffice.broadcast).toHaveBeenCalledWith(
        workspaceId,
        'task:updated',
        expect.objectContaining({ id: 'task-2', key: 'DP-2', assigneeId: null }),
      );
    });
  });
});
