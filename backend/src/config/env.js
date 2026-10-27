import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../env') });
dotenv.config();

// Normalize alternative env variable names
if (!process.env.JWT_ACCESS_SECRET && process.env.JWT_SECRET) {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_SECRET;
}
if (!process.env.MONGODB_URI && process.env.MONGO_URI) {
  process.env.MONGODB_URI = process.env.MONGO_URI;
}
if (!process.env.EMAIL_FROM && process.env.BREVO_SENDER_EMAIL) {
  process.env.EMAIL_FROM = process.env.BREVO_SENDER_EMAIL;
}
if (!process.env.ALLOWED_ORIGINS && process.env.CORS_ORIGIN) {
  process.env.ALLOWED_ORIGINS = process.env.CORS_ORIGIN;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(5000),
  CLIENT_URL: z.string().default(process.env.CLIENT_URL || 'http://localhost:5173'),
  ALLOWED_ORIGINS: z.string().default(process.env.ALLOWED_ORIGINS || ''),
  MONGODB_URI: z.string().default(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/campusflow_lite'),
  JWT_ACCESS_SECRET: z.string().default(process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || ''),
  JWT_REFRESH_SECRET: z.string().default(process.env.JWT_REFRESH_SECRET || ''),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((value) => value === 'true')
    .default(false),
  
  IMAGEKIT_PUBLIC_KEY: z.string().optional().default(''),
  IMAGEKIT_PRIVATE_KEY: z.string().optional().default(''),
  IMAGEKIT_URL_ENDPOINT: z.string().optional().default(''),
  
  LEAVE_MAX_DAYS: z.coerce.number().default(30),
  LEAVE_BACKDATE_DAYS: z.coerce.number().default(7),
  ESCALATION_HOURS: z.coerce.number().default(48),
  TZ: z.string().default('Asia/Kolkata'),

  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: z.string().default(process.env.GOOGLE_CLIENT_ID || ''),
  GOOGLE_CLIENT_SECRET: z.string().default(process.env.GOOGLE_CLIENT_SECRET || ''),
  GOOGLE_CALLBACK_URL: z.string().optional().default(process.env.GOOGLE_CALLBACK_URL || ''),
  
  EMAIL_ENABLED: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .default(false),
  BREVO_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().optional().default('no-reply@campusflow.edu'),

  // PWA Web Push Configuration
  VAPID_PUBLIC_KEY: z.string().default(process.env.VAPID_PUBLIC_KEY || ''),
  VAPID_PRIVATE_KEY: z.string().default(process.env.VAPID_PRIVATE_KEY || ''),
  VAPID_SUBJECT: z.string().default(process.env.VAPID_SUBJECT || ''),

  // Consideration & Attendance Review Reminders
  // Midday: 1:00 PM IST (between 12:30 PM and 1:30 PM)
  REMINDER_MIDDAY_CRON: z.string().default(process.env.REMINDER_MIDDAY_CRON || '0 13 * * *'),
  // Afternoon: 4:00 PM IST (window close, between 4:00 PM and 4:30 PM)
  REMINDER_AFTERNOON_CRON: z.string().default(process.env.REMINDER_AFTERNOON_CRON || '0 16 * * *'),
  BYPASS_CONSIDERATION_WINDOW: z.string().optional().default('false'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration error');
}

if (parsed.data.NODE_ENV === 'production') {
  for (const [name, value] of Object.entries({
    JWT_ACCESS_SECRET: parsed.data.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: parsed.data.JWT_REFRESH_SECRET,
  })) {
    if (value.length < 32 || /change_in_production/i.test(value)) {
      throw new Error(`${name} must be a high-entropy secret of at least 32 characters in production`);
    }
  }
}

export const env = parsed.data;
export default env;
