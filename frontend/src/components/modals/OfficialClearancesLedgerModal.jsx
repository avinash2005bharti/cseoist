import React, { useState, useEffect, useMemo } from 'react';
import { reportApi } from '../../api';
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
  History,
  Filter,
  ArrowLeft,
  Clock,
  Sparkles,
} from 'lucide-react';

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
  const [dateMode, setDateMode] = useState('today');
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
    const letters = new Set(['A', 'B', 'C', 'D']);
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
  const [showExportModal, setShowExportModal] = useState(false);

  const fetchRecords = async (overrideParams = null) => {
    setLoading(true);
    try {
      const params = {
        status: 'APPROVED_BY_HOD,APPROVED',
        approvedOnly: true,
        limit: 500,
        ...(overrideParams || {}),
      };

      const [conRes, leaveRes] = await Promise.allSettled([
        reportApi.getConsiderations(params),
        reportApi.getLeaves(params),
      ]);

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
      // STRICT FILTER: Only approved considerations
      const approvedCons = rawConList.filter(
        (c) => c.status === 'APPROVED_BY_HOD' || c.status === 'APPROVED'
      );
      setConsiderations(approvedCons);

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
      // STRICT FILTER: Only approved leaves
      const approvedLeaves = rawLeaveList.filter(
        (l) => l.status === 'APPROVED_BY_HOD' || l.status === 'APPROVED'
      );
      setLeaves(approvedLeaves);
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
  }, []);

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
  const expandedConsiderationRows = useMemo(() => {
    const rows = [];
    considerations.forEach((item) => {
      const isApproved = item.status === 'APPROVED' || item.status === 'APPROVED_BY_HOD';
      if (!isApproved) return;

      const excludedIds = new Set(
        (item.studentAudits || [])
          .filter((a) => a.status === 'EXCLUDED')
          .map((a) => (a.student?._id || a.student)?.toString())
      );

      const leader = item.student;
      const leaderId = (leader?._id || leader)?.toString();
      const isGroup = Boolean(item.isGroup || (item.groupMembers && item.groupMembers.length > 0));

      // 1. Leader / Applicant
      if (leader && !excludedIds.has(leaderId)) {
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
          description: item.description || item.reason || 'Approved attendance consideration',
          selectedPeriods: item.selectedPeriods,
          requestedPeriods: item.requestedPeriods,
          periodsStr: item.selectedPeriods?.length
            ? item.selectedPeriods.join(', ')
            : item.requestedPeriods
            ? `P1 - P${item.requestedPeriods}`
            : 'P2, P3, P4',
          timeFrom: item.timeFrom || '10:50 AM',
          timeTo: item.timeTo || '01:20 PM',
          startDate: item.startDate,
          endDate: item.endDate || item.startDate,
          totalDays: item.totalDays || 1,
          status: item.status,
          createdAt: item.createdAt,
        });
      }

      // 2. Non-excluded Group Members
      if (isGroup && Array.isArray(item.groupMembers)) {
        item.groupMembers.forEach((member, mIdx) => {
          if (!member) return;
          const memberId = (member._id || member)?.toString();
          if (!memberId || memberId === leaderId) return;
          if (excludedIds.has(memberId)) return;

          const memberSec = member.section || leader?.section;
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
            description: item.description || item.reason || 'Approved attendance consideration',
            selectedPeriods: item.selectedPeriods,
            requestedPeriods: item.requestedPeriods,
            periodsStr: item.selectedPeriods?.length
              ? item.selectedPeriods.join(', ')
              : item.requestedPeriods
              ? `P1 - P${item.requestedPeriods}`
              : 'P2, P3, P4',
            timeFrom: item.timeFrom || '10:50 AM',
            timeTo: item.timeTo || '01:20 PM',
            startDate: item.startDate,
            endDate: item.endDate || item.startDate,
            totalDays: item.totalDays || 1,
            status: item.status,
            createdAt: item.createdAt,
          });
        });
      }
    });
    return rows;
  }, [considerations]);

  // Expand leaves into individual clearance rows
  const expandedLeaveRows = useMemo(() => {
    return leaves
      .filter((item) => item.status === 'APPROVED' || item.status === 'APPROVED_BY_HOD')
      .map((item, idx) => {
        const student = item.student || {};
        return {
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
          description: item.reason || item.description || 'Approved student leave',
          periodsStr: item.leaveType || 'Sanctioned Leave',
          timeFrom: 'Full Day',
          timeTo: 'Full Day',
          startDate: item.startDate,
          endDate: item.endDate || item.startDate,
          totalDays: item.totalDays || 1,
          status: item.status,
          createdAt: item.createdAt,
        };
      });
  }, [leaves]);

  const filterRows = (rows) => {
    return rows.filter((row) => {
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

    if (reportList.length === 0) {
      alert(
        `No approved sanction records found for the selected print scope (${
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

    const reportTitle =
      activeTab === 'considerations'
        ? 'Official Approved Clearances'
        : 'Official Approved Clearances (Student Leaves)';

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
              <span style="font-weight: 800; font-size: 10px; color: #059669; text-transform: uppercase; background: #ECFDF5; padding: 2px 6px; border-radius: 4px; border: 1px solid #A7F3D0;">
                APPROVED
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
            <span>Authorized by: Head of Department (HOD CSE)</span>
            <span>Total Sanctions: <strong>${reportList.length} Approved</strong></span>
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
    <div className="modal-backdrop py-4 sm:py-6" onClick={onClose}>
      <div
        className="modal-container clearances-ledger-modal max-w-7xl w-[96vw] max-h-[86vh] overflow-y-auto bg-white px-5 sm:px-8 py-4 sm:py-6 text-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl relative block my-auto"
        style={{ display: 'block', maxHeight: '86vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Close Button - Placed at Top-Right Corner */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC',
            color: '#64748B',
            border: '1.5px solid #CBD5E1',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            zIndex: 20,
          }}
          className="hover:bg-slate-100 hover:text-slate-900"
          aria-label="Close"
          title="Close (Esc)"
        >
          <X size={18} />
        </button>

        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1 pb-3.5 border-b border-slate-200 pr-12">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200 shadow-2xs">
              <FileText size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 m-0">
                  ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY (OIST)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black">
                  CampusFlow ERP
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                  Approved Sanctions Only
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium m-0 mt-0.5">
                Department of Computer Science & Engineering • Approved Attendance Clearances
              </p>
            </div>
          </div>

          {/* Action Buttons: Google live sheet, export excel, csv, print report */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={handleGoogleSheet}
              className="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet size={14} className="text-emerald-700" />
              <span>Google Live Sheet</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Download size={14} className="text-emerald-700" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>

            {/* Print Report Button */}
            <button
              onClick={() => setShowPrintModal(true)}
              className="px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Printer size={14} />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* Row 1: Navigation Tabs (Left) and Date Mode Action (Right) */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          {/* Primary Tabs - shrink-0 ensures titles are never squished or hidden */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('considerations')}
              style={
                activeTab === 'considerations'
                  ? { backgroundColor: '#2563EB', color: '#FFFFFF', borderColor: '#1D4ED8', boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)' }
                  : { backgroundColor: '#F1F5F9', color: '#334155', borderColor: '#CBD5E1' }
              }
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap border flex items-center gap-2 ${
                activeTab === 'considerations' ? '' : 'hover:bg-slate-200'
              }`}
            >
              <span>Attendance Consideration Records ({filteredConsiderations.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaves')}
              style={
                activeTab === 'leaves'
                  ? { backgroundColor: '#2563EB', color: '#FFFFFF', borderColor: '#1D4ED8', boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)' }
                  : { backgroundColor: '#F1F5F9', color: '#334155', borderColor: '#CBD5E1' }
              }
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap border flex items-center gap-2 ${
                activeTab === 'leaves' ? '' : 'hover:bg-slate-200'
              }`}
            >
              <span>Leave Application Records ({filteredLeaves.length})</span>
            </button>
          </div>

          {/* Date Scope Controls: Today, Future, Previous */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Today Button */}
            <button
              type="button"
              onClick={handleSwitchToToday}
              style={
                dateMode === 'today'
                  ? { backgroundColor: '#2563EB', color: '#FFFFFF', borderColor: '#1D4ED8', boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)' }
                  : { backgroundColor: '#F8FAFC', color: '#334155', borderColor: '#CBD5E1' }
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                dateMode === 'today' ? '' : 'hover:bg-slate-100'
              }`}
              title="Show only considerations/leaves active on current day"
            >
              <Calendar size={13} style={{ color: dateMode === 'today' ? '#FFFFFF' : '#2563EB' }} />
              <span>Today ({formatDateSlash(todayStr)})</span>
            </button>

            {/* Show Future Considerations Button */}
            <button
              type="button"
              onClick={handleSwitchToFuture}
              style={
                dateMode === 'future'
                  ? { backgroundColor: '#D97706', color: '#FFFFFF', borderColor: '#B45309', boxShadow: '0 2px 4px rgba(217, 119, 6, 0.25)' }
                  : { backgroundColor: '#FFFBEB', color: '#92400E', borderColor: '#FCD34D' }
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                dateMode === 'future' ? '' : 'hover:bg-amber-100'
              }`}
              title="Show approved future considerations/leaves scheduled for upcoming dates"
            >
              <Sparkles size={13} style={{ color: dateMode === 'future' ? '#FFFFFF' : '#D97706' }} />
              <span>
                {activeTab === 'considerations'
                  ? 'Show Future Considerations'
                  : 'Show Future Leaves'}
              </span>
            </button>

            {/* Show Previous Considerations Button */}
            <button
              type="button"
              onClick={handleOpenPreviousModal}
              style={
                dateMode === 'previous'
                  ? { backgroundColor: '#4F46E5', color: '#FFFFFF', borderColor: '#4338CA', boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)' }
                  : { backgroundColor: '#EEF2FF', color: '#312E81', borderColor: '#C7D2FE' }
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                dateMode === 'previous' ? '' : 'hover:bg-indigo-100'
              }`}
              title="View historical clearances from previous dates"
            >
              <History size={13} style={{ color: dateMode === 'previous' ? '#FFFFFF' : '#4F46E5' }} />
              <span>
                {activeTab === 'considerations'
                  ? 'Show Previous Considerations'
                  : 'Show Previous Leaves'}
              </span>
            </button>

            {/* If in previous mode, allow changing custom date range */}
            {dateMode === 'previous' && (
              <button
                type="button"
                onClick={handleOpenPreviousModal}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                title="Change custom date range"
              >
                <Filter size={13} className="text-slate-500" />
                <span>Change Dates</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Filter Dropdowns & Search Box */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Scope badges or Semester/Section selectors */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {isTgView ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold">
                <span>Assigned Scope:</span>
                <span
                  style={{ backgroundColor: '#2563EB', color: '#FFFFFF' }}
                  className="px-2.5 py-0.5 rounded-md text-[11px] font-black"
                >
                  Semester {assignedSemester || 5} • Section {assignedSection || 'B'}
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-600">Semester:</span>
                  <select
                    value={semesterFilter}
                    onChange={(e) => setSemesterFilter(e.target.value)}
                    className="px-2 py-0.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="All Semesters">All Semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={`Semester ${s}`}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-600">Section:</span>
                  <select
                    value={sectionFilter}
                    onChange={(e) => setSectionFilter(e.target.value)}
                    className="px-2 py-0.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Sections</option>
                    {dynamicSections.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Right: Search Box */}
          <div style={{ position: 'relative' }} className="flex-1 sm:flex-initial min-w-[240px]">
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94A3B8',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or roll..."
              style={{
                paddingLeft: '38px',
                paddingRight: '14px',
                paddingTop: '7px',
                paddingBottom: '7px',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                border: '1.5px solid #CBD5E1',
                borderRadius: '12px',
                outline: 'none',
                width: '100%',
                fontSize: '12px',
                boxSizing: 'border-box',
              }}
              className="sm:w-64 shadow-2xs focus:border-blue-500"
            />
          </div>
        </div>

        {/* Subhead Banner with Current Scope State */}
        <div className="mt-4 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-slate-800">
              APPROVED CLEARANCES:{' '}
              {activeTab === 'considerations'
                ? 'Official Approved Attendance Considerations'
                : 'Official Approved Student Leave Applications'}
            </span>
            {dateMode === 'today' ? (
              <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-extrabold text-[11px] flex items-center gap-1">
                <Clock size={11} /> Today's Live Sanctions ({formatDateSlash(todayStr)})
              </span>
            ) : dateMode === 'future' ? (
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[11px] flex items-center gap-1">
                <Sparkles size={11} className="text-amber-700" /> Future Clearances (Upcoming)
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 font-extrabold text-[11px] flex items-center gap-1">
                <History size={11} /> Previous Range: {formatDateSlash(dateFrom) || 'Start'} to {formatDateSlash(dateTo) || 'End'}
              </span>
            )}
          </div>
          <span className="text-slate-500 font-semibold shrink-0">
            Showing {filteredList.length} approved record(s) • Filtered by: {semesterFilter}
          </span>
        </div>

        {/* Ledger Table (Approved Students Only, No Clipped Columns) */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-visible">
          <table className="w-full text-left border-collapse text-xs min-w-[980px]">
            <thead className="sticky top-0 z-10 bg-slate-100 shadow-xs">
              <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                <th className="sticky top-0 z-10 p-3.5 border-r border-slate-200 bg-slate-100 w-[280px]">Student Name</th>
                <th className="sticky top-0 z-10 p-3.5 border-r border-slate-200 bg-slate-100 w-[140px]">Enrollment No.</th>
                <th className="sticky top-0 z-10 p-3.5 border-r border-slate-200 bg-slate-100 text-center w-[75px]">Section</th>
                <th className="sticky top-0 z-10 p-3.5 border-r border-slate-200 bg-slate-100 w-[120px]">
                  {activeTab === 'leaves' ? 'Category' : 'Lectures / Periods'}
                </th>
                <th className="sticky top-0 z-10 p-3.5 border-r border-slate-200 bg-slate-100 text-center w-[160px]" colSpan={2}>
                  Time
                  <div className="grid grid-cols-2 text-[10px] font-bold text-slate-500 border-t border-slate-200 mt-1 pt-1">
                    <span>From</span>
                    <span>To</span>
                  </div>
                </th>
                <th className="sticky top-0 z-10 p-3.5 border-r border-slate-200 bg-slate-100 text-center w-[190px]" colSpan={2}>
                  Date
                  <div className="grid grid-cols-2 text-[10px] font-bold text-slate-500 border-t border-slate-200 mt-1 pt-1">
                    <span>From</span>
                    <span>To</span>
                  </div>
                </th>
                <th className="sticky top-0 z-10 p-3.5 bg-slate-100 text-center w-[130px]">Number of Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-400 font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <Clock size={16} className="animate-spin text-blue-600" />
                      <span>Loading authorized records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-400 font-semibold">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                      <Calendar size={28} className="text-slate-300" />
                      <p className="text-sm font-bold text-slate-700 m-0">
                        {dateMode === 'today'
                          ? `No approved ${activeTab === 'considerations' ? 'attendance considerations' : 'leave applications'} sanctioned for today (${formatDateSlash(todayStr)}).`
                          : dateMode === 'future'
                          ? `No approved upcoming ${activeTab === 'considerations' ? 'attendance considerations' : 'leave applications'} found for future dates.`
                          : `No approved ${activeTab === 'considerations' ? 'attendance considerations' : 'leave applications'} found between ${formatDateSlash(dateFrom)} and ${formatDateSlash(dateTo)}.`}
                      </p>
                      <p className="text-xs text-slate-400 m-0 text-center">
                        {dateMode === 'today'
                          ? 'You can view upcoming future clearances or historical records from previous dates below.'
                          : dateMode === 'future'
                          ? 'You can switch back to today’s view or inspect previous historical records.'
                          : 'Try switching to today, upcoming future dates, or adjusting the date range.'}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
                        {dateMode !== 'today' && (
                          <button
                            type="button"
                            onClick={handleSwitchToToday}
                            className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
                          >
                            <Calendar size={14} />
                            <span>View Today ({formatDateSlash(todayStr)})</span>
                          </button>
                        )}
                        {dateMode !== 'future' && (
                          <button
                            type="button"
                            onClick={handleSwitchToFuture}
                            className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
                          >
                            <Sparkles size={14} className="text-amber-600" />
                            <span>
                              Show Future{' '}
                              {activeTab === 'considerations' ? 'Considerations' : 'Leaves'}
                            </span>
                          </button>
                        )}
                        {dateMode !== 'previous' && (
                          <button
                            type="button"
                            onClick={handleOpenPreviousModal}
                            className="px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
                          >
                            <History size={14} />
                            <span>
                              Show Previous{' '}
                              {activeTab === 'considerations' ? 'Considerations' : 'Leaves'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredList.map((row, idx) => {
                  const studentName = row.studentName;
                  const rollNo = row.enrollmentNumber;
                  const secName = row.sectionName;
                  const periodsStr = row.periodsStr;
                  const timeFrom = row.timeFrom;
                  const timeTo = row.timeTo;
                  const dateFromStr = formatDateSlash(row.startDate);
                  const dateToStr = formatDateSlash(row.endDate || row.startDate);
                  const isLead = row.isLeader;
                  const isTeam = row.isGroup && !row.isLeader;

                  return (
                    <tr key={row._id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 border-r border-slate-100">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-slate-900 text-xs">{studentName}</span>
                          {isLead && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                              ★ Lead
                            </span>
                          )}
                          {isTeam && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Team Member
                            </span>
                          )}
                        </div>
                        {row.eventTitle && (
                          <span className="text-[11px] text-slate-600 block font-bold mt-0.5">
                            [{row.eventTitle}]
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 block truncate max-w-xs mt-0.5">
                          {row.description || 'Approved attendance consideration'}
                        </span>
                      </td>
                      <td className="p-3.5 border-r border-slate-100 font-mono text-slate-700 text-xs">
                        {rollNo}
                      </td>
                      <td className="p-3.5 border-r border-slate-100 text-center">
                        <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-black text-xs border border-blue-200 flex items-center justify-center mx-auto shadow-2xs">
                          {secName}
                        </div>
                      </td>
                      <td className="p-3.5 border-r border-slate-100 font-bold text-slate-700 text-xs">
                        {periodsStr}
                      </td>
                      <td className="p-3.5 border-r border-slate-100 text-center text-slate-600 font-mono text-xs">
                        {timeFrom}
                      </td>
                      <td className="p-3.5 border-r border-slate-100 text-center text-slate-600 font-mono text-xs">
                        {timeTo}
                      </td>
                      <td className="p-3.5 border-r border-slate-100 text-center text-slate-600 whitespace-nowrap font-mono text-xs">
                        {dateFromStr}
                      </td>
                      <td className="p-3.5 border-r border-slate-100 text-center text-slate-600 whitespace-nowrap font-mono text-xs">
                        {dateToStr}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black shadow-2xs">
                          {row.totalDays ? `${row.totalDays} Day${row.totalDays !== 1 ? 's' : ''}` : '1 Day'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            Authorized Sign-off:{' '}
            <strong className="text-slate-800">
              Head of Department (HOD CSE) • Department of CSE
            </strong>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition-colors cursor-pointer self-end sm:self-auto shadow-xs"
          >
            Close Window
          </button>
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
                                  backgroundColor: '#2563EB',
                                  color: '#FFFFFF',
                                  border: '1.5px solid #1D4ED8',
                                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
                                }
                              : {
                                  backgroundColor: '#F1F5F9',
                                  color: '#334155',
                                  border: '1px solid #CBD5E1',
                                }
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-400/30'
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
                      backgroundColor: '#2563EB',
                      color: '#FFFFFF',
                      border: '1px solid #1D4ED8',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                    }}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center gap-2 cursor-pointer transition-all"
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
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative text-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
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
              <div className="space-y-4 mt-4">
                {/* Semester Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
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
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none transition-all cursor-pointer"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Report Date Scope:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPrintDateScope('today')}
                      style={
                        printDateScope === 'today'
                          ? { backgroundColor: '#2563EB', color: '#FFFFFF', borderColor: '#1D4ED8' }
                          : { backgroundColor: '#F8FAFC', color: '#334155', borderColor: '#CBD5E1' }
                      }
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
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
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
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
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        printDateScope === 'previous' ? 'shadow-xs' : 'hover:bg-slate-100'
                      }`}
                    >
                      <History size={13} />
                      <span>Previous</span>
                    </button>
                  </div>

                  {printDateScope === 'previous' && (
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 animate-in fade-in duration-100">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          From Date:
                        </label>
                        <input
                          type="date"
                          value={printDateFrom}
                          onChange={(e) => setPrintDateFrom(e.target.value)}
                          style={{ backgroundColor: '#F8FAFC', color: '#0F172A', border: '1.5px solid #CBD5E1' }}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          To Date:
                        </label>
                        <input
                          type="date"
                          value={printDateTo}
                          onChange={(e) => setPrintDateTo(e.target.value)}
                          style={{ backgroundColor: '#F8FAFC', color: '#0F172A', border: '1.5px solid #CBD5E1' }}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>
                    Report generation enforces 100% approved sanction criteria. Rejected applications are strictly excluded.
                  </span>
                </div>

                {/* Footer Buttons: Cancel & Generate PDF / Print */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowPrintModal(false)}
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
                      setShowPrintModal(false);
                      setShowExportModal(true);
                    }}
                    style={{
                      backgroundColor: '#059669',
                      color: '#FFFFFF',
                      border: '1px solid #047857',
                      boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 cursor-pointer transition-all hover:bg-emerald-700"
                  >
                    <Download size={15} style={{ color: '#FFFFFF' }} />
                    <span style={{ color: '#FFFFFF' }}>Export Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={executeGenerateReport}
                    style={{
                      backgroundColor: '#2563EB',
                      color: '#FFFFFF',
                      border: '1px solid #1D4ED8',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                    }}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Printer size={15} style={{ color: '#FFFFFF' }} />
                    <span style={{ color: '#FFFFFF' }}>Generate PDF / Print</span>
                  </button>
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
    </div>
  );
}
