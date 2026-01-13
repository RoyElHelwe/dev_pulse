import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CommentService } from './comment.service';
import { CreateCommentDto, UpdateCommentDto } from './dto';

@Controller()
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @MessagePattern('comment.create')
  async createComment(
    @Payload() data: { taskId: string; userId: string; workspaceId: string; dto: CreateCommentDto },
  ) {
    return this.commentService.createComment(data.taskId, data.userId, data.workspaceId, data.dto);
  }

  @MessagePattern('comment.findAll')
  async findAllComments(@Payload() data: { taskId: string }) {
    return this.commentService.findAllComments(data.taskId);
  }

  @MessagePattern('comment.update')
  async updateComment(
    @Payload() data: { commentId: string; userId: string; dto: UpdateCommentDto },
  ) {
    return this.commentService.updateComment(data.commentId, data.userId, data.dto);
  }

  @MessagePattern('comment.delete')
  async deleteComment(@Payload() data: { commentId: string; userId: string; userRole: string }) {
    return this.commentService.deleteComment(data.commentId, data.userId, data.userRole);
  }
}
