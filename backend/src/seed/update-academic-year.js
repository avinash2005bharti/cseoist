import connectDB from '../config/db.js';
import env from '../config/env.js';
import MentorGroup from '../models/MentorGroup.js';

const ACADEMIC_YEAR = process.env.ACADEMIC_YEAR || '2026-27';

export const updateAcademicYear = async () => {
  if (!env.MONGODB_URI || env.MONGODB_URI.includes('<username>') || env.MONGODB_URI.includes('<password>')) {
    throw new Error('Please set a valid MONGODB_URI/MONGO_URI before updating academic years.');
  }

  await connectDB();
  const result = await MentorGroup.updateMany({}, { $set: { academicYear: ACADEMIC_YEAR } });
  return {
    academicYear: ACADEMIC_YEAR,
    matched: result.matchedCount ?? result.n,
    modified: result.modifiedCount ?? result.nModified,
  };
};

if (process.argv[1] && process.argv[1].endsWith('update-academic-year.js')) {
  updateAcademicYear()
    .then(({ academicYear, matched, modified }) => {
      console.log(`Updated ${modified} of ${matched} mentor group(s) to academic year ${academicYear}.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(`Academic year update failed: ${error.message}`);
      process.exit(1);
    });
}
