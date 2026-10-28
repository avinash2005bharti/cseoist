import mongoose from 'mongoose';

const teacherPasscodeAttemptSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    failures: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

const TeacherPasscodeAttempt = mongoose.model(
  'TeacherPasscodeAttempt',
  teacherPasscodeAttemptSchema
);

export default TeacherPasscodeAttempt;
