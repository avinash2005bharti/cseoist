import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true,
    },
    rollNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    enrollmentNumber: {
      type: String,
      trim: true,
      index: true,
      default: '',
    },
    enrollmentYear: {
      type: Number,
      required: true,
    },
    batch: {
      type: String,
      trim: true,
      default: '',
    },
    semester: {
      type: Number,
      min: 1,
      max: 8,
      default: 5,
    },
    guardianName: {
      type: String,
      trim: true,
    },
    guardianPhone: {
      type: String,
      trim: true,
    },
    mentorGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MentorGroup',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Student = mongoose.model('Student', studentSchema);
export default Student;
