import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string()
    .trim()
    .email('Invalid email address format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters'),
  role: z.enum(['admin', 'staff', 'client']).optional(),
  companyName: z.string().trim().max(150).optional(),
  phone: z.string().trim().max(30).optional(),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email address format'),
  password: z
    .string()
    .min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  companyName: z.string().trim().max(150).optional(),
  phone: z.string().trim().max(30).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'New password cannot exceed 128 characters'),
});

export const queryUsersSchema = z.object({
  role: z.enum(['admin', 'staff', 'client']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

