import User from '../../models/User.js';
import Student from '../../models/Student.js';
import Teacher from '../../models/Teacher.js';
import Section from '../../models/Section.js';
import Department from '../../models/Department.js';
import MentorGroup from '../../models/MentorGroup.js';
import HodAppointment from '../../models/HodAppointment.js';
import AuditLog from '../../models/AuditLog.js';
import ConsiderationRequest from '../../models/ConsiderationRequest.js';
import LeaveApplication from '../../models/LeaveApplication.js';
import RefreshToken from '../../models/RefreshToken.js';
import Notification from '../../models/Notification.js';
import Notice from '../../models/Notice.js';
import ApiError from '../../utils/ApiError.js';
import { sendTemporaryPasswordEmail } from '../../utils/sendEmail.js';
import { emitNotification } from '../../sockets/emitters.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';

export const listUsers = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};

  if (query.role) {
    filter.role = query.role.toUpperCase();
  }
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  const [users, total] = await Promise.all([
    User.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    User.countDocuments(filter),
  ]);

  const userIds = users.map((u) => u._id);

  // Bulk fetch Student profiles
  const students = await Student.find({ user: { $in: userIds } })
    .populate('section', 'name code year semester')
    .populate('department', 'name code');
  const studentMap = new Map();
  students.forEach((s) => studentMap.set(s.user.toString(), s));

  // Bulk fetch Teacher profiles
  const teachers = await Teacher.find({ user: { $in: userIds } })
    .populate('department', 'name code');
  const teacherIds = teachers.map((t) => t._id);

  // Bulk fetch active MentorGroups for these teachers
  const activeCohorts = await MentorGroup.find({
    tg: { $in: teacherIds },
    isActive: true,
  }).populate('section', 'name code year semester');
  const cohortMap = new Map();
  activeCohorts.forEach((c) => {
    if (c.tg) cohortMap.set(c.tg.toString(), c);
  });

  const teacherMap = new Map();
  teachers.forEach((t) => {
    const activeCohort = cohortMap.get(t._id.toString()) || null;
    let mentoredSection = null;
    if (activeCohort) {
      const sem = activeCohort.section?.semester || activeCohort.semester || 5;
      const sec = activeCohort.section?.name || activeCohort.section?.code || 'Assigned';
      mentoredSection = `Semester ${sem} • ${sec}`;
    }
    teacherMap.set(t.user.toString(), {
      ...t.toObject(),
      isTG: Boolean(activeCohort),
      activeCohort: activeCohort ? activeCohort.toObject() : null,
      mentoredSection,
    });
  });

  const enrichedUsers = users.map((u) => {
    const uObj = u.toObject();
    if (u.role === 'STUDENT') {
      uObj.studentProfile = studentMap.get(u._id.toString()) || null;
    } else if (u.role === 'TEACHER' || u.role === 'HOD') {
      uObj.teacherProfile = teacherMap.get(u._id.toString()) || null;
    }
    return uObj;
  });

  return {
    users: enrichedUsers,
    meta: buildPaginationMeta(total, page, limit),
  };
};

