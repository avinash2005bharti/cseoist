import { Router } from 'express';
import Section from '../../models/Section.js';
import Department from '../../models/Department.js';
import Student from '../../models/Student.js';
import MentorGroup from '../../models/MentorGroup.js';
import Teacher from '../../models/Teacher.js';
import User from '../../models/User.js';
import AuditLog from '../../models/AuditLog.js';
import auth from '../../middleware/auth.js';
import authorize from '../../middleware/authorize.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import ApiError from '../../utils/ApiError.js';

const router = Router();

router.use(auth);

const getNextAcademicYear = (academicYear) => {
  const match = String(academicYear || '').match(/^(\d{4})-(\d{2}|\d{4})$/);
  if (!match) return academicYear;
  const startYear = Number(match[1]) + 1;
  const endYear = Number(match[2].length === 2 ? String(startYear + 1).slice(-2) : startYear + 1);
  return `${startYear}-${match[2].length === 2 ? String(endYear).padStart(2, '0') : endYear}`;
};

const getSectionLetter = (section) => {
  const codeMatch = section.code?.match(/(?:^|-)([A-H])$/i);
  if (codeMatch) return codeMatch[1].toUpperCase();
  const nameMatch = section.name?.match(/([A-H])$/i);
  return nameMatch ? nameMatch[1].toUpperCase() : null;
};

const getSectionIdentity = ({ name, code }) => {
  const source = String(code || name || '').toUpperCase().replace(/^SECTION\s*/i, '');
  const match = source.match(/([A-Z])(?:-S\d+)?$/);
  return match ? match[1] : source.replace(/[^A-Z0-9]/g, '');
};

const getDestinationSection = async (section, newYear) => {
  const letter = getSectionLetter(section);
  if (!letter) return null;

  return Section.findOne({
    department: section.department?._id || section.department,
    year: newYear,
    $or: [
      { code: new RegExp(`-${newYear}${letter}$`, 'i') },
      { code: new RegExp(`-${letter}-S\\d+$`, 'i') },
      { name: new RegExp(`^Year\\s*${newYear}\\s*Section\\s*${letter}$`, 'i') },
    ],
  }).sort({ semester: 1 });
};

router.get(
  '/',
  authorize('ADMIN', 'HOD', 'TG', 'TEACHER', 'STUDENT'),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.department) {
      if (req.user.role === 'HOD' && req.user.departmentId && req.query.department.toString() !== req.user.departmentId.toString()) {
        throw ApiError.forbidden('You can only view sections in your department');
      }
      filter.department = req.query.department;
    } else if (req.user.role === 'HOD' || (req.user.role !== 'ADMIN' && req.user.departmentId)) {
      filter.department = req.user.departmentId;
    }
    const sections = await Section.find(filter)
      .populate('department', 'name code')
      .sort({ semester: 1, name: 1, code: 1 });

    const sectionIds = sections.map((s) => s._id);

    // Count students per section in bulk
    const studentCounts = await Student.aggregate([
      { $match: { section: { $in: sectionIds } } },
      { $group: { _id: '$section', count: { $sum: 1 } } },
    ]);
    const countMap = new Map();
    studentCounts.forEach((c) => countMap.set(c._id.toString(), c.count));

    // Active mentor groups per section
    const activeGroups = await MentorGroup.find({
      section: { $in: sectionIds },
      isActive: true,
    }).populate({
      path: 'tg',
      select: '_id user',
      populate: { path: 'user', select: 'name' },
    });
    const groupMap = new Map();
    activeGroups.forEach((g) => {
      if (g.section) groupMap.set(g.section.toString(), g);
    });

    const enriched = sections.map((sec) => {
      const g = groupMap.get(sec._id.toString());
      return {
        ...sec.toObject(),
        capacity: sec.capacity || 90,
        studentCount: countMap.get(sec._id.toString()) || 0,
        activeMentorGroup: g ? g.toObject() : null,
        tg: g?.tg || null,
        tgName: g?.tg?.user?.name || null,
      };
    });

    return sendSuccess(res, enriched);
  })
);

