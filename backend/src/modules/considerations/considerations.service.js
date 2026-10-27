import ConsiderationRequest from '../../models/ConsiderationRequest.js';
import Student from '../../models/Student.js';
import Teacher from '../../models/Teacher.js';
import MentorGroup from '../../models/MentorGroup.js';
import Section from '../../models/Section.js';
import Department from '../../models/Department.js';
import User from '../../models/User.js';
import Notification from '../../models/Notification.js';
import AuditLog from '../../models/AuditLog.js';
import SystemSetting from '../../models/SystemSetting.js';
import ApiError from '../../utils/ApiError.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { isEndDateGteStartDate, rangesOverlap, isWithinConsiderationWindow } from '../../utils/dates.js';
import { emitNotification, emitRequestUpdated, emitQueueChanged } from '../../sockets/emitters.js';
import { sendStatusNotificationEmail } from '../../utils/sendEmail.js';

export const resolveStudentTG = async (student) => {
  // 1. If student already has a mentor group, ensure it matches their section
  if (student.mentorGroup) {
    const group = await MentorGroup.findById(student.mentorGroup);
    if (group && group.isActive) {
      const matchesSection = !group.section || !student.section || group.section.toString() === student.section.toString();
      if (matchesSection) {
        return group.tg;
      }
    }
  }

  // 2. Find active MentorGroup specifically assigned to student's section
  if (student.section) {
    let sectionGroup = await MentorGroup.findOne({
      section: student.section,
      isActive: true,
    });

    if (!sectionGroup) {
      sectionGroup = await MentorGroup.findOne({ section: student.section });
      if (sectionGroup) {
        sectionGroup.isActive = true;
        await sectionGroup.save();
      }
    }

    if (sectionGroup) {
      student.mentorGroup = sectionGroup._id;
      await student.save();
      await MentorGroup.findByIdAndUpdate(sectionGroup._id, { $addToSet: { students: student._id } });
      return sectionGroup.tg;
    }
  }

  // DO NOT leak to another section's TG! If no TG is appointed, return null (direct HOD review)
  return null;
};

