import ExcelJS from 'exceljs';
import ConsiderationRequest from '../../models/ConsiderationRequest.js';
import LeaveApplication from '../../models/LeaveApplication.js';
import Student from '../../models/Student.js';
import Teacher from '../../models/Teacher.js';
import MentorGroup from '../../models/MentorGroup.js';
import Section from '../../models/Section.js';
import Department from '../../models/Department.js';
import User from '../../models/User.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { getTodayIST } from '../../utils/dates.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getDashboardSummary = async (user) => {
  const role = user.role;
  const todayIST = getTodayIST();

  if (role === 'STUDENT') {
    const student = await Student.findOne({ user: user.id });
    const studentId = student?._id;

    const studentConsiderationFilter = studentId
      ? {
          $or: [
            { student: studentId },
            { sectionStudents: studentId },
            { groupMembers: studentId },
          ],
        }
      : { student: null };

    const [
      totalConsiderations,
      pendingConsiderations,
      approvedConsiderations,
      totalLeaves,
      pendingLeaves,
      approvedLeaves,
      approvedConsiderationDocs,
      pendingConsiderationDocs,
      approvedLeaveDocs,
      pendingLeaveDocs,
    ] = await Promise.all([
      ConsiderationRequest.countDocuments(studentConsiderationFilter),
      ConsiderationRequest.countDocuments({
        ...studentConsiderationFilter,
        status: { $in: ['PENDING', 'RECOMMENDED_BY_TG'] },
      }),
      ConsiderationRequest.countDocuments({
        ...studentConsiderationFilter,
        status: 'APPROVED_BY_HOD',
      }),
      LeaveApplication.countDocuments({ applicant: user._id }),
      LeaveApplication.countDocuments({
        applicant: user._id,
        status: { $in: ['PENDING', 'RECOMMENDED_BY_TG'] },
      }),
      LeaveApplication.countDocuments({
        applicant: user._id,
        status: { $in: ['APPROVED_BY_HOD', 'APPROVED'] },
      }),
      ConsiderationRequest.find({
        ...studentConsiderationFilter,
        status: 'APPROVED_BY_HOD',
      }).select('requestedPeriods hodReview.approvedPeriods'),
      ConsiderationRequest.find({
        ...studentConsiderationFilter,
        status: { $in: ['PENDING', 'RECOMMENDED_BY_TG'] },
      }).select('requestedPeriods'),
      LeaveApplication.find({
        applicant: user._id,
        status: { $in: ['APPROVED_BY_HOD', 'APPROVED'] },
      }).select('totalDays'),
      LeaveApplication.find({
        applicant: user._id,
        status: { $in: ['PENDING', 'RECOMMENDED_BY_TG'] },
      }).select('totalDays'),
    ]);

    const approvedLectures = approvedConsiderationDocs.reduce(
      (sum, r) => sum + (r.hodReview?.approvedPeriods ?? r.requestedPeriods ?? 0),
      0
    );

    const pendingLectures = pendingConsiderationDocs.reduce(
      (sum, r) => sum + (r.requestedPeriods ?? 0),
      0
    );

    const approvedDays = approvedLeaveDocs.reduce(
      (sum, l) => sum + (l.totalDays || 0),
      0
    );

    const pendingDays = (pendingLeaveDocs || []).reduce(
      (sum, l) => sum + (l.totalDays || 0),
      0
    );

    return {
      role: 'STUDENT',
      considerations: {
        total: totalConsiderations,
        pending: pendingConsiderations,
        approved: approvedConsiderations,
        approvedLectures,
        pendingLectures,
      },
      leaves: {
        total: totalLeaves,
        pending: pendingLeaves,
        approved: approvedLeaves,
        approvedDays,
        pendingDays,
      },
    };
  }

  if (user.isTG) {
    const teacherId = user.teacherId;
    const activeGroup = await MentorGroup.findOne({ tg: teacherId, isActive: true });
    const sectionId = activeGroup?.section;
    const myStudents = sectionId ? await Student.find({ section: sectionId }).select('_id') : [];
    const myStudentIds = myStudents.map((s) => s._id);

    const [
      pendingConsiderations,
      pendingLeaves,
    ] = await Promise.all([
      ConsiderationRequest.countDocuments({
        status: 'PENDING',
        $or: [{ student: { $in: myStudentIds } }, { sectionStudents: { $in: myStudentIds } }],
      }),
      LeaveApplication.countDocuments({
        status: 'PENDING',
        applicantRole: 'STUDENT',
        student: { $in: myStudentIds },
      }),
    ]);

    return {
      role: 'TG',
      pendingConsiderations,
      pendingLeaves,
      totalMentees: myStudentIds.length,
    };
  }

  if (role === 'HOD' || role === 'ADMIN') {
    const isHod = role === 'HOD';
    const deptId = isHod ? user.departmentId : null;

    let studentIds = null;
    let teacherIds = null;
    if (deptId) {
      const [deptStudents, deptTeachers] = await Promise.all([
        Student.find({ department: deptId }).select('_id'),
        Teacher.find({ department: deptId }).select('_id'),
      ]);
      studentIds = deptStudents.map((s) => s._id);
      teacherIds = deptTeachers.map((t) => t._id);
    }

    const consFilter = (base) => {
      if (studentIds) {
        return { ...base, student: { $in: studentIds } };
      }
      return base;
    };

    const studentLeaveFilter = (base) => {
      if (studentIds) {
        return { ...base, applicantRole: 'STUDENT', student: { $in: studentIds } };
      }
      return { ...base, applicantRole: 'STUDENT' };
    };

    const teacherLeaveFilter = (base) => {
      if (teacherIds) {
        return { ...base, applicantRole: 'TEACHER', teacher: { $in: teacherIds } };
      }
      return { ...base, applicantRole: 'TEACHER' };
    };

    const studentAggPipeline = [];
    if (deptId) {
      studentAggPipeline.push({ $match: { department: deptId } });
    }
    studentAggPipeline.push(
      { $group: { _id: '$semester', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    );

    const [
      pendingConsiderations,
      escalatedConsiderations,
      pendingStudentLeaves,
      escalatedLeaves,
      pendingFacultyLeaves,
      pendingHodLeaves,
      onLeaveTodayCount,
      semesterAggregation,
      totalStudentsCount,
      totalTeachersCount,
      totalUsersCount,
    ] = await Promise.all([
      ConsiderationRequest.countDocuments(consFilter({ status: { $in: ['RECOMMENDED_BY_TG', 'PENDING'] } })),
      ConsiderationRequest.countDocuments(consFilter({ status: 'PENDING', escalated: true })),
      LeaveApplication.countDocuments(studentLeaveFilter({ status: 'RECOMMENDED_BY_TG' })),
      LeaveApplication.countDocuments(studentLeaveFilter({ status: 'PENDING', escalated: true })),
      LeaveApplication.countDocuments(teacherLeaveFilter({ status: 'PENDING' })),
      LeaveApplication.countDocuments(deptId ? { applicantRole: 'HOD', status: 'PENDING', department: deptId } : { applicantRole: 'HOD', status: 'PENDING' }),
      LeaveApplication.countDocuments(teacherLeaveFilter({
        status: 'APPROVED',
        startDate: { $lte: todayIST },
        endDate: { $gte: todayIST },
      })),
      Student.aggregate(studentAggPipeline),
      Student.countDocuments(deptId ? { department: deptId } : {}),
      Teacher.countDocuments(deptId ? { department: deptId } : {}),
      User.countDocuments(deptId ? { departmentId: deptId } : {}),
    ]);

    return {
      role,
      considerationsQueue: pendingConsiderations + escalatedConsiderations,
      escalatedConsiderations,
      studentLeavesQueue: pendingStudentLeaves + escalatedLeaves,
      escalatedLeaves,
      facultyLeavesQueue: pendingFacultyLeaves,
      hodLeavesQueue: pendingHodLeaves,
      facultyOnLeaveToday: onLeaveTodayCount,
      semesterDistribution: semesterAggregation,
      totalStudents: totalStudentsCount,
      totalTeachers: totalTeachersCount,
      totalUsers: totalUsersCount,
    };
  }

  // Teacher fallback
  const [myLeavesTotal, myLeavesPending] = await Promise.all([
    LeaveApplication.countDocuments({ applicant: user._id }),
    LeaveApplication.countDocuments({ applicant: user._id, status: 'PENDING' }),
  ]);

  return {
    role: 'TEACHER',
    leaves: {
      total: myLeavesTotal,
      pending: myLeavesPending,
    },
  };
};

const formatStatus = (status) => {
  const map = {
    PENDING: 'Pending',
    RECOMMENDED_BY_TG: 'Recommended by TG',
    APPROVED_BY_HOD: 'Approved by HOD',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    REJECTED_BY_HOD: 'Rejected by HOD',
    REJECTED_BY_TG: 'Rejected by TG',
    CANCELLED: 'Cancelled',
  };
  return map[status] || status || 'Pending';
};

const applyDateFilter = (filter, query) => {
  if (query.range && !query.from && !query.to) {
    const now = new Date();
    const formatYMD = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const todayStr = formatYMD(now);

    if (query.range === 'today') {
      query.from = todayStr;
      query.to = todayStr;
    } else if (query.range === 'future') {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      query.from = formatYMD(tomorrow);
    } else if (query.range === 'last7days') {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      query.from = formatYMD(d);
      query.to = todayStr;
    } else if (query.range === 'lastmonth') {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      query.from = formatYMD(d);
      query.to = todayStr;
    }
  }

  const dateConditions = [];
  if (query.date) {
    dateConditions.push({
      $or: [
        { startDate: query.date },
        { $and: [{ startDate: { $lte: query.date } }, { endDate: { $gte: query.date } }] },
      ],
    });
  } else if (query.from && query.to) {
    dateConditions.push({
      $or: [
        { startDate: { $gte: query.from, $lte: query.to } },
        { endDate: { $gte: query.from, $lte: query.to } },
        { $and: [{ startDate: { $lte: query.from } }, { endDate: { $gte: query.to } }] },
      ],
    });
  } else if (query.from) {
    dateConditions.push({
      $or: [
        { startDate: { $gte: query.from } },
        { endDate: { $gte: query.from } },
      ],
    });
  } else if (query.to) {
    dateConditions.push({
      $or: [
        { startDate: { $lte: query.to } },
      ],
    });
  }

  if (dateConditions.length > 0) {
    if (filter.$and) {
      filter.$and.push(...dateConditions);
    } else {
      filter.$and = [...dateConditions];
    }
  }
};

const applyStatusFilter = (filter, query, defaultToApproved = false) => {
  if (query.status && query.status !== 'ALL') {
    if (query.status.includes(',')) {
      filter.status = { $in: query.status.split(',').map((s) => s.trim().toUpperCase()) };
    } else {
      filter.status = query.status.toUpperCase();
    }
  } else if (query.status === 'ALL') {
    // Allow exporting all statuses
  } else if (query.approvedOnly === 'true' || query.approvedOnly === true || defaultToApproved) {
    filter.status = { $in: ['APPROVED_BY_HOD', 'APPROVED'] };
  }
};

export const getConsiderationsReport = async (query = {}, user = null) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};

  if (user?.role === 'TEACHER' && !user.isTG) {
    if (!user.departmentId) {
      filter.student = null;
    } else {
      const departmentStudents = await Student.find({
        department: user.departmentId,
      }).select('_id');
      filter.student = { $in: departmentStudents.map((student) => student._id) };
    }
  } else if (user && user.role !== 'HOD' && user.role !== 'ADMIN') {
    const myGroups = await MentorGroup.find({
      $or: [{ tg: user._id }, { tg: user.teacherId }],
      isActive: true,
    });
    const mySectionIds = myGroups.map((g) => g.section).filter(Boolean);
    let myExplicitStudentIds = [];
    myGroups.forEach((g) => {
      if (Array.isArray(g.students) && g.students.length > 0) {
        myExplicitStudentIds.push(...g.students);
      }
    });

    const myStudents = await Student.find({
      $or: [
        { _id: { $in: myExplicitStudentIds } },
        { mentorGroup: { $in: myGroups.map((g) => g._id) } },
        ...(mySectionIds.length > 0 ? [{ section: { $in: mySectionIds } }] : []),
      ],
    }).select('_id');
    const myStudentIds = myStudents.map((s) => s._id);

    if (myStudentIds.length > 0) {
      filter.$or = [
        { student: { $in: myStudentIds } },
        { groupMembers: { $in: myStudentIds } },
      ];
    } else {
      filter.student = null;
    }
  }

  applyStatusFilter(filter, query, false);
  if (query.type && query.type !== 'ALL') filter.eventType = query.type.toUpperCase();
  applyDateFilter(filter, query);

  // For group considerations in reports (HOD/Admin): only include master request so group applications are not duplicated
  if (!user || user.role === 'HOD' || user.role === 'ADMIN') {
    const groupMasterCondition = {
      $or: [
        { isGroup: false },
        { isGroup: { $exists: false } },
        { isGroupMaster: true },
      ],
    };
    if (filter.$and) {
      filter.$and.push(groupMasterCondition);
    } else if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, groupMasterCondition];
      delete filter.$or;
    } else {
      Object.assign(filter, groupMasterCondition);
    }
  }

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
      .populate('studentAudits.student', 'name rollNumber enrollmentNumber')
      .populate({ path: 'tg', populate: { path: 'user', select: 'name email phone' } })
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

