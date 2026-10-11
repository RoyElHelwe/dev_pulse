/**
 * Mail delivery module.
 * Globally provides and exports MailService for sending transactional emails or logging in development.
 */
import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Globally provides transactional email delivery services across all application domains. */
@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}