export const createConsideration = async (user, data, options = {}) => {
  if (user.role !== 'STUDENT') {
    throw ApiError.forbidden('Only students can submit consideration requests');
  }

  // Enforce Consideration Submission Window (default: 9:00 AM to 4:00 PM IST unless toggled OFF by Admin)
  const clock = options?.clock || new Date();
  const setting = await SystemSetting.findOne({ key: 'CONSIDERATION_TIME_LIMIT_ENABLED' });
  const isTimeLimitEnabled = setting !== null ? Boolean(setting.value) : true;
  const bypass = Boolean(
    options?.bypassWindowCheck ||
    !isTimeLimitEnabled ||
    process.env.BYPASS_CONSIDERATION_WINDOW === 'true'
  );
  if (!bypass && !isWithinConsiderationWindow(clock)) {
    throw ApiError.badRequest(
      'Consideration requests can only be submitted between 9:00 AM and 4:00 PM IST. The submission window is currently closed.'
    );
  }

  const student = await Student.findOne({ user: user.id });
  if (!student) {
    throw ApiError.notFound('Student profile not found');
  }

  if (!isEndDateGteStartDate(data.startDate, data.endDate)) {
    throw ApiError.badRequest('End date must be on or after start date');
  }

  // Check for duplicate / overlapping request with same eventTitle in non-terminal state
  const activeRequests = await ConsiderationRequest.find({
    student: student._id,
    eventTitle: { $regex: new RegExp(`^${data.eventTitle.trim()}$`, 'i') },
    status: { $in: ['PENDING', 'RECOMMENDED_BY_TG', 'APPROVED_BY_HOD'] },
  });

  for (const existing of activeRequests) {
    if (rangesOverlap(data.startDate, data.endDate, existing.startDate, existing.endDate)) {
      throw ApiError.conflict(
        `An active consideration request for event '${data.eventTitle}' already exists in an overlapping date range`
      );
    }
  }

  const isGroup = Boolean(data.isGroup) && Array.isArray(data.groupMembers) && data.groupMembers.length > 0;
  const timeFrom = data.timeFrom || '10:50 AM';
  const timeTo = data.timeTo || '01:20 PM';
  const periodTiming = data.periodTiming || `${timeFrom} - ${timeTo}`;

  if (!isGroup) {
    // Derive TG from student's active MentorGroup or auto-resolve
    const tgTeacherId = await resolveStudentTG(student);
    const initialStatus = tgTeacherId ? 'PENDING' : 'RECOMMENDED_BY_TG';

    const now = new Date();
    const request = await ConsiderationRequest.create({
      student: student._id,
      tg: tgTeacherId,
      eventTitle: data.eventTitle,
      eventType: data.eventType,
      organizer: data.organizer,
      venue: data.venue,
      startDate: data.startDate,
      endDate: data.endDate,
      timeFrom,
      timeTo,
      isGroup: false,
      requestedPeriods: data.requestedPeriods,
      selectedPeriods: data.selectedPeriods || [],
      periodTiming,
      description: data.description,
      attachments: data.attachments || [],
      status: initialStatus,
      history: [
        {
          status: initialStatus,
          actor: user._id,
          actorRole: 'STUDENT',
          remarks: tgTeacherId
            ? 'Application submitted'
            : 'Application submitted (No TG assigned to section; auto-routed to HOD review)',
          at: now,
          via: 'MANUAL',
        },
      ],
    });

    // Audit log
    await AuditLog.create({
      actor: user._id,
      action: 'CREATE_CONSIDERATION',
      entityType: 'ConsiderationRequest',
      entityId: request._id,
      after: request.toObject(),
    });

    // Notifications
    if (tgTeacherId) {
      const tgTeacher = await Teacher.findById(tgTeacherId).populate('user');
      if (tgTeacher?.user) {
        const notif = await Notification.create({
          user: tgTeacher.user._id,
          title: 'New Attendance Consideration Application',
          message: `${user.name} submitted an attendance consideration application for "${data.eventTitle}".`,
          type: 'CONSIDERATION',
          link: `/tg/considerations/${request._id}`,
        });
        emitNotification(tgTeacher.user._id.toString(), notif);
        emitQueueChanged('TG', 'CONSIDERATION');
      }
    } else {
      // If no TG assigned, notify HODs directly
      const hodUsers = await User.find({ role: { $in: ['HOD', 'ADMIN'] }, isActive: true });
      for (const hod of hodUsers) {
        const notif = await Notification.create({
          user: hod._id,
          title: 'New Attendance Consideration Application (Direct Review)',
          message: `${user.name} submitted an attendance consideration application (No TG assigned; routed directly for HOD review).`,
          type: 'CONSIDERATION',
          link: `/hod/considerations/${request._id}`,
        });
        emitNotification(hod._id.toString(), notif);
      }
      emitQueueChanged('HOD', 'CONSIDERATION');
    }

    // Always notify HOD queue so HOD Dashboard counter updates in real time
    emitQueueChanged('HOD', 'CONSIDERATION');

    return request;
  }

  // GROUP CONSIDERATION WORKFLOW
  const rawMemberIds = [student._id.toString(), ...(data.groupMembers || []).map((id) => id.toString())];
  const uniqueMemberIds = [...new Set(rawMemberIds)];
  const groupId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();

  const memberStudents = await Student.find({ _id: { $in: uniqueMemberIds } })
    .populate('user', 'name email phone')
    .populate('section', 'name code semester year');

  // Group members into section buckets (one request per section / TG)
  const sectionBuckets = new Map();

  for (const mStudent of memberStudents) {
    const isLeader = mStudent._id.toString() === student._id.toString();

    // Check duplicate active request
    const activeDup = await ConsiderationRequest.findOne({
      $or: [
        { student: mStudent._id },
        { sectionStudents: mStudent._id },
        { groupMembers: mStudent._id },
      ],
      eventTitle: { $regex: new RegExp(`^${data.eventTitle.trim()}$`, 'i') },
      status: { $in: ['PENDING', 'RECOMMENDED_BY_TG', 'APPROVED_BY_HOD'] },
    });
    if (activeDup && rangesOverlap(data.startDate, data.endDate, activeDup.startDate, activeDup.endDate)) {
      if (isLeader) {
        throw ApiError.conflict(
          `An active consideration request for event '${data.eventTitle}' already exists in an overlapping date range`
        );
      }
      continue;
    }

    const mTGTeacherId = await resolveStudentTG(mStudent);
    const bucketKey = mTGTeacherId
      ? mTGTeacherId.toString()
      : mStudent.section?._id
      ? mStudent.section._id.toString()
      : 'NO_TG';

    if (!sectionBuckets.has(bucketKey)) {
      sectionBuckets.set(bucketKey, {
        tgTeacherId: mTGTeacherId,
        sectionId: mStudent.section?._id,
        sectionName: mStudent.section?.name || mStudent.section?.code || 'General',
        semester: mStudent.section?.semester || mStudent.semester || 5,
        students: [],
        hasLeader: false,
      });
    }

    const bucket = sectionBuckets.get(bucketKey);
    bucket.students.push(mStudent);
    if (isLeader) {
      bucket.hasLeader = true;
    }
  }

  let leaderRequest = null;
  const createdRequests = [];

  // Create exactly ONE request per section/TG bucket!
  for (const [bucketKey, bucket] of sectionBuckets.entries()) {
    const isMasterBucket = bucket.hasLeader || (!leaderRequest && createdRequests.length === 0);
    const sectionRepresentative = bucket.hasLeader
      ? student
      : bucket.students[0];

    const sectionMemberIds = bucket.students.map((s) => s._id);
    const sectionStudentNames = bucket.students.map((s) => s.user?.name || s.rollNumber).join(', ');

    const secStatus = bucket.tgTeacherId ? 'PENDING' : 'RECOMMENDED_BY_TG';
    const secRemarks = bucket.tgTeacherId
      ? `Group consideration (${bucket.students.length} student(s) from ${bucket.sectionName}) submitted by team lead ${user.name}`
      : `Group consideration (${bucket.students.length} student(s) from ${bucket.sectionName}) submitted by team lead ${user.name} (No TG assigned to section; auto-routed to HOD review)`;

    const secRequest = await ConsiderationRequest.create({
      student: sectionRepresentative._id,
      tg: bucket.tgTeacherId,
      eventTitle: data.eventTitle,
      eventType: data.eventType,
      organizer: data.organizer,
      venue: data.venue,
      startDate: data.startDate,
      endDate: data.endDate,
      timeFrom,
      timeTo,
      isGroup: true,
      isGroupMaster: isMasterBucket,
      groupId,
      groupLeader: student._id,
      groupMembers: uniqueMemberIds,
      sectionStudents: sectionMemberIds,
      requestedPeriods: data.requestedPeriods,
      selectedPeriods: data.selectedPeriods || [],
      periodTiming,
      description: data.description,
      attachments: data.attachments || [],
      status: secStatus,
      history: [
        {
          status: secStatus,
          actor: user._id,
          actorRole: 'STUDENT',
          remarks: secRemarks,
          at: now,
          via: 'MANUAL',
        },
      ],
    });

    createdRequests.push(secRequest);
    if (isMasterBucket) {
      leaderRequest = secRequest;
    }

    // Send a SINGLE notification to the TG of this section!
    if (bucket.tgTeacherId) {
      const tgTeacher = await Teacher.findById(bucket.tgTeacherId).populate('user');
      if (tgTeacher?.user) {
        const notif = await Notification.create({
          user: tgTeacher.user._id,
          title: 'New Group Consideration Application',
          message: `${user.name} submitted a group consideration application for "${data.eventTitle}" with ${bucket.students.length} student(s) from your section (${sectionStudentNames}).`,
          type: 'CONSIDERATION',
          link: `/tg/considerations/${secRequest._id}`,
        });
        emitNotification(tgTeacher.user._id.toString(), notif);
      }
    }
  }

  // Ensure there is always a designated master request
  if (!leaderRequest && createdRequests.length > 0) {
    leaderRequest = createdRequests[0];
    leaderRequest.isGroupMaster = true;
    await leaderRequest.save();
  }

  // Notify member students (once each)
  for (const mStudent of memberStudents) {
    if (mStudent._id.toString() !== student._id.toString() && mStudent.user?._id) {
      const memNotif = await Notification.create({
        user: mStudent.user._id,
        title: 'Group Attendance Consideration Application',
        message: `${user.name} included you in a group consideration application for "${data.eventTitle}".`,
        type: 'CONSIDERATION',
        link: `/student/considerations`,
      });
      emitNotification(mStudent.user._id.toString(), memNotif);
    }
  }

  emitQueueChanged('TG', 'CONSIDERATION');
  emitQueueChanged('HOD', 'CONSIDERATION');

  // Notify HOD once about the new group submission
  const hodUsers = await User.find({ role: { $in: ['HOD', 'ADMIN'] }, isActive: true });
  for (const hod of hodUsers) {
    const notif = await Notification.create({
      user: hod._id,
      title: 'New Group Consideration Application',
      message: `${user.name} submitted a group consideration application for "${data.eventTitle}" (${uniqueMemberIds.length} students across ${sectionBuckets.size} section(s)).`,
      type: 'CONSIDERATION',
      link: `/hod/considerations`,
    });
    emitNotification(hod._id.toString(), notif);
  }

  return leaderRequest || createdRequests[0];
};

