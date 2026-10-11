/**
 * Mail delivery module.
 * Globally provides and exports MailService for sending transactional emails or logging in development.
 */
import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Global()
@Module({ providers: [MailService], exports: [MailService] })
/** Global module providing transactional email sending capabilities. */
export class MailModule {}