export const createUser = async (data) => {
  const normEmail = data.email?.toLowerCase().trim();
  if (!normEmail) {
    throw ApiError.badRequest('Valid email address is required');
  }

  const existing = await User.findOne({ email: normEmail });
  if (existing) {
    throw ApiError.conflict(`User with email '${data.email}' already exists`);
  }

  const rawRole = (data.role || 'STUDENT').toUpperCase();
  const isTGAppointment = rawRole === 'TG' || Boolean(data.isTG);
  const targetRole = rawRole === 'TG' ? 'TEACHER' : rawRole;
  const password = data.password || 'Password@123';
  const passwordHash = await User.hashPassword(password);

  const user = await User.create({
    name: (data.name || 'User Account').trim(),
    email: normEmail,
    passwordHash,
    role: targetRole,
    phone: data.phone ? data.phone.trim() : null,
    mustChangePassword: data.mustChangePassword !== undefined ? Boolean(data.mustChangePassword) : false,
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
  });

  // Default Department
  let dept = null;
  if (data.departmentId || data.department) {
    dept = await Department.findById(data.departmentId || data.department);
  }
  if (!dept) {
    dept = (await Department.findOne({ code: 'CSE' })) || (await Department.findOne()) || (await Department.create({ name: 'Computer Science & Engineering', code: 'CSE' }));
  }

  let profile = null;

  if (targetRole === 'STUDENT') {
    const semNumber = parseInt(data.semester, 10) || 5;
    const yearNumber = parseInt(data.year, 10) || Math.ceil(semNumber / 2) || 3;

    // Find or create Section scoped by semester
    let sec = null;
    const cleanSectionName = (data.section || 'Section B').replace(/^Section\s*/i, '').trim();
    if (data.sectionId) {
      sec = await Section.findById(data.sectionId);
    }
    if (!sec) {
      sec = await Section.findOne({
        department: dept._id,
        semester: semNumber,
        $or: [
          { name: new RegExp(`^Section ${cleanSectionName}$`, 'i') },
          { code: new RegExp(`^CSE-${cleanSectionName}-S${semNumber}$`, 'i') },
          { code: new RegExp(`^CSE-${cleanSectionName}$`, 'i') },
          { name: new RegExp(`^${cleanSectionName}$`, 'i') },
        ],
      });
    }

    if (!sec) {
      let codeToUse = `CSE-${cleanSectionName}`;
      const codeConflict = await Section.findOne({ code: codeToUse });
      if (codeConflict && codeConflict.semester !== semNumber) {
        codeToUse = `CSE-${cleanSectionName}-S${semNumber}`;
      }
      sec = await Section.create({
        name: `Section ${cleanSectionName}`,
        code: codeToUse,
        department: dept._id,
        year: yearNumber,
        semester: semNumber,
        academicYear: data.academicYear || '2025-26',
      });
    }

    const roll = (data.rollNumber || data.enrollmentNo || data.enrollmentNumber || `0176CS${Date.now().toString().slice(-6)}`).trim().toUpperCase();
    const enrollNo = (data.enrollmentNumber || data.enrollmentNo || roll).trim().toUpperCase();

    profile = await Student.create({
      user: user._id,
      department: dept._id,
      section: sec._id,
      rollNumber: roll,
      enrollmentNumber: enrollNo,
      enrollmentYear: parseInt(data.enrollmentYear, 10) || 2022,
      semester: semNumber,
      guardianName: data.guardianName ? data.guardianName.trim() : null,
      guardianPhone: data.guardianPhone ? data.guardianPhone.trim() : null,
    });

    // Auto-link to active MentorGroup if exists
    try {
      const group = await MentorGroup.findOne({ section: sec._id, isActive: true });
      if (group) {
        profile.mentorGroup = group._id;
        await profile.save();
        if (!group.students.includes(profile._id)) {
          group.students.push(profile._id);
          await group.save();
        }
      }
    } catch {}
  } else if (targetRole === 'TEACHER' || targetRole === 'HOD') {
    const empId = (data.employeeId || `EMP_${Date.now().toString().slice(-5)}`).trim().toUpperCase();
    profile = await Teacher.create({
      user: user._id,
      department: dept._id,
      employeeId: empId,
      designation: data.designation || (targetRole === 'HOD' ? 'Head of Department' : isTGAppointment ? 'Assistant Professor (TG)' : 'Assistant Professor'),
      specialization: data.specialization || 'Computer Science & Engineering',
    });

    if (targetRole === 'HOD') {
      // Deactivate any previous active HOD appointment for this department
      await HodAppointment.updateMany({ department: dept._id, isActive: true }, { isActive: false, endDate: new Date() });
      await HodAppointment.create({
        department: dept._id,
        teacher: profile._id,
        startDate: new Date(),
        isActive: true,
      });
    }

    // If TG appointment was selected
    if (isTGAppointment) {
      try {
        const tgSemester = parseInt(data.semester, 10) || 5;
        let tgSection = null;
        if (data.sectionId) {
          tgSection = await Section.findById(data.sectionId);
        } else if (data.section) {
          const cleanLetter = String(data.section).replace(/Section\s*/i, '').trim();
          tgSection = await Section.findOne({
            department: dept._id,
            semester: tgSemester,
            $or: [
              { code: `CSE-${cleanLetter}-S${tgSemester}` },
              { code: `CSE-${cleanLetter}` },
              { name: `Section ${cleanLetter}` },
              { name: cleanLetter },
            ],
          });
          if (!tgSection) {
            tgSection = await Section.findOne({
              department: dept._id,
              $or: [
                { code: `CSE-${cleanLetter}` },
                { name: `Section ${cleanLetter}` },
              ],
            });
          }
        }

        const tgSession = data.academicYear || data.session || '2025-26';

        let tgStudentIds = [];
        if (tgSection) {
          const sectionStudents = await Student.find({ section: tgSection._id }).select('_id');
          tgStudentIds = sectionStudents.map((s) => s._id);
        }

        const mentorGroup = await MentorGroup.create({
          department: dept._id,
          tg: profile._id,
          academicYear: tgSession,
          semester: tgSemester,
          section: tgSection?._id || null,
          students: tgStudentIds,
          isActive: true,
        });

        if (tgStudentIds.length > 0) {
          await Student.updateMany(
            { _id: { $in: tgStudentIds } },
            { $set: { mentorGroup: mentorGroup._id } }
          );
        }
      } catch (tgErr) {
        console.warn('Auto-create TG cohort failed during user creation:', tgErr.message);
      }
    }
  }

  const userSafe = user.toObject();
  delete userSafe.passwordHash;
  return { user: userSafe, profile };
};

