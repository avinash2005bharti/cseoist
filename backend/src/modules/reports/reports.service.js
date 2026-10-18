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
      },
    };
  }

  if (user.isTG) {
    const teacherId = user.teacherId;
    const [
      pendingConsiderations,
      pendingLeaves,
      mentorGroup,
    ] = await Promise.all([
      ConsiderationRequest.countDocuments({ tg: teacherId, status: 'PENDING' }),
      LeaveApplication.countDocuments({ tg: teacherId, status: 'PENDING', applicantRole: 'STUDENT' }),
      MentorGroup.findOne({ tg: teacherId, isActive: true }),
    ]);

    return {
      role: 'TG',
      pendingConsiderations,
      pendingLeaves,
      totalMentees: mentorGroup?.students?.length || 0,
    };
  }

  if (role === 'HOD' || role === 'ADMIN') {
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
      ConsiderationRequest.countDocuments({ status: { $in: ['RECOMMENDED_BY_TG', 'PENDING'] } }),
      ConsiderationRequest.countDocuments({ status: 'PENDING', escalated: true }),
      LeaveApplication.countDocuments({ applicantRole: 'STUDENT', status: 'RECOMMENDED_BY_TG' }),
      LeaveApplication.countDocuments({ applicantRole: 'STUDENT', status: 'PENDING', escalated: true }),
      LeaveApplication.countDocuments({ applicantRole: 'TEACHER', status: 'PENDING' }),
      LeaveApplication.countDocuments({ applicantRole: 'HOD', status: 'PENDING' }),
      LeaveApplication.countDocuments({
        applicantRole: 'TEACHER',
        status: 'APPROVED',
        startDate: { $lte: todayIST },
        endDate: { $gte: todayIST },
      }),
      Student.aggregate([
        { $group: { _id: '$semester', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Student.countDocuments({}),
      Teacher.countDocuments({}),
      User.countDocuments({}),
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
  if (query.status) {
    if (query.status.includes(',')) {
      filter.status = { $in: query.status.split(',').map((s) => s.trim().toUpperCase()) };
    } else {
      filter.status = query.status.toUpperCase();
    }
  } else if (query.approvedOnly === 'true' || query.approvedOnly === true || defaultToApproved) {
    filter.status = { $in: ['APPROVED_BY_HOD', 'APPROVED'] };
  }
};

export const getConsiderationsReport = async (query = {}, user = null) => {
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
  if (query.type && query.type !== 'ALL') filter.eventType = query.type.toUpperCase();
  applyDateFilter(filter, query);

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

export const exportConsiderationsToExcel = async (query, res) => {
  const filter = {};
  applyStatusFilter(filter, query, true);
  if (query.type && query.type !== 'ALL') filter.eventType = query.type.toUpperCase();
  applyDateFilter(filter, query);

  const requests = await ConsiderationRequest.find(filter)
    .populate({
      path: 'student',
      populate: [
        { path: 'user', select: 'name email phone' },
        { path: 'section', select: 'name code year semester' },
      ],
    })
    .populate({ path: 'tg', populate: { path: 'user', select: 'name email' } })
    .populate('hodReview.reviewedBy', 'name email')
    .sort({ createdAt: -1 });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Attendance Considerations');

  worksheet.columns = [
    { header: 'Student Name', key: 'studentName', width: 22 },
    { header: 'Roll Number', key: 'rollNumber', width: 16 },
    { header: 'Section', key: 'section', width: 12 },
    { header: 'Event Title', key: 'eventTitle', width: 28 },
    { header: 'Request Type', key: 'eventType', width: 16 },
    { header: 'Start Date', key: 'startDate', width: 14 },
    { header: 'End Date', key: 'endDate', width: 14 },
    { header: 'Requested Periods', key: 'requestedPeriods', width: 18 },
    { header: 'Approved Periods', key: 'approvedPeriods', width: 18 },
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Reason / Description', key: 'reason', width: 32 },
    { header: 'Tutor Guardian (TG)', key: 'tgName', width: 20 },
    { header: 'Final Approver', key: 'finalReviewer', width: 20 },
    { header: 'Decision Date', key: 'decisionDate', width: 16 },
  ];

  // Header styling
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E7FF' },
  };

  requests.forEach((req) => {
    worksheet.addRow({
      studentName: req.student?.user?.name || req.student?.rollNumber || 'Student',
      rollNumber: req.student?.rollNumber || 'Not provided',
      section: req.student?.section?.code || req.student?.section?.name || 'Not provided',
      eventTitle: req.eventTitle,
      eventType: req.eventType,
      startDate: req.startDate,
      endDate: req.endDate,
      requestedPeriods: req.requestedPeriods,
      approvedPeriods: req.hodReview?.approvedPeriods || req.approvedPeriods || 0,
      status: formatStatus(req.status),
      reason: req.description || req.reason || 'Not provided',
      tgName: req.tg?.user?.name || req.tg?.designation || 'Not assigned',
      finalReviewer: req.hodReview?.reviewedBy?.name || 'HOD Office',
      decisionDate: req.hodReview?.reviewedAt ? req.hodReview.reviewedAt.toISOString().slice(0, 10) : 'Pending',
    });
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="considerations-report-${Date.now()}.xlsx"`
  );

  await workbook.xlsx.write(res);
  res.end();
};

export const exportLeavesToExcel = async (query, res) => {
  const filter = {};
  applyStatusFilter(filter, query, true);
  if (query.role) filter.applicantRole = query.role.toUpperCase();
  if (query.type && query.type !== 'ALL') filter.leaveType = query.type.toUpperCase();
  applyDateFilter(filter, query);

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

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Leave Applications');

  worksheet.columns = [
    { header: 'Applicant Name', key: 'name', width: 22 },
    { header: 'Role', key: 'role', width: 14 },
    { header: 'Leave Type', key: 'leaveType', width: 16 },
    { header: 'Start Date', key: 'startDate', width: 14 },
    { header: 'End Date', key: 'endDate', width: 14 },
    { header: 'Total Days', key: 'totalDays', width: 12 },
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Reason', key: 'reason', width: 32 },
    { header: 'TG Reviewer', key: 'tgReviewer', width: 20 },
    { header: 'Final Reviewer', key: 'finalReviewer', width: 20 },
    { header: 'Decision Date', key: 'decisionDate', width: 16 },
  ];

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E7FF' },
  };

  leaves.forEach((l) => {
    worksheet.addRow({
      name: l.applicant?.name || (l.applicantRole === 'STUDENT' ? 'Student' : 'Faculty Member'),
      role: l.applicantRole === 'TEACHER' ? 'Faculty' : l.applicantRole,
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

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="leaves-report-${Date.now()}.xlsx"`
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
    { header: 'Mentored Cohort', key: 'cohort', width: 24 },
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
