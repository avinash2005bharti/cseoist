import mongoose from 'mongoose';
import Student from '../../models/Student.js';
import User from '../../models/User.js';
import Section from '../../models/Section.js';
import Department from '../../models/Department.js';
import MentorGroup from '../../models/MentorGroup.js';
import Teacher from '../../models/Teacher.js';
import ConsiderationRequest from '../../models/ConsiderationRequest.js';
import LeaveApplication from '../../models/LeaveApplication.js';
import Notification from '../../models/Notification.js';
import ApiError from '../../utils/ApiError.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeSearch = (value) => {
  const search = String(value || '').trim();
  if (search.length > 100) {
    throw ApiError.badRequest('Search text must be 100 characters or fewer');
  }
  return search;
};

export const listStudents = async (query, actorUser = null) => {
  const { page, limit, skip } = parsePagination(query);
  const andConditions = [];

  // If actor is a TG, strictly limit visibility to students of their assigned section(s)
  if (actorUser && (actorUser.role === 'TG' || actorUser.isTG) && actorUser.role !== 'HOD' && actorUser.role !== 'ADMIN') {
    const activeGroups = await MentorGroup.find({ tg: actorUser.teacherId, isActive: true });
    const assignedSectionIds = activeGroups.map((g) => g.section).filter(Boolean);
    andConditions.push({ section: { $in: assignedSectionIds } });
  }

  if (query.section) {
    andConditions.push({ section: query.section });
  }

  if (query.semester && String(query.semester).toUpperCase() !== 'ALL') {
    const semNum = parseInt(String(query.semester).replace(/\D/g, ''), 10);
    if (!isNaN(semNum)) {
      const matchingSections = await Section.find({ semester: semNum }).select('_id');
      const secIds = matchingSections.map((s) => s._id);
      andConditions.push({
        $or: [
          { semester: semNum },
          ...(secIds.length > 0 ? [{ section: { $in: secIds } }] : []),
        ],
      });
    }
  }

  if (query.department) {
    andConditions.push({ department: query.department });
  }

  if (query.mentor) {
    andConditions.push({ mentorGroup: query.mentor });
  }

  // If search query is provided, search rollNumber, enrollmentNumber or matching user IDs
  if (query.search) {
    const searchRegex = new RegExp(escapeRegex(normalizeSearch(query.search)), 'i');
    const matchingUsers = await User.find({
      role: 'STUDENT',
      $or: [{ name: searchRegex }, { email: searchRegex }],
    }).select('_id');

    andConditions.push({
      $or: [
        { rollNumber: searchRegex },
        { enrollmentNumber: searchRegex },
        { user: { $in: matchingUsers.map((u) => u._id) } },
      ],
    });
  }

  const filter = andConditions.length > 0 ? { $and: andConditions } : {};
  const fetchAll = query.all === 'true' || query.limit === 'all';
  const queryLimit = fetchAll ? Math.min(limit || 1000, 1000) : limit;
  const querySkip = fetchAll ? 0 : skip;

  const [students, total] = await Promise.all([
    Student.find(filter)
      .populate('user', 'name email phone isActive profileImage')
      .populate('department', 'name code')
      .populate('section', 'name code year semester')
      .populate({
        path: 'mentorGroup',
        select: 'academicYear isActive tg',
        populate: {
          path: 'tg',
          populate: { path: 'user', select: 'name email phone' },
        },
      })
      .skip(querySkip)
      .limit(queryLimit)
      .sort({ rollNumber: 1 }),
    Student.countDocuments(filter),
  ]);

  return {
    students,
    meta: buildPaginationMeta(total, page, fetchAll ? total : limit),
  };
};

export const getStudentById = async (id) => {
  return Student.findById(id)
    .populate('user', 'name email phone isActive profileImage')
    .populate('department', 'name code')
    .populate('section', 'name code year semester')
    .populate({
      path: 'mentorGroup',
      populate: {
        path: 'tg',
        populate: { path: 'user', select: 'name email phone' },
      },
    });
};