export const getLeavesReport = async (query = {}, user = null) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};

  if (user && user.role !== 'HOD' && user.role !== 'ADMIN') {
    const myGroups = await MentorGroup.find({
      $or: [{ tg: user._id }, { tg: user.teacherId }],
      isActive: true,
    });
    const mySectionIds = myGroups.map((g) => g.section).filter(Boolean);
    let myExplicitStudentIds = [];
    myGroups.forEach((g) => {
      if (Array.isArray(g.students) && g.students.length > 0) {
        myExplicitStudentIds.push(...g.students);
      }
    });

    const myStudents = await Student.find({
      $or: [
        { _id: { $in: myExplicitStudentIds } },
        { mentorGroup: { $in: myGroups.map((g) => g._id) } },
        ...(mySectionIds.length > 0 ? [{ section: { $in: mySectionIds } }] : []),
      ],
    }).select('_id');
    const myStudentIds = myStudents.map((s) => s._id);

    if (myStudentIds.length > 0) {
      filter.student = { $in: myStudentIds };
    } else {
      filter.student = null;
    }
  }

  applyStatusFilter(filter, query, false);
  if (query.role) filter.applicantRole = query.role.toUpperCase();
  if (query.type && query.type !== 'ALL') filter.leaveType = query.type.toUpperCase();
  applyDateFilter(filter, query);

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
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name email phone' } })
      .populate({ path: 'tg', populate: { path: 'user', select: 'name email phone' } })
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

