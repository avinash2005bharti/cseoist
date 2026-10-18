import LeaveApplication from '../../models/LeaveApplication.js';
import Student from '../../models/Student.js';
import Teacher from '../../models/Teacher.js';
import MentorGroup from '../../models/MentorGroup.js';
import Section from '../../models/Section.js';
import Department from '../../models/Department.js';
import User from '../../models/User.js';
import Notification from '../../models/Notification.js';
import AuditLog from '../../models/AuditLog.js';
import ApiError from '../../utils/ApiError.js';
import env from '../../config/env.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import {
  isEndDateGteStartDate,
  calculateInclusiveDays,
  isExcessivelyBackdated,
  rangesOverlap,
} from '../../utils/dates.js';
import { emitNotification, emitRequestUpdated, emitQueueChanged } from '../../sockets/emitters.js';
import { resolveStudentTG } from '../considerations/considerations.service.js';
import { sendStatusNotificationEmail } from '../../utils/sendEmail.js';

export const resolveApprovalChain = (applicantRole) => {
  switch (applicantRole) {
    case 'STUDENT':
      return { tiers: ['TG', 'HOD'], finalRole: 'HOD' };
    case 'TEACHER':
      return { tiers: ['HOD'], finalRole: 'HOD' };
    case 'HOD':
      return { tiers: ['ADMIN'], finalRole: 'ADMIN' };
    default:
      throw ApiError.badRequest('Invalid applicant role for leave application');
  }
};