export const getStudentConsiderations = async (userId, query) => {
  const student = await Student.findOne({ user: userId });
  if (!student) {
    throw ApiError.notFound('Student profile not found');
  }

  const { page, limit, skip } = parsePagination(query);
  const filter = {
    $or: [
      { student: student._id },
      { sectionStudents: student._id },
      { groupMembers: student._id },
    ],
  };

  if (query.status) {
    const s = query.status.toUpperCase();
    if (s === 'APPROVED' || s === 'APPROVED_BY_HOD') {
      filter.status = { $in: ['APPROVED', 'APPROVED_BY_HOD'] };
    } else {
      filter.status = s;
    }
  }

  const [rawRequests, total] = await Promise.all([
    ConsiderationRequest.find(filter)
      .populate('tg', 'designation employeeId')
      .populate({
        path: 'student',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
        ],
      })
      .populate({
        path: 'groupMembers',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
        ],
      })
      .populate({
        path: 'sectionStudents',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
        ],
      })
      .populate({
        path: 'groupLeader',
        populate: [{ path: 'user', select: 'name email' }],
      })
      .populate({
        path: 'studentAudits.student',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
        ],
      })
      .populate('studentAudits.auditedBy', 'name role')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    ConsiderationRequest.countDocuments(filter),
  ]);

  // Deduplicate by groupId so each group consideration appears once
  const seenGroupIds = new Set();
  const requests = [];
  for (const req of rawRequests) {
    if (req.isGroup && req.groupId) {
      if (seenGroupIds.has(req.groupId)) continue;
      seenGroupIds.add(req.groupId);
    }
    requests.push(req);
  }

  return {
    requests,
    meta: buildPaginationMeta(requests.length, page, limit),
  };
};

export const getTGQueue = async (user, query) => {
  if (!user.isTG || !user.teacherId) {
    throw ApiError.forbidden('Only Tutor Guardians can access this review queue');
  }

  const { page, limit, skip } = parsePagination(query);

  // Scope strictly to students belonging to this TG's assigned sections
  const myGroups = await MentorGroup.find({ tg: user.teacherId, isActive: true });
  const mySectionIds = myGroups.map((g) => g.section).filter(Boolean);

  if (mySectionIds.length === 0) {
    return {
      requests: [],
      meta: buildPaginationMeta(0, page, limit),
    };
  }

  const myStudents = await Student.find({
    section: { $in: mySectionIds },
  }).select('_id');
  const myStudentIds = myStudents.map((s) => s._id);

  const filter = {
    $or: [
      { student: { $in: myStudentIds } },
      { sectionStudents: { $in: myStudentIds } },
    ],
  };

  if (query.status && query.status.toUpperCase() !== 'ALL') {
    filter.status = query.status.toUpperCase();
  } else if (!query.status && query.all !== 'true') {
    filter.status = 'PENDING';
  }

  const [requests, total] = await Promise.all([
    ConsiderationRequest.find(filter)
      .populate({
        path: 'student',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
        ],
      })
      .populate({
        path: 'groupMembers',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
        ],
      })
      .populate({
        path: 'sectionStudents',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
        ],
      })
      .populate({
        path: 'groupLeader',
        populate: [{ path: 'user', select: 'name email' }],
      })
      .populate({
        path: 'studentAudits.student',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
        ],
      })
      .populate('studentAudits.auditedBy', 'name role')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    ConsiderationRequest.countDocuments(filter),
  ]);

  return {
    requests,
    meta: buildPaginationMeta(total, page, limit),
  };
};