export const getUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  let profile = null;
  if (user.role === 'STUDENT') {
    profile = await Student.findOne({ user: user._id }).populate('department section mentorGroup');
  } else if (user.role === 'TEACHER' || user.role === 'HOD') {
    profile = await Teacher.findOne({ user: user._id }).populate('department');
    if (profile) {
      const activeCohort = await MentorGroup.findOne({ tg: profile._id, isActive: true })
        .populate('section', 'name code semester year');
      profile = {
        ...profile.toObject(),
        isTG: Boolean(activeCohort),
        activeCohort,
      };
    }
  }

  return { user, profile };
};

export const updateUser = async (id, updates = {}) => {
  const user = await User.findById(id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  // Email uniqueness check if changed
  if (updates.email) {
    const normEmail = updates.email.toLowerCase().trim();
    if (normEmail !== user.email) {
      const existing = await User.findOne({ email: normEmail, _id: { $ne: user._id } });
      if (existing) {
        throw ApiError.conflict(`Email '${updates.email}' is already in use by another account`);
      }
      user.email = normEmail;
    }
  }

  if (updates.name) user.name = updates.name.trim();
  if (updates.phone !== undefined) user.phone = updates.phone ? updates.phone.trim() : null;
  if (updates.isActive !== undefined) user.isActive = Boolean(updates.isActive);
  if (updates.mustChangePassword !== undefined) user.mustChangePassword = Boolean(updates.mustChangePassword);

  // Direct password update
  if (updates.password && updates.password.trim().length >= 6) {
    user.passwordHash = await User.hashPassword(updates.password.trim());
  }

  const previousRole = user.role;
  let roleChanged = false;

  if (updates.role && updates.role.toUpperCase() !== user.role) {
    user.role = updates.role.toUpperCase();
    roleChanged = true;
  }

  await user.save();

  // Profile-specific updates
  let profile = null;

  if (user.role === 'STUDENT' || previousRole === 'STUDENT') {
    const student = await Student.findOne({ user: user._id });
    if (student) {
      if (updates.rollNumber) student.rollNumber = updates.rollNumber.trim().toUpperCase();
      if (updates.enrollmentNumber) student.enrollmentNumber = updates.enrollmentNumber.trim().toUpperCase();
      if (updates.enrollmentYear) student.enrollmentYear = parseInt(updates.enrollmentYear);
      if (updates.semester) student.semester = parseInt(updates.semester);
      if (updates.sectionId) student.section = updates.sectionId;
      await student.save();
      profile = student;
    }
  }

  if (user.role === 'TEACHER' || user.role === 'HOD' || previousRole === 'TEACHER' || previousRole === 'HOD') {
    let teacher = await Teacher.findOne({ user: user._id });
    if (!teacher && (user.role === 'TEACHER' || user.role === 'HOD')) {
      let dept = (await Department.findOne({ code: 'CSE' })) || (await Department.findOne());
      teacher = await Teacher.create({
        user: user._id,
        department: dept?._id,
        employeeId: updates.employeeId || `EMP_${Date.now().toString().slice(-4)}`,
        designation: user.role === 'HOD' ? 'Head of Department' : 'Assistant Professor',
      });
    }

    if (teacher) {
      if (updates.employeeId) teacher.employeeId = updates.employeeId.trim().toUpperCase();
      if (updates.designation) {
        teacher.designation = updates.designation.trim();
      } else if (roleChanged) {
        if (user.role === 'HOD') teacher.designation = 'Head of Department';
        else if (previousRole === 'HOD') teacher.designation = 'Assistant Professor';
      }
      if (updates.specialization !== undefined) teacher.specialization = updates.specialization.trim();

      // TG toggle handling
      if (updates.isTG === false) {
        await MentorGroup.updateMany({ tg: teacher._id }, { isActive: false });
      }

      await teacher.save();
      profile = teacher;
    }
  }

  return { user, profile };
};

export const deleteUser = async (id, requestingUser = null) => {
  const user = await User.findById(id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  // Prevent deleting the last active Administrator account
  if (user.role === 'ADMIN') {
    const activeAdminsCount = await User.countDocuments({ role: 'ADMIN', isActive: true });
    if (activeAdminsCount <= 1 && user.isActive) {
      throw ApiError.badRequest('Cannot delete the only remaining active Administrator account');
    }
    if (requestingUser && requestingUser._id && requestingUser._id.toString() === user._id.toString()) {
      throw ApiError.badRequest('You cannot delete your own active Administrator account while signed in');
    }
  }

  // Cascade cleanup for Students
  if (user.role === 'STUDENT') {
    const student = await Student.findOne({ user: user._id });
    if (student) {
      await ConsiderationRequest.deleteMany({ student: student._id });
      await LeaveApplication.deleteMany({ student: student._id });
      await MentorGroup.updateMany({ students: student._id }, { $pull: { students: student._id } });
      await Student.findByIdAndDelete(student._id);
    }
  }

  // Cascade cleanup for Teachers / HODs
  if (user.role === 'TEACHER' || user.role === 'HOD') {
    const teacher = await Teacher.findOne({ user: user._id });
    if (teacher) {
      await MentorGroup.updateMany({ tg: teacher._id }, { isActive: false });
      await LeaveApplication.deleteMany({ teacher: teacher._id });
      await Teacher.findByIdAndDelete(teacher._id);
    }
  }

  // Clean tokens, notifications, notices, and HOD appointments
  await Notification.deleteMany({ user: user._id });
  await RefreshToken.deleteMany({ user: user._id });
  await Notice.deleteMany({ author: user._id });
  await HodAppointment.deleteMany({ user: user._id });
  await User.findByIdAndDelete(id);

  return {
    success: true,
    message: `Account for ${user.name} (${user.role}) has been permanently deleted.`,
  };
};

export const appointHOD = async (userId, actorUser = null) => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  let teacher = await Teacher.findOne({ user: user._id });
  let dept = null;
  if (teacher) {
    dept = await Department.findById(teacher.department);
  }
  if (!dept) {
    dept = (await Department.findOne({ code: 'CSE' })) || (await Department.findOne());
  }

  if (!teacher) {
    teacher = await Teacher.create({
      user: user._id,
      department: dept._id,
      employeeId: `EMP_${Date.now().toString().slice(-5)}`,
      designation: 'Head of Department',
      specialization: 'Computer Science & Engineering',
    });
  } else {
    teacher.designation = 'Head of Department';
    await teacher.save();
  }

  // Deactivate any existing active HOD for this department
  const existingHodAppointments = await HodAppointment.find({
    department: dept._id,
    isActive: true,
  });

  for (const appt of existingHodAppointments) {
    if (appt.teacher.toString() !== teacher._id.toString()) {
      appt.isActive = false;
      appt.endDate = new Date();
      await appt.save();

      const prevTeacher = await Teacher.findById(appt.teacher);
      if (prevTeacher) {
        prevTeacher.designation = 'Assistant Professor';
        await prevTeacher.save();
        await User.findByIdAndUpdate(prevTeacher.user, { role: 'TEACHER' });
      }
    }
  }

  // Demote any other users with role 'HOD'
  const otherHods = await User.find({ role: 'HOD', _id: { $ne: user._id } });
  for (const other of otherHods) {
    other.role = 'TEACHER';
    await other.save();
    const ot = await Teacher.findOne({ user: other._id });
    if (ot) {
      ot.designation = 'Assistant Professor';
      await ot.save();
    }
  }

  user.role = 'HOD';
  await user.save();

  // Create active HodAppointment record
  await HodAppointment.create({
    department: dept._id,
    teacher: teacher._id,
    startDate: new Date(),
    isActive: true,
  });

  // Audit log
  await AuditLog.create({
    actor: actorUser?._id || null,
    action: 'APPOINT_HOD',
    entityType: 'User',
    entityId: user._id,
    before: null,
    after: {
      userId: user._id,
      userName: user.name,
      teacherId: teacher._id,
      departmentId: dept._id,
      departmentCode: dept.code,
    },
  });

  // In-app notification
  try {
    const notif = await Notification.create({
      user: user._id,
      title: 'Appointed as Head of Department (HOD)',
      message: `You have been appointed as Head of Department for ${dept.name}.`,
      type: 'SYSTEM',
      link: '/hod',
    });
    emitNotification(user._id.toString(), notif);
  } catch {}

  return {
    user,
    teacher,
    message: `${user.name} has been appointed as Head of Department (HOD).`,
  };
};

export const removeHOD = async (userId, actorUser = null) => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  user.role = 'TEACHER';
  await user.save();

  let teacher = await Teacher.findOne({ user: user._id });
  if (teacher) {
    teacher.designation = 'Assistant Professor';
    await teacher.save();

    await HodAppointment.updateMany(
      { teacher: teacher._id, isActive: true },
      { $set: { isActive: false, endDate: new Date() } }
    );
  }

  // Audit log
  await AuditLog.create({
    actor: actorUser?._id || null,
    action: 'REMOVE_HOD',
    entityType: 'User',
    entityId: user._id,
    before: { role: 'HOD' },
    after: { role: 'TEACHER', userName: user.name },
  });

  // In-app notification
  try {
    const notif = await Notification.create({
      user: user._id,
      title: 'HOD Appointment Concluded',
      message: `Your appointment as Head of Department has concluded; account returned to standard faculty status.`,
      type: 'SYSTEM',
      link: '/teacher',
    });
    emitNotification(user._id.toString(), notif);
  } catch {}

  return {
    user,
    teacher,
    message: `HOD status removed for ${user.name}; restored to standard faculty status.`,
  };
};