router.post(
  '/',
  authorize('HOD', 'ADMIN'),
  asyncHandler(async (req, res) => {
    let { department, year, semester, name, code, capacity } = req.body;
    if (req.user.role === 'HOD') {
      if (department && req.user.departmentId && department.toString() !== req.user.departmentId.toString()) {
        throw ApiError.forbidden('Forbidden: Cannot create sections in another department');
      }
      department = req.user.departmentId;
    } else if (!department) {
      if (req.user.departmentId) {
        department = req.user.departmentId;
      } else {
        const defaultDept = (await Department.findOne({ code: 'CSE' })) || (await Department.findOne());
        department = defaultDept?._id;
      }
    }
    const semNum = parseInt(semester, 10);
    if (!semNum || semNum < 1 || semNum > 8) {
      throw ApiError.badRequest('Valid semester between 1 and 8 is required');
    }
    const yrNum = parseInt(year, 10) || Math.ceil(semNum / 2) || 1;
    if (!name) {
      throw ApiError.badRequest('Section name is required');
    }

    const deptDoc = await Department.findById(department);
    if (!deptDoc) {
      throw ApiError.notFound('Department not found');
    }

    const cleanName = name.replace(/^Section\s*/i, '').trim();
    const formattedName = `Section ${cleanName}`;
    const deptPrefix = (deptDoc.code || 'SEC').toUpperCase().trim();
    const formattedCode = (code || `${deptPrefix}-${cleanName}-S${semNum}`).toUpperCase().trim();

    const sameSemesterSections = await Section.find({ department, semester: semNum }).select('name code');
    const requestedIdentity = getSectionIdentity({ name: formattedName, code: formattedCode });
    const existing = sameSemesterSections.find(
      (candidate) => getSectionIdentity(candidate) === requestedIdentity
    );
    if (existing) {
      throw ApiError.conflict(
        `Section ${requestedIdentity} already exists in Semester ${semNum} for this department`
      );
    }

    const capNum = parseInt(capacity, 10);
    const finalCapacity = !isNaN(capNum) && capNum >= 1 && capNum <= 500 ? capNum : 90;

    const section = await Section.create({
      department,
      year: yrNum,
      semester: semNum,
      name: formattedName,
      code: formattedCode,
      capacity: finalCapacity,
    });

    await AuditLog.create({
      actor: req.user?._id || null,
      action: 'CREATE_SECTION',
      entityType: 'Section',
      entityId: section._id,
      after: {
        name: section.name,
        code: section.code,
        semester: section.semester,
        year: section.year,
        capacity: section.capacity,
      },
    });

    return sendCreated(res, section);
  })
);

router.patch(
  '/:id',
  authorize('HOD', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { capacity, name } = req.body;
    const section = await Section.findById(id).populate('department');
    if (!section) {
      throw ApiError.notFound('Section not found');
    }

    const secDeptId = section.department?._id || section.department;
    if (req.user.role === 'HOD' && req.user.departmentId && secDeptId && secDeptId.toString() !== req.user.departmentId.toString()) {
      throw ApiError.forbidden('Forbidden: Cannot modify sections in another department');
    }

    const prevCapacity = section.capacity || 90;
    if (capacity !== undefined) {
      const capNum = parseInt(capacity, 10);
      if (isNaN(capNum) || capNum < 1 || capNum > 500) {
        throw ApiError.badRequest('Section capacity must be a valid number between 1 and 500');
      }
      section.capacity = capNum;
    }

    if (name && typeof name === 'string') {
      const cleanName = name.replace(/^Section\s*/i, '').trim();
      if (cleanName) {
        section.name = `Section ${cleanName}`;
      }
    }

    await section.save();

    await AuditLog.create({
      actor: req.user?._id || null,
      action: 'UPDATE_SECTION_CAPACITY',
      entityType: 'Section',
      entityId: section._id,
      before: { capacity: prevCapacity },
      after: { capacity: section.capacity, name: section.name },
    });

    return sendSuccess(res, section, 'Section capacity updated successfully');
  })
);

router.delete(
  '/:id',
  authorize('HOD', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const section = await Section.findById(id);
    if (!section) {
      throw ApiError.notFound('Section not found');
    }

    const secDeptId = section.department?._id || section.department;
    if (req.user.role === 'HOD' && req.user.departmentId && secDeptId && secDeptId.toString() !== req.user.departmentId.toString()) {
      throw ApiError.forbidden('Forbidden: Cannot delete sections in another department');
    }

    const studentCount = await Student.countDocuments({ section: id });
    if (studentCount > 0) {
      throw ApiError.badRequest(
        `Cannot delete ${section.name || section.code}: ${studentCount} student(s) currently enrolled. Please reallocate students first.`
      );
    }

    await Section.findByIdAndDelete(id);
    await MentorGroup.deleteMany({ section: id });

    await AuditLog.create({
      actor: req.user?._id || null,
      action: 'DELETE_SECTION',
      entityType: 'Section',
      entityId: section._id,
      before: { name: section.name, code: section.code, semester: section.semester },
    });

    return sendSuccess(res, null, `Section ${section.name || section.code} deleted successfully`);
  })
);

