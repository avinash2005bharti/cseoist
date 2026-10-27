import MentorGroup from '../../models/MentorGroup.js';
import Student from '../../models/Student.js';
import Teacher from '../../models/Teacher.js';
import Section from '../../models/Section.js';
import Department from '../../models/Department.js';
import User from '../../models/User.js';
import AuditLog from '../../models/AuditLog.js';
import ApiError from '../../utils/ApiError.js';

export const listMentorGroups = async (query = {}) => {
  const filter = {};
  if (query.department) filter.department = query.department;
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true' || query.isActive === true;

  return MentorGroup.find(filter)
    .populate('department', 'name code')
    .populate('section', 'name code year semester')
    .populate({
      path: 'tg',
      populate: { path: 'user', select: 'name email phone' },
    })
    .populate({
      path: 'students',
      populate: [
        { path: 'user', select: 'name email phone' },
        { path: 'section', select: 'name code year semester' },
      ],
    })
    .sort({ createdAt: -1 });
};

export const createMentorGroup = async (
  { department, tgId, academicYear, semester, section, sectionCode, sectionId, studentIds = [], reassign = false },
  actorUser = null
) => {
  const teacher = await Teacher.findById(tgId).populate('user', 'name email');
  if (!teacher) {
    throw ApiError.notFound('Faculty member not found.');
  }

  // Parse semester number if provided as string e.g. "Semester 5" or 5
  let parsedSemester = null;
  if (semester) {
    parsedSemester = typeof semester === 'string' ? parseInt(semester.replace(/\D/g, ''), 10) : Number(semester);
    if (isNaN(parsedSemester) || parsedSemester < 1 || parsedSemester > 8) {
      parsedSemester = null;
    }
  }

  // Resolve section if provided
  let resolvedSectionDoc = null;
  const targetSectionId = sectionId || (section && typeof section === 'object' ? section._id : null);
  const targetCodeOrName = sectionCode || (typeof section === 'string' ? section : null);

  if (targetSectionId) {
    resolvedSectionDoc = await Section.findById(targetSectionId);
  } else if (targetCodeOrName) {
    const cleanedCode = targetCodeOrName.replace(/Section\s*/i, '').replace(/^CSE-/i, '').trim();
    resolvedSectionDoc = await Section.findOne({
      $or: [
        { code: targetCodeOrName },
        { code: `CSE-${cleanedCode}` },
        { code: `CSE-${cleanedCode}-S${parsedSemester || 5}` },
        { name: targetCodeOrName },
        { name: `Section ${cleanedCode}` },
        { name: new RegExp(`^Section\\s*${cleanedCode}$`, 'i') },
        { code: new RegExp(`^CSE-${cleanedCode}(?:-S\\d+)?$`, 'i') },
        { code: new RegExp(`-${cleanedCode}(?:-|$)`, 'i') },
      ],
    });

    if (!resolvedSectionDoc && (department || teacher.department)) {
      resolvedSectionDoc = await Section.findOne({
        department: department || teacher.department,
        $or: [
          { code: `CSE-${cleanedCode}-S${parsedSemester || 5}` },
          { code: `CSE-${cleanedCode}` },
          { name: `Section ${cleanedCode}` },
          { name: new RegExp(`^Section\\s*${cleanedCode}$`, 'i') },
          { code: new RegExp(`^CSE-${cleanedCode}(?:-S\\d+)?$`, 'i') },
        ],
      });
    }
  }

  const finalSemester = parsedSemester || resolvedSectionDoc?.semester || 5;
  const finalSectionId = resolvedSectionDoc?._id || null;
  const activeYear = academicYear || '2025-26';

  // Prevent duplicate active appointment for the same teacher in the same academic session
  const existingTeacherGroup = await MentorGroup.findOne({
    tg: teacher._id,
    academicYear: activeYear,
    isActive: true,
  });

  if (existingTeacherGroup) {
    if (reassign) {
      return updateMentorGroup(
        existingTeacherGroup._id,
        { department, tgId, academicYear: activeYear, semester: finalSemester, section, sectionCode, sectionId, studentIds },
        actorUser
      );
    }
    throw ApiError.conflict(
      `${teacher.user?.name || teacher.designation || 'This faculty member'} is already actively appointed as a Tutor Guardian for academic session ${activeYear}. Modify or reassign the existing cohort directly.`
    );
  }

  // Prevent duplicate active appointment for the same section and semester
  if (finalSectionId) {
    const existingSectionGroup = await MentorGroup.findOne({
      section: finalSectionId,
      academicYear: activeYear,
      isActive: true,
    }).populate({ path: 'tg', populate: { path: 'user', select: 'name' } });

    if (existingSectionGroup) {
      const currentTgName = existingSectionGroup.tg?.user?.name || 'another faculty member';
      throw ApiError.conflict(
        `Section ${resolvedSectionDoc?.name || resolvedSectionDoc?.code} already has an active Tutor Guardian (${currentTgName}) appointed for session ${activeYear}.`
      );
    }
  }

  // If no studentIds specified, automatically find active students belonging to this section
  let finalStudentIds = [...studentIds];
  if (finalStudentIds.length === 0 && finalSectionId) {
    const sectionStudents = await Student.find({
      section: finalSectionId,
    }).select('_id');
    finalStudentIds = sectionStudents.map((s) => s._id);
  } else if (finalStudentIds.length > 0) {
    // Check if students are already in an active mentor group
    const conflictingStudents = await Student.find({
      _id: { $in: finalStudentIds },
      mentorGroup: { $ne: null },
    }).populate('user', 'name');

    if (conflictingStudents.length > 0 && !reassign) {
      const names = conflictingStudents.map((s) => s.user?.name || s.rollNumber).join(', ');
      throw ApiError.conflict(`The following student(s) already belong to an active mentor group: ${names}`);
    } else if (conflictingStudents.length > 0 && reassign) {
      await MentorGroup.updateMany(
        { students: { $in: finalStudentIds } },
        { $pull: { students: { $in: finalStudentIds } } }
      );
    }
  }


  const group = await MentorGroup.create({
    department: department || teacher.department,
    tg: teacher._id,
    academicYear: activeYear,
    semester: finalSemester,
    section: finalSectionId,
    students: finalStudentIds,
    isActive: true,
  });

  // Sync Student.mentorGroup
  if (finalStudentIds.length > 0) {
    await Student.updateMany(
      { _id: { $in: finalStudentIds } },
      { $set: { mentorGroup: group._id } }
    );
  }

  // Ensure teacher has isTG: true
  await Teacher.findByIdAndUpdate(teacher._id, { isTG: true });

  // Record Immutable Audit Log
  await AuditLog.create({
    actor: actorUser?._id || actorUser?.id || null,
    action: 'APPOINT_TG',
    entityType: 'MentorGroup',
    entityId: group._id,
    before: null,
    after: {
      tgId: teacher._id,
      teacherName: teacher.user?.name || teacher.designation,
      academicYear: activeYear,
      semester: finalSemester,
      section: resolvedSectionDoc?.code || resolvedSectionDoc?.name || null,
      studentCount: finalStudentIds.length,
    },
  });

  return MentorGroup.findById(group._id)
    .populate('department', 'name code')
    .populate('section', 'name code year semester')
    .populate({
      path: 'tg',
      populate: { path: 'user', select: 'name email phone' },
    })
    .populate({
      path: 'students',
      populate: [
        { path: 'user', select: 'name email phone' },
        { path: 'section', select: 'name code' },
      ],
    });
};