export const createLeave = async (user, data) => {
  const applicantRole = user.role;
  if (!['STUDENT', 'TEACHER', 'HOD'].includes(applicantRole)) {
    throw ApiError.forbidden('Admins cannot apply for leave through this form');
  }

  if (!isEndDateGteStartDate(data.startDate, data.endDate)) {
    throw ApiError.badRequest('End date must be on or after start date');
  }

  // Backdate check
  if (isExcessivelyBackdated(data.startDate, env.LEAVE_BACKDATE_DAYS)) {
    throw ApiError.badRequest(
      `Leave cannot be backdated by more than ${env.LEAVE_BACKDATE_DAYS} days from today`
    );
  }

  // Calculate inclusive duration
  const totalDays = calculateInclusiveDays(data.startDate, data.endDate);
  if (totalDays > env.LEAVE_MAX_DAYS) {
    throw ApiError.badRequest(`Leave duration cannot exceed ${env.LEAVE_MAX_DAYS} days per application`);
  }

  // Medical leave rule: totalDays > 2 requires at least one attachment
  const attachments = data.attachments || [];
  if (data.leaveType === 'MEDICAL' && totalDays > 2 && attachments.length === 0) {
    throw ApiError.badRequest('Medical leave exceeding 2 days requires at least one medical certificate attachment');
  }

  // Overlap check
  const activeLeaves = await LeaveApplication.find({
    applicant: user._id,
    status: { $in: ['PENDING', 'RECOMMENDED_BY_TG', 'APPROVED_BY_HOD', 'APPROVED'] },
  });

  for (const existing of activeLeaves) {
    if (rangesOverlap(data.startDate, data.endDate, existing.startDate, existing.endDate)) {
      throw ApiError.conflict(
        `You already have an active or approved leave application overlapping with ${data.startDate} to ${data.endDate}`
      );
    }
  }

  let studentId = null;
  let teacherId = null;
  let tgTeacherId = null;

  if (applicantRole === 'STUDENT') {
    const student = await Student.findOne({ user: user._id });
    if (!student) throw ApiError.notFound('Student profile not found');
    studentId = student._id;

    tgTeacherId = await resolveStudentTG(student);
  } else if (applicantRole === 'TEACHER' || applicantRole === 'HOD') {
    const teacher = await Teacher.findOne({ user: user._id });
    if (!teacher) throw ApiError.notFound('Teacher profile not found');
    teacherId = teacher._id;
  }

  const now = new Date();
  const leave = await LeaveApplication.create({
    applicant: user._id,
    applicantRole,
    student: studentId,
    teacher: teacherId,
    tg: tgTeacherId,
    leaveType: data.leaveType,
    startDate: data.startDate,
    endDate: data.endDate,
    totalDays,
    reason: data.reason,
    attachments,
    status: 'PENDING',
    history: [
      {
        status: 'PENDING',
        actor: user._id,
        actorRole: applicantRole,
        remarks: 'Leave application submitted',
        at: now,
        via: 'MANUAL',
      },
    ],
  });

  // Audit log
  await AuditLog.create({
    actor: user._id,
    action: 'CREATE_LEAVE',
    entityType: 'LeaveApplication',
    entityId: leave._id,
    after: leave.toObject(),
  });

  // Notifications routing
  if (applicantRole === 'STUDENT') {
    if (tgTeacherId) {
      const tgTeacher = await Teacher.findById(tgTeacherId).populate('user');
      if (tgTeacher?.user) {
        const notif = await Notification.create({
          user: tgTeacher.user._id,
          title: 'New Student Leave Application',
          message: `${user.name} applied for ${data.leaveType.toLowerCase()} leave (${totalDays} day${totalDays > 1 ? 's' : ''}).`,
          type: 'LEAVE',
          link: `/tg/leaves/${leave._id}`,
        });
        emitNotification(tgTeacher.user._id.toString(), notif);
        emitQueueChanged('TG', 'LEAVE');
      }
    } else {
      // Direct to HOD
      const hodUsers = await User.find({ role: { $in: ['HOD', 'ADMIN'] }, isActive: true });
      for (const hod of hodUsers) {
        const notif = await Notification.create({
          user: hod._id,
          title: 'New Student Leave (No TG Assigned)',
          message: `${user.name} applied for leave requiring direct review.`,
          type: 'LEAVE',
          link: `/hod/leaves/${leave._id}`,
        });
        emitNotification(hod._id.toString(), notif);
      }
    }
    // Always notify HOD queue so HOD Dashboard counter updates in real time
    emitQueueChanged('HOD', 'LEAVE');
  } else if (applicantRole === 'TEACHER') {
    // Notify HOD
    const hodUsers = await User.find({ role: { $in: ['HOD', 'ADMIN'] }, isActive: true });
    for (const hod of hodUsers) {
      const notif = await Notification.create({
        user: hod._id,
        title: 'Faculty Leave Application',
        message: `Faculty member ${user.name} applied for ${data.leaveType.toLowerCase()} leave.`,
        type: 'LEAVE',
        link: `/hod/faculty-leaves/${leave._id}`,
      });
      emitNotification(hod._id.toString(), notif);
    }
    emitQueueChanged('HOD', 'LEAVE');
  } else if (applicantRole === 'HOD') {
    // Notify Admin
    const admins = await User.find({ role: 'ADMIN', isActive: true });
    for (const admin of admins) {
      const notif = await Notification.create({
        user: admin._id,
        title: 'HOD Leave Application',
        message: `HOD ${user.name} applied for leave.`,
        type: 'LEAVE',
        link: `/admin/hod-leaves/${leave._id}`,
      });
      emitNotification(admin._id.toString(), notif);
    }
  }

  return leave;
};

export const getMyLeaves = async (userId, query) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = { applicant: userId };

  if (query.status) {
    const s = query.status.toUpperCase();
    if (s === 'APPROVED' || s === 'APPROVED_BY_HOD') {
      filter.status = { $in: ['APPROVED', 'APPROVED_BY_HOD'] };
    } else {
      filter.status = s;
    }
  }

  const [leaves, total] = await Promise.all([
    LeaveApplication.find(filter)
      .populate('tg', 'designation employeeId')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    LeaveApplication.countDocuments(filter),
  ]);

  return {
    leaves,
    meta: buildPaginationMeta(total, page, limit),
  };
};

