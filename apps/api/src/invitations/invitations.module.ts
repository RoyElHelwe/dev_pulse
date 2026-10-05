import { Module } from '@nestjs/common';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({ controllers: [InvitationsController], providers: [InvitationsService] })
export class InvitationsModule {}
