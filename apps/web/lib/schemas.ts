import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const verify2faSchema = z.object({
  userId: z.string(),
  token: z.string().length(6, 'Token must be 6 digits').regex(/^\d+$/, 'Token must be numeric'),
})

export const enable2FASchema = z.object({
  token: z.string().length(6, 'Token must be 6 digits').regex(/^\d+$/, 'Token must be numeric'),
})

export const disable2FASchema = z.object({
  token: z.string().length(6, 'Token must be 6 digits').regex(/^\d+$/, 'Token must be numeric'),
})
