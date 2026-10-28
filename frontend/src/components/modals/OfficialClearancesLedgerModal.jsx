import React, { useState, useEffect, useMemo } from 'react';
import { reportApi } from '../../api';
import considerationApi from '../../api/considerationApi.js';
import AttendanceLeaveReportsModal from './AttendanceLeaveReportsModal.jsx';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Printer,
  Share2,
  X,
  Search,
  ExternalLink,
  CheckCircle2,
  Check,
  Calendar,
  CalendarDays,
  CalendarX2,
  Table2,
  History,
  Filter,
  ArrowLeft,
  Clock,
  Sparkles,
} from 'lucide-react';
import './Screen-19.screen.css';

function getTodayISTString() {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatDateSlash(dStr) {
  if (!dStr) return '';
  if (dStr.includes('/')) return dStr;
  const parts = dStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  return dStr;
}

export default function OfficialClearancesLedgerModal({
  initialTab = 'considerations', // 'considerations' | 'leaves'
  onClose,
  isTgView = false,
  assignedSemester = null,
  assignedSection = null,
  initialDateMode = 'today',
  isTeacherView = false,
}) {
  const todayStr = getTodayISTString();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [semesterFilter, setSemesterFilter] = useState(
    isTgView && assignedSemester ? `Semester ${assignedSemester}` : 'All Semesters'
  );
  const [sectionFilter, setSectionFilter] = useState(
    isTgView && assignedSection
      ? String(assignedSection).replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim()
      : 'All'
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Date Filter Mode: 'today' by default, 'previous' when user chooses a date range
  const [dateMode, setDateMode] = useState(initialDateMode);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modal to select date range for Previous records
  const [showPreviousModal, setShowPreviousModal] = useState(false);
  const [modalFrom, setModalFrom] = useState('');
  const [modalTo, setModalTo] = useState('');
  const [dateError, setDateError] = useState('');
  const [activePreset, setActivePreset] = useState('7days');

  const getPresetDates = (presetKey) => {
    if (presetKey === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      return { from: yStr, to: yStr };
    }
    if (presetKey === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { from: d.toISOString().slice(0, 10), to: todayStr };
    }
    if (presetKey === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { from: d.toISOString().slice(0, 10), to: todayStr };
    }
    if (presetKey === 'thisMonth') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      return { from: firstDay, to: todayStr };
    }
    return null;
  };

  const handleSelectPreset = (presetKey) => {
    const dates = getPresetDates(presetKey);
    if (dates) {
      setModalFrom(dates.from);
      setModalTo(dates.to);
      setActivePreset(presetKey);
      setDateError('');
    }
  };

  const [considerations, setConsiderations] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  const dynamicSections = useMemo(() => {
    const letters = new Set(['A', 'B', 'C', 'D', 'E']);
    considerations.forEach((item) => {
      const sec = (item.student?.section?.name || item.student?.section?.code || '')
        .replace(/^Section\s*/i, '')
        .replace(/^CSE-/i, '')
        .trim();
      if (sec) letters.add(sec.toUpperCase());
    });
    leaves.forEach((item) => {
      const sec = (item.student?.section?.name || item.student?.section?.code || '')
        .replace(/^Section\s*/i, '')
        .replace(/^CSE-/i, '')
        .trim();
      if (sec) letters.add(sec.toUpperCase());
    });
    return Array.from(letters).sort();
  }, [considerations, leaves]);

  // Print Modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [targetPrintSemester, setTargetPrintSemester] = useState(
    isTgView && assignedSemester
      ? `Semester ${assignedSemester}`
      : 'All Semesters (Comprehensive Ledger)'
  );
  const [printDateScope, setPrintDateScope] = useState('today'); // 'today' | 'previous'
  const [printDateFrom, setPrintDateFrom] = useState('');
  const [printDateTo, setPrintDateTo] = useState('');
  const [printStatusScope, setPrintStatusScope] = useState(''); // '' (All Statuses) | 'APPROVED_BY_HOD,APPROVED' | 'PENDING' | 'RECOMMENDED_BY_TG' | 'REJECTED_BY_HOD,REJECTED_BY_TG,REJECTED'
  const [showExportModal, setShowExportModal] = useState(false);

  const fetchRecords = async (overrideParams = null) => {
    setLoading(true);
    try {
      const params = {
        status: 'ALL',
        limit: 1000,
        ...(overrideParams || {}),
      };

      const [conRes, leaveRes] = await Promise.allSettled(
        isTeacherView
          ? [considerationApi.getTeacherApproved({ limit: 1000 }), Promise.resolve({ data: [] })]
          : [reportApi.getConsiderations(params), reportApi.getLeaves(params)]
      );

      const rawCon = conRes.status === 'fulfilled' ? conRes.value : null;
      const rawConList = Array.isArray(rawCon?.data?.requests)
        ? rawCon.data.requests
        : Array.isArray(rawCon?.data)
        ? rawCon.data
        : Array.isArray(rawCon?.requests)
        ? rawCon.requests
        : Array.isArray(rawCon)
        ? rawCon
        : [];
      setConsiderations(rawConList);

      const rawLeave = leaveRes.status === 'fulfilled' ? leaveRes.value : null;
      const rawLeaveList = Array.isArray(rawLeave?.data?.leaves)
        ? rawLeave.data.leaves
        : Array.isArray(rawLeave?.data)
        ? rawLeave.data
        : Array.isArray(rawLeave?.leaves)
        ? rawLeave.leaves
        : Array.isArray(rawLeave)
        ? rawLeave
        : [];
      setLeaves(rawLeaveList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial load: fetch approved records
    fetchRecords();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('open_print') === 'true') {
      setShowPrintModal(true);
    }
  }, [isTeacherView]);

  // Sync print modal scope whenever dateMode or dates change
  useEffect(() => {
    setPrintDateScope(dateMode);
    if (dateFrom) setPrintDateFrom(dateFrom);
    if (dateTo) setPrintDateTo(dateTo);
  }, [dateMode, dateFrom, dateTo]);

  // Open Previous Date Range modal with sensible defaults
  const handleOpenPreviousModal = () => {
    if (!modalFrom || !modalTo) {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      const defaultStart = d.toISOString().slice(0, 10);
      setModalFrom(dateFrom || defaultStart);
      setModalTo(dateTo || todayStr);
    }
    setDateError('');
    setShowPreviousModal(true);
  };

  // Switch back to Today view
  const handleSwitchToToday = () => {
    setDateMode('today');
    setDateFrom('');
    setDateTo('');
  };

  // Switch to Future view
  const handleSwitchToFuture = () => {
    setDateMode('future');
    setDateFrom('');
    setDateTo('');
  };

  // Expand considerations into individual student clearance rows (Leader + non-excluded Group Members)
  // Expand considerations into individual student clearance rows (Leader + non-excluded Group Members)
  const expandedConsiderationRows = useMemo(() => {
    const rows = [];
    const seenGroupIds = new Set();
    const seenStudentClearanceSlots = new Set();

    // Sort so master group requests are processed before slave group requests
    const sortedConsiderations = [...considerations].sort((a, b) => {
      if (a.isGroupMaster && !b.isGroupMaster) return -1;
      if (!a.isGroupMaster && b.isGroupMaster) return 1;
      return 0;
    });

    sortedConsiderations.forEach((item) => {
      // Group request deduplication: if multiple requests exist with the same groupId, process only once
      if (item.isGroup && item.groupId) {
        if (seenGroupIds.has(item.groupId)) return;
        seenGroupIds.add(item.groupId);
      }

      const excludedIds = new Set(
        (item.studentAudits || [])
          .filter((a) => a.status === 'EXCLUDED')
          .map((a) => (a.student?._id || a.student)?.toString())
      );

      const leader = item.student;
      const leaderId = (leader?._id || leader)?.toString();
      const isGroup = Boolean(item.isGroup || (item.groupMembers && item.groupMembers.length > 0));

      const periodsStr = item.selectedPeriods?.length
        ? item.selectedPeriods.join(', ')
        : item.requestedPeriods
        ? `P1 - P${item.requestedPeriods}`
        : 'P2, P3, P4';

      // 1. Leader / Applicant
      if (leader && !excludedIds.has(leaderId)) {
        const leaderSlotKey = `${leaderId || leader.enrollmentNumber || leader.rollNumber}_${item.startDate}_${item.endDate || item.startDate}_${item.timeFrom || ''}_${item.timeTo || ''}_${periodsStr}`;
        if (!seenStudentClearanceSlots.has(leaderSlotKey)) {
          seenStudentClearanceSlots.add(leaderSlotKey);
          rows.push({
            _id: `${item._id}_lead_${leaderId}`,
            rawItem: item,
            isGroup,
            isLeader: isGroup,
            student: leader,
            studentName: leader.user?.name || item.applicant?.name || leader.designation || 'Student',
            enrollmentNumber: leader.enrollmentNumber || leader.rollNumber || item.applicant?.rollNumber || 'Not provided',
            section: leader.section,
            sectionName: (leader.section?.name || leader.section?.code || 'B').replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim(),
            semester: leader.section?.semester || leader.semester || 5,
            eventTitle: item.eventTitle,
            category: item.eventType || 'Consideration',
            description: item.description || item.reason || 'Attendance consideration',
            selectedPeriods: item.selectedPeriods,
            requestedPeriods: item.requestedPeriods,
            periodsStr,
            timeFrom: item.timeFrom || '10:50 AM',
            timeTo: item.timeTo || '01:20 PM',
            startDate: item.startDate,
            endDate: item.endDate || item.startDate,
            totalDays: item.totalDays || 1,
            status: item.status,
            createdAt: item.createdAt,
          });
        }
      }

      // 2. Non-excluded Group Members
      if (isGroup && Array.isArray(item.groupMembers)) {
        item.groupMembers.forEach((member, mIdx) => {
          if (!member) return;
          const memberId = (member._id || member)?.toString();
          if (!memberId || memberId === leaderId) return;
          if (excludedIds.has(memberId)) return;

          const memberSec = member.section || leader?.section;
          const memberSlotKey = `${memberId || member.enrollmentNumber || member.rollNumber}_${item.startDate}_${item.endDate || item.startDate}_${item.timeFrom || ''}_${item.timeTo || ''}_${periodsStr}`;
          if (!seenStudentClearanceSlots.has(memberSlotKey)) {
            seenStudentClearanceSlots.add(memberSlotKey);
            rows.push({
              _id: `${item._id}_mbr_${memberId}_${mIdx}`,
              rawItem: item,
              isGroup: true,
              isLeader: false,
              student: member,
              studentName: member.user?.name || member.name || member.rollNumber || 'Team Member',
              enrollmentNumber: member.enrollmentNumber || member.rollNumber || 'Not provided',
              section: memberSec,
              sectionName: (memberSec?.name || memberSec?.code || 'B').replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim(),
              semester: memberSec?.semester || member.semester || leader?.section?.semester || 5,
              eventTitle: item.eventTitle,
              category: item.eventType || 'Consideration',
              description: item.description || item.reason || 'Attendance consideration',
              selectedPeriods: item.selectedPeriods,
              requestedPeriods: item.requestedPeriods,
              periodsStr,
              timeFrom: item.timeFrom || '10:50 AM',
              timeTo: item.timeTo || '01:20 PM',
              startDate: item.startDate,
              endDate: item.endDate || item.startDate,
              totalDays: item.totalDays || 1,
              status: item.status,
              createdAt: item.createdAt,
            });
          }
        });
      }
    });
    return rows;
  }, [considerations]);

  // Expand leaves into individual clearance rows
  const expandedLeaveRows = useMemo(() => {
    const seenLeaveSlots = new Set();
    const rows = [];
    leaves.forEach((item, idx) => {
      const student = item.student || {};
      const studentId = (student._id || student || item.applicant?._id)?.toString();
      const leaveSlotKey = `${studentId || student.enrollmentNumber || student.rollNumber}_${item.startDate}_${item.endDate || item.startDate}_${item.leaveType}`;
      if (seenLeaveSlots.has(leaveSlotKey)) return;
      seenLeaveSlots.add(leaveSlotKey);

      rows.push({
        _id: `${item._id || idx}_leave`,
        rawItem: item,
        isGroup: false,
        isLeader: false,
        student,
        studentName: item.applicant?.name || student.user?.name || student.designation || 'Student',
        enrollmentNumber: student.enrollmentNumber || student.rollNumber || item.applicant?.rollNumber || 'N/A',
        section: student.section,
        sectionName: (student.section?.name || student.section?.code || 'B').replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim(),
        semester: student.section?.semester || student.semester || 5,
        eventTitle: `${item.leaveType} Leave`,
        category: item.leaveType,
        description: item.reason || item.description || 'Student leave application',
        periodsStr: item.leaveType || 'Sanctioned Leave',
        timeFrom: 'Full Day',
        timeTo: 'Full Day',
        startDate: item.startDate,
        endDate: item.endDate || item.startDate,
        totalDays: item.totalDays || 1,
        status: item.status,
        createdAt: item.createdAt,
      });
    });
    return rows;
  }, [leaves]);

  const filterRows = (rows) => {
    return rows.filter((row) => {
      // Official clearances ledger table strictly displays authorized/approved records
      const isApproved = row.status === 'APPROVED' || row.status === 'APPROVED_BY_HOD';
      if (!isApproved) return false;
      // 1. Date filtering
      const itemStart = row.startDate ? row.startDate.slice(0, 10) : '';
      const itemEnd = row.endDate ? row.endDate.slice(0, 10) : itemStart;

      if (dateMode === 'today') {
        // Strictly current day only: event must cover today or start today. Future dates strictly excluded.
        const isToday =
          (itemStart && itemEnd && itemStart <= todayStr && itemEnd >= todayStr) ||
          itemStart === todayStr;
        if (!isToday) return false;
      } else if (dateMode === 'future') {
        // Future considerations: event starts after today
        const isFuture = itemStart > todayStr;
        if (!isFuture) return false;
      } else if (dateMode === 'previous') {
        if (dateFrom && dateTo) {
          const overlaps = itemStart <= dateTo && itemEnd >= dateFrom;
          if (!overlaps) return false;
        } else if (dateFrom) {
          if (itemEnd < dateFrom) return false;
        } else if (dateTo) {
          if (itemStart > dateTo) return false;
        } else {
          // Historical: ended before today
          if (itemEnd >= todayStr) return false;
        }
      }

      // 2. Search query
      const query = searchQuery.toLowerCase().trim();
      if (query) {
        const name = (row.studentName || '').toLowerCase();
        const roll = (row.enrollmentNumber || '').toLowerCase();
        if (!name.includes(query) && !roll.includes(query)) return false;
      }

      // 3. Section filter
      if (sectionFilter && sectionFilter !== 'All') {
        const targetSec = sectionFilter.toString().toUpperCase().replace(/^SECTION\s*/i, '').replace(/^CSE-/i, '').trim();
        const rowSec = (row.sectionName || '').toUpperCase();
        if (rowSec !== targetSec && !rowSec.includes(targetSec)) return false;
      }

      // 4. Semester filter
      if (semesterFilter && semesterFilter !== 'All Semesters') {
        const targetSem = parseInt(semesterFilter.toString().replace(/\D/g, ''), 10);
        if (Number(targetSem) !== Number(row.semester)) return false;
      }

      return true;
    });
  };

  const filteredConsiderations = useMemo(
    () => filterRows(expandedConsiderationRows),
    [expandedConsiderationRows, dateMode, dateFrom, dateTo, searchQuery, sectionFilter, semesterFilter, todayStr]
  );

  const filteredLeaves = useMemo(
    () => filterRows(expandedLeaveRows),
    [expandedLeaveRows, dateMode, dateFrom, dateTo, searchQuery, sectionFilter, semesterFilter, todayStr]
  );

  const filteredList = activeTab === 'considerations' ? filteredConsiderations : filteredLeaves;

  const handleExportExcel = () => {
    setShowExportModal(true);
  };

  const handleExportCsv = () => {
    const list = filteredList;
    let csv = '';
    if (activeTab === 'considerations') {
      csv = 'Student Name,Enrollment,Section,Role,Periods,Time From,Time To,Date From,Date To,Number of Days,Status\n';
      list.forEach((row) => {
        const role = row.isLeader ? 'Group Leader' : row.isGroup ? 'Group Member' : 'Individual';
        csv += `"${row.studentName}","${row.enrollmentNumber}","${row.sectionName}","${role}","${row.periodsStr}","${row.timeFrom}","${row.timeTo}","${row.startDate}","${row.endDate}","${row.totalDays} Day${row.totalDays !== 1 ? 's' : ''}","APPROVED"\n`;
      });
    } else {
      csv = 'Student Name,Enrollment,Section,Category,Date From,Date To,Number of Days,Status\n';
      list.forEach((row) => {
        csv += `"${row.studentName}","${row.enrollmentNumber}","${row.sectionName}","${row.category}","${row.startDate}","${row.endDate}","${row.totalDays} Days","APPROVED"\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const scopeTag = dateMode === 'today' ? `today_${todayStr}` : `range_${dateFrom || 'start'}_to_${dateTo || 'end'}`;
    link.setAttribute('download', `${activeTab}_approved_ledger_${scopeTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGoogleSheet = () => {
    window.open('https://docs.google.com/spreadsheets/u/0/', '_blank');
  };

  // Execute formal landscape printing matching user requirements (Only Approved Students!)
  const executeGenerateReport = () => {
    setShowPrintModal(false);

    let reportList = activeTab === 'considerations' ? expandedConsiderationRows : expandedLeaveRows;

    // Filter by Semester
    if (targetPrintSemester !== 'All Semesters (Comprehensive Ledger)') {
      const targetSemNum = parseInt(targetPrintSemester.replace(/\D/g, ''), 10);
      reportList = reportList.filter((row) => Number(row.semester) === Number(targetSemNum));
    }

    // Filter by Section
    if (isTgView && assignedSection) {
      const tgSec = String(assignedSection).replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim().toUpperCase();
      reportList = reportList.filter((row) => (row.sectionName || '').toUpperCase() === tgSec);
    } else if (sectionFilter && sectionFilter !== 'All') {
      const targetSec = sectionFilter.toString().toUpperCase().replace(/^SECTION\s*/i, '').replace(/^CSE-/i, '').trim();
      reportList = reportList.filter((row) => {
        const rowSec = (row.sectionName || '').toUpperCase();
        return rowSec === targetSec || rowSec.includes(targetSec);
      });
    }

    // Filter by Print Date Scope
    if (printDateScope === 'today') {
      reportList = reportList.filter((row) => {
        const itemStart = row.startDate ? row.startDate.slice(0, 10) : '';
        const itemEnd = row.endDate ? row.endDate.slice(0, 10) : itemStart;
        return (
          (itemStart && itemEnd && itemStart <= todayStr && itemEnd >= todayStr) ||
          itemStart === todayStr
        );
      });
    } else if (printDateScope === 'future') {
      reportList = reportList.filter((row) => {
        const itemStart = row.startDate ? row.startDate.slice(0, 10) : '';
        return itemStart > todayStr;
      });
    } else if (printDateScope === 'previous') {
      if (printDateFrom && printDateTo) {
        reportList = reportList.filter((row) => {
          const itemStart = row.startDate ? row.startDate.slice(0, 10) : '';
          const itemEnd = row.endDate ? row.endDate.slice(0, 10) : itemStart;
          return itemStart <= printDateTo && itemEnd >= printDateFrom;
        });
      } else if (printDateFrom) {
        reportList = reportList.filter((row) => {
          const itemEnd = row.endDate ? row.endDate.slice(0, 10) : (row.startDate ? row.startDate.slice(0, 10) : '');
          return itemEnd >= printDateFrom;
        });
      } else if (printDateTo) {
        reportList = reportList.filter((row) => {
          const itemStart = row.startDate ? row.startDate.slice(0, 10) : '';
          return itemStart <= printDateTo;
        });
      } else {
        reportList = reportList.filter((row) => {
          const itemEnd = row.endDate ? row.endDate.slice(0, 10) : (row.startDate ? row.startDate.slice(0, 10) : '');
          return itemEnd < todayStr;
        });
      }
    }

    // Filter by Status Scope
    if (printStatusScope) {
      const allowedStatuses = printStatusScope.split(',').map((s) => s.trim().toUpperCase());
      reportList = reportList.filter((row) => allowedStatuses.includes((row.status || '').toUpperCase()));
    }

    // Secondary strict deduplication to ensure identical student slot records are never duplicated
    const seenPrintKeys = new Set();
    reportList = reportList.filter((row) => {
      const sId = (row.student?._id || row.enrollmentNumber || row.studentName || '').toString().trim().toLowerCase();
      const timeKey = `${row.startDate}_${row.endDate || row.startDate}_${row.timeFrom}_${row.timeTo}_${row.periodsStr}`;
      const compositeKey = `${sId}_${timeKey}`;
      if (seenPrintKeys.has(compositeKey)) return false;
      seenPrintKeys.add(compositeKey);
      return true;
    });

    if (reportList.length === 0) {
      const scopeLabel = !printStatusScope
        ? 'All Statuses'
        : printStatusScope.includes('APPROVED')
        ? 'Approved'
        : printStatusScope.includes('PENDING')
        ? 'Pending Review'
        : printStatusScope.includes('RECOMMENDED')
        ? 'Recommended by TG'
        : 'Rejected';
      alert(
        `No records found for the selected print scope (${scopeLabel}, ${
          printDateScope === 'today'
            ? `Today: ${formatDateSlash(todayStr)}`
            : printDateScope === 'future'
            ? 'Future / Upcoming Clearances'
            : `${formatDateSlash(printDateFrom)} to ${formatDateSlash(printDateTo)}`
        }).`
      );
      return;
    }

    const now = new Date();
    const formattedPrintTimestamp = `${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', { hour12: true })}`;
    const semDisplay = targetPrintSemester.includes('All Semesters')
      ? 'All Semesters'
      : targetPrintSemester;

    const dateScopeDisplay =
      printDateScope === 'today'
        ? `Today (${formatDateSlash(todayStr)})`
        : printDateScope === 'future'
        ? `Future / Upcoming Clearances`
        : `${formatDateSlash(printDateFrom) || 'Initial'} to ${formatDateSlash(printDateTo) || 'Latest'}`;

    const statusScopeDisplay = !printStatusScope
      ? 'All Statuses'
      : printStatusScope.includes('APPROVED')
      ? 'Approved Only'
      : printStatusScope.includes('PENDING')
      ? 'Pending Review Only'
      : printStatusScope.includes('RECOMMENDED')
      ? 'Recommended by TG'
      : printStatusScope.includes('REJECTED')
      ? 'Rejected Only'
      : 'Filtered';

    const reportTitle =
      activeTab === 'considerations'
        ? printStatusScope === 'APPROVED_BY_HOD,APPROVED'
          ? 'Official Approved Clearances'
          : 'Official Clearances Ledger'
        : printStatusScope === 'APPROVED_BY_HOD,APPROVED'
          ? 'Official Approved Clearances (Student Leaves)'
          : 'Official Leaves Ledger';

    const rowsHtml = reportList
      .map((row, idx) => {
        const studentName = row.studentName;
        const enrollNo = row.enrollmentNumber;
        const sec = row.sectionName;
        const periods = row.periodsStr;
        const timeStr = `${row.timeFrom} - ${row.timeTo}`;
        const dateStr = `${formatDateSlash(row.startDate)} - ${formatDateSlash(row.endDate)}`;
        const days = row.totalDays || 1;
        const roleTag = row.isLeader
          ? ' <span style="font-size:9px;color:#D97706;font-weight:900;">(LEAD)</span>'
          : row.isGroup
          ? ' <span style="font-size:9px;color:#4F46E5;font-weight:700;">(TEAM)</span>'
          : '';

        const st = (row.status || 'APPROVED').toUpperCase();
        let badgeStyle = 'color: #059669; background: #ECFDF5; border: 1px solid #A7F3D0;';
        let statusLabel = 'APPROVED';

        if (st.includes('REJECT')) {
          badgeStyle = 'color: #DC2626; background: #FEF2F2; border: 1px solid #FECACA;';
          statusLabel = 'REJECTED';
        } else if (st.includes('RECOMMEND')) {
          badgeStyle = 'color: #2563EB; background: #EFF6FF; border: 1px solid #BFDBFE;';
          statusLabel = 'RECOMMENDED';
        } else if (st.includes('PENDING')) {
          badgeStyle = 'color: #D97706; background: #FFFBEB; border: 1px solid #FDE68A;';
          statusLabel = 'PENDING';
        }

        return `
          <tr style="border-bottom: 1px solid #E2E8F0; font-size: 11px;">
            <td style="padding: 7px 6px; text-align: center; font-weight: 700; color: #64748B;">${idx + 1}</td>
            <td style="padding: 7px 8px; font-weight: 800; color: #0F172A;">${studentName}${roleTag}</td>
            <td style="padding: 7px 8px; font-family: monospace; color: #334155;">${enrollNo}</td>
            <td style="padding: 7px 6px; text-align: center; font-weight: 700; color: #1E3A8A;">${sec}</td>
            <td style="padding: 7px 8px; font-weight: 700; color: #334155;">${periods}</td>
            <td style="padding: 7px 8px; text-align: center; color: #475569;">${timeStr}</td>
            <td style="padding: 7px 8px; text-align: center; color: #475569; white-space: nowrap;">${dateStr}</td>
            <td style="padding: 7px 6px; text-align: center; font-weight: 800; color: #0F172A;">${days}</td>
            <td style="padding: 7px 8px; text-align: center;">
              <span style="font-weight: 800; font-size: 10px; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; ${badgeStyle}">
                ${statusLabel}
              </span>
            </td>
          </tr>
        `;
      })
      .join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to generate print report.');
      return;
    }

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>OIST CSE - ${reportTitle}</title>
          <style>
            @page {
              size: landscape;
              margin: 12mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0F172A;
              margin: 0;
              padding: 10px;
              background: #FFF;
            }
            .header-bar {
              border-top: 3px solid #1E40AF;
              padding-top: 14px;
              text-align: center;
              margin-bottom: 16px;
            }
            .title-main {
              font-size: 18px;
              font-weight: 900;
              color: #1E3A8A;
              margin: 0;
              letter-spacing: 0.5px;
            }
            .title-sub {
              font-size: 11px;
              font-weight: 700;
              color: #475569;
              margin: 3px 0 0 0;
            }
            .title-ledger {
              font-size: 13px;
              font-weight: 800;
              color: #0F172A;
              margin: 6px 0 0 0;
            }
            .meta-bar {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              font-weight: 700;
              color: #334155;
              border-top: 1px solid #CBD5E1;
              border-bottom: 1px solid #CBD5E1;
              padding: 6px 4px;
              margin-bottom: 12px;
              background-color: #F8FAFC;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              border: 1px solid #CBD5E1;
            }
            th {
              background-color: #F1F5F9;
              color: #475569;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              padding: 8px 6px;
              border: 1px solid #CBD5E1;
            }
            td {
              border: 1px solid #E2E8F0;
            }
            .signatures {
              display: flex;
              justify-content: space-between;
              margin-top: 36px;
              padding: 0 30px;
            }
            .sig-box {
              text-align: center;
            }
            .sig-title {
              font-size: 11px;
              font-weight: 800;
              color: #0F172A;
              margin: 0;
            }
            .sig-sub {
              font-size: 9.5px;
              color: #64748B;
              margin: 2px 0 0 0;
            }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <h1 class="title-main">ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY (OIST)</h1>
            <p class="title-sub">Department of Computer Science & Engineering • CampusFlow ERP</p>
            <h2 class="title-ledger">${reportTitle}</h2>
          </div>

          <div class="meta-bar">
            <span>Date Scope: <strong>${dateScopeDisplay}</strong></span>
            <span>Generated: ${formattedPrintTimestamp}</span>
            <span>Semester: ${semDisplay}</span>
            <span>Status Scope: <strong>${statusScopeDisplay}</strong></span>
            <span>Authorized by: Head of Department (HOD CSE)</span>
            <span>Total Records: <strong>${reportList.length} ${statusScopeDisplay}</strong></span>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 28px;">#</th>
                <th style="text-align: left;">Student Name</th>
                <th style="text-align: left;">Enrollment No.</th>
                <th>Section</th>
                <th style="text-align: left;">${activeTab === 'leaves' ? 'Category' : 'Lectures / Periods'}</th>
                <th>Time (From - To)</th>
                <th>Date (From - To)</th>
                <th>Number of Days</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="signatures">
            <div class="sig-box">
              <p class="sig-title">Department ERP Coordinator</p>
              <p class="sig-sub">OIST Bhopal • Department Academic Office</p>
            </div>
            <div class="sig-box">
              <p class="sig-title">Head of Department (HOD CSE)</p>
              <p class="sig-sub">Official Digital Sanction • 100% Approved Records</p>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showPreviousModal) {
          setShowPreviousModal(false);
        } else if (showPrintModal) {
          setShowPrintModal(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPreviousModal, showPrintModal, onClose]);

  return (
    <div
      data-appearance="light"
      className="ledger-modal-overlay animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* =========================================================================
          Desktop View: Screen 19 (Visible on >= 640px screens)
          ========================================================================= */}
      <section
        className="hidden sm:block shadow-2xl rounded-3xl bg-card border border-border p-5 sm:p-6 w-full max-w-6xl my-auto text-foreground relative max-h-[90vh] overflow-y-auto ledger-modal-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex justify-between items-start gap-6">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg bg-accent text-accent-foreground flex justify-center items-center shrink-0 size-11 shadow-2xs">
              <FileText className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-bold text-base text-foreground leading-snug">
                  ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY (OIST)
                </h1>
                <span className="font-semibold rounded-full bg-accent text-accent-foreground text-xs px-3 py-1 border border-sky-200">
                  CampusFlow ERP
                </span>
                <span className="font-semibold rounded-full bg-secondary text-secondary-foreground text-xs px-3 py-1 border border-indigo-200">
                  Approved Sanctions Only
                </span>
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                Department of Computer Science & Engineering • Approved Attendance Clearances
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground size-9 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Action Buttons Row */}
        <div className="border-b border-border flex mt-5 pb-4 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGoogleSheet}
            className="border border-border bg-card hover:bg-muted text-foreground font-medium text-xs sm:text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Table2 className="size-4 text-emerald-600" />
            Google Live Sheet
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="border border-border bg-card hover:bg-muted text-foreground font-medium text-xs sm:text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="size-4 text-emerald-600" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="border border-border bg-card hover:bg-muted text-foreground font-medium text-xs sm:text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="size-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="border border-border bg-card hover:bg-muted text-foreground font-medium text-xs sm:text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="size-4" />
            Print Report
          </button>
        </div>

        {/* Tabs & Date Filter Controls Row */}
        <div className="border-b border-border flex py-4 flex-wrap justify-between items-center gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('considerations')}
              className={`font-medium text-xs sm:text-sm px-4 py-2.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'considerations'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Attendance Consideration Records ({filteredConsiderations.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaves')}
              className={`font-medium text-xs sm:text-sm px-4 py-2.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'leaves'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Leave Application Records ({filteredLeaves.length})
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSwitchToToday}
              className={`font-medium text-xs sm:text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
                dateMode === 'today'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'border border-border bg-card hover:bg-muted text-foreground'
              }`}
            >
              <CalendarDays className="size-4" />
              Today ({formatDateSlash(todayStr)})
            </button>
            <button
              type="button"
              onClick={handleSwitchToFuture}
              className={`font-medium text-xs sm:text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
                dateMode === 'future'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-chart-3/10 text-foreground border border-chart-3 hover:bg-amber-100/50'
              }`}
            >
              <Sparkles className="size-4 text-amber-600" />
              Show Future Considerations
            </button>
            <button
              type="button"
              onClick={handleOpenPreviousModal}
              className={`font-medium text-xs sm:text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
                dateMode === 'previous'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-indigo-200'
              }`}
            >
              <History className="size-4" />
              Show Previous Considerations
            </button>
          </div>
        </div>

        {/* Assigned Scope & Search Row */}
        <div className="flex py-4 items-center gap-3 flex-wrap">
          {isTgView ? (
            <div className="font-semibold rounded-full bg-muted text-sm px-3.5 py-2 shrink-0 flex items-center gap-2 border border-border">
              <span>Assigned Scope:</span>
              <span className="rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs font-bold">
                Semester {assignedSemester || 5} • Section {assignedSection || 'B'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              {/* Semester Selector */}
              <div className="flex items-center gap-2 bg-muted/80 px-3 py-1.5 rounded-xl border border-border">
                <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">Semester:</span>
                <select
                  value={semesterFilter}
                  onChange={(e) => setSemesterFilter(e.target.value)}
                  className="bg-background text-foreground text-xs font-bold rounded-lg px-2.5 py-1 border border-input outline-none cursor-pointer focus:ring-2 focus:ring-primary shadow-2xs"
                >
                  <option value="All Semesters">All Semesters</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={`Semester ${s}`}>Semester {s}</option>
                  ))}
                </select>
              </div>

              {/* Section Selector */}
              <div className="flex items-center gap-2 bg-muted/80 px-3 py-1.5 rounded-xl border border-border">
                <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">Section:</span>
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="bg-background text-foreground text-xs font-bold rounded-lg px-2.5 py-1 border border-input outline-none cursor-pointer focus:ring-2 focus:ring-primary shadow-2xs"
                >
                  <option value="All">All Sections</option>
                  {dynamicSections.map((sec) => (
                    <option key={sec} value={sec}>Section {sec}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="relative flex-1 min-w-[200px]">
            <Search className="-translate-y-1/2 text-muted-foreground absolute top-1/2 left-3.5 size-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Search student or roll..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ledger-search-input ring-ring rounded-lg bg-background text-sm border border-input outline-none pr-3 w-full h-10 focus:ring-2 text-foreground placeholder:text-muted-foreground"
              style={{ paddingLeft: '2.75rem' }}
            />
          </div>
        </div>

        {/* Subheader Banner */}
        <div className="rounded-lg bg-muted text-sm border border-border flex px-4 py-3 justify-between items-center gap-4 flex-wrap">
          <div className="font-semibold text-foreground">
            APPROVED CLEARANCES: Official Approved {activeTab === 'considerations' ? 'Attendance Considerations' : 'Leave Applications'}
          </div>
          <div className="font-semibold rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs border border-sky-200">
            {dateMode === 'today'
              ? `Today's Live Sanctions (${formatDateSlash(todayStr)})`
              : dateMode === 'future'
              ? 'Upcoming Future Clearances'
              : `Previous Range: ${formatDateSlash(dateFrom) || 'Start'} to ${formatDateSlash(dateTo) || 'End'}`}
          </div>
          <div className="text-muted-foreground text-xs font-medium">
            Showing {filteredList.length} approved record(s) • Filtered by:{' '}
            <span className="font-semibold text-foreground">
              {semesterFilter === 'All Semesters' ? 'All Semesters' : semesterFilter}
              {sectionFilter !== 'All' ? ` • Section ${sectionFilter}` : ' • All Sections'}
            </span>
          </div>
        </div>

        {/* Table / Records Area */}
        <div className="rounded-lg border border-border mt-4 overflow-hidden bg-card">
          <div className="font-bold bg-muted text-xs grid ledger-grid-cols-7 border-b border-border text-foreground">
            <div className="border-r border-border p-3.5 flex items-center">Student Name</div>
            <div className="border-r border-border p-3.5 flex items-center">Enrollment No.</div>
            <div className="border-r border-border p-3.5 text-center flex items-center justify-center">Section</div>
            <div className="border-r border-border p-3.5 flex items-center">
              {activeTab === 'leaves' ? 'Category' : 'Lectures / Periods'}
            </div>
            <div className="text-center border-r border-border p-2.5 flex flex-col justify-center">
              <div>Time</div>
              <div className="text-muted-foreground grid grid-cols-2 gap-1 mt-1 font-semibold text-[11px]">
                <span>From</span>
                <span>To</span>
              </div>
            </div>
            <div className="text-center border-r border-border p-2.5 flex flex-col justify-center">
              <div>Date</div>
              <div className="text-muted-foreground grid grid-cols-2 gap-1 mt-1 font-semibold text-[11px]">
                <span>From</span>
                <span>To</span>
              </div>
            </div>
            <div className="p-3.5 text-center flex items-center justify-center">Number of Days</div>
          </div>

          {loading ? (
            <div className="text-center flex py-16 flex-col justify-center items-center min-h-56">
              <Clock className="size-7 text-primary animate-spin" />
              <div className="text-muted-foreground text-sm mt-3">Loading authorized clearances...</div>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center flex px-8 py-12 flex-col justify-center items-center min-h-56">
              <CalendarX2 className="text-muted-foreground size-7" />
              <div className="font-semibold text-sm mt-3 max-w-lg text-foreground">
                No approved {activeTab === 'considerations' ? 'attendance considerations' : 'leave applications'} sanctioned for today ({formatDateSlash(todayStr)}).
              </div>
              <div className="text-muted-foreground text-sm mt-2 max-w-xl">
                You can view upcoming future clearances or historical records from previous dates below.
              </div>
              <div className="flex mt-4 flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={handleSwitchToFuture}
                  className="rounded-md border border-border bg-card hover:bg-muted text-foreground text-sm font-medium px-4 py-2 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Sparkles className="size-4 text-amber-600" />
                  Show Future Considerations
                </button>
                <button
                  type="button"
                  onClick={handleOpenPreviousModal}
                  className="rounded-md border border-border bg-card hover:bg-muted text-foreground text-sm font-medium px-4 py-2 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <History className="size-4" />
                  Show Previous Considerations
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border text-xs">
              {filteredList.map((row, idx) => (
                <div
                  key={row._id || idx}
                  className="grid ledger-grid-cols-7 items-center hover:bg-muted/40 transition-colors bg-card"
                >
                  <div className="border-r border-border p-3.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-foreground text-sm truncate">{row.studentName}</span>
                      {row.isLeader && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                          ★ Lead
                        </span>
                      )}
                      {row.isGroup && !row.isLeader && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground border border-border shrink-0">
                          Team Member
                        </span>
                      )}
                    </div>
                    {row.eventTitle && (
                      <span className="text-[11px] text-muted-foreground block font-semibold mt-0.5 truncate">
                        [{row.eventTitle}]
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground block truncate max-w-xs mt-0.5">
                      {row.description || 'Approved consideration'}
                    </span>
                  </div>
                  <div className="border-r border-border p-3.5 font-mono text-muted-foreground text-xs truncate">
                    {row.enrollmentNumber}
                  </div>
                  <div className="border-r border-border p-3.5 text-center">
                    <span className="inline-flex items-center justify-center size-7 rounded-full bg-secondary text-secondary-foreground font-bold text-xs mx-auto border border-border">
                      {row.sectionName}
                    </span>
                  </div>
                  <div className="border-r border-border p-3.5 font-medium text-foreground text-xs truncate">
                    {row.periodsStr}
                  </div>
                  <div className="border-r border-border p-2.5 text-center font-mono text-muted-foreground text-[11px]">
                    <div className="grid grid-cols-2 gap-1 items-center">
                      <span className="truncate">{row.timeFrom || '—'}</span>
                      <span className="truncate">{row.timeTo || '—'}</span>
                    </div>
                  </div>
                  <div className="border-r border-border p-2.5 text-center font-mono text-muted-foreground text-[11px]">
                    <div className="grid grid-cols-2 gap-1 items-center">
                      <span className="font-medium whitespace-nowrap">{formatDateSlash(row.startDate)}</span>
                      <span className="font-medium whitespace-nowrap">{formatDateSlash(row.endDate || row.startDate)}</span>
                    </div>
                  </div>
                  <div className="p-3.5 text-center">
                    <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold whitespace-nowrap">
                      {row.totalDays ? `${row.totalDays} Day${row.totalDays !== 1 ? 's' : ''}` : '1 Day'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Authorized Sign-off Footer */}
        <div className="text-muted-foreground text-sm border-t border-border mt-4 pt-4">
          Authorized Sign-off:{' '}
          <span className="font-semibold text-foreground">
            Head of Department (HOD CSE) • Department of CSE
          </span>
        </div>
      </section>

      {/* =========================================================================
          Mobile View: Screen 20 (Visible on < 640px screens)
          ========================================================================= */}
      <div
        className="sm:hidden w-full max-w-md mx-auto my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shadow-sm rounded-xl bg-card border border-border flex flex-col w-full max-h-[92vh] overflow-hidden">
          {/* Mobile Header */}
          <div className="border-b border-border flex p-4 justify-between items-start gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="rounded-md bg-secondary text-primary flex justify-center items-center shrink-0 size-9">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-semibold text-base leading-5 text-foreground">
                    OIST Approved Clearances
                  </h1>
                  <span className="rounded-full font-semibold text-xs px-2.5 py-0.5 bg-accent text-accent-foreground">
                    CampusFlow ERP
                  </span>
                  <span className="rounded-full font-semibold text-xs px-2.5 py-0.5 bg-secondary text-secondary-foreground">
                    Approved Only
                  </span>
                </div>
                <p className="text-muted-foreground text-sm mt-1">{`Department of Computer Science & Engineering`}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 size-9 flex items-center justify-center transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Mobile Body */}
          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            {/* Action buttons */}
            <div className="grid gap-2">
              <button
                type="button"
                onClick={handleGoogleSheet}
                className="w-full min-h-11 rounded-lg bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Table2 className="size-4" />
                Google Live Sheet
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="w-full min-h-11 rounded-lg bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="size-4" />
                Export Excel
              </button>
              <div className="grid gap-2 grid-cols-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="w-full min-h-11 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="size-4" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="w-full min-h-11 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="size-4" />
                  Print Report
                </button>
              </div>
            </div>

            {/* Segmented Control */}
            <div className="rounded-md bg-muted grid p-1 grid-cols-2 gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('considerations')}
                className={`py-2 px-2 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'considerations'
                    ? 'bg-card text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground'
                }`}
              >
                Attendance Records ({filteredConsiderations.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('leaves')}
                className={`py-2 px-2 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'leaves'
                    ? 'bg-card text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground'
                }`}
              >
                Leave Records ({filteredLeaves.length})
              </button>
            </div>

            {/* Date Quick Toggles */}
            <div className="flex pb-1 gap-2 overflow-x-auto text-xs font-medium">
              <button
                type="button"
                onClick={handleSwitchToToday}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                  dateMode === 'today'
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'border border-border bg-card text-muted-foreground'
                }`}
              >
                Today · {formatDateSlash(todayStr)}
              </button>
              <button
                type="button"
                onClick={handleSwitchToFuture}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                  dateMode === 'future'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'border border-border bg-card text-muted-foreground'
                }`}
              >
                Future
              </button>
              <button
                type="button"
                onClick={handleOpenPreviousModal}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                  dateMode === 'previous'
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'border border-border bg-card text-muted-foreground'
                }`}
              >
                Previous
              </button>
            </div>

            {/* Scope / Filters & Search */}
            <div>
              {isTgView ? (
                <div className="font-medium text-sm flex mb-2 items-center gap-2">
                  <span>Assigned Scope:</span>
                  <span className="rounded-md font-semibold text-xs px-2.5 py-0.5 bg-secondary text-secondary-foreground">
                    Semester {assignedSemester || 5} • Section {assignedSection || 'B'}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Semester</label>
                    <select
                      value={semesterFilter}
                      onChange={(e) => setSemesterFilter(e.target.value)}
                      className="w-full text-xs font-bold h-9 px-2 rounded-lg border border-input bg-background outline-none text-foreground"
                    >
                      <option value="All Semesters">All Semesters</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={`Semester ${s}`}>Semester {s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Section</label>
                    <select
                      value={sectionFilter}
                      onChange={(e) => setSectionFilter(e.target.value)}
                      className="w-full text-xs font-bold h-9 px-2 rounded-lg border border-input bg-background outline-none text-foreground"
                    >
                      <option value="All">All Sections</option>
                      {dynamicSections.map((sec) => (
                        <option key={sec} value={sec}>Section {sec}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <input
                type="text"
                placeholder="Search student or roll..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-base h-11 px-3 rounded-lg border border-input bg-background outline-none text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Subheader */}
            <div className="flex justify-between items-start gap-3 pt-1">
              <div>
                <h2 className="font-semibold text-base text-foreground">
                  Approved clearances
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Official approved {activeTab === 'considerations' ? 'attendance considerations' : 'leave applications'}
                </p>
              </div>
              <span className="font-semibold rounded-md text-xs px-2.5 py-1 bg-accent text-accent-foreground shrink-0">
                Today’s live sanctions
              </span>
            </div>

            {/* Mobile Empty State Card or Records */}
            {filteredList.length === 0 ? (
              <div className="rounded-xl border border-border bg-card text-center flex px-4 py-8 flex-col items-center">
                <div className="rounded-full bg-secondary text-primary flex justify-center items-center size-12">
                  <CalendarDays className="size-6" />
                </div>
                <h3 className="font-semibold text-lg mt-4 text-foreground">
                  No approved clearances today
                </h3>
                <p className="text-muted-foreground text-base mt-2">
                  No approved attendance considerations sanctioned for {formatDateSlash(todayStr)}.
                </p>
                <p className="text-muted-foreground text-sm mt-3">
                  View future or previous clearances to find historical records.
                </p>
                <div className="grid mt-6 gap-2 w-full">
                  <button
                    type="button"
                    onClick={handleSwitchToFuture}
                    className="w-full min-h-11 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium flex items-center justify-center transition-colors cursor-pointer"
                  >
                    Show Future Considerations
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenPreviousModal}
                    className="w-full min-h-11 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium flex items-center justify-center transition-colors cursor-pointer"
                  >
                    Show Previous Considerations
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredList.map((row, idx) => (
                  <div key={row._id || idx} className="rounded-xl border border-border bg-card p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-foreground text-base">{row.studentName}</div>
                        <div className="text-xs font-mono text-muted-foreground">{row.enrollmentNumber}</div>
                      </div>
                      <span className="rounded-full bg-secondary text-secondary-foreground font-bold text-xs px-2.5 py-0.5">
                        Sec {row.sectionName}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Lectures:</span> {row.periodsStr}
                    </div>
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span><strong className="text-foreground">Time:</strong> {row.timeFrom} - {row.timeTo}</span>
                      <span><strong className="text-foreground">Date:</strong> {formatDateSlash(row.startDate)}</span>
                    </div>
                    <div className="pt-2 border-t border-border flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">{row.description || 'Approved consideration'}</span>
                      <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5 font-bold">
                        {row.totalDays ? `${row.totalDays} Day${row.totalDays !== 1 ? 's' : ''}` : '1 Day'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mobile Footer */}
          <div className="text-muted-foreground text-sm border-t border-border px-4 py-3">
            Authorized sign-off: Head of Department (HOD CSE)
          </div>
        </div>
      </div>

        {/* =======================================================================
            Modal: Select Date Range for Previous Data
            ======================================================================= */}
        {showPreviousModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setShowPreviousModal(false)}
          >
            <div
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative text-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div
                    style={{ backgroundColor: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE' }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                  >
                    <History size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 m-0">
                      {activeTab === 'considerations'
                        ? 'Show Previous Considerations'
                        : 'Show Previous Leaves'}
                    </h3>
                    <p className="text-xs text-slate-500 m-0 mt-0.5">
                      Select date range (From & To) to view previous records
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreviousModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 mt-4">
                {/* Quick Presets */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Quick Date Presets:
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { key: 'yesterday', label: 'Yesterday' },
                      { key: '7days', label: 'Last 7 Days' },
                      { key: '30days', label: 'Last 30 Days' },
                      { key: 'thisMonth', label: 'This Month' },
                    ].map((p) => {
                      const pDates = getPresetDates(p.key);
                      const isSelected =
                        activePreset === p.key ||
                        (pDates && pDates.from === modalFrom && pDates.to === modalTo);

                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => handleSelectPreset(p.key)}
                          style={
                            isSelected
                              ? {
                                  backgroundColor: '#4F46E5',
                                  color: '#FFFFFF',
                                  border: '1.5px solid #4338CA',
                                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)',
                                }
                              : {
                                  backgroundColor: '#F1F5F9',
                                  color: '#334155',
                                  border: '1px solid #CBD5E1',
                                }
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-primary text-white border-indigo-700 shadow-xs ring-2 ring-indigo-400/30'
                              : 'hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {isSelected && <Check size={13} className="text-white shrink-0 stroke-[2.5]" />}
                          <span>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* From and To inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      From Date:
                    </label>
                    <input
                      type="date"
                      value={modalFrom}
                      onChange={(e) => {
                        setModalFrom(e.target.value);
                        setActivePreset(null);
                      }}
                      style={{ backgroundColor: '#F8FAFC', color: '#0F172A', border: '1.5px solid #CBD5E1' }}
                      className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:outline-none transition-all cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      To Date:
                    </label>
                    <input
                      type="date"
                      value={modalTo}
                      onChange={(e) => {
                        setModalTo(e.target.value);
                        setActivePreset(null);
                      }}
                      style={{ backgroundColor: '#F8FAFC', color: '#0F172A', border: '1.5px solid #CBD5E1' }}
                      className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:outline-none transition-all cursor-pointer"
                    />
                  </div>
                </div>

                {dateError && (
                  <p className="text-xs text-rose-600 font-bold m-0">{dateError}</p>
                )}

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowPreviousModal(false)}
                    style={{
                      backgroundColor: '#F1F5F9',
                      color: '#334155',
                      border: '1px solid #CBD5E1',
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!modalFrom || !modalTo) {
                        setDateError('Please enter both From and To dates.');
                        return;
                      }
                      if (modalFrom > modalTo) {
                        setDateError('From Date cannot be later than To Date.');
                        return;
                      }
                      setDateFrom(modalFrom);
                      setDateTo(modalTo);
                      setDateMode('previous');
                      setShowPreviousModal(false);
                      fetchRecords({ from: modalFrom, to: modalTo });
                    }}
                    style={{
                      backgroundColor: '#4F46E5',
                      color: '#FFFFFF',
                      border: '1px solid #4338CA',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
                    }}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover active:bg-indigo-800 text-white flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <CheckCircle2 size={15} style={{ color: '#FFFFFF' }} />
                    <span style={{ color: '#FFFFFF' }}>Apply & View Records</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================================
            Image 3 Modal: Select Semester & Date Scope for Print Report
            ======================================================================= */}
        {showPrintModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setShowPrintModal(false)}
          >
            <div
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative text-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200 shadow-2xs">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 m-0">
                      Select Scope for Print
                    </h3>
                    <p className="text-xs text-slate-500 m-0 mt-0.5">
                      Choose semester and date scope for downloadable report (PRINT)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Content */}
              <div className="space-y-5 mt-5">
                {/* Semester Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Target Semester:
                  </label>
                  {isTgView ? (
                    <div className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800">
                      Semester {assignedSemester || 5} (TG Assigned Scope)
                    </div>
                  ) : (
                    <select
                      value={targetPrintSemester}
                      onChange={(e) => setTargetPrintSemester(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none transition-all cursor-pointer shadow-2xs"
                    >
                      <option value="All Semesters (Comprehensive Ledger)">
                        All Semesters (Comprehensive Ledger)
                      </option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={`Semester ${s}`}>
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Date Scope for Print */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Report Date Scope:
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPrintDateScope('today')}
                      style={
                        printDateScope === 'today'
                          ? { backgroundColor: '#4F46E5', color: '#FFFFFF', borderColor: '#4338CA' }
                          : { backgroundColor: '#F8FAFC', color: '#334155', borderColor: '#CBD5E1' }
                      }
                      className={`min-h-[40px] py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        printDateScope === 'today' ? 'shadow-xs' : 'hover:bg-slate-100'
                      }`}
                    >
                      <Calendar size={13} />
                      <span>Today</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintDateScope('future')}
                      style={
                        printDateScope === 'future'
                          ? { backgroundColor: '#D97706', color: '#FFFFFF', borderColor: '#B45309' }
                          : { backgroundColor: '#FFFBEB', color: '#92400E', borderColor: '#FCD34D' }
                      }
                      className={`min-h-[40px] py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        printDateScope === 'future' ? 'shadow-xs' : 'hover:bg-amber-100'
                      }`}
                    >
                      <Sparkles size={13} />
                      <span>Future</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintDateScope('previous')}
                      style={
                        printDateScope === 'previous'
                          ? { backgroundColor: '#4F46E5', color: '#FFFFFF', borderColor: '#4338CA' }
                          : { backgroundColor: '#F8FAFC', color: '#334155', borderColor: '#CBD5E1' }
                      }
                      className={`min-h-[40px] py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        printDateScope === 'previous' ? 'shadow-xs' : 'hover:bg-slate-100'
                      }`}
                    >
                      <History size={13} />
                      <span>Previous</span>
                    </button>
                  </div>

                  {printDateScope === 'previous' && (
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100 animate-in fade-in duration-100">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                          From Date:
                        </label>
                        <input
                          type="date"
                          value={printDateFrom}
                          onChange={(e) => setPrintDateFrom(e.target.value)}
                          style={{ backgroundColor: '#F8FAFC', color: '#0F172A', border: '1.5px solid #CBD5E1' }}
                          className="w-full px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                          To Date:
                        </label>
                        <input
                          type="date"
                          value={printDateTo}
                          onChange={(e) => setPrintDateTo(e.target.value)}
                          style={{ backgroundColor: '#F8FAFC', color: '#0F172A', border: '1.5px solid #CBD5E1' }}
                          className="w-full px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600 transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Scope Selection */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 m-0">
                      <Filter size={13} className="text-blue-600" />
                      <span>Status Scope:</span>
                    </label>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                      {!printStatusScope
                        ? 'All Statuses'
                        : printStatusScope.includes('APPROVED')
                        ? 'Approved Only'
                        : printStatusScope.includes('REJECTED')
                        ? 'Rejected Only'
                        : printStatusScope.includes('PENDING')
                        ? 'Pending Only'
                        : 'Filtered'}
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={printStatusScope}
                      onChange={(e) => setPrintStatusScope(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 hover:border-blue-500 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none transition-all cursor-pointer shadow-2xs"
                    >
                      <option value="">All Statuses (Pending, Approved, Recommended, Rejected)</option>
                      <option value="APPROVED_BY_HOD,APPROVED">Approved Only</option>
                      <option value="PENDING">Pending Review Only</option>
                      <option value="RECOMMENDED_BY_TG">Recommended by TG</option>
                      <option value="REJECTED_BY_HOD,REJECTED_BY_TG,REJECTED">Rejected Only</option>
                    </select>
                  </div>
                </div>

                <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200 text-blue-900 text-xs font-medium flex items-start gap-2.5 leading-relaxed">
                  <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    {!printStatusScope
                      ? 'Generating comprehensive report across all workflow stages (Pending, Approved, Recommended, Rejected).'
                      : printStatusScope.includes('APPROVED')
                      ? 'Report generation enforces 100% approved sanction criteria. Rejected applications are strictly excluded.'
                      : printStatusScope.includes('PENDING')
                      ? 'Report will display pending applications awaiting institutional review.'
                      : printStatusScope.includes('RECOMMENDED')
                      ? 'Report will display applications recommended by Teacher Guardian (TG).'
                      : 'Report will display rejected applications.'}
                  </span>
                </div>

                {/* Footer Buttons: Cancel & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowPrintModal(false)}
                    style={{
                      backgroundColor: '#F1F5F9',
                      color: '#334155',
                      border: '1px solid #CBD5E1',
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer transition-colors min-h-[42px] flex items-center justify-center order-2 sm:order-1"
                  >
                    Cancel
                  </button>
                  <div className="flex items-center gap-2.5 order-1 sm:order-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPrintModal(false);
                        setShowExportModal(true);
                      }}
                      style={{
                        backgroundColor: '#059669',
                        color: '#FFFFFF',
                        border: '1px solid #047857',
                        boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer transition-all hover:bg-emerald-700 min-h-[42px] shadow-xs flex-1 sm:flex-none"
                    >
                      <Download size={15} style={{ color: '#FFFFFF' }} />
                      <span style={{ color: '#FFFFFF' }}>Export Excel (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={executeGenerateReport}
                      style={{
                        backgroundColor: '#4F46E5',
                        color: '#FFFFFF',
                        border: '1px solid #4338CA',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                      }}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover active:bg-indigo-800 text-white flex items-center justify-center gap-2 cursor-pointer transition-all min-h-[42px] shadow-xs flex-1 sm:flex-none"
                    >
                      <Printer size={15} style={{ color: '#FFFFFF' }} />
                      <span style={{ color: '#FFFFFF' }}>Generate PDF / Print</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showExportModal && (
          <AttendanceLeaveReportsModal
            modalData={{
              initialType: activeTab,
              isTgView: isTgView,
              assignedSemester: assignedSemester,
              assignedSection: assignedSection,
              initialSemester:
                isTgView && assignedSemester
                  ? assignedSemester
                  : (
                    semesterFilter && semesterFilter !== 'All Semesters'
                      ? parseInt(semesterFilter.replace(/\D/g, ''), 10)
                      : 'ALL'
                  ),
              initialFrom: dateMode === 'previous' ? dateFrom : (dateMode === 'today' ? todayStr : ''),
              initialTo: dateMode === 'previous' ? dateTo : (dateMode === 'today' ? todayStr : ''),
            }}
            onClose={() => setShowExportModal(false)}
          />
        )}
      </div>
    );
  }