export const getHODQueue = async (query = {}, user = null) => {
  const { page, limit, skip } = parsePagination(query);
  const conditions = [];

  // For group considerations in HOD queue: only include master request so HOD sees a single request
  conditions.push({
    $or: [
      { isGroup: false },
      { isGroup: { $exists: false } },
      { isGroupMaster: true },
    ],
  });

  if (query.all === 'true' || query.status === 'ALL') {
    // Return all department records without restricting to action queue
  } else if (query.status === 'ACTION_NEEDED' || (!query.all && !query.status)) {
    conditions.push({
      $or: [
        { status: 'RECOMMENDED_BY_TG' },
        { status: 'PENDING' },
        { status: 'APPLIED' },
      ],
    });
  } else if (query.status === 'APPROVED' || query.status === 'APPROVED_BY_HOD') {
    conditions.push({ status: 'APPROVED_BY_HOD' });
  } else if (query.status === 'REJECTED') {
    conditions.push({ status: { $in: ['REJECTED', 'REJECTED_BY_HOD', 'REJECTED_BY_TG'] } });
  } else if (query.status) {
    conditions.push({ status: query.status.toUpperCase() });
  }

  if (query.type && query.type !== 'ALL') {
    conditions.push({ eventType: query.type.toUpperCase() });
  }

  // BKD-01 Department Scoping:
  let targetDepartment = null;
  if (user?.role === 'HOD') {
    targetDepartment = user.departmentId;
  } else if (query.department) {
    targetDepartment = query.department;
  }

  if (targetDepartment) {
    const deptStudents = await Student.find({ department: targetDepartment }).select('_id');
    conditions.push({ student: { $in: deptStudents.map((s) => s._id) } });
  }

  const filter = conditions.length > 0 ? { $and: conditions } : {};

  const [requests, total] = await Promise.all([
    ConsiderationRequest.find(filter)
      .populate({
        path: 'student',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
          { path: 'department', select: 'name code' },
        ],
      })
      .populate({
        path: 'groupMembers',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
          { path: 'department', select: 'name code' },
        ],
      })
      .populate({
        path: 'sectionStudents',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
        ],
      })
      .populate({
        path: 'groupLeader',
        populate: [{ path: 'user', select: 'name email' }],
      })
      .populate({
        path: 'tg',
        populate: { path: 'user', select: 'name email phone' },
      })
      .populate({
        path: 'studentAudits.student',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
        ],
      })
      .populate('studentAudits.auditedBy', 'name role')
      .populate('hodReview.reviewedBy', 'name email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    ConsiderationRequest.countDocuments(filter),
  ]);

  return {
    requests,
    meta: buildPaginationMeta(total, page, limit),
  };
};

export const getTGRecommendationsHistory = async (query = {}, user = null) => {
  const { page, limit, skip } = parsePagination(query);
  const conditions = [];

  // Deduplicate group considerations: only master request is returned
  conditions.push({
    $or: [
      { isGroup: false },
      { isGroup: { $exists: false } },
      { isGroupMaster: true },
    ],
  });

  // Department Scoping:
  let targetDepartment = null;
  if (user?.role === 'HOD') {
    targetDepartment = user.departmentId;
  } else if (query.department) {
    targetDepartment = query.department;
  }

  if (targetDepartment) {
    const deptStudents = await Student.find({ department: targetDepartment }).select('_id');
    conditions.push({ student: { $in: deptStudents.map((s) => s._id) } });
  }

  // Must have TG recommendation / approval (strictly excludes pending items not approved by TG, or items rejected by TG)
  conditions.push({
    $or: [
      { status: 'RECOMMENDED_BY_TG' },
      { 'history.status': 'RECOMMENDED_BY_TG' },
    ],
  });
  // Strictly exclude applications rejected by TG (i.e. not approved by TG)
  conditions.push({
    history: {
      $not: {
        $elemMatch: {
          status: 'REJECTED',
          actorRole: { $in: ['TG'] },
        },
      },
    },
  });

  // Status or history filter
  if (query.status && query.status !== 'ALL') {
    const s = query.status.toUpperCase();
    if (s === 'AWAITING_HOD' || s === 'RECOMMENDED_BY_TG') {
      conditions.push({ status: 'RECOMMENDED_BY_TG' });
    } else if (s === 'APPROVED' || s === 'APPROVED_BY_HOD') {
      conditions.push({ status: 'APPROVED_BY_HOD' });
    } else if (s === 'REJECTED') {
      conditions.push({ status: { $in: ['REJECTED', 'REJECTED_BY_HOD', 'REJECTED_BY_TG'] } });
    } else {
      conditions.push({ status: s });
    }
  }

  // Type filter
  if (query.type && query.type !== 'ALL') {
    conditions.push({ eventType: query.type.toUpperCase() });
  }

  const filter = conditions.length > 0 ? { $and: conditions } : {};

  const [requests, total] = await Promise.all([
    ConsiderationRequest.find(filter)
      .populate({
        path: 'student',
        populate: [
          { path: 'user', select: 'name email phone profileImage' },
          { path: 'section', select: 'name code year semester' },
          { path: 'department', select: 'name code' },
        ],
      })
      .populate({
        path: 'groupMembers',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
          { path: 'department', select: 'name code' },
        ],
      })
      .populate({
        path: 'sectionStudents',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
        ],
      })
      .populate({
        path: 'groupLeader',
        populate: [{ path: 'user', select: 'name email' }],
      })
      .populate({
        path: 'tg',
        populate: { path: 'user', select: 'name email phone' },
      })
      .populate('tgReview.reviewedBy', 'name email role')
      .populate('hodReview.reviewedBy', 'name email role')
      .populate({
        path: 'studentAudits.student',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'section', select: 'name code year semester' },
        ],
      })
      .populate('studentAudits.auditedBy', 'name role')
      .skip(skip)
      .limit(limit)
      .sort({ updatedAt: -1, createdAt: -1 }),
    ConsiderationRequest.countDocuments(filter),
  ]);

  return {
    requests,
    meta: buildPaginationMeta(total, page, limit),
  };
};

