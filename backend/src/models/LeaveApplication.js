import mongoose from 'mongoose';
import { attachmentSchema, historyEntrySchema } from './ConsiderationRequest.js';

const leaveApplicationSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    applicantRole: {
      type: String,
      enum: ['STUDENT', 'TEACHER', 'HOD'],
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
      index: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
      index: true,
    },
    tg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
      index: true,
    },
    leaveType: {
      type: String,
      enum: ['CASUAL', 'MEDICAL', 'EMERGENCY', 'DUTY', 'OTHER'],
      required: true,
    },
    startDate: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    endDate: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    totalDays: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: [
        'PENDING',
        'RECOMMENDED_BY_TG',
        'APPROVED_BY_HOD',
        'APPROVED',
        'REJECTED',
        'CANCELLED',
      ],
      default: 'PENDING',
      index: true,
    },
    tgReview: {
      decision: {
        type: String,
        enum: ['RECOMMEND', 'REJECT'],
      },
      remarks: String,
      reviewedAt: Date,
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    finalReview: {
      remarks: String,
      reviewedAt: Date,
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    escalated: {
      type: Boolean,
      default: false,
    },
    escalatedAt: {
      type: Date,
    },
    history: {
      type: [historyEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

leaveApplicationSchema.index({ applicant: 1, startDate: 1 });
leaveApplicationSchema.index({ tg: 1, status: 1 });
leaveApplicationSchema.index({ status: 1, createdAt: 1 });

const LeaveApplication = mongoose.model('LeaveApplication', leaveApplicationSchema);
export default LeaveApplication;