export const updateMentorGroup = async (
  groupId,
  { department, tgId, academicYear, semester, section, sectionCode, sectionId, studentIds },
  actorUser = null
) => {
  const group = await MentorGroup.findById(groupId).populate('tg').populate('section');
  if (!group) {
    throw ApiError.notFound('Mentor group not found');
  }

  const before = group.toObject();

  // Parse semester
  let parsedSemester = group.semester;
  if (semester !== undefined && semester !== null) {
    parsedSemester = typeof semester === 'string' ? parseInt(semester.replace(/\D/g, ''), 10) : Number(semester);
    if (isNaN(parsedSemester) || parsedSemester < 1 || parsedSemester > 8) {
      parsedSemester = group.semester || 5;
    }
  }

  // Resolve section
  let resolvedSectionDoc = null;
  const targetSectionId = sectionId || (section && typeof section === 'object' ? section._id : null);
  const targetCodeOrName = sectionCode || (typeof section === 'string' ? section : null);

  if (targetSectionId) {
    resolvedSectionDoc = await Section.findById(targetSectionId);
  } else if (targetCodeOrName) {
    const cleanedCode = targetCodeOrName.replace(/Section\s*/i, '').replace(/^CSE-/i, '').trim();
    resolvedSectionDoc = await Section.findOne({
      $or: [
        { code: targetCodeOrName },
        { code: `CSE-${cleanedCode}` },
        { code: `CSE-${cleanedCode}-S${parsedSemester || group.semester || 5}` },
        { name: targetCodeOrName },
        { name: `Section ${cleanedCode}` },
        { name: new RegExp(`^Section\\s*${cleanedCode}$`, 'i') },
        { code: new RegExp(`^CSE-${cleanedCode}(?:-S\\d+)?$`, 'i') },
        { code: new RegExp(`-${cleanedCode}(?:-|$)`, 'i') },
      ],
    });

    if (!resolvedSectionDoc && group.department) {
      resolvedSectionDoc = await Section.findOne({
        department: group.department,
        $or: [
          { code: `CSE-${cleanedCode}-S${parsedSemester || group.semester || 5}` },
          { code: `CSE-${cleanedCode}` },
          { name: `Section ${cleanedCode}` },
          { name: new RegExp(`^Section\\s*${cleanedCode}$`, 'i') },
          { code: new RegExp(`^CSE-${cleanedCode}(?:-S\\d+)?$`, 'i') },
        ],
      });
    }
  }

  const activeYear = academicYear || group.academicYear || '2025-26';
  const finalSemester = parsedSemester || resolvedSectionDoc?.semester || group.semester || 5;
  const finalSectionId = resolvedSectionDoc?._id || group.section?._id || group.section;

  // If changing section, check if new section already has another active TG in this academic year
  if (finalSectionId && finalSectionId.toString() !== (group.section?._id || group.section || '').toString()) {
    const conflictingGroup = await MentorGroup.findOne({
      _id: { $ne: group._id },
      section: finalSectionId,
      academicYear: activeYear,
      isActive: true,
    }).populate({ path: 'tg', populate: { path: 'user', select: 'name' } });

    if (conflictingGroup) {
      const tgName = conflictingGroup.tg?.user?.name || 'another faculty member';
      throw ApiError.conflict(
        `Section ${resolvedSectionDoc?.name || resolvedSectionDoc?.code} already has an active Tutor Guardian (${tgName}) for session ${activeYear}.`
      );
    }
  }

  // If teacher tgId is changing, verify
  let newTgId = group.tg?._id || group.tg;
  if (tgId && tgId.toString() !== newTgId.toString()) {
    const teacher = await Teacher.findById(tgId);
    if (!teacher) throw ApiError.notFound('Target faculty member not found.');
    newTgId = teacher._id;
  }

  // Update group fields
  group.tg = newTgId;
  group.academicYear = activeYear;
  group.semester = finalSemester;
  group.section = finalSectionId;

  // Manage students: If section changed, unassign old students and reassign new section's students
  if (finalSectionId && finalSectionId.toString() !== (before.section?._id || before.section || '').toString()) {
    // Unassign old students who belonged to this mentor group
    await Student.updateMany(
      { mentorGroup: group._id },
      { $set: { mentorGroup: null } }
    );

    // Assign students of the new section
    const sectionStudents = await Student.find({
      section: finalSectionId,
    });
    const newStudentIds = sectionStudents.map((s) => s._id);
    group.students = newStudentIds;

    if (newStudentIds.length > 0) {
      await Student.updateMany(
        { _id: { $in: newStudentIds } },
        { $set: { mentorGroup: group._id } }
      );
    }
  } else if (Array.isArray(studentIds) && studentIds.length > 0) {
    group.students = studentIds;
  }

  group.isActive = true;
  await group.save();

  // Ensure TG flag on Teacher
  await Teacher.findByIdAndUpdate(newTgId, { isTG: true });

  // Audit Log
  await AuditLog.create({
    actor: actorUser?._id || actorUser?.id || null,
    action: 'REASSIGN_TG_SECTION',
    entityType: 'MentorGroup',
    entityId: group._id,
    before,
    after: group.toObject(),
  });

  return MentorGroup.findById(group._id)
    .populate('department', 'name code')
    .populate('section', 'name code year semester')
    .populate({
      path: 'tg',
      populate: { path: 'user', select: 'name email phone' },
    })
    .populate({
      path: 'students',
      populate: [
        { path: 'user', select: 'name email phone' },
        { path: 'section', select: 'name code' },
      ],
    });
};