export const getConsiderationById = async (id, user) => {
  const request = await ConsiderationRequest.findById(id)
    .populate({
      path: 'student',
      populate: [
        { path: 'user', select: 'name email phone profileImage' },
        { path: 'section', select: 'name code year semester' },
        { path: 'department', select: 'name code' },
      ],
    })
    .populate({
      path: 'groupMembers',
      populate: [
        { path: 'user', select: 'name email phone profileImage' },
        { path: 'section', select: 'name code year semester' },
        { path: 'department', select: 'name code' },
      ],
    })
    .populate({
      path: 'sectionStudents',
      populate: [
        { path: 'user', select: 'name email phone profileImage' },
        { path: 'section', select: 'name code year semester' },
      ],
    })
    .populate({
      path: 'groupLeader',
      populate: [
        { path: 'user', select: 'name email' },
        { path: 'section', select: 'name code year semester' },
      ],
    })
    .populate({
      path: 'tg',
      populate: { path: 'user', select: 'name email phone' },
    })
    .populate('history.actor', 'name role')
    .populate({
      path: 'studentAudits.student',
      populate: [
        { path: 'user', select: 'name email phone' },
        { path: 'section', select: 'name code year semester' },
      ],
    })
    .populate('studentAudits.auditedBy', 'name role')
    .populate('tgReview.reviewedBy', 'name role')
    .populate('hodReview.reviewedBy', 'name role');

  if (!request) {
    throw ApiError.notFound('Consideration request not found');
  }

  // Authorization check
  const studentUserId = request.student?.user?._id?.toString() || request.student?.user?.toString();
  const groupMemberUserIds = (request.groupMembers || [])
    .map((m) => m?.user?._id?.toString() || m?.user?.toString())
    .filter(Boolean);
  const isOwner =
    user.role === 'STUDENT' &&
    (studentUserId === user.id || groupMemberUserIds.includes(user.id));
  const requestTgId = request.tg?._id?.toString() || request.tg?.toString();
  const isTG = Boolean(user.isTG && user.teacherId && requestTgId === user.teacherId.toString());
  const isHOD = user.role === 'HOD';
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isTG && !isHOD && !isAdmin) {
    throw ApiError.forbidden('You do not have permission to view this request');
  }

  return request;
};

export const cancelConsideration = async (id, user) => {
  const request = await ConsiderationRequest.findById(id).populate('student');
  if (!request) {
    throw ApiError.notFound('Consideration request not found');
  }

  const studentUserId = request.student?.user?._id?.toString() || request.student?.user?.toString();
  const studentDocId = request.student?._id?.toString() || request.student?.toString();
  const isOwner = (studentUserId && studentUserId === user.id) || 
                  (user.studentId && studentDocId === user.studentId) ||
                  (user.role === 'ADMIN');

  if (!isOwner) {
    throw ApiError.forbidden('You can only cancel your own consideration requests');
  }

  if (request.status !== 'PENDING') {
    throw ApiError.invalidStateTransition(
      `Cannot cancel request in '${request.status}' status. Only PENDING requests can be cancelled.`
    );
  }

  const before = request.toObject();
  const now = new Date();

  request.status = 'CANCELLED';
  request.history.push({
    status: 'CANCELLED',
    actor: user._id,
    actorRole: 'STUDENT',
    remarks: 'Cancelled by student',
    at: now,
    via: 'MANUAL',
  });
  await request.save();

  await AuditLog.create({
    actor: user._id,
    action: 'CANCEL_CONSIDERATION',
    entityType: 'ConsiderationRequest',
    entityId: request._id,
    before,
    after: request.toObject(),
  });

  emitRequestUpdated([`user_${user.id}`, `role_HOD`], {
    kind: 'CONSIDERATION',
    id: request._id,
    status: 'CANCELLED',
  });
  if (request.tg) {
    emitQueueChanged('TG', 'CONSIDERATION');
  }

  return request;
};

export const tgReview = async (id, user, { decision, remarks }) => {
  const request = await ConsiderationRequest.findById(id).populate('student');
  if (!request) {
    throw ApiError.notFound('Consideration request not found');
  }

  if (!user.isTG || !user.teacherId) {
    throw ApiError.forbidden('You are only authorized to review requests from your assigned mentees');
  }

  const myGroups = await MentorGroup.find({ tg: user.teacherId, isActive: true });
  const mySectionIds = myGroups.map((g) => g.section?.toString()).filter(Boolean);
  const studentSecId = (request.student?.section?._id || request.student?.section)?.toString();

  const isAssignedSection = studentSecId && mySectionIds.includes(studentSecId);
  if (!isAssignedSection && request.tg?.toString() !== user.teacherId) {
    throw ApiError.forbidden('You are only authorized to review requests from your assigned mentees');
  }
  if (!isAssignedSection) {
    throw ApiError.forbidden('You are only authorized to review requests from students in your assigned section');
  }

  if (request.status !== 'PENDING') {
    throw ApiError.invalidStateTransition(`Cannot perform TG review on a request in '${request.status}' state`);
  }

  const before = request.toObject();
  const now = new Date();
  const newStatus = decision === 'RECOMMEND' ? 'RECOMMENDED_BY_TG' : 'REJECTED';

  request.status = newStatus;
  request.tgReview = {
    decision,
    remarks: remarks || '',
    reviewedAt: now,
    reviewedBy: user._id,
  };
  request.history.push({
    status: newStatus,
    actor: user._id,
    actorRole: 'TG',
    remarks: remarks || (decision === 'RECOMMEND' ? 'Recommended by TG' : 'Rejected by TG'),
    at: now,
    via: 'MANUAL',
  });
  await request.save();

  await AuditLog.create({
    actor: user._id,
    action: `TG_${decision}_CONSIDERATION`,
    entityType: 'ConsiderationRequest',
    entityId: request._id,
    before,
    after: request.toObject(),
  });

  // Notify student(s)
  const sectionStudentIds = (request.isGroup && request.sectionStudents?.length)
    ? request.sectionStudents
    : [request.student?._id || request.student];

  const studentsToNotify = await Student.find({ _id: { $in: sectionStudentIds } }).populate('user');
  for (const s of studentsToNotify) {
    const sUser = s.user;
    if (sUser?._id) {
      const notif = await Notification.create({
        user: sUser._id,
        title: decision === 'RECOMMEND' ? 'Attendance Consideration Recommended by TG' : 'Attendance Consideration Rejected by TG',
        message: decision === 'RECOMMEND'
          ? `Your attendance consideration application for "${request.eventTitle}" was recommended by your Tutor Guardian and forwarded to the Head of Department.`
          : `Your attendance consideration application for "${request.eventTitle}" was not recommended by your Tutor Guardian.`,
        type: 'CONSIDERATION',
        link: `/student/considerations`,
      });
      emitNotification(sUser._id.toString(), notif);

      // Send email notification to student
      try {
        if (sUser.email) {
          sendStatusNotificationEmail(
            sUser.email,
            sUser.name,
            'Attendance Consideration Request',
            newStatus.replace(/_/g, ' '),
            remarks || ''
          ).catch((err) => console.error('[Email Notification Error]:', err.message));
        }
      } catch (e) {
        console.error('[Email Dispatch Failed]:', e.message);
      }

      emitRequestUpdated([`user_${sUser._id}`], {
        kind: 'CONSIDERATION',
        id: request._id,
        status: newStatus,
      });
    }
  }

  // If this is a group section request and recommended, update the master request if still PENDING
  if (request.isGroup && request.groupId && decision === 'RECOMMEND' && !request.isGroupMaster) {
    const masterReq = await ConsiderationRequest.findOne({ groupId: request.groupId, isGroupMaster: true });
    if (masterReq && masterReq.status === 'PENDING') {
      masterReq.status = 'RECOMMENDED_BY_TG';
      masterReq.history.push({
        status: 'RECOMMENDED_BY_TG',
        actor: user._id,
        actorRole: 'TG',
        remarks: `Recommended by TG for section students`,
        at: now,
        via: 'MANUAL',
      });
      await masterReq.save();
    }
  }

  // If recommended, notify HOD
  if (decision === 'RECOMMEND') {
    const hodUsers = await User.find({ role: { $in: ['HOD', 'ADMIN'] }, isActive: true });
    for (const hod of hodUsers) {
      const notif = await Notification.create({
        user: hod._id,
        title: 'Attendance Consideration Awaiting HOD Approval',
        message: `Tutor Guardian recommended attendance consideration application for "${request.eventTitle}".`,
        type: 'CONSIDERATION',
        link: `/hod/considerations/${request._id}`,
      });
      emitNotification(hod._id.toString(), notif);
    }
    emitQueueChanged('HOD', 'CONSIDERATION');
  }

  emitQueueChanged('TG', 'CONSIDERATION');
  emitRequestUpdated(['role_HOD', `tg_${user.teacherId}`], {
    kind: 'CONSIDERATION',
    id: request._id,
    status: newStatus,
  });

  return request;
};

