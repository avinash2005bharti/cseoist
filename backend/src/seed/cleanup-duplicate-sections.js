import connectDB from '../config/db.js';
import env from '../config/env.js';
import Section from '../models/Section.js';
import Student from '../models/Student.js';
import MentorGroup from '../models/MentorGroup.js';

const getSectionIdentity = ({ name, code }) => {
  const source = String(code || name || '').toUpperCase().replace(/^SECTION\s*/i, '');
  const match = source.match(/([A-Z])(?:-S\d+)?$/);
  return match ? match[1] : source.replace(/[^A-Z0-9]/g, '');
};

export const cleanupDuplicateSections = async () => {
  if (!env.MONGODB_URI || env.MONGODB_URI.includes('<username>') || env.MONGODB_URI.includes('<password>')) {
    throw new Error('Please set a valid MONGODB_URI/MONGO_URI before cleaning duplicate sections.');
  }

  await connectDB();
  const sections = await Section.find({ semester: { $in: [5, 7] } }).sort({ createdAt: 1 });
  const groups = new Map();
  sections.forEach((section) => {
    const key = `${section.department.toString()}:${section.semester}:${getSectionIdentity(section)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(section);
  });

  const deleted = [];
  for (const candidates of groups.values()) {
    if (candidates.length < 2) continue;

    const counts = await Promise.all(candidates.map((section) => Student.countDocuments({ section: section._id })));
    const occupied = candidates.filter((_, index) => counts[index] > 0);
    if (occupied.length > 1) {
      throw new Error(
        `Cannot safely merge duplicate occupied sections: ${candidates.map((section) => section.code).join(', ')}`
      );
    }

    const keeper = occupied[0] || candidates[0];
    for (const [index, section] of candidates.entries()) {
      if (section._id.equals(keeper._id)) continue;
      await MentorGroup.deleteMany({ section: section._id });
      await Section.findByIdAndDelete(section._id);
      deleted.push({ code: section.code, semester: section.semester, students: counts[index] });
    }
  }

  return deleted;
};

if (process.argv[1] && process.argv[1].endsWith('cleanup-duplicate-sections.js')) {
  cleanupDuplicateSections()
    .then((deleted) => {
      console.log(`Deleted ${deleted.length} duplicate empty section(s).`);
      deleted.forEach(({ code, semester, students }) => {
        console.log(`${code} (Semester ${semester}, students: ${students})`);
      });
      process.exit(0);
    })
    .catch((error) => {
      console.error(`Duplicate section cleanup failed: ${error.message}`);
      process.exit(1);
    });
}
