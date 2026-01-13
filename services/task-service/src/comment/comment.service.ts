import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService, TaskAction } from '@ft-trans/database';
import { CreateCommentDto, UpdateCommentDto } from './dto';

const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  MEMBER: 2,
  VIEWER: 1,
};

@Injectable()
export class CommentService {
  constructor(private prisma: PrismaService) {}

  private hasPermission(userRole: string, requiredRole: string): boolean {
    return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
  }

  async createComment(
    taskId: string,
    userId: string,
    workspaceId: string,
    dto: CreateCommentDto,
  ) {
    // Verify task exists and belongs to workspace
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });

    if (!task) {
      throw new RpcException({ statusCode: 404, message: 'Task not found' });
    }

    // Verify user is a workspace member
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });

    if (!membership || !this.hasPermission(membership.role, 'MEMBER')) {
      throw new RpcException({
        statusCode: 403,
        message: 'You do not have permission to comment',
      });
    }

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        userId,
        content: dto.content,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Record activity
    await this.prisma.taskActivity.create({
      data: {
        taskId,
        userId,
        action: TaskAction.COMMENT_ADDED,
        metadata: { commentId: comment.id },
      },
    });

    return comment;
  }

  async findAllComments(taskId: string) {
    const comments = await this.prisma.taskComment.findMany({
      where: { taskId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments;
  }

  async updateComment(commentId: string, userId: string, dto: UpdateCommentDto) {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new RpcException({ statusCode: 404, message: 'Comment not found' });
    }

    // Only the comment author can edit
    if (comment.userId !== userId) {
      throw new RpcException({
        statusCode: 403,
        message: 'You can only edit your own comments',
      });
    }

    const updatedComment = await this.prisma.taskComment.update({
      where: { id: commentId },
      data: { content: dto.content },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return updatedComment;
  }

  async deleteComment(commentId: string, userId: string, userRole: string) {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new RpcException({ statusCode: 404, message: 'Comment not found' });
    }

    // Comment author or admin+ can delete
    const isAuthor = comment.userId === userId;
    const isAdmin = this.hasPermission(userRole, 'ADMIN');

    if (!isAuthor && !isAdmin) {
      throw new RpcException({
        statusCode: 403,
        message: 'You do not have permission to delete this comment',
      });
    }

    await this.prisma.taskComment.delete({ where: { id: commentId } });

    return { success: true, deletedId: commentId };
  }
}
