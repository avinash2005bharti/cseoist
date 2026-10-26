import mongoose from 'mongoose';

export const attachmentSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true },
    filePath: { type: String, required: true },
    url: { type: String, default: '' },
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export const historyEntrySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: 'SYSTEM' },
    remarks: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    via: { type: String, enum: ['MANUAL', 'ESCALATION'], default: 'MANUAL' },
  },
  { _id: false }
);

export const studentAuditSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    status: {
      type: String,
      enum: ['VERIFIED', 'EXCLUDED'],
      default: 'VERIFIED',
    },
    auditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    auditedByRole: {
      type: String,
      enum: ['TG', 'TEACHER', 'HOD', 'ADMIN'],
    },
    auditedAt: {
      type: Date,
      default: Date.now,
    },
    remarks: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const considerationRequestSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    tg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      index: true,
    },
    eventTitle: {
      type: String,
      required: true,
      trim: true,
    },
    eventType: {
      type: String,
      enum: ['HACKATHON', 'SPORTS', 'CULTURAL', 'COLLEGE_DUTY', 'OTHER'],
      required: true,
    },
    organizer: {
      type: String,
      trim: true,
    },
    venue: {
      type: String,
      trim: true,
    },
    startDate: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    endDate: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    requestedPeriods: {
      type: Number,
      required: true,
      min: 1,
    },
    selectedPeriods: {
      type: [String],
      default: [],
    },
    periodTiming: {
      type: String,
      default: '',
    },
    timeFrom: {
      type: String,
      default: '10:50 AM',
      trim: true,
    },
    timeTo: {
      type: String,
      default: '01:20 PM',
      trim: true,
    },
    isGroup: {
      type: Boolean,
      default: false,
      index: true,
    },
    isGroupMaster: {
      type: Boolean,
      default: false,
      index: true,
    },
    groupId: {
      type: String,
      default: null,
      index: true,
    },
    groupLeader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    groupMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
      },
    ],
    sectionStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
      },
    ],
    studentAudits: {
      type: [studentAuditSchema],
      default: [],
    },
    description: {
      type: String,
      trim: true,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['PENDING', 'RECOMMENDED_BY_TG', 'APPROVED_BY_HOD', 'REJECTED', 'CANCELLED'],
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
    hodReview: {
      remarks: String,
      reviewedAt: Date,
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      approvedPeriods: Number,
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

considerationRequestSchema.index({ student: 1, createdAt: -1 });
considerationRequestSchema.index({ tg: 1, status: 1 });
considerationRequestSchema.index({ status: 1, createdAt: 1 });

const ConsiderationRequest = mongoose.model('ConsiderationRequest', considerationRequestSchema);
export default ConsiderationRequest;