export const getTGLeaveQueue = async (user, query) => {
  if (!user.isTG || !user.teacherId) {
    throw ApiError.forbidden('Only Tutor Guardians can access this queue');
  }

  const { page, limit, skip } = parsePagination(query);

  // Scope to the students of this TG's assigned sections/groups
  const myGroups = await MentorGroup.find({ tg: user.teacherId, isActive: true });
  const mySectionIds = myGroups.map((g) => g.section).filter(Boolean);
  const myExplicitStudentIds = myGroups.flatMap((g) => g.students || []);

  const myStudents = await Student.find({
    $or: [
      { _id: { $in: myExplicitStudentIds } },
      { mentorGroup: { $in: myGroups.map((g) => g._id) } },
      ...(mySectionIds.length > 0 ? [{ section: { $in: mySectionIds } }] : []),
    ],
  }).select('_id');
  const myStudentIds = myStudents.map((s) => s._id);

  const filter = {
    applicantRole: 'STUDENT',
    $or: [
      { tg: user.teacherId },
      { student: { $in: myStudentIds } },
    ],
  };

  if (myStudentIds.length > 0) {
    filter.student = { $in: myStudentIds };
    delete filter.$or;
  }

  if (query.status) {
    filter.status = query.status.toUpperCase();
  } else {
    filter.status = 'PENDING';
  }

  const [leaves, total] = await Promise.all([
    LeaveApplication.find(filter)
      .populate({
        path: 'student',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code' },
        ],
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: 1 }),
    LeaveApplication.countDocuments(filter),
  ]);

  return {
    leaves,
    meta: buildPaginationMeta(total, page, limit),
  };
};

export const getHODLeaveQueue = async (query = {}, user = null) => {
  const { page, limit, skip } = parsePagination(query);
  const conditions = [];

  if (query.all === 'true' || query.status === 'ALL') {
    // Return all student and faculty department leaves
  } else if (query.status === 'ACTION_NEEDED' || (!query.all && !query.status)) {
    conditions.push({
      $or: [
        { applicantRole: 'STUDENT', status: 'RECOMMENDED_BY_TG' },
        { applicantRole: 'STUDENT', status: 'PENDING', escalated: true },
        { applicantRole: 'STUDENT', status: 'PENDING', tg: null },
        { applicantRole: 'TEACHER', status: 'PENDING' },
      ],
    });
  } else if (query.status === 'APPROVED' || query.status === 'APPROVED_BY_HOD') {
    conditions.push({ status: { $in: ['APPROVED', 'APPROVED_BY_HOD'] } });
  } else if (query.status === 'REJECTED') {
    conditions.push({ status: 'REJECTED' });
  } else if (query.status) {
    conditions.push({ status: query.status.toUpperCase() });
  }

  if (query.roleFilter && query.roleFilter !== 'ALL') {
    conditions.push({ applicantRole: query.roleFilter.toUpperCase() });
  } else if (query.role && query.role !== 'ALL') {
    conditions.push({ applicantRole: query.role.toUpperCase() });
  }

  // BKD-02 Department scoping
  let targetDepartment = null;
  if (user?.role === 'HOD') {
    targetDepartment = user.departmentId;
  } else if (query.department) {
    targetDepartment = query.department;
  }

  if (targetDepartment) {
    const [deptStudents, deptTeachers] = await Promise.all([
      Student.find({ department: targetDepartment }).select('_id'),
      Teacher.find({ department: targetDepartment }).select('_id'),
    ]);
    conditions.push({
      $or: [
        { student: { $in: deptStudents.map((s) => s._id) } },
        { teacher: { $in: deptTeachers.map((t) => t._id) } },
      ],
    });
  }

  const filter = conditions.length > 0 ? { $and: conditions } : {};

  const [leaves, total] = await Promise.all([
    LeaveApplication.find(filter)
      .populate('applicant', 'name email role phone')
      .populate({
        path: 'student',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
          { path: 'department', select: 'name code' },
        ],
      })
      .populate({
        path: 'teacher',
        populate: { path: 'user', select: 'name email phone' },
      })
      .populate({
        path: 'tg',
        populate: { path: 'user', select: 'name email phone' },
      })
      .populate('finalReview.reviewedBy', 'name email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    LeaveApplication.countDocuments(filter),
  ]);

  return {
    leaves,
    meta: buildPaginationMeta(total, page, limit),
  };
};

