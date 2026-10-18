import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema(
  {
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    capacity: {
      type: Number,
      default: 60,
      min: 1,
      max: 500,
    },
  },
  {
    timestamps: true,
  }
);

const Section = mongoose.model('Section', sectionSchema);
export default Section;
