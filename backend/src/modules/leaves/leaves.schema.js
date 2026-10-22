import { z } from 'zod';

const attachmentSchema = z.object({
  fileId: z.string().min(1),
  filePath: z.string().min(1),
  url: z.string().optional().default(''),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().positive(),
  uploadedAt: z.coerce.date().optional(),
}).passthrough();

export const createLeaveSchema = z.object({
  leaveType: z.enum(['CASUAL', 'MEDICAL', 'EMERGENCY', 'DUTY', 'OTHER']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  reason: z.string().min(5, 'Reason must be at least 5 characters long').trim(),
  attachments: z.array(attachmentSchema).optional().default([]),
});

export const tgReviewLeaveSchema = z.object({
  decision: z.enum(['RECOMMEND', 'REJECT']),
  remarks: z.string().optional().default(''),
}).refine(
  (data) => {
    if (data.decision === 'REJECT') {
      return (data.remarks || '').trim().length >= 5;
    }
    return true;
  },
  { message: 'Remarks of at least 5 characters are required when rejecting', path: ['remarks'] }
);

export const finalReviewLeaveSchema = z.object({
  decision: z.preprocess((val) => {
    if (typeof val === 'string') {
      const u = val.toUpperCase().trim();
      if (u.includes('APPROV')) return 'APPROVE';
      if (u.includes('REJECT')) return 'REJECT';
    }
    return val;
  }, z.enum(['APPROVE', 'REJECT'])),
  remarks: z.string().optional().default(''),
}).refine(
  (data) => {
    if (data.decision === 'REJECT') {
      return (data.remarks || '').trim().length >= 5;
    }
    return true;
  },
  { message: 'Remarks of at least 5 characters are required when rejecting', path: ['remarks'] }
);

export default {
  createLeaveSchema,
  tgReviewLeaveSchema,
  finalReviewLeaveSchema,
};
