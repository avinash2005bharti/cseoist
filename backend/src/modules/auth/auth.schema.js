import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Please enter your email or enrollment number').trim(),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters long')
    .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'New password must contain at least one number'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  otp: z.union([z.string(), z.number()]).transform((val) => String(val).trim()),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  otp: z.union([z.string(), z.number()]).transform((val) => String(val).trim()),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters long')
    .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'New password must contain at least one number'),
});

export const registerStudentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  rollNumber: z.string().trim().nullish(),
  enrollment_no: z.string().trim().nullish(),
  year: z.union([z.string(), z.number()]).nullish(),
  semester: z.union([z.string(), z.number()]).nullish(),
  section: z.string().trim().nullish(),
  batch: z.string().trim().nullish(),
  phone: z.union([z.string(), z.number()]).nullish().transform((v) => (v != null ? String(v).trim() : null)),
  enrollmentYear: z.union([z.string(), z.number()]).nullish(),
  otp: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((value) => /^\d{6}$/.test(value), 'A valid 6-digit verification code is required'),
});

export const registerTeacherSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  employeeId: z.string().trim().nullish(),
  designation: z.string().trim().nullish(),
  specialization: z.string().trim().nullish(),
  phone: z.union([z.string(), z.number()]).nullish().transform((v) => (v != null ? String(v).trim() : null)),
});

export const profileUpdateSchema = z
  .object({
    email: z.string().email('Please enter a valid email address').toLowerCase().trim().optional(),
    phone: z.union([z.string(), z.number()]).nullish().transform((v) => (v == null ? null : String(v).trim())),
    currentPassword: z.string().min(1).optional(),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters long')
      .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'New password must contain at least one number')
      .optional(),
  })
  .strict();

export default {
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  registerStudentSchema,
  registerTeacherSchema,
  profileUpdateSchema,
};