export const appointTG = async (userId, data = {}, actorUser = null) => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  let teacher = await Teacher.findOne({ user: user._id });
  let dept = null;
  if (teacher) {
    dept = await Department.findById(teacher.department);
  }
  if (!dept) {
    dept = (await Department.findOne({ code: 'CSE' })) || (await Department.findOne());
  }

  if (!teacher) {
    teacher = await Teacher.create({
      user: user._id,
      department: dept._id,
      employeeId: `EMP_${Date.now().toString().slice(-5)}`,
      designation: 'Assistant Professor (TG)',
      specialization: 'Computer Science & Engineering',
    });
  }

  const finalSemester = parseInt(data.semester, 10) || 5;
  const activeYear = data.academicYear || data.session || '2025-26';

  // Resolve section
  let resolvedSectionDoc = null;
  if (data.sectionId) {
    resolvedSectionDoc = await Section.findById(data.sectionId);
  } else if (data.section) {
    const cleanedCode = String(data.section).replace(/Section\s*/i, '').trim();
    resolvedSectionDoc = await Section.findOne({
      department: dept._id,
      semester: finalSemester,
      $or: [
        { code: `CSE-${cleanedCode}-S${finalSemester}` },
        { code: `CSE-${cleanedCode}` },
        { name: `Section ${cleanedCode}` },
        { code: data.section },
        { name: data.section },
      ],
    });
    if (!resolvedSectionDoc) {
      resolvedSectionDoc = await Section.findOne({
        department: dept._id,
        $or: [
          { code: `CSE-${cleanedCode}-S${finalSemester}` },
          { code: `CSE-${cleanedCode}` },
          { name: `Section ${cleanedCode}` },
          { code: data.section },
          { name: data.section },
        ],
      });
    }
  }

  let finalStudentIds = Array.isArray(data.studentIds) ? [...data.studentIds] : [];

  if (finalStudentIds.length === 0 && resolvedSectionDoc) {
    const secStudents = await Student.find({ section: resolvedSectionDoc._id }).select('_id');
    finalStudentIds = secStudents.map((s) => s._id);
  }

  // Deactivate any existing mentor group for this teacher or reassign
  const existingTeacherGroup = await MentorGroup.findOne({
    tg: teacher._id,
    isActive: true,
  });

  let group = null;

  if (existingTeacherGroup) {
    if (existingTeacherGroup.section?.toString() !== resolvedSectionDoc?._id?.toString()) {
      await Student.updateMany(
        { mentorGroup: existingTeacherGroup._id },
        { $set: { mentorGroup: null } }
      );
    }
    existingTeacherGroup.section = resolvedSectionDoc?._id || existingTeacherGroup.section;
    existingTeacherGroup.semester = finalSemester;
    existingTeacherGroup.academicYear = activeYear;
    existingTeacherGroup.students = finalStudentIds;
    existingTeacherGroup.isActive = true;
    await existingTeacherGroup.save();
    group = existingTeacherGroup;
  } else {
    // If another TG is currently assigned to this section in this academic year, deactivate it
    if (resolvedSectionDoc) {
      const existingSecGroup = await MentorGroup.findOne({
        section: resolvedSectionDoc._id,
        academicYear: activeYear,
        isActive: true,
      });
      if (existingSecGroup) {
        existingSecGroup.isActive = false;
        await existingSecGroup.save();
        await Teacher.findByIdAndUpdate(existingSecGroup.tg, { isTG: false });
      }
    }

    group = await MentorGroup.create({
      department: dept._id,
      tg: teacher._id,
      academicYear: activeYear,
      semester: finalSemester,
      section: resolvedSectionDoc?._id || null,
      students: finalStudentIds,
      isActive: true,
    });
  }

  // Reassign student references
  if (finalStudentIds.length > 0) {
    await Student.updateMany(
      { _id: { $in: finalStudentIds } },
      { $set: { mentorGroup: group._id } }
    );
  }

  if (!teacher.designation.includes('(TG)') && teacher.designation !== 'Head of Department') {
    teacher.designation = `${teacher.designation} (TG)`;
  }
  await teacher.save();

  // Audit log
  await AuditLog.create({
    actor: actorUser?._id || null,
    action: 'APPOINT_TG',
    entityType: 'MentorGroup',
    entityId: group._id,
    before: null,
    after: {
      userId: user._id,
      teacherId: teacher._id,
      userName: user.name,
      section: resolvedSectionDoc?.code || resolvedSectionDoc?.name,
      semester: finalSemester,
      studentsCount: finalStudentIds.length,
    },
  });

  // In-app notification
  try {
    const notif = await Notification.create({
      user: user._id,
      title: 'Appointed as Tutor Guardian (TG)',
      message: `You have been appointed as Tutor Guardian for Semester ${finalSemester}, ${resolvedSectionDoc?.name || 'Assigned Section'}.`,
      type: 'SYSTEM',
      link: '/tg',
    });
    emitNotification(user._id.toString(), notif);
  } catch {}

  return {
    group,
    teacher,
    user,
    message: `${user.name} has been appointed as Tutor Guardian for ${resolvedSectionDoc?.name || 'assigned section'}.`,
  };
};

