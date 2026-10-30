import connectDB from '../config/db.js';
import env from '../config/env.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Section from '../models/Section.js';
import Teacher from '../models/Teacher.js';
import MentorGroup from '../models/MentorGroup.js';

const TG_PASSWORD = 'Tgoist@123';
const DEFAULT_ACADEMIC_YEAR = '2026-27';
const SECTIONS = 'ABCDEFGH'.split('');

const getAcademicYear = () => process.env.TG_ACADEMIC_YEAR || DEFAULT_ACADEMIC_YEAR;

const getEmployeeId = (year, section) => `EMP_TG_CSE_${year}${section}`;

export const provisionTutorGuardianAccounts = async () => {
  if (!env.MONGODB_URI || env.MONGODB_URI.includes('<username>') || env.MONGODB_URI.includes('<password>')) {
    throw new Error('Please set a valid MONGODB_URI/MONGO_URI before provisioning TG accounts.');
  }

  await connectDB();

  const department = await Department.findOne({ code: 'CSE' });
  if (!department) {
    throw new Error('CSE department was not found. Run the normal seed first or create the department.');
  }

  const passwordHash = await User.hashPassword(TG_PASSWORD);
  const academicYear = getAcademicYear();
  const provisioned = [];

  for (let year = 1; year <= 4; year += 1) {
    for (const sectionLetter of SECTIONS) {
      const email = `tgcse${year}${sectionLetter.toLowerCase()}@oist.in`;
      const sectionCode = `CSE-${year}${sectionLetter}`;
      const semester = year * 2;

      const section = await Section.findOneAndUpdate(
        { department: department._id, semester, code: sectionCode },
        {
          $set: {
            year,
            name: `Year ${year} Section ${sectionLetter}`,
            capacity: 90,
          },
          $setOnInsert: { department: department._id, semester, code: sectionCode },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      const existingUser = await User.findOne({ email }).select('role');
      if (existingUser && existingUser.role !== 'TEACHER') {
        throw new Error(`Cannot provision ${email}: an existing ${existingUser.role} account uses this address.`);
      }

      const user = await User.findOneAndUpdate(
        { email },
        {
          $set: {
            name: `TG CSE Year ${year} Section ${sectionLetter}`,
            passwordHash,
            role: 'TEACHER',
            mustChangePassword: false,
            isActive: true,
            isVerified: true,
          },
          $setOnInsert: { email },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      const teacher = await Teacher.findOneAndUpdate(
        { user: user._id },
        {
          $set: {
            department: department._id,
            designation: 'Tutor Guardian',
            employeeId: getEmployeeId(year, sectionLetter),
          },
          $setOnInsert: { user: user._id },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      const group = await MentorGroup.findOneAndUpdate(
        { section: section._id, academicYear },
        {
          $set: {
            department: department._id,
            tg: teacher._id,
            semester,
            isActive: true,
          },
          $setOnInsert: { section: section._id, students: [] },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      await Teacher.findByIdAndUpdate(teacher._id, { $set: { isTG: true } });
      provisioned.push({ email, password: TG_PASSWORD, section: sectionCode, mentorGroupId: group._id });
    }
  }

  return { academicYear, accounts: provisioned };
};

if (process.argv[1] && process.argv[1].endsWith('provision-tg-accounts.js')) {
  provisionTutorGuardianAccounts()
    .then(({ academicYear, accounts }) => {
      console.log(`Provisioned ${accounts.length} TG accounts for academic session ${academicYear}.`);
      accounts.forEach(({ email, section }) => console.log(`${email} -> ${section}`));
      process.exit(0);
    })
    .catch((error) => {
      console.error(`TG account provisioning failed: ${error.message}`);
      process.exit(1);
    });
}