export const hodReview = async (id, user, { decision, remarks, approvedPeriods }) => {
  const request = await ConsiderationRequest.findById(id).populate('student');
  if (!request) {
    throw ApiError.notFound('Consideration request not found');
  }

  // Prevent self-review (applicant == reviewer)
  if (request.student?.user?.toString() === user.id) {
    throw ApiError.forbidden('You cannot review your own request');
  }

  // BKD-01 / FLAW-AUTH-05: HOD can strictly only review requests from their assigned department
  if (user.role === 'HOD') {
    if (!user.departmentId) {
      throw ApiError.forbidden('Head of Department account has no assigned department');
    }
    const studentDept = request.student?.department?.toString();
    if (studentDept && studentDept !== user.departmentId.toString()) {
      throw ApiError.forbidden('You are only authorized to review requests from your department');
    }
  }

  // Allowed transitions: HOD can review RECOMMENDED_BY_TG, PENDING (direct approval/override), APPLIED, or escalated
  const isEligible =
    request.status === 'RECOMMENDED_BY_TG' ||
    request.status === 'PENDING' ||
    request.status === 'APPLIED' ||
    request.escalated === true ||
    !request.tg;
  if (!isEligible) {
    throw ApiError.invalidStateTransition(
      `HOD review cannot be performed on a request in '${request.status}' state`
    );
  }

  if (decision === 'APPROVE') {
    if (!approvedPeriods || approvedPeriods < 1 || approvedPeriods > request.requestedPeriods) {
      approvedPeriods = request.requestedPeriods || 1;
    }
  }

  const before = request.toObject();
  const now = new Date();
  const newStatus = decision === 'APPROVE' ? 'APPROVED_BY_HOD' : 'REJECTED';

  request.status = newStatus;
  request.hodReview = {
    remarks: remarks || '',
    reviewedAt: now,
    reviewedBy: user._id,
    ...(decision === 'APPROVE' ? { approvedPeriods } : {}),
  };
  request.history.push({
    status: newStatus,
    actor: user._id,
    actorRole: user.role,
    remarks: remarks || (decision === 'APPROVE' ? `Approved with ${approvedPeriods} periods` : 'Rejected by HOD'),
    at: now,
    via: 'MANUAL',
  });
  await request.save();

  // If this is a group request, synchronize status to all linked section requests with the same groupId!
  if (request.isGroup && request.groupId) {
    await ConsiderationRequest.updateMany(
      { groupId: request.groupId, _id: { $ne: request._id } },
      {
        $set: {
          status: newStatus,
          hodReview: request.hodReview,
        },
        $push: {
          history: {
            status: newStatus,
            actor: user._id,
            actorRole: user.role,
            remarks: remarks || (decision === 'APPROVE' ? `Approved with ${approvedPeriods} periods (Group)` : 'Rejected by HOD (Group)'),
            at: now,
            via: 'MANUAL',
          },
        },
      }
    );
  }

  await AuditLog.create({
    actor: user._id,
    action: `HOD_${decision}_CONSIDERATION`,
    entityType: 'ConsiderationRequest',
    entityId: request._id,
    before,
    after: request.toObject(),
  });

  // Notify ALL participating group members
  const memberStudentIds = (request.isGroup && request.groupMembers?.length)
    ? request.groupMembers
    : [request.student?._id || request.student];

  const studentsToNotify = await Student.find({ _id: { $in: memberStudentIds } }).populate('user');
  for (const s of studentsToNotify) {
    const sUser = s.user;
    if (sUser?._id) {
      const notif = await Notification.create({
        user: sUser._id,
        title: decision === 'APPROVE' ? 'Attendance Consideration Approved by HOD' : 'Attendance Consideration Rejected by HOD',
        message: decision === 'APPROVE'
          ? `Your${request.isGroup ? ' group' : ''} attendance consideration application for "${request.eventTitle}" was approved by the Head of Department (${approvedPeriods} lecture${approvedPeriods === 1 ? '' : 's'} sanctioned).`
          : `Your${request.isGroup ? ' group' : ''} attendance consideration application for "${request.eventTitle}" was rejected by the Head of Department.`,
        type: 'CONSIDERATION',
        link: `/student/considerations`,
      });
      emitNotification(sUser._id.toString(), notif);

      // Send email notification to student
      try {
        if (sUser.email) {
          sendStatusNotificationEmail(
            sUser.email,
            sUser.name,
            `${request.isGroup ? 'Group ' : ''}Attendance Consideration Request`,
            newStatus.replace(/_/g, ' '),
            remarks || ''
          ).catch((err) => console.error('[Email Notification Error]:', err.message));
        }
      } catch (e) {
        console.error('[Email Dispatch Failed]:', e.message);
      }

      emitRequestUpdated([`user_${sUser._id}`], {
        kind: 'CONSIDERATION',
        id: request._id,
        status: newStatus,
      });
    }
  }

  // Notify all TGs involved across all section requests in this group
  const allGroupTgIds = (request.isGroup && request.groupId)
    ? (await ConsiderationRequest.find({ groupId: request.groupId }).distinct('tg')).filter(Boolean)
    : (request.tg ? [request.tg] : []);

  for (const tgId of allGroupTgIds) {
    const tgTeacher = await Teacher.findById(tgId).populate('user');
    if (tgTeacher?.user) {
      const notif = await Notification.create({
        user: tgTeacher.user._id,
        title: `HOD Decision: Attendance Consideration ${decision === 'APPROVE' ? 'Approved' : 'Rejected'}`,
        message: `Head of Department completed final review on "${request.eventTitle}" (${decision === 'APPROVE' ? 'Approved' : 'Rejected'}).`,
        type: 'CONSIDERATION',
        link: `/tg/considerations`,
      });
      emitNotification(tgTeacher.user._id.toString(), notif);
      emitRequestUpdated([`tg_${tgId}`], {
        kind: 'CONSIDERATION',
        id: request._id,
        status: newStatus,
      });
    }
  }

  emitQueueChanged('HOD', 'CONSIDERATION');
  emitQueueChanged('TG', 'CONSIDERATION');

  return request;
};