export const getAdminLeaveQueue = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {
    applicantRole: 'HOD',
    status: 'PENDING',
  };

  if (query.status && query.status !== 'ALL') {
    filter.status = query.status.toUpperCase();
  }

  const [leaves, total] = await Promise.all([
    LeaveApplication.find(filter)
      .populate('applicant', 'name email phone')
      .populate({
        path: 'teacher',
        populate: { path: 'user', select: 'name email' },
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: 1 }),
    LeaveApplication.countDocuments(filter),
  ]);

  return {
    leaves,
    meta: buildPaginationMeta(total, page, limit),
  };
};

export const getLeaveById = async (id, user) => {
  const leave = await LeaveApplication.findById(id)
    .populate('applicant', 'name email phone role profileImage')
    .populate({
      path: 'student',
      populate: [
        { path: 'user', select: 'name email phone' },
        { path: 'section', select: 'name code year semester' },
        { path: 'department', select: 'name code' },
      ],
    })
    .populate({
      path: 'teacher',
      populate: { path: 'user', select: 'name email phone' },
    })
    .populate({
      path: 'tg',
      populate: { path: 'user', select: 'name email phone' },
    })
    .populate('history.actor', 'name role')
    .populate('tgReview.reviewedBy', 'name role')
    .populate('finalReview.reviewedBy', 'name role');

  if (!leave) {
    throw ApiError.notFound('Leave application not found');
  }

  const isOwner = leave.applicant?._id?.toString() === user.id;
  const isTG = user.isTG && leave.tg?._id?.toString() === user.teacherId;
  const isHOD = user.role === 'HOD';
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isTG && !isHOD && !isAdmin) {
    throw ApiError.forbidden('You do not have permission to view this leave application');
  }

  return leave;
};

export const cancelLeave = async (id, user) => {
  const leave = await LeaveApplication.findById(id);
  if (!leave) {
    throw ApiError.notFound('Leave application not found');
  }

  if (leave.applicant.toString() !== user.id) {
    throw ApiError.forbidden('You can only cancel your own leave application');
  }

  if (leave.status !== 'PENDING') {
    throw ApiError.invalidStateTransition(
      `Cannot cancel leave in '${leave.status}' status. Only PENDING leaves can be cancelled.`
    );
  }

  const before = leave.toObject();
  const now = new Date();

  leave.status = 'CANCELLED';
  leave.history.push({
    status: 'CANCELLED',
    actor: user._id,
    actorRole: user.role,
    remarks: 'Cancelled by applicant',
    at: now,
    via: 'MANUAL',
  });
  await leave.save();

  await AuditLog.create({
    actor: user._id,
    action: 'CANCEL_LEAVE',
    entityType: 'LeaveApplication',
    entityId: leave._id,
    before,
    after: leave.toObject(),
  });

  emitRequestUpdated([`user_${user.id}`, 'role_HOD'], {
    kind: 'LEAVE',
    id: leave._id,
    status: 'CANCELLED',
  });
  if (leave.tg) {
    emitQueueChanged('TG', 'LEAVE');
  }

  return leave;
};

