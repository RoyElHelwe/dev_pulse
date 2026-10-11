/**
 * Shared validation decorator factories for authentication forms.
 * Enforces length and format rules aligned with frontend form schemas.
 */
import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

// 254 characters matches the maximum permitted email address length per RFC 5321.
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MIN_DISPLAY_NAME_LENGTH = 1;
const MAX_DISPLAY_NAME_LENGTH = 50;

/** Validates, trims, and normalizes email address fields. */
export const IsEmailField = () =>
  applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    IsEmail({}, { message: 'Enter a valid email address.' }),
    MaxLength(MAX_EMAIL_LENGTH),
  );

/** Enforces strong password rules: 8-128 characters containing at least one letter and one number. */
export const IsNewPassword = () =>
  applyDecorators(
    IsString(),
    Length(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, { message: 'Password must be 8 to 128 characters.' }),
    Matches(/[A-Za-z]/, { message: 'Password must contain a letter.' }),
    Matches(/\d/, { message: 'Password must contain a number.' }),
  );

/** Validates and collapses extra whitespace in user display names (1-50 characters). */
export const IsDisplayName = () =>
  applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value)),
    IsString(),
    Length(MIN_DISPLAY_NAME_LENGTH, MAX_DISPLAY_NAME_LENGTH, { message: 'Name must be 1 to 50 characters.' }),
  );