export const updateMentorGroupStudents = async (groupId, { addStudentIds = [], removeStudentIds = [] }, actorUser = null) => {
  const group = await MentorGroup.findById(groupId);
  if (!group) {
    throw ApiError.notFound('Mentor group not found');
  }

  const before = group.toObject();

  // Check if any students to add belong to a different section
  if (addStudentIds.length > 0 && group.section) {
    const mismatched = await Student.find({
      _id: { $in: addStudentIds },
      section: { $ne: group.section },
    }).populate('user', 'name');
    if (mismatched.length > 0) {
      const names = mismatched.map((s) => s.user?.name || s.rollNumber).join(', ');
      throw ApiError.badRequest(`Cannot assign students from another section to this cohort: ${names}`);
    }
  }

  // Check if any students to add are already in another active group
  if (addStudentIds.length > 0) {
    const conflicting = await Student.find({
      _id: { $in: addStudentIds },
      mentorGroup: { $exists: true, $ne: null, $ne: group._id },
    }).populate('user', 'name');

    if (conflicting.length > 0) {
      const names = conflicting.map((s) => s.user?.name || s.rollNumber).join(', ');
      throw ApiError.conflict(`Student(s) already belong to another active mentor group: ${names}`);
    }
  }

  // Add students
  if (addStudentIds.length > 0) {
    const currentSet = new Set(group.students.map((s) => s.toString()));
    addStudentIds.forEach((id) => currentSet.add(id.toString()));
    group.students = Array.from(currentSet);

    await Student.updateMany(
      { _id: { $in: addStudentIds } },
      { $set: { mentorGroup: group._id } }
    );
  }

  // Remove students
  if (removeStudentIds.length > 0) {
    const removeSet = new Set(removeStudentIds.map((id) => id.toString()));
    group.students = group.students.filter((s) => !removeSet.has(s.toString()));

    await Student.updateMany(
      { _id: { $in: removeStudentIds }, mentorGroup: group._id },
      { $set: { mentorGroup: null } }
    );
  }

  await group.save();

  await AuditLog.create({
    actor: actorUser?._id || actorUser?.id || null,
    action: 'UPDATE_MENTOR_GROUP',
    entityType: 'MentorGroup',
    entityId: group._id,
    before,
    after: group.toObject(),
  });

  return MentorGroup.findById(group._id)
    .populate('department', 'name code')
    .populate('section', 'name code year semester')
    .populate({
      path: 'tg',
      populate: { path: 'user', select: 'name email phone' },
    })
    .populate({
      path: 'students',
      populate: [
        { path: 'user', select: 'name email phone' },
        { path: 'section', select: 'name code' },
      ],
    });
};

