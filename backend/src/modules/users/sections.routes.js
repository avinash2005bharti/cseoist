import { Router } from 'express';
import Section from '../../models/Section.js';
import Department from '../../models/Department.js';
import Student from '../../models/Student.js';
import MentorGroup from '../../models/MentorGroup.js';
import AuditLog from '../../models/AuditLog.js';
import auth from '../../middleware/auth.js';
import authorize from '../../middleware/authorize.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import ApiError from '../../utils/ApiError.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.department) {
      filter.department = req.query.department;
    }
    const sections = await Section.find(filter).populate('department').sort({ semester: 1, name: 1, code: 1 });

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
      populate: { path: 'user', select: 'name email phone' },
    });
    const groupMap = new Map();
    activeGroups.forEach((g) => {
      if (g.section) groupMap.set(g.section.toString(), g);
    });

    const enriched = sections.map((sec) => {
      const g = groupMap.get(sec._id.toString());
      return {
        ...sec.toObject(),
        capacity: sec.capacity || 60,
        studentCount: countMap.get(sec._id.toString()) || 0,
        activeMentorGroup: g ? g.toObject() : null,
        tg: g?.tg || null,
        tgName: g?.tg?.user?.name || null,
      };
    });

    return sendSuccess(res, enriched);
  })
);

router.use(auth);

router.post(
  '/',
  authorize('HOD', 'ADMIN'),
  asyncHandler(async (req, res) => {
    let { department, year, semester, name, code, capacity } = req.body;
    if (!department) {
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
    const formattedCode = (code || `CSE-${cleanName}-S${semNum}`).toUpperCase().trim();

    const existing = await Section.findOne({ department, semester: semNum, code: formattedCode });
    if (existing) {
      throw ApiError.conflict(`Section with code '${formattedCode}' already exists in this department and semester`);
    }

    const capNum = parseInt(capacity, 10);
    const finalCapacity = !isNaN(capNum) && capNum >= 1 && capNum <= 500 ? capNum : 60;

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

    const prevCapacity = section.capacity || 60;
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

    section.semester = newSemester;
    section.year = newYear;
    await section.save();

    // Move all students enrolled in this section to the new semester
    const studentUpdateResult = await Student.updateMany(
      { section: section._id },
      { $set: { semester: newSemester } }
    );

    // Update active mentor group for this section to the new semester
    await MentorGroup.updateMany(
      { section: section._id, isActive: true },
      { $set: { semester: newSemester } }
    );

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
        affectedStudents: studentUpdateResult.modifiedCount,
        sectionCode: section.code,
        sectionName: section.name,
      },
    });

    return sendSuccess(res, {
      section,
      previousSemester: prevSemester,
      newSemester,
      newYear,
      affectedStudents: studentUpdateResult.modifiedCount,
      message: `Section ${section.code || section.name} and ${studentUpdateResult.modifiedCount} student(s) successfully moved from Semester ${prevSemester} to Semester ${newSemester} (Year ${newYear}).`,
    });
  })
);

export default router;