export const updateStudent = async (id, data, actorUser = null) => {
  const student = await Student.findById(id);
  if (!student) {
    throw ApiError.notFound('Student not found');
  }

  // FLAW-AUTH-04: Strict cohort scoping and field restrictions for Tutor Guardians
  if (actorUser && (actorUser.role === 'TG' || actorUser.isTG) && actorUser.role !== 'HOD' && actorUser.role !== 'ADMIN') {
    const activeGroups = await MentorGroup.find({ tg: actorUser.teacherId, isActive: true });
    const assignedSectionIds = activeGroups.map((g) => g.section?.toString()).filter(Boolean);

    const isMentee = student.section && assignedSectionIds.includes(student.section.toString());

    if (!isMentee) {
      throw ApiError.forbidden('You are only authorized to update students assigned to your section');
    }

    // TGs are NOT authorized to alter institutional attributes or account status
    if (
      data.status !== undefined ||
      data.rollNumber ||
      data.enrollmentYear ||
      data.batch ||
      data.section ||
      data.semester ||
      data.department
    ) {
      throw ApiError.forbidden('Tutor Guardians cannot alter student status, roll number, semester, section, or enrollment parameters');
    }
  }

  if (data.name || data.phone || data.status !== undefined || data.email) {
    const user = await User.findById(student.user);
    if (user) {
      if (data.name) user.name = data.name.trim();
      if (data.phone !== undefined) user.phone = data.phone ? data.phone.trim() : null;
      if (data.email) user.email = data.email.trim().toLowerCase();
      if (data.status !== undefined) {
        user.isActive = data.status === 'ACTIVE' || data.status === true;
      }
      await user.save();
    }
  }

  if (data.rollNumber) {
    student.rollNumber = data.rollNumber.trim().toUpperCase();
  }

  // Update Semester if provided
  if (data.semester !== undefined && data.semester !== null) {
    const semNum = parseInt(String(data.semester).replace(/\D/g, ''), 10);
    if (!isNaN(semNum) && semNum >= 1 && semNum <= 8) {
      student.semester = semNum;
    }
  }

  // Update Academic Batch and Enrollment Year if provided
  if (data.batch !== undefined || data.enrollmentYear !== undefined) {
    if (data.batch) {
      student.batch = String(data.batch).trim();
    }
    if (data.enrollmentYear) {
      student.enrollmentYear = Number(data.enrollmentYear);
    } else if (data.batch && typeof data.batch === 'string' && data.batch.includes('-')) {
      const parsedYear = parseInt(data.batch.split('-')[0], 10);
      if (!isNaN(parsedYear)) {
        student.enrollmentYear = parsedYear;
      }
    }
  }

  // Update Section if provided
  if (data.section) {
    let resolvedSection = null;
    const isObjectId = mongoose.Types.ObjectId.isValid(data.section) && /^[0-9a-fA-F]{24}$/.test(String(data.section));
    if (isObjectId) {
      resolvedSection = await Section.findById(data.section);
    }

    if (!resolvedSection) {
      const rawSec = String(data.section).trim();
      let letter = '';
      const cseMatch = rawSec.match(/CSE[\s\-_]*(?:SEM\s*\d+[\s\-_]*|\d+[\s\-_]*)?([A-Z0-9]+)/i);
      const secMatch = rawSec.match(/SEC(?:TION)?[\s\-_]*([A-Z0-9]+)/i);
      const singleMatch = rawSec.match(/^([A-Z0-9])$/i);

      if (singleMatch) {
        letter = singleMatch[1].toUpperCase();
      } else if (secMatch) {
        letter = secMatch[1].toUpperCase();
      } else if (cseMatch) {
        letter = cseMatch[1].toUpperCase();
      } else {
        const match = rawSec.match(/([A-Z0-9]+)/i);
        if (match) letter = match[1].toUpperCase();
      }

      if (!letter) letter = 'B';

      const targetSem = student.semester || 5;

      resolvedSection = await Section.findOne({
        semester: targetSem,
        $or: [
          { code: `CSE-${letter}-S${targetSem}` },
          { code: `CSE-${letter}` },
          { name: `Section ${letter}` },
          { name: new RegExp(`^Section\\s*${letter}$`, 'i') },
          { code: new RegExp(`^CSE-${letter}(?:-S\\d+)?$`, 'i') },
          { code: new RegExp(`-${letter}(?:-|$)`, 'i') },
          { code: rawSec },
          { name: rawSec },
        ],
      });

      if (!resolvedSection) {
        resolvedSection = await Section.findOne({
          $or: [
            { code: `CSE-${letter}-S${targetSem}` },
            { code: `CSE-${letter}` },
            { name: `Section ${letter}` },
            { name: new RegExp(`^Section\\s*${letter}$`, 'i') },
            { code: new RegExp(`^CSE-${letter}(?:-S\\d+)?$`, 'i') },
            { code: rawSec },
            { name: rawSec },
          ],
        });
      }

      // If section does not exist in DB yet for this semester, create it automatically
      if (!resolvedSection) {
        const deptId = student.department || (await Department.findOne({ code: 'CSE' }))?._id;
        if (deptId) {
          let codeToUse = `CSE-${letter}`;
          const existingCode = await Section.findOne({ code: codeToUse });
          if (existingCode && existingCode.semester !== targetSem) {
            codeToUse = `CSE-${letter}-S${targetSem}`;
          }
          resolvedSection = await Section.create({
            department: deptId,
            year: Math.ceil(targetSem / 2),
            semester: targetSem,
            name: `Section ${letter}`,
            code: codeToUse,
            capacity: 90,
          });
        }
      }
    }

    if (resolvedSection) {
      const oldSectionId = student.section ? student.section.toString() : null;
      const newSectionId = resolvedSection._id.toString();

      student.section = resolvedSection._id;

      if (oldSectionId !== newSectionId) {
        // Automatically unbind student from previous mentor group
        if (student.mentorGroup) {
          await MentorGroup.findByIdAndUpdate(student.mentorGroup, { $pull: { students: student._id } });
          student.mentorGroup = null;
        }

        // Automatically reassign student to the appointed Tutor Guardian / MentorGroup of the new section
        const activeMentorGroup = await MentorGroup.findOne({
          section: resolvedSection._id,
          isActive: true,
        });

        if (activeMentorGroup) {
          student.mentorGroup = activeMentorGroup._id;
          await MentorGroup.findByIdAndUpdate(activeMentorGroup._id, { $addToSet: { students: student._id } });
        }
      }
    }
  }

  if (data.mentorGroup !== undefined) {
    if (data.mentorGroup) {
      const mg = await MentorGroup.findById(data.mentorGroup);
      if (mg && (!mg.section || !student.section || mg.section.toString() === student.section.toString())) {
        student.mentorGroup = data.mentorGroup;
      }
    } else {
      if (student.mentorGroup) {
        await MentorGroup.findByIdAndUpdate(student.mentorGroup, { $pull: { students: student._id } });
      }
      student.mentorGroup = null;
    }
  }

  await student.save();
  return getStudentById(student._id);
};