export const tgReviewLeave = async (id, user, { decision, remarks }) => {
  const leave = await LeaveApplication.findById(id);
  if (!leave) {
    throw ApiError.notFound('Leave application not found');
  }

  if (leave.applicantRole !== 'STUDENT') {
    throw ApiError.badRequest('TG review is only applicable for student leave applications');
  }

  if (!user.isTG || !user.teacherId || leave.tg?.toString() !== user.teacherId) {
    throw ApiError.forbidden('You are only authorized to review leaves from your assigned mentees');
  }

  if (leave.status !== 'PENDING') {
    throw ApiError.invalidStateTransition(`Cannot perform TG review on a leave in '${leave.status}' state`);
  }

  const before = leave.toObject();
  const now = new Date();
  const newStatus = decision === 'RECOMMEND' ? 'RECOMMENDED_BY_TG' : 'REJECTED';

  leave.status = newStatus;
  leave.tgReview = {
    remarks: remarks || '',
    reviewedAt: now,
    reviewedBy: user._id,
  };
  leave.history.push({
    status: newStatus,
    actor: user._id,
    actorRole: 'TG',
    remarks: remarks || (decision === 'RECOMMEND' ? 'Recommended by TG' : 'Rejected by TG'),
    at: now,
    via: 'MANUAL',
  });
  await leave.save();

  await AuditLog.create({
    actor: user._id,
    action: `TG_${decision}_LEAVE`,
    entityType: 'LeaveApplication',
    entityId: leave._id,
    before,
    after: leave.toObject(),
  });

  // Notify student
  const notif = await Notification.create({
    user: leave.applicant,
    title: decision === 'RECOMMEND' ? 'Leave Application Recommended by TG' : 'Leave Application Rejected by TG',
    message: decision === 'RECOMMEND'
      ? 'Your leave application was recommended by your Tutor Guardian and forwarded to the Head of Department.'
      : 'Your leave application was not recommended by your Tutor Guardian.',
    type: 'LEAVE',
    link: `/student/leaves/${leave._id}`,
  });
  emitNotification(leave.applicant.toString(), notif);

  // Send email notification to applicant
  try {
    const recipientUser = await User.findById(leave.applicant);
    if (recipientUser?.email) {
      sendStatusNotificationEmail(
        recipientUser.email,
        recipientUser.name,
        'Student Leave Application',
        newStatus.replace(/_/g, ' '),
        remarks || ''
      ).catch((err) => console.error('[Email Notification Error]:', err.message));
    }
  } catch (e) {
    console.error('[Email Dispatch Failed]:', e.message);
  }

  // If recommended, notify HOD
  if (decision === 'RECOMMEND') {
    const hodUsers = await User.find({ role: { $in: ['HOD', 'ADMIN'] }, isActive: true });
    for (const hod of hodUsers) {
      const hNotif = await Notification.create({
        user: hod._id,
        title: 'Student Leave Application Awaiting HOD Decision',
        message: 'Tutor Guardian recommended a student leave application.',
        type: 'LEAVE',
        link: `/hod/leaves/${leave._id}`,
      });
      emitNotification(hod._id.toString(), hNotif);
    }
    emitQueueChanged('HOD', 'LEAVE');
  }

  emitQueueChanged('TG', 'LEAVE');
  emitRequestUpdated([`user_${leave.applicant}`, 'role_HOD', `tg_${user.teacherId}`], {
    kind: 'LEAVE',
    id: leave._id,
    status: newStatus,
  });

  return leave;
};