export const auditGroupStudent = async (id, user, { studentId, status, remarks }) => {
  const request = await ConsiderationRequest.findById(id)
    .populate('student')
    .populate({
      path: 'groupMembers',
      populate: { path: 'user', select: 'name email' },
    })
    .populate({
      path: 'sectionStudents',
      populate: { path: 'user', select: 'name email' },
    });

  if (!request) {
    throw ApiError.notFound('Consideration request not found');
  }

  if (!request.isGroup) {
    throw ApiError.badRequest('Audit is only available for group consideration applications');
  }

  // Authorization check
  const isTG = Boolean(user.isTG && user.teacherId && request.tg?.toString() === user.teacherId.toString());
  const isHOD = user.role === 'HOD';
  const isAdmin = user.role === 'ADMIN';

  if (!isTG && !isHOD && !isAdmin) {
    throw ApiError.forbidden('You are not authorized to audit students for this application');
  }

  if (isTG && !isHOD && !isAdmin) {
    const myGroups = await MentorGroup.find({ tg: user.teacherId, isActive: true });
    const mySectionIds = myGroups.map((g) => g.section?.toString()).filter(Boolean);
    const targetStudent = await Student.findById(studentId);
    const targetSecId = (targetStudent?.section?._id || targetStudent?.section)?.toString();
    if (!targetSecId || !mySectionIds.includes(targetSecId)) {
      throw ApiError.forbidden('You are only authorized to audit students from your assigned section');
    }
  }

  // Valid members check
  const validMemberIds = [
    ...(request.groupMembers || []).map((m) => (m._id || m).toString()),
    ...(request.sectionStudents || []).map((s) => (s._id || s).toString()),
    (request.student?._id || request.student).toString(),
  ];

  if (!validMemberIds.includes(studentId.toString())) {
    throw ApiError.badRequest('The specified student is not part of this group application');
  }

  // Fetch student info for remarks & history
  const studentDoc = await Student.findById(studentId).populate('user', 'name');
  const studentName = studentDoc?.user?.name || studentDoc?.rollNumber || 'Student';

  const now = new Date();
  const auditStatus = status === 'EXCLUDED' ? 'EXCLUDED' : 'VERIFIED';
  const auditRemarks = remarks || (auditStatus === 'EXCLUDED' ? 'Excluded during audit' : 'Verified during audit');

  if (!Array.isArray(request.studentAudits)) {
    request.studentAudits = [];
  }

  const existingIdx = request.studentAudits.findIndex(
    (a) => (a.student?._id || a.student).toString() === studentId.toString()
  );

  const auditRole = user.isTG ? 'TG' : (user.role || 'TEACHER');
  const auditEntry = {
    student: studentId,
    status: auditStatus,
    auditedBy: user._id,
    auditedByRole: auditRole,
    auditedAt: now,
    remarks: auditRemarks,
  };

  if (existingIdx >= 0) {
    request.studentAudits[existingIdx] = auditEntry;
  } else {
    request.studentAudits.push(auditEntry);
  }

  // Remove from or restore to groupMembers and sectionStudents
  if (auditStatus === 'EXCLUDED') {
    request.groupMembers = (request.groupMembers || []).filter(
      (m) => (m._id || m).toString() !== studentId.toString()
    );
    if (Array.isArray(request.sectionStudents)) {
      request.sectionStudents = request.sectionStudents.filter(
        (s) => (s._id || s).toString() !== studentId.toString()
      );
    }
  } else if (auditStatus === 'VERIFIED') {
    const sIdStr = studentId.toString();
    const isPresent = (request.groupMembers || []).some(
      (m) => (m._id || m).toString() === sIdStr
    );
    if (!isPresent && (request.student?._id || request.student)?.toString() !== sIdStr) {
      request.groupMembers.push(studentId);
    }
    if (Array.isArray(request.sectionStudents)) {
      const isSecPresent = request.sectionStudents.some(
        (s) => (s._id || s).toString() === sIdStr
      );
      if (!isSecPresent) {
        request.sectionStudents.push(studentId);
      }
    }
  }

  request.history.push({
    status: request.status,
    actor: user._id,
    actorRole: user.role,
    remarks: `Group Audit: ${studentName} was ${auditStatus === 'EXCLUDED' ? 'EXCLUDED from' : 'VERIFIED for'} consideration by ${user.role} (${auditRemarks})`,
    at: now,
    via: 'MANUAL',
  });

  await request.save();

  // If this group application has linked requests across sections (same groupId), synchronize the student audit and membership!
  if (request.groupId) {
    await ConsiderationRequest.updateMany(
      { groupId: request.groupId, _id: { $ne: request._id } },
      {
        $pull: { studentAudits: { student: studentId } },
      }
    );
    if (auditStatus === 'EXCLUDED') {
      await ConsiderationRequest.updateMany(
        { groupId: request.groupId },
        {
          $pull: {
            groupMembers: studentId,
            sectionStudents: studentId,
          },
        }
      );
    } else if (auditStatus === 'VERIFIED') {
      await ConsiderationRequest.updateMany(
        { groupId: request.groupId, isGroupMaster: true },
        {
          $addToSet: {
            groupMembers: studentId,
          },
        }
      );
    }
    await ConsiderationRequest.updateMany(
      { groupId: request.groupId, _id: { $ne: request._id } },
      {
        $push: {
          studentAudits: auditEntry,
          history: {
            status: request.status,
            actor: user._id,
            actorRole: user.role,
            remarks: `Group Audit: ${studentName} was ${auditStatus === 'EXCLUDED' ? 'EXCLUDED from' : 'VERIFIED for'} consideration by ${user.role} (${auditRemarks})`,
            at: now,
            via: 'MANUAL',
          },
        },
      }
    );
  }

  await AuditLog.create({
    actor: user._id,
    action: `AUDIT_GROUP_STUDENT_${auditStatus}`,
    entityType: 'ConsiderationRequest',
    entityId: request._id,
    after: { studentId, status: auditStatus, remarks: auditRemarks },
  });

  emitQueueChanged('TG', 'CONSIDERATION');
  emitQueueChanged('HOD', 'CONSIDERATION');
  if (studentDoc?.user?._id) {
    emitRequestUpdated([`user_${studentDoc.user._id}`, 'role_HOD'], {
      kind: 'CONSIDERATION',
      id: request._id,
      studentAudits: request.studentAudits,
    });
  }

  return getConsiderationById(request._id, user);
};