router.post(
  '/:id/move-semester',
  authorize('HOD', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { direction, targetSemester } = req.body;
    const section = await Section.findById(id).populate('department');
    if (!section) {
      throw ApiError.notFound('Section not found');
    }

    const secDeptId = section.department?._id || section.department;
    if (req.user.role === 'HOD' && req.user.departmentId && secDeptId && secDeptId.toString() !== req.user.departmentId.toString()) {
      throw ApiError.forbidden('Forbidden: Cannot move sections in another department');
    }

    const currentSem = section.semester || 5;
    let newSemester = currentSem;

    if (targetSemester !== undefined && targetSemester !== null) {
      newSemester = parseInt(targetSemester, 10);
    } else if (direction === 'next' || direction === 'forward') {
      newSemester = currentSem + 1;
    } else if (direction === 'previous' || direction === 'prev' || direction === 'backward') {
      newSemester = currentSem - 1;
    } else {
      throw ApiError.badRequest('Please specify direction as "next" or "previous"');
    }

    if (newSemester < 1 || newSemester > 8) {
      throw ApiError.badRequest(
        `Semester out of bounds (1-8). Current: Semester ${currentSem}, Attempted: Semester ${newSemester}`
      );
    }

    const prevSemester = section.semester;
    const prevYear = section.year;
    const newYear = Math.ceil(newSemester / 2);
    const yearChanged = newYear !== prevYear;
    const students = await Student.find({ section: section._id }).select('_id user mentorGroup');
    let destinationSection = section;
    let destinationAcademicYear = null;
    let destinationMentorGroup = null;

    const isPromotion = direction === 'next' || direction === 'forward' || newSemester > currentSem;
    if (yearChanged && isPromotion) {
      destinationSection = await getDestinationSection(section, newYear);
      if (!destinationSection) {
        throw ApiError.notFound(
          `Destination section for Year ${newYear}, Section ${getSectionLetter(section) || 'matching section'} was not found`
        );
      }

      const currentAcademicYear = await MentorGroup.findOne({
        section: section._id,
        isActive: true,
      }).select('academicYear');
      destinationAcademicYear = getNextAcademicYear(currentAcademicYear?.academicYear || '2026-27');

      const destinationOddSemester = newYear * 2 - 1;
      const letter = getSectionLetter(section);
      const destinationUser = await User.findOne({
        email: `tgcse${newYear}${letter.toLowerCase()}@oist.in`,
        role: 'TEACHER',
        isActive: true,
      }).select('_id');
      const destinationTeacher = destinationUser
        ? await Teacher.findOne({ user: destinationUser._id }).select('_id')
        : null;

      if (!destinationTeacher) {
        throw ApiError.notFound(
          `Tutor Guardian account for Year ${newYear}, Section ${letter || 'matching section'} was not found`
        );
      }

      destinationMentorGroup = await MentorGroup.findOneAndUpdate(
        { section: destinationSection._id, academicYear: destinationAcademicYear },
        {
          $set: {
            department: secDeptId,
            tg: destinationTeacher._id,
            semester: destinationOddSemester,
            isActive: true,
          },
          $setOnInsert: { section: destinationSection._id, students: [] },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      const studentIds = students.map((student) => student._id);
      if (studentIds.length > 0) {
        await MentorGroup.updateMany(
          { students: { $in: studentIds } },
          { $pull: { students: { $in: studentIds } } }
        );
        await Student.updateMany(
          { _id: { $in: studentIds } },
          {
            $set: {
              section: destinationSection._id,
              semester: newSemester,
              mentorGroup: destinationMentorGroup._id,
            },
          }
        );
        await MentorGroup.findByIdAndUpdate(destinationMentorGroup._id, {
          $addToSet: { students: { $each: studentIds } },
        });
      }

      await MentorGroup.updateMany(
        { section: section._id, isActive: true },
        { $set: { isActive: false } }
      );
    } else {
      let updatedCode = section.code;
      if (section.code && /-S\d+$/i.test(section.code)) {
        updatedCode = section.code.replace(/-S\d+$/i, `-S${newSemester}`);
        const collision = await Section.findOne({
          _id: { $ne: section._id },
          department: secDeptId,
          semester: newSemester,
          code: updatedCode,
        });
        if (collision) {
          throw ApiError.conflict(
            `Cannot move section: Target section code '${updatedCode}' already exists in Semester ${newSemester}`
          );
        }
        section.code = updatedCode;
      }

      section.semester = newSemester;
      section.year = newYear;
      await section.save();

      await Student.updateMany(
        { section: section._id },
        { $set: { semester: newSemester } }
      );

      await MentorGroup.updateMany(
        { section: section._id, isActive: true },
        { $set: { semester: newSemester } }
      );
    }

    const affectedStudents = students.length;

    // Record Immutable Audit Log
    await AuditLog.create({
      actor: req.user?._id || null,
      action: direction === 'next' ? 'PROMOTE_SECTION_SEMESTER' : 'DEMOTE_SECTION_SEMESTER',
      entityType: 'Section',
      entityId: section._id,
      before: { semester: prevSemester, year: prevYear },
      after: {
        semester: newSemester,
        year: newYear,
        academicYear: destinationAcademicYear,
        destinationSection: destinationSection.code,
        destinationMentorGroup: destinationMentorGroup?._id || null,
        affectedStudents,
        sectionCode: destinationSection.code,
        sectionName: destinationSection.name,
      },
    });

    return sendSuccess(res, {
      section: destinationSection,
      previousSemester: prevSemester,
      newSemester,
      newYear,
      academicYear: destinationAcademicYear,
      destinationMentorGroup: destinationMentorGroup?._id || null,
      affectedStudents,
      message: `${affectedStudents} student(s) moved from Semester ${prevSemester} to Semester ${newSemester} (Year ${newYear})${yearChanged ? ` and assigned to ${destinationSection.code || destinationSection.name} TG for ${destinationAcademicYear}` : ''}.`,
    });
  })
);

export default router;