export const finalReviewLeave = async (id, user, { decision, remarks }) => {
  const leave = await LeaveApplication.findById(id);
  if (!leave) {
    throw ApiError.notFound('Leave application not found');
  }

  // Prevent self-review
  if (leave.applicant.toString() === user.id) {
    throw ApiError.forbidden('You cannot review your own leave application');
  }

  // BKD-02: HOD department scope check
  if (user.role === 'HOD' && user.departmentId) {
    if (leave.applicantRole === 'STUDENT' && leave.student) {
      const student = await Student.findById(leave.student);
      if (student && student.department?.toString() !== user.departmentId) {
        throw ApiError.forbidden('You are only authorized to review leaves from your department');
      }
    } else if (leave.applicantRole === 'TEACHER' && leave.teacher) {
      const teacher = await Teacher.findById(leave.teacher);
      if (teacher && teacher.department?.toString() !== user.departmentId) {
        throw ApiError.forbidden('You are only authorized to review leaves from your department');
      }
    }
  }

  const before = leave.toObject();
  const now = new Date();
  let newStatus = '';

  if (leave.applicantRole === 'STUDENT') {
    // Only HOD or Admin
    if (user.role !== 'HOD' && user.role !== 'ADMIN') {
      throw ApiError.forbidden('Only HOD or Admin can perform final review on student leave');
    }
    // HOD or Admin can approve RECOMMENDED_BY_TG, PENDING (direct departmental review), APPLIED, or escalated
    const isEligible =
      leave.status === 'RECOMMENDED_BY_TG' ||
      leave.status === 'PENDING' ||
      leave.status === 'APPLIED' ||
      leave.escalated === true ||
      !leave.tg;
    if (!isEligible) {
      throw ApiError.invalidStateTransition(
        `Final review cannot be performed on student leave in '${leave.status}' status`
      );
    }
    newStatus = decision === 'APPROVE' ? 'APPROVED_BY_HOD' : 'REJECTED';
  } else if (leave.applicantRole === 'TEACHER') {
    // Decided by HOD or Admin
    if (user.role !== 'HOD' && user.role !== 'ADMIN') {
      throw ApiError.forbidden('Only HOD or Admin can approve faculty leave');
    }
    if (leave.status !== 'PENDING') {
      throw ApiError.invalidStateTransition(`Cannot review faculty leave in '${leave.status}' state`);
    }
    newStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  } else if (leave.applicantRole === 'HOD') {
    // Decided by Admin only
    if (user.role !== 'ADMIN') {
      throw ApiError.forbidden("Only Admin can approve HOD's leave application");
    }
    if (leave.status !== 'PENDING') {
      throw ApiError.invalidStateTransition(`Cannot review HOD leave in '${leave.status}' state`);
    }
    newStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  }

  leave.status = newStatus;
  leave.finalReview = {
    remarks: remarks || '',
    reviewedAt: now,
    reviewedBy: user._id,
  };
  leave.history.push({
    status: newStatus,
    actor: user._id,
    actorRole: user.role,
    remarks: remarks || `Leave ${decision.toLowerCase()}d by ${user.role}`,
    at: now,
    via: 'MANUAL',
  });
  await leave.save();

  await AuditLog.create({
    actor: user._id,
    action: `FINAL_${decision}_LEAVE`,
    entityType: 'LeaveApplication',
    entityId: leave._id,
    before,
    after: leave.toObject(),
  });

  // Notify applicant
  const notif = await Notification.create({
    user: leave.applicant,
    title: `Leave Application ${decision === 'APPROVE' ? 'Approved' : 'Rejected'}`,
    message: decision === 'APPROVE'
      ? 'Your leave application was approved by the Head of Department.'
      : 'Your leave application was rejected by the Head of Department.',
    type: 'LEAVE',
    link: `/student/leaves/${leave._id}`,
  });
  emitNotification(leave.applicant.toString(), notif);

  // Send email notification to applicant
  try {
    const recipientUser = await User.findById(leave.applicant);
    if (recipientUser?.email) {
      sendStatusNotificationEmail(
        recipientUser.email,
        recipientUser.name,
        'Leave Application',
        newStatus.replace(/_/g, ' '),
        remarks || ''
      ).catch((err) => console.error('[Email Notification Error]:', err.message));
    }
  } catch (e) {
    console.error('[Email Dispatch Failed]:', e.message);
  }

  // If student leave, notify TG
  if (leave.tg) {
    const tgTeacher = await Teacher.findById(leave.tg).populate('user');
    if (tgTeacher?.user) {
      const tgNotif = await Notification.create({
        user: tgTeacher.user._id,
        title: `HOD Decision: Student Leave ${decision === 'APPROVE' ? 'Approved' : 'Rejected'}`,
        message: `Head of Department ${decision === 'APPROVE' ? 'approved' : 'rejected'} student leave application.`,
        type: 'LEAVE',
        link: `/tg/leaves/${leave._id}`,
      });
      emitNotification(tgTeacher.user._id.toString(), tgNotif);
    }
  }

  emitQueueChanged('HOD', 'LEAVE');
  emitRequestUpdated([`user_${leave.applicant}`, 'role_HOD', ...(leave.tg ? [`tg_${leave.tg}`] : [])], {
    kind: 'LEAVE',
    id: leave._id,
    status: newStatus,
  });

  return leave;
};

export default {
  resolveApprovalChain,
  createLeave,
  getMyLeaves,
  getTGLeaveQueue,
  getHODLeaveQueue,
  getAdminLeaveQueue,
  getLeaveById,
  cancelLeave,
  tgReviewLeave,
  finalReviewLeave,
};