const extractSectionLetter = (sectionDocOrObj) => {
  if (!sectionDocOrObj) return 'Unassigned';
  const str = (
    typeof sectionDocOrObj === 'string'
      ? sectionDocOrObj
      : sectionDocOrObj.code || sectionDocOrObj.name || ''
  ).trim().toUpperCase();

  const cseMatch = str.match(/CSE[\s\-_]*(?:SEM\s*\d+[\s\-_]*|\d+[\s\-_]*)?([A-Z0-9]+)/i);
  if (cseMatch) return cseMatch[1].toUpperCase();

  const secMatch = str.match(/SEC(?:TION)?[\s\-_]*([A-Z0-9]+)/i);
  if (secMatch) return secMatch[1].toUpperCase();

  const endMatch = str.match(/(?:^|[\s\-_])([A-Z0-9]+)$/i);
  if (endMatch) return endMatch[1].toUpperCase();

  return str || 'Unassigned';
};

const formatTimeFromTo = (req) => {
  if (req.timeFrom && req.timeTo) {
    return `${req.timeFrom} - ${req.timeTo}`;
  }
  if (req.timeFrom) return req.timeFrom;
  if (req.timeTo) return req.timeTo;
  if (req.periodTiming) return req.periodTiming;
  return '10:50 AM - 01:20 PM';
};