export const deleteStudent = async (id) => {
  const student = await Student.findById(id);
  if (!student) {
    throw new Error('Student not found');
  }
  const userId = student.user;

  // SEC-06 Cascade cleanup
  await ConsiderationRequest.deleteMany({ student: id });
  await LeaveApplication.deleteMany({ student: id });
  await MentorGroup.updateMany(
    { students: id },
    { $pull: { students: id } }
  );
  if (userId) {
    await Notification.deleteMany({ user: userId });
  }

  await Student.findByIdAndDelete(id);
  if (userId) {
    await User.findByIdAndDelete(userId);
  }
  return { message: 'Student deleted successfully' };
};

export const searchPeers = async (query = {}, user = null) => {
  const search = normalizeSearch(query.search || query.q);
  const limit = Math.min(parseInt(query.limit, 10) || 1000, 1000);
  const filter = {};

  if (query.semester && String(query.semester).toUpperCase() !== 'ALL') {
    const semNum = parseInt(String(query.semester).replace(/\D/g, ''), 10);
    if (!isNaN(semNum)) {
      filter.semester = semNum;
    }
  }

  if (query.section && String(query.section).toUpperCase() !== 'ALL') {
    filter.section = query.section;
  }

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), 'i');
    const matchingUsers = await User.find({
      role: 'STUDENT',
      isActive: true,
      name: searchRegex,
    }).select('_id name');

    filter.$or = [
      { rollNumber: searchRegex },
      { enrollmentNumber: searchRegex },
      { user: { $in: matchingUsers.map((u) => u._id) } },
    ];
  }

  const students = await Student.find(filter)
    .populate('user', 'name email phone profileImage')
    .populate('section', 'name code year semester')
    .populate('department', 'name code')
    .select('_id rollNumber enrollmentNumber user section semester department')
    .sort({ rollNumber: 1 })
    .limit(limit);

  return students.map((s) => ({
    _id: s._id,
    id: s._id,
    name: s.user?.name || 'Student',
    user: s.user,
    rollNumber: s.rollNumber,
    enrollmentNumber: s.enrollmentNumber,
    section: s.section,
    semester: s.semester || s.section?.semester,
    department: s.department,
  }));
};

export default {
  listStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  searchPeers,
};
