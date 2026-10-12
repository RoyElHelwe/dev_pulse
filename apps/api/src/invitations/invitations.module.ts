/**
 * NestJS module providing workspace invitation controller and service providers.
 * Manages email invitations and token validation for workspace onboarding.
 */

import { Module } from '@nestjs/common';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

/** NestJS module managing invitation lifecycle and token acceptance endpoints. */
@Module({ controllers: [InvitationsController], providers: [InvitationsService] })
export class InvitationsModule {}