const TAB_COLORS = {
  ALL: { argb: 'FF1E3A8A' }, // Deep Institutional Navy
  A: { argb: 'FF2563EB' },   // Blue
  B: { argb: 'FF7C3AED' },   // Purple
  C: { argb: 'FF059669' },   // Emerald Green
  D: { argb: 'FFD97706' },   // Amber
  E: { argb: 'FFE11D48' },   // Rose
  FACULTY: { argb: 'FF475569' }, // Slate
};

const getDateRangeLabel = (query) => {
  if (query.range === 'today') return 'Today (' + (query.from || 'Current Date') + ')';
  if (query.range === 'last7days') return 'Last 7 Days (' + (query.from || '') + ' to ' + (query.to || '') + ')';
  if (query.range === 'lastmonth') return 'Last Month (' + (query.from || '') + ' to ' + (query.to || '') + ')';
  if (query.from && query.to) return `${query.from} to ${query.to}`;
  if (query.from) return `From ${query.from}`;
  if (query.to) return `Up to ${query.to}`;
  return 'All Time (Complete Records)';
};

const autoFitColumns = (worksheet, minWidth = 12) => {
  worksheet.columns.forEach((column) => {
    let maxLength = minWidth;
    column.eachCell({ includeEmpty: false }, (cell) => {
      const cellLength = cell.value ? String(cell.value).length : 0;
      if (cellLength > maxLength) {
        maxLength = Math.min(cellLength + 3, 38);
      }
    });
    column.width = Math.max(maxLength, 10);
  });
};

const styleTable = (worksheet, headerRowIndex, dataStartIndex, totalRows) => {
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  for (let r = dataStartIndex; r < dataStartIndex + totalRows; r++) {
    const row = worksheet.getRow(r);
    row.height = 21;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { size: 9.5 };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  }
};