export const revokeMentorGroup = async (groupId, actorUser = null) => {
  const group = await MentorGroup.findById(groupId).populate({
    path: 'tg',
    populate: { path: 'user', select: 'name' },
  });
  if (!group) {
    throw ApiError.notFound('Mentor group appointment not found.');
  }

  const before = group.toObject();

  // Mark group inactive and unlink students
  group.isActive = false;
  await group.save();

  await Student.updateMany(
    { mentorGroup: group._id },
    { $set: { mentorGroup: null } }
  );

  // Revert TG flag on Teacher
  await Teacher.findByIdAndUpdate(group.tg?._id || group.tg, { isTG: false });

  await AuditLog.create({
    actor: actorUser?._id || actorUser?.id || null,
    action: 'REVOKE_TG',
    entityType: 'MentorGroup',
    entityId: group._id,
    before,
    after: {
      isActive: false,
      revokedAt: new Date(),
      teacherName: group.tg?.user?.name || 'Faculty Member',
    },
  });

  return { success: true, message: 'Tutor Guardian appointment revoked successfully.' };
};

export const getMyCohort = async (teacherId) => {
  if (!teacherId) {
    throw ApiError.forbidden('You are not assigned as a TG or teacher');
  }

  const group = await MentorGroup.findOne({ tg: teacherId, isActive: true })
    .populate('department', 'name code')
    .populate('section', 'name code year semester')
    .populate({
      path: 'tg',
      populate: { path: 'user', select: 'name email phone' },
    })
    .populate({
      path: 'students',
      populate: [
        { path: 'user', select: 'name email phone' },
        { path: 'section', select: 'name code' },
      ],
    });

  if (!group) {
    throw ApiError.notFound('No active mentor group found for your account');
  }

  // Strict Section Letter Isolation:
  // Ensure that every student in group.students strictly belongs to group.section
  if (group.section) {
    const groupSecId = (group.section._id || group.section).toString();
    const validStudents = [];
    const prunedIds = [];

    for (const st of (group.students || [])) {
      if (!st) continue;
      const stSecId = (st.section?._id || st.section)?.toString();
      if (stSecId === groupSecId) {
        validStudents.push(st);
      } else {
        prunedIds.push(st._id);
      }
    }

    if (prunedIds.length > 0) {
      // Heal in database
      await MentorGroup.findByIdAndUpdate(group._id, {
        $pull: { students: { $in: prunedIds } },
      });
      await Student.updateMany(
        { _id: { $in: prunedIds }, mentorGroup: group._id },
        { $set: { mentorGroup: null } }
      );
      group.students = validStudents;
    }
  }

  return group;
};

export default {
  listMentorGroups,
  createMentorGroup,
  updateMentorGroup,
  updateMentorGroupStudents,
  revokeMentorGroup,
  getMyCohort,
};
