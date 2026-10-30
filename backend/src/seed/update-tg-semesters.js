import connectDB from '../config/db.js';
import env from '../config/env.js';
import User from '../models/User.js';
import Teacher from '../models/Teacher.js';
import Department from '../models/Department.js';
import Section from '../models/Section.js';
import MentorGroup from '../models/MentorGroup.js';

const ACADEMIC_YEAR = process.env.TG_ACADEMIC_YEAR || '2026-27';
const ACCOUNTS_TO_DELETE = [
  'kavita.teacher@campusflow.edu',
  'test_teacher@mail.in',
  'ananya.tg@campusflow.edu',
];

const remapSemester = (semester) => (semester % 2 === 0 ? semester - 1 : semester);

export const updateTutorGuardianSemesters = async () => {
  if (!env.MONGODB_URI || env.MONGODB_URI.includes('<username>') || env.MONGODB_URI.includes('<password>')) {
    throw new Error('Please set a valid MONGODB_URI/MONGO_URI before updating TG assignments.');
  }

  await connectDB();

  const deleted = [];
  for (const email of ACCOUNTS_TO_DELETE) {
    const user = await User.findOne({ email }).select('_id email role');
    if (!user) continue;

    const teacher = await Teacher.findOne({ user: user._id }).select('_id');
    if (teacher) {
      await MentorGroup.updateMany({ tg: teacher._id }, { $set: { isActive: false } });
      await Teacher.findByIdAndDelete(teacher._id);
    }
    await User.findByIdAndDelete(user._id);
    deleted.push(email);
  }

  const department = await Department.findOne({ code: 'CSE' }).select('_id');
  if (!department) {
    throw new Error('CSE department was not found.');
  }

  const sections = await Section.find({
    department: department._id,
    code: /^CSE-[1-4][A-H]$/,
    semester: { $in: [2, 4, 6, 8] },
  }).select('_id code semester');

  const remapped = [];
  for (const section of sections) {
    const semester = remapSemester(section.semester);
    await Section.findByIdAndUpdate(section._id, { $set: { semester } });
    await MentorGroup.updateMany(
      { section: section._id, academicYear: ACADEMIC_YEAR },
      { $set: { semester } }
    );
    remapped.push({ code: section.code, from: section.semester, to: semester });
  }

  return { academicYear: ACADEMIC_YEAR, deleted, remapped };
};

if (process.argv[1] && process.argv[1].endsWith('update-tg-semesters.js')) {
  updateTutorGuardianSemesters()
    .then(({ academicYear, deleted, remapped }) => {
      console.log(`Deleted ${deleted.length} faculty accounts.`);
      deleted.forEach((email) => console.log(`Deleted: ${email}`));
      console.log(`Remapped ${remapped.length} CSE sections for academic session ${academicYear}.`);
      remapped.forEach(({ code, from, to }) => console.log(`${code}: Semester ${from} -> Semester ${to}`));
      process.exit(0);
    })
    .catch((error) => {
      console.error(`TG semester update failed: ${error.message}`);
      process.exit(1);
    });
}
