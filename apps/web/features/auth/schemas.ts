import { z } from 'zod';

// Same rules as the API DTOs (apps/api/src/auth/dto/validation.ts).

export const emailField = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.').max(254));

export const newPasswordField = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use at most 128 characters.')
  .regex(/[A-Za-z]/, 'Add at least one letter.')
  .regex(/\d/, 'Add at least one number.');

export const displayNameField = z
  .string()
  .trim()
  .min(1, 'Enter your name.')
  .max(50, 'Use at most 50 characters.');

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password.').max(128),
});

export const registerSchema = z.object({
  displayName: displayNameField,
  email: emailField,
  password: newPasswordField,
});

export const newPasswordSchema = z
  .object({ password: newPasswordField, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'The passwords are not the same.' });

/** First error message per field, for showing under each input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return errors;
}
