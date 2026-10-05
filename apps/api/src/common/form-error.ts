import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * An expected "you typed something wrong" answer: wrong password, email
 * taken, wrong 2FA code, expired link...
 *
 * Sent as HTTP 200 with { error: { code, message, field } } on purpose:
 * Chrome prints every 4xx response as a red console error, and the subject
 * requires a clean console. The frontend api() helper turns it back into an
 * ApiError. Missing or expired tokens still get a real 401.
 */
export class FormError extends HttpException {
  constructor(code: string, message: string, field?: string) {
    super({ error: { code, message, ...(field && { field }) } }, HttpStatus.OK);
  }
}
