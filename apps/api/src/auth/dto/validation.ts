import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

// Shared rules, mirrored in the frontend (apps/web/features/auth/schemas.ts).

export const IsEmailField = () =>
  applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    IsEmail({}, { message: 'Enter a valid email address.' }),
    MaxLength(254),
  );

/** At least 8 characters with a letter and a number. */
export const IsNewPassword = () =>
  applyDecorators(
    IsString(),
    Length(8, 128, { message: 'Password must be 8 to 128 characters.' }),
    Matches(/[A-Za-z]/, { message: 'Password must contain a letter.' }),
    Matches(/\d/, { message: 'Password must contain a number.' }),
  );

export const IsDisplayName = () =>
  applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value)),
    IsString(),
    Length(1, 50, { message: 'Name must be 1 to 50 characters.' }),
  );