export const exportConsiderationsToExcel = async (query, res, user) => {
  const filter = {};
  applyStatusFilter(filter, query, false);
  if (query.type && query.type !== 'ALL') filter.eventType = query.type.toUpperCase();
  applyDateFilter(filter, query);

  // Check if TG or constrained section
  let targetSemester = null;
  let targetSection = query.section
    ? String(query.section).replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim().toUpperCase()
    : null;

  if (user?.isTG && user?.teacherId && user.role !== 'HOD' && user.role !== 'ADMIN') {
    const tgGroup = await MentorGroup.findOne({ tg: user.teacherId, isActive: true }).populate('section');
    if (tgGroup?.section) {
      targetSemester = tgGroup.section.semester;
      targetSection = extractSectionLetter(tgGroup.section);
    }
  }

  // Filter by semester if specified (e.g. from HOD)
  if (!targetSemester && query.semester && query.semester !== 'ALL') {
    const semNum = parseInt(String(query.semester).replace(/\D/g, ''), 10);
    if (!isNaN(semNum)) {
      targetSemester = semNum;
    }
  }

  // Build student scope filter for semester and section
  const studentScope = {};
  if (targetSemester) {
    studentScope.semester = targetSemester;
  }
  if (targetSection && targetSection !== 'ALL') {
    const cleanLetter = escapeRegex(
      targetSection.replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim()
    );
    const matchingSections = await Section.find({
      $or: [
        { code: `CSE-${cleanLetter}-S${targetSemester || ''}` },
        { code: `CSE-${cleanLetter}` },
        { name: `Section ${cleanLetter}` },
        { name: new RegExp(`^Section\\s*${cleanLetter}$`, 'i') },
        { code: new RegExp(`^CSE-${cleanLetter}(?:-S\\d+)?$`, 'i') },
        { code: targetSection },
        { name: targetSection },
      ],
      ...(targetSemester ? { semester: targetSemester } : {}),
    }).select('_id');
    const secIds = matchingSections.map((s) => s._id);
    if (secIds.length > 0) {
      studentScope.section = { $in: secIds };
    } else {
      studentScope.section = { $in: [] };
    }
  }

  if (Object.keys(studentScope).length > 0) {
    const matchingStudents = await Student.find(studentScope).select('_id');
    const mIds = matchingStudents.map((s) => s._id);
    filter.$or = [
      { student: { $in: mIds } },
      { groupMembers: { $in: mIds } },
    ];
  }

  // Deduplicate group considerations: only master group requests
  if (!user || user.role === 'HOD' || user.role === 'ADMIN') {
    const groupMasterCondition = {
      $or: [
        { isGroup: false },
        { isGroup: { $exists: false } },
        { isGroupMaster: true },
      ],
    };
    if (filter.$and) {
      filter.$and.push(groupMasterCondition);
    } else if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, groupMasterCondition];
      delete filter.$or;
    } else {
      Object.assign(filter, groupMasterCondition);
    }
  }

  const requests = await ConsiderationRequest.find(filter)
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
    .populate('studentAudits.student', 'name rollNumber enrollmentNumber')
    .populate({ path: 'tg', populate: { path: 'user', select: 'name email' } })
    .populate('hodReview.reviewedBy', 'name email')
    .sort({ createdAt: -1 });

  // Fetch active sections for the target semester to build section tabs
  let sortedSections = [];
  if (targetSection && targetSection !== 'ALL') {
    sortedSections = [targetSection];
  } else {
    const sectionFilter = targetSemester ? { semester: targetSemester } : {};
    const dbSections = await Section.find(sectionFilter);
    const sectionLetters = new Set(['A', 'B', 'C', 'D']);
    dbSections.forEach((s) => {
      const letCode = extractSectionLetter(s);
      if (letCode && letCode !== 'Unassigned') sectionLetters.add(letCode);
    });
    sortedSections = Array.from(sectionLetters).sort();
  }

  // Extract all individual sanctioned student records (leader + non-excluded group members)
  const allSanctionedRows = [];
  const seenGroupIds = new Set();
  const seenStudentClearanceKeys = new Set();

  requests.forEach((req) => {
    if (req.isGroup && req.groupId) {
      if (seenGroupIds.has(req.groupId)) return;
      seenGroupIds.add(req.groupId);
    }

    const excludedStudentIds = new Set(
      (req.studentAudits || [])
        .filter((a) => a.status === 'EXCLUDED')
        .map((a) => (a.student?._id || a.student)?.toString())
    );

    const leader = req.student;
    const leaderId = (leader?._id || leader)?.toString();
    const isGroup = Boolean(req.isGroup || (req.groupMembers && req.groupMembers.length > 0));

    // 1. Leader / Applicant
    if (leader && !excludedStudentIds.has(leaderId)) {
      const secLetter = extractSectionLetter(leader.section);
      const studentClearanceKey = `${leaderId}_${req.startDate}_${req.endDate || req.startDate}_${req.timeFrom}_${req.timeTo}`;
      if (!seenStudentClearanceKeys.has(studentClearanceKey)) {
        seenStudentClearanceKeys.add(studentClearanceKey);
        allSanctionedRows.push({
          req,
          student: leader,
          isLeader: isGroup,
          secLetter,
          studentName: leader.user?.name || leader.rollNumber || 'Student',
          rollNumber: leader.rollNumber || leader.enrollmentNumber || 'Not provided',
          sectionStr: leader.section?.code || leader.section?.name || `Section ${secLetter}`,
        });
      }
    }

    // 2. Group members (excluding leader if already added, and excluding excluded students)
    if (isGroup && Array.isArray(req.groupMembers)) {
      req.groupMembers.forEach((m) => {
        if (!m) return;
        const mId = (m._id || m)?.toString();
        if (!mId || mId === leaderId) return;
        if (excludedStudentIds.has(mId)) return;

        const secLetter = extractSectionLetter(m.section) || extractSectionLetter(leader?.section);
        const memberClearanceKey = `${mId}_${req.startDate}_${req.endDate || req.startDate}_${req.timeFrom}_${req.timeTo}`;
        if (!seenStudentClearanceKeys.has(memberClearanceKey)) {
          seenStudentClearanceKeys.add(memberClearanceKey);
          allSanctionedRows.push({
            req,
            student: m,
            isLeader: false,
            secLetter,
            studentName: m.user?.name || m.rollNumber || 'Team Member',
            rollNumber: m.rollNumber || m.enrollmentNumber || 'Not provided',
            sectionStr: m.section?.code || m.section?.name || `Section ${secLetter}`,
          });
        }
      });
    }
  });

  // Group student rows by section letter
  const sectionMap = new Map();
  sortedSections.forEach((sec) => sectionMap.set(sec, []));

  allSanctionedRows.forEach((row) => {
    const secLetter = row.secLetter;
    if (!sectionMap.has(secLetter)) sectionMap.set(secLetter, []);
    sectionMap.get(secLetter).push(row);
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CampusFlow Lite';
  workbook.created = new Date();

  const columns = [
    { header: 'S.No.', key: 'sno', width: 8 },
    { header: 'Student Name', key: 'studentName', width: 22 },
    { header: 'Roll Number', key: 'rollNumber', width: 16 },
    { header: 'Section', key: 'section', width: 14 },
    { header: 'Event Title', key: 'eventTitle', width: 26 },
    { header: 'Application Type', key: 'eventType', width: 18 },
    { header: 'Start Date', key: 'startDate', width: 14 },
    { header: 'End Date', key: 'endDate', width: 14 },
    { header: 'Time (From - To)', key: 'timeRange', width: 22 },
    { header: 'Approved Lectures / Periods', key: 'approvedPeriods', width: 26 },
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Reason / Description', key: 'reason', width: 32 },
    { header: 'Tutor Guardian (TG)', key: 'tgName', width: 20 },
    { header: 'Approving Authority', key: 'finalReviewer', width: 22 },
    { header: 'Decision Date', key: 'decisionDate', width: 16 },
  ];

  const semLabel = targetSemester ? `Semester ${targetSemester}` : 'All Semesters';
  const dateRangeLabel = getDateRangeLabel(query);

  // 1. SHEET 1: Consolidated Master Sheet (named specifically when scoped to a section)
  const masterSheetTitle = targetSection && targetSection !== 'ALL'
    ? `Master (Sec ${targetSection})`
    : 'All Sections';
  const masterSheet = workbook.addWorksheet(masterSheetTitle);
  masterSheet.properties.tabColor = TAB_COLORS.ALL;
  masterSheet.columns = columns;

  // Sort rows section-wise (A, B, C, D...)
  const sortedRows = [...allSanctionedRows].sort((a, b) => {
    const secDiff = (a.secLetter || '').localeCompare(b.secLetter || '');
    if (secDiff !== 0) return secDiff;
    return (a.studentName || '').localeCompare(b.studentName || '');
  });

  sortedRows.forEach((row, idx) => {
    const req = row.req;
    masterSheet.addRow({
      sno: idx + 1,
      studentName: row.studentName,
      rollNumber: row.rollNumber,
      section: row.sectionStr,
      eventTitle: req.eventTitle,
      eventType: req.eventType,
      startDate: req.startDate,
      endDate: req.endDate,
      timeRange: formatTimeFromTo(req),
      approvedPeriods: req.hodReview?.approvedPeriods || req.approvedPeriods || 0,
      status: formatStatus(req.status),
      reason: req.description || req.reason || 'Not provided',
      tgName: req.tg?.user?.name || req.tg?.designation || 'Not assigned',
      finalReviewer: req.hodReview?.reviewedBy?.name || 'HOD Office',
      decisionDate: req.hodReview?.reviewedAt ? req.hodReview.reviewedAt.toISOString().slice(0, 10) : 'Pending',
    });
  });

  styleTable(masterSheet, 1, 2, sortedRows.length);
  autoFitColumns(masterSheet);

  // 2. SHEETS 2+: Individual Section Worksheets (sec A, sec B, sec C, sec D...)
  sortedSections.forEach((secLetter) => {
    const secSheet = workbook.addWorksheet(`sec ${secLetter}`);
    secSheet.properties.tabColor = TAB_COLORS[secLetter] || { argb: 'FF3B82F6' };
    secSheet.columns = columns;

    const secRecords = sectionMap.get(secLetter) || [];

    if (secRecords.length === 0) {
      secSheet.addRow({
        sno: '-',
        studentName: `No consideration records found for Section ${secLetter} in the selected date range.`,
        rollNumber: '-',
        section: `CSE-${secLetter}`,
        eventTitle: '-',
        eventType: '-',
        startDate: '-',
        endDate: '-',
        timeRange: '-',
        approvedPeriods: 0,
        status: 'None',
        reason: 'No records matching filters',
        tgName: '-',
        finalReviewer: '-',
        decisionDate: '-',
      });
      styleTable(secSheet, 1, 2, 1);
    } else {
      secRecords.forEach((row, idx) => {
        const req = row.req;
        secSheet.addRow({
          sno: idx + 1,
          studentName: row.studentName,
          rollNumber: row.rollNumber,
          section: row.sectionStr,
          eventTitle: req.eventTitle,
          eventType: req.eventType,
          startDate: req.startDate,
          endDate: req.endDate,
          timeRange: formatTimeFromTo(req),
          approvedPeriods: req.hodReview?.approvedPeriods || req.approvedPeriods || 0,
          status: formatStatus(req.status),
          reason: req.description || req.reason || 'Not provided',
          tgName: req.tg?.user?.name || req.tg?.designation || 'Not assigned',
          finalReviewer: req.hodReview?.reviewedBy?.name || 'HOD Office',
          decisionDate: req.hodReview?.reviewedAt ? req.hodReview.reviewedAt.toISOString().slice(0, 10) : 'Pending',
        });
      });
      styleTable(secSheet, 1, 2, secRecords.length);
    }

    autoFitColumns(secSheet);
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="considerations_${targetSemester ? `sem${targetSemester}_` : ''}${Date.now()}.xlsx"`
  );

  await workbook.xlsx.write(res);
  res.end();
};

export const exportLeavesToExcel = async (query, res, user) => {
  const filter = {};
  applyStatusFilter(filter, query, false);
  if (query.role) filter.applicantRole = query.role.toUpperCase();
  if (query.type && query.type !== 'ALL') filter.leaveType = query.type.toUpperCase();
  applyDateFilter(filter, query);

  let targetSemester = null;
  let targetSection = query.section
    ? String(query.section).replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim().toUpperCase()
    : null;

  // If user is a TG and no explicit semester/section provided or TG scope should be strictly enforced
  if (user?.isTG && user?.teacherId && user.role !== 'HOD' && user.role !== 'ADMIN') {
    const tgGroup = await MentorGroup.findOne({ tg: user.teacherId, isActive: true }).populate('section');
    if (tgGroup?.section) {
      targetSemester = tgGroup.section.semester;
      targetSection = extractSectionLetter(tgGroup.section);
    }
    // TG reports exclusively contain student leaves
    filter.applicantRole = 'STUDENT';
  }

  if (!targetSemester && query.semester && query.semester !== 'ALL') {
    const semNum = parseInt(String(query.semester).replace(/\D/g, ''), 10);
    if (!isNaN(semNum)) {
      targetSemester = semNum;
    }
  }

  const studentScope = {};
  if (targetSemester) {
    studentScope.semester = targetSemester;
  }
  if (targetSection && targetSection !== 'ALL') {
    const cleanLetter = escapeRegex(
      targetSection.replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim()
    );
    const matchingSections = await Section.find({
      $or: [
        { code: `CSE-${cleanLetter}-S${targetSemester || ''}` },
        { code: `CSE-${cleanLetter}` },
        { name: `Section ${cleanLetter}` },
        { name: new RegExp(`^Section\\s*${cleanLetter}$`, 'i') },
        { code: new RegExp(`^CSE-${cleanLetter}(?:-S\\d+)?$`, 'i') },
        { code: targetSection },
        { name: targetSection },
      ],
      ...(targetSemester ? { semester: targetSemester } : {}),
    }).select('_id');
    const secIds = matchingSections.map((s) => s._id);
    if (secIds.length > 0) {
      studentScope.section = { $in: secIds };
    } else {
      studentScope.section = { $in: [] };
    }
  }

  if (Object.keys(studentScope).length > 0) {
    const matchingStudents = await Student.find(studentScope).select('_id');
    const studentIds = matchingStudents.map((s) => s._id);
    filter.student = { $in: studentIds };
    filter.applicantRole = 'STUDENT';
  }

  const leaves = await LeaveApplication.find(filter)
    .populate('applicant', 'name email role phone')
    .populate({
      path: 'student',
      populate: [{ path: 'section', select: 'name code year semester' }],
    })
    .populate({ path: 'teacher', populate: { path: 'user', select: 'name email phone' } })
    .populate({ path: 'tg', populate: { path: 'user', select: 'name email' } })
    .populate('finalReview.reviewedBy', 'name email')
    .sort({ createdAt: -1 });

  // Fetch active sections for section tabs
  let sortedSections = [];
  if (targetSection && targetSection !== 'ALL') {
    sortedSections = [targetSection];
  } else {
    const sectionFilter = targetSemester ? { semester: targetSemester } : {};
    const dbSections = await Section.find(sectionFilter);
    const sectionLetters = new Set(['A', 'B', 'C', 'D']);
    dbSections.forEach((s) => {
      const letCode = extractSectionLetter(s);
      if (letCode && letCode !== 'Unassigned') sectionLetters.add(letCode);
    });
    sortedSections = Array.from(sectionLetters).sort();
  }

  // Group leaves by section letter + faculty
  const sectionMap = new Map();
  sortedSections.forEach((sec) => sectionMap.set(sec, []));
  const facultyLeaves = [];

  leaves.forEach((l) => {
    if (l.applicantRole === 'TEACHER') {
      facultyLeaves.push(l);
    } else {
      const secLetter = extractSectionLetter(l.student?.section);
      if (!sectionMap.has(secLetter)) sectionMap.set(secLetter, []);
      sectionMap.get(secLetter).push(l);
    }
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CampusFlow Lite';
  workbook.created = new Date();

  const columns = [
    { header: 'S.No.', key: 'sno', width: 8 },
    { header: 'Applicant Name', key: 'name', width: 22 },
    { header: 'Role', key: 'role', width: 14 },
    { header: 'Roll Number / ID', key: 'rollOrId', width: 18 },
    { header: 'Section', key: 'section', width: 14 },
    { header: 'Leave Type', key: 'leaveType', width: 16 },
    { header: 'Start Date', key: 'startDate', width: 14 },
    { header: 'End Date', key: 'endDate', width: 14 },
    { header: 'Total Days', key: 'totalDays', width: 12 },
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Reason', key: 'reason', width: 32 },
    { header: 'Tutor Guardian Reviewer', key: 'tgReviewer', width: 24 },
    { header: 'Approving Authority', key: 'finalReviewer', width: 22 },
    { header: 'Decision Date', key: 'decisionDate', width: 16 },
  ];

  // 1. SHEET 1: Consolidated Master Sheet (named specifically when scoped to a section)
  const masterSheetTitle = targetSection && targetSection !== 'ALL'
    ? `Master (Sec ${targetSection})`
    : 'All Sections';
  const masterSheet = workbook.addWorksheet(masterSheetTitle);
  masterSheet.properties.tabColor = TAB_COLORS.ALL;
  masterSheet.columns = columns;

  leaves.forEach((l, idx) => {
    masterSheet.addRow({
      sno: idx + 1,
      name: l.applicant?.name || (l.applicantRole === 'STUDENT' ? 'Student' : 'Faculty Member'),
      role: l.applicantRole === 'TEACHER' ? 'Faculty' : l.applicantRole,
      rollOrId: l.student?.rollNumber || l.teacher?.employeeId || 'N/A',
      section: l.student?.section?.code || l.student?.section?.name || (l.applicantRole === 'TEACHER' ? 'Faculty' : 'N/A'),
      leaveType: l.leaveType,
      startDate: l.startDate,
      endDate: l.endDate,
      totalDays: l.totalDays,
      status: formatStatus(l.status),
      reason: l.reason || 'Not provided',
      tgReviewer: l.tg?.user?.name || (l.applicantRole === 'TEACHER' ? 'Direct to HOD' : 'Not assigned'),
      finalReviewer: l.finalReview?.reviewedBy?.name || 'HOD Office',
      decisionDate: l.finalReview?.reviewedAt ? l.finalReview.reviewedAt.toISOString().slice(0, 10) : 'Pending',
    });
  });

  styleTable(masterSheet, 1, 2, leaves.length);
  autoFitColumns(masterSheet);

  // 2. SHEETS 2+: Dedicated Section Worksheets (sec A, sec B, sec C, sec D...)
  sortedSections.forEach((secLetter) => {
    const secSheet = workbook.addWorksheet(`sec ${secLetter}`);
    secSheet.properties.tabColor = TAB_COLORS[secLetter] || { argb: 'FF3B82F6' };
    secSheet.columns = columns;

    const secRecords = sectionMap.get(secLetter) || [];

    if (secRecords.length === 0) {
      secSheet.addRow({
        sno: '-',
        name: `No leave applications found for Section ${secLetter} in the selected date range.`,
        role: '-',
        rollOrId: '-',
        section: `CSE-${secLetter}`,
        leaveType: '-',
        startDate: '-',
        endDate: '-',
        totalDays: 0,
        status: 'None',
        reason: 'No records matching filters',
        tgReviewer: '-',
        finalReviewer: '-',
        decisionDate: '-',
      });
      styleTable(secSheet, 1, 2, 1);
    } else {
      secRecords.forEach((l, idx) => {
        secSheet.addRow({
          sno: idx + 1,
          name: l.applicant?.name || 'Student',
          role: 'STUDENT',
          rollOrId: l.student?.rollNumber || 'N/A',
          section: l.student?.section?.code || l.student?.section?.name || `Section ${secLetter}`,
          leaveType: l.leaveType,
          startDate: l.startDate,
          endDate: l.endDate,
          totalDays: l.totalDays,
          status: formatStatus(l.status),
          reason: l.reason || 'Not provided',
          tgReviewer: l.tg?.user?.name || 'Not assigned',
          finalReviewer: l.finalReview?.reviewedBy?.name || 'HOD Office',
          decisionDate: l.finalReview?.reviewedAt ? l.finalReview.reviewedAt.toISOString().slice(0, 10) : 'Pending',
        });
      });
      styleTable(secSheet, 1, 2, secRecords.length);
    }

    autoFitColumns(secSheet);
  });

  // 3. Faculty Sheet (if any faculty leaves)
  if (facultyLeaves.length > 0) {
    const facSheet = workbook.addWorksheet('Faculty');
    facSheet.properties.tabColor = TAB_COLORS.FACULTY;
    facSheet.columns = columns;
    facultyLeaves.forEach((l, idx) => {
      facSheet.addRow({
        sno: idx + 1,
        name: l.applicant?.name || 'Faculty Member',
        role: 'Faculty',
        rollOrId: l.teacher?.employeeId || 'N/A',
        section: 'Faculty',
        leaveType: l.leaveType,
        startDate: l.startDate,
        endDate: l.endDate,
        totalDays: l.totalDays,
        status: formatStatus(l.status),
        reason: l.reason || 'Not provided',
        tgReviewer: 'Direct to HOD',
        finalReviewer: l.finalReview?.reviewedBy?.name || 'HOD Office',
        decisionDate: l.finalReview?.reviewedAt ? l.finalReview.reviewedAt.toISOString().slice(0, 10) : 'Pending',
      });
    });
    styleTable(facSheet, 1, 2, facultyLeaves.length);
    autoFitColumns(facSheet);
  }

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="leaves_${targetSemester ? `sem${targetSemester}_` : ''}${Date.now()}.xlsx"`
  );

  await workbook.xlsx.write(res);
  res.end();
};

export const exportFacultyToExcel = async (res) => {
  const [teachers, activeGroups] = await Promise.all([
    Teacher.find()
      .populate('user', 'name email phone isActive role')
      .populate('department', 'name code')
      .sort({ createdAt: 1 }),
    MentorGroup.find({ isActive: true })
      .populate('section', 'name code semester')
      .populate('tg', '_id user'),
  ]);

  const tgGroupMap = new Map();
  activeGroups.forEach((g) => {
    const tid = (g.tg?._id || g.tg)?.toString();
    if (tid) {
      const sem = g.semester || g.section?.semester || 5;
      const sec = g.section?.name || (g.section?.code ? `Section ${g.section.code.replace('CSE-', '')}` : 'Section B');
      tgGroupMap.set(tid, `Semester ${sem} • ${sec}`);
    }
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Faculty Directory');

  worksheet.columns = [
    { header: 'Faculty Name', key: 'name', width: 26 },
    { header: 'Employee ID', key: 'employeeId', width: 18 },
    { header: 'Designation', key: 'designation', width: 26 },
    { header: 'Department', key: 'department', width: 32 },
    { header: 'Institutional Role', key: 'role', width: 24 },
    { header: 'Assigned Section', key: 'cohort', width: 24 },
    { header: 'Email Address', key: 'email', width: 30 },
    { header: 'Phone Number', key: 'phone', width: 18 },
    { header: 'Account Status', key: 'status', width: 16 },
  ];

  // Header styling with professional navy theme
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' }, // Navy blue
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 26;

  teachers.forEach((t) => {
    const facultyName = t.user?.name || t.designation || 'Faculty Member';
    const isHod = t.user?.role === 'HOD' || t.designation?.toLowerCase().includes('head');
    const isTg = Boolean(t.isTG || tgGroupMap.has(t._id.toString()));
    const cohort = tgGroupMap.get(t._id.toString()) || (isTg ? 'Active TG' : 'N/A');
    const role = isHod ? 'Head of Department' : (isTg ? 'Tutor Guardian (TG)' : 'Faculty Member');

    const row = worksheet.addRow({
      name: facultyName,
      employeeId: t.employeeId || 'Not provided',
      designation: t.designation || 'Assistant Professor',
      department: t.department?.name || 'Computer Science & Engineering',
      role,
      cohort,
      email: t.user?.email || 'Not provided',
      phone: t.user?.phone || 'Not provided',
      status: t.user?.isActive !== false ? 'Active' : 'Inactive',
    });

    row.alignment = { vertical: 'middle' };
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="faculty-directory-${Date.now()}.xlsx"`
  );

  await workbook.xlsx.write(res);
  res.end();
};

export default {
  getDashboardSummary,
  getConsiderationsReport,
  getLeavesReport,
  exportConsiderationsToExcel,
  exportLeavesToExcel,
  exportFacultyToExcel,
};
