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

export const createConsiderationSchema = z.object({
  eventTitle: z.string().min(3, 'Event title must be at least 3 characters long').trim(),
  eventType: z.enum(['HACKATHON', 'SPORTS', 'CULTURAL', 'COLLEGE_DUTY', 'OTHER']),
  organizer: z.string().optional(),
  venue: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  requestedPeriods: z.number().int().min(1, 'Requested periods must be at least 1'),
  selectedPeriods: z.array(z.string()).optional(),
  periodTiming: z.string().optional(),
  timeFrom: z.string().optional(),
  timeTo: z.string().optional(),
  isGroup: z.boolean().optional(),
  groupMembers: z.array(z.string()).optional(),
  description: z.string().optional(),
  attachments: z.array(attachmentSchema).optional().default([]),
});

export const tgReviewSchema = z
  .object({
    decision: z.enum(['RECOMMEND', 'REJECT']),
    remarks: z.string().optional().default(''),
  })
  .refine(
    (data) => {
      if (data.decision === 'REJECT') {
        return typeof data.remarks === 'string' && data.remarks.trim().length >= 5;
      }
      return true;
    },
    { message: 'Rejection remarks must be at least 5 characters long', path: ['remarks'] }
  );

export const hodReviewSchema = z.object({
  decision: z.preprocess((val) => {
    if (typeof val === 'string') {
      const u = val.toUpperCase().trim();
      if (u.includes('APPROV')) return 'APPROVE';
      if (u.includes('REJECT')) return 'REJECT';
    }
    return val;
  }, z.enum(['APPROVE', 'REJECT'])),
  remarks: z.string().optional().default(''),
  approvedPeriods: z.number().int().min(1).optional(),
}).refine(
  (data) => {
    if (data.decision === 'APPROVE') {
      return data.approvedPeriods !== undefined && data.approvedPeriods > 0;
    }
    return true;
  },
  { message: 'Approved periods must be specified when approving', path: ['approvedPeriods'] }
);

export const auditStudentSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  status: z.enum(['VERIFIED', 'EXCLUDED']),
  remarks: z.string().optional().default(''),
});

export const auditAllStudentsSchema = z.object({
  status: z.enum(['VERIFIED', 'EXCLUDED']).optional().default('VERIFIED'),
  remarks: z.string().optional().default(''),
});

export default {
  createConsiderationSchema,
  tgReviewSchema,
  hodReviewSchema,
  auditStudentSchema,
  auditAllStudentsSchema,
};
