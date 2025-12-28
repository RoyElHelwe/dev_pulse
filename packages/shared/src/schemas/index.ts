import { z } from 'zod'

// ============================================
// Auth Schemas
// ============================================

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

export const verifyOtpSchema = z.object({
  userId: z.string(),
  code: z.string().length(6, 'OTP must be 6 digits'),
})

export const setup2faSchema = z.object({
  userId: z.string(),
  code: z.string().length(6, 'Code must be 6 digits'),
})

export const verify2faSchema = z.object({
  userId: z.string(),
  code: z.string().length(6, 'Code must be 6 digits'),
})

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const newPasswordSchema = z.object({
  token: z.string(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

// ============================================
// Workspace Schemas
// ============================================

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters'),
  description: z.string().optional(),
})

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  settings: z.record(z.any()).optional(),
})

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'manager', 'member', 'viewer']),
})

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'manager', 'member', 'viewer']),
})

// ============================================
// Task Schemas
// ============================================

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  tags: z.array(z.string()).default([]),
  deadline: z.string().datetime().optional(),
  sprintId: z.string().optional(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  tags: z.array(z.string()).optional(),
  deadline: z.string().datetime().nullable().optional(),
  sprintId: z.string().nullable().optional(),
})

export const createCommentSchema = z.object({
  text: z.string().min(1, 'Comment cannot be empty'),
})

// ============================================
// Sprint Schemas
// ============================================

export const createSprintSchema = z.object({
  name: z.string().min(1, 'Sprint name is required'),
  goal: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
})

export const updateSprintSchema = z.object({
  name: z.string().min(1).optional(),
  goal: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['planned', 'active', 'completed']).optional(),
})

// ============================================
// Chat Schemas
// ============================================

export const sendMessageSchema = z.object({
  recipientId: z.string().optional(), // undefined for team chat
  text: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
})

// ============================================
// Game/Office Schemas
// ============================================

export const updatePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  direction: z.enum(['up', 'down', 'left', 'right']).optional(),
})

export const updateStatusSchema = z.object({
  status: z.enum(['active', 'away', 'busy']),
  currentTask: z.string().optional(),
})

// ============================================
// Type Inference
// ============================================

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type CreateSprintInput = z.infer<typeof createSprintSchema>
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>
export type SendMessageInput = z.infer<typeof sendMessageSchema>
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>