export const removeTG = async (userId, actorUser = null) => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const teacher = await Teacher.findOne({ user: user._id });
  if (!teacher) {
    throw ApiError.notFound('Faculty profile not found');
  }

  const groups = await MentorGroup.find({ tg: teacher._id, isActive: true });
  const groupIds = groups.map((g) => g._id);

  if (groupIds.length > 0) {
    await Student.updateMany(
      { mentorGroup: { $in: groupIds } },
      { $set: { mentorGroup: null } }
    );
    await MentorGroup.updateMany(
      { _id: { $in: groupIds } },
      { $set: { isActive: false } }
    );
  }

  teacher.designation = teacher.designation.replace(/\s*\(TG\)/i, '').trim();
  await teacher.save();

  // Audit log
  await AuditLog.create({
    actor: actorUser?._id || null,
    action: 'REVOKE_TG',
    entityType: 'Teacher',
    entityId: teacher._id,
    before: { isTG: true },
    after: { isTG: false, userName: user.name },
  });

  // In-app notification
  try {
    const notif = await Notification.create({
      user: user._id,
      title: 'Tutor Guardian Appointment Concluded',
      message: `Your appointment as Tutor Guardian has concluded.`,
      type: 'SYSTEM',
      link: '/teacher',
    });
    emitNotification(user._id.toString(), notif);
  } catch {}

  return {
    teacher,
    user,
    message: `Tutor Guardian appointment revoked for ${user.name}.`,
  };
};

