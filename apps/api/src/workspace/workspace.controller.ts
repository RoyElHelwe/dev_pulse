import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { IsIn, IsString, MaxLength } from 'class-validator';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { CharacterDto, CreateWorkspaceDto, RenameWorkspaceDto, UpdateLayoutDto } from './dto';
import { MembersService } from './members.service';
import { WorkspaceService } from './workspace.service';

class RoleDto {
  @IsIn(['ADMIN', 'MEMBER'])
  role: 'ADMIN' | 'MEMBER';
}

class DeleteWorkspaceDto {
  @IsString()
  @MaxLength(60)
  confirmName: string;
}

/** "My workspace": every user belongs to at most one. */
@Controller('workspace')
export class WorkspaceController {
  constructor(
    private readonly workspaces: WorkspaceService,
    private readonly members: MembersService,
  ) {}

  @Get()
  mine(@CurrentUser() user: AuthUser) {
    return this.workspaces.mine(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(user.id, dto);
  }

  @Patch()
  rename(@CurrentUser() user: AuthUser, @Body() dto: RenameWorkspaceDto) {
    return this.workspaces.rename(user.id, dto.name);
  }

  @Post('delete')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Body() dto: DeleteWorkspaceDto) {
    return this.workspaces.remove(user.id, dto.confirmName);
  }

  @Patch('me')
  setCharacter(@CurrentUser() user: AuthUser, @Body() dto: CharacterDto) {
    return this.workspaces.setCharacter(user.id, dto.character);
  }

  @Put('layout')
  updateLayout(@CurrentUser() user: AuthUser, @Body() dto: UpdateLayoutDto) {
    return this.workspaces.updateLayout(user.id, dto);
  }

  @Get('members')
  listMembers(@CurrentUser() user: AuthUser) {
    return this.members.list(user.id);
  }

  @Patch('members/:userId')
  @HttpCode(204)
  changeRole(@CurrentUser() user: AuthUser, @Param('userId') target: string, @Body() dto: RoleDto) {
    return this.members.changeRole(user.id, target, dto.role);
  }

  @Delete('members/:userId')
  @HttpCode(204)
  removeMember(@CurrentUser() user: AuthUser, @Param('userId') target: string) {
    return this.members.remove(user.id, target);
  }
}