export const auditAllGroupStudents = async (id, user, { status = 'VERIFIED', remarks }) => {
  const request = await ConsiderationRequest.findById(id).populate('student');
  if (!request) {
    throw ApiError.notFound('Consideration request not found');
  }
  if (!request.isGroup) {
    throw ApiError.badRequest('Audit is only available for group consideration applications');
  }

  const isTG = Boolean(user.isTG && user.teacherId && request.tg?.toString() === user.teacherId.toString());
  const isHOD = user.role === 'HOD';
  const isAdmin = user.role === 'ADMIN';

  if (!isTG && !isHOD && !isAdmin) {
    throw ApiError.forbidden('You are not authorized to audit students for this application');
  }

  const targetStudentIds = (isTG && request.sectionStudents?.length > 0)
    ? request.sectionStudents
    : [
        request.student?._id || request.student,
        ...(request.groupMembers || []),
      ];

  let uniqueTargetIds = [...new Set(targetStudentIds.map((s) => (s._id || s).toString()))];

  if (isTG && !isHOD && !isAdmin) {
    const myGroups = await MentorGroup.find({ tg: user.teacherId, isActive: true });
    const mySectionIds = myGroups.map((g) => g.section?.toString()).filter(Boolean);
    const validStudents = await Student.find({
      _id: { $in: uniqueTargetIds },
      section: { $in: mySectionIds },
    }).select('_id');
    const validIdSet = new Set(validStudents.map((s) => s._id.toString()));
    uniqueTargetIds = uniqueTargetIds.filter((id) => validIdSet.has(id));
  }
  const now = new Date();
  const auditStatus = status === 'EXCLUDED' ? 'EXCLUDED' : 'VERIFIED';
  const auditRemarks = remarks || (auditStatus === 'EXCLUDED' ? 'All excluded during audit' : 'All verified during audit');

  if (!Array.isArray(request.studentAudits)) {
    request.studentAudits = [];
  }

  for (const sId of uniqueTargetIds) {
    const existingIdx = request.studentAudits.findIndex(
      (a) => (a.student?._id || a.student).toString() === sId
    );
    const auditRole = user.isTG ? 'TG' : (user.role || 'TEACHER');
    const auditEntry = {
      student: sId,
      status: auditStatus,
      auditedBy: user._id,
      auditedByRole: auditRole,
      auditedAt: now,
      remarks: auditRemarks,
    };
    if (existingIdx >= 0) {
      request.studentAudits[existingIdx] = auditEntry;
    } else {
      request.studentAudits.push(auditEntry);
    }
  }

  request.history.push({
    status: request.status,
    actor: user._id,
    actorRole: user.role,
    remarks: `Group Audit: All ${uniqueTargetIds.length} student(s) marked as ${auditStatus} by ${user.role}`,
    at: now,
    via: 'MANUAL',
  });

  await request.save();

  if (request.groupId) {
    await ConsiderationRequest.updateMany(
      { groupId: request.groupId, _id: { $ne: request._id } },
      {
        $set: { studentAudits: request.studentAudits },
      }
    );
  }

  emitQueueChanged('TG', 'CONSIDERATION');
  emitQueueChanged('HOD', 'CONSIDERATION');

  return getConsiderationById(request._id, user);
};

export default {
  createConsideration,
  getStudentConsiderations,
  getTGQueue,
  getHODQueue,
  getTGRecommendationsHistory,
  getConsiderationById,
  cancelConsideration,
  tgReview,
  hodReview,
  auditGroupStudent,
  auditAllGroupStudents,
};
