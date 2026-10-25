const { z } = require('zod');

const registerSchema = z
  .object({
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .toLowerCase()
      .email('Invalid email address'),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password cannot exceed 128 characters'),
    handle: z
      .string({ required_error: 'Handle is required' })
      .trim()
      .toLowerCase()
      .min(3, 'Handle must be at least 3 characters')
      .max(30, 'Handle cannot exceed 30 characters')
      .regex(/^[a-z0-9_]+$/, 'Handle can only contain lowercase letters, numbers, and underscores'),
    displayName: z
      .string({ required_error: 'Display name is required' })
      .trim()
      .min(1, 'Display name cannot be empty')
      .max(50, 'Display name cannot exceed 50 characters'),
    bio: z.string().trim().max(500, 'Bio cannot exceed 500 characters').optional(),
  })
  .strict();

const loginSchema = z
  .object({
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .toLowerCase()
      .email('Invalid email address'),
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, 'Password is required'),
  })
  .strict();

module.exports = {
  registerSchema,
  loginSchema,
};