export const resetPassword = async (id, customPassword = null, actorUser = null) => {
  const user = await User.findById(id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  // FLAW-AUTH-02: Strict role and cohort boundary enforcement
  if (actorUser) {
    if (actorUser.role === 'TG') {
      // TG can strictly only reset credentials for students
      if (user.role !== 'STUDENT') {
        throw ApiError.forbidden('Tutor Guardians are only authorized to reset student credentials');
      }

      // Verify student belongs to this TG's cohort
      const student = await Student.findOne({ user: user._id });
      if (!student) {
        throw ApiError.forbidden('Target student profile not found');
      }

      const activeGroups = await MentorGroup.find({ tg: actorUser.teacherId, isActive: true });
      const assignedSectionIds = activeGroups.map((g) => g.section?.toString()).filter(Boolean);
      const assignedStudentIds = activeGroups.flatMap((g) => (g.students || []).map((s) => s.toString()));

      const isMentee =
        assignedStudentIds.includes(student._id.toString()) ||
        (student.mentorGroup && activeGroups.some((g) => g._id.toString() === student.mentorGroup.toString())) ||
        (student.section && assignedSectionIds.includes(student.section.toString()));

      if (!isMentee) {
        throw ApiError.forbidden('You can only reset credentials for students assigned to your cohort');
      }
    } else if (actorUser.role === 'HOD') {
      // HOD cannot reset Administrator passwords
      if (user.role === 'ADMIN') {
        throw ApiError.forbidden('Head of Department cannot reset Administrator credentials');
      }
    }
  }

  const newPassword = (customPassword && customPassword.trim().length >= 6)
    ? customPassword.trim()
    : 'Reset@' + Math.floor(1000 + Math.random() * 9000);

  user.passwordHash = await User.hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();

  // Send temporary password to user via email if configured
  if (user.email) {
    try {
      await sendTemporaryPasswordEmail(user.email, newPassword, user.name);
    } catch (err) {
      console.warn('[Send Temp Password Email Notice]:', err.message);
    }
  }

  // Create in-app notification
  try {
    const notif = await Notification.create({
      user: user._id,
      title: 'Password Updated by Administrator',
      message: `Your account credentials were reset by an administrator.`,
      type: 'SYSTEM',
      link: user.role === 'STUDENT' ? '/student/profile' : '/change-password',
    });
    emitNotification(user._id.toString(), notif);
  } catch (err) {
    // Ignore notification error if offline
  }

  return {
    success: true,
    message: `Password reset successfully for ${user.name}.`,
    tempPassword: newPassword,
  };
};

export const updateStatus = async (id, isActive) => {
  const user = await User.findById(id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  user.isActive = Boolean(isActive);
  await user.save();
  return user;
};

export default {
  listUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  appointHOD,
  removeHOD,
  appointTG,
  removeTG,
  resetPassword,
  updateStatus,
};

