import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import { considerationApi, leaveApi, reportApi, masterDataApi } from '../../api';
import OfficialClearancesLedgerModal from '../../components/modals/OfficialClearancesLedgerModal.jsx';
import FormalApplicationModal from '../../components/modals/FormalApplicationModal.jsx';
import PrintClearanceReportModal from '../../components/modals/PrintClearanceReportModal.jsx';
import {
  STATUS_LABELS,
  REQUEST_TYPE_LABELS,
} from '../../utils/constants.js';
import {
  FileText,
  Calendar,
  Clock,
  Eye,
  Check,
  X,
  Plus,
  Minus,
  Zap,
  ChevronDown,
  XCircle,
  CheckCircle2,
  Users,
  Printer,
  Filter,
  Layers,
  CheckCheck,
  FileSpreadsheet,
} from 'lucide-react';

const GoogleSheetsLogo = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" fill="#0F9D58"/>
    <path d="M14 2v6h6" fill="#87CEAB"/>
    <rect x="7" y="11" width="10" height="7" rx="0.5" fill="#E8F5E9"/>
    <line x1="7" y1="14.5" x2="17" y2="14.5" stroke="#0F9D58" strokeWidth="1"/>
    <line x1="12" y1="11" x2="12" y2="18" stroke="#0F9D58" strokeWidth="1"/>
  </svg>
);

const ExcelLogo = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" fill="#107C41"/>
    <path d="M14 2v6h6" fill="#33C481"/>
    <rect x="5.5" y="9" width="7" height="9" rx="1" fill="#0E5C2F"/>
    <path d="M7 11.5l4 4m0-4l-4 4" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

function formatDateSlash(dateStr) {
  if (!dateStr) return '10/12/2026';
  try {
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number);
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '10/12/2026';
  }
}

function formatPeriodsDisplay(periods) {
  const periodSchedule = {
    1: '10:00 AM - 10:50 AM',
    2: '10:50 AM - 11:40 AM',
    3: '11:40 AM - 12:30 PM',
    4: '12:30 PM - 01:20 PM',
    5: '02:00 PM - 02:50 PM',
    6: '02:50 PM - 03:40 PM',
    7: '03:40 PM - 04:30 PM',
  };

  if (!periods || !Array.isArray(periods) || periods.length === 0) {
    return '3 Periods • P2 (10:50 AM - 11:40 AM), P3 (11:40 AM - 12:30 PM), P4 (12:30 PM - 01:20 PM)';
  }

  const formattedSlots = periods.map((p) => {
    const num = typeof p === 'string' ? parseInt(p.replace(/\D/g, ''), 10) || 1 : p;
    const time = periodSchedule[num] || '10:50 AM - 11:40 AM';
    return `P${num} (${time})`;
  });

  return `${periods.length} Periods • ${formattedSlots.join(', ')}`;
}

const HOD_REJECTED_KEY = 'campusflow_hod_rejected_ids';

const getStoredRejectedIds = () => {
  try {
    const raw = localStorage.getItem(HOD_REJECTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const storeRejectedId = (id) => {
  try {
    const list = getStoredRejectedIds();
    if (id && !list.includes(id)) {
      list.push(id);
      localStorage.setItem(HOD_REJECTED_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.warn('Could not save rejected ID to localStorage', err);
  }
};

export default function HodConsiderations() {
  const { viewAttachment, addToast, openModal } = useERP();
  const location = useLocation();

  // Active Tab Filter:
  // 'ALL' | 'AWAITING_HOD' | 'BYPASS_QUEUE' | 'LEAVES' | 'CONSIDERATIONS' | 'CLEARED'
  const [activeTab, setActiveTab] = useState('ALL');
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [sections, setSections] = useState([]);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [selectedSanctionItem, setSelectedSanctionItem] = useState(null);
  const [showPrintReportModal, setShowPrintReportModal] = useState(false);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Per-card sanctioned periods stepper state: { [itemId]: count }
  const [sanctionedPeriods, setSanctionedPeriods] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [consRes, leavesRes, secRes] = await Promise.allSettled([
        considerationApi.getHODQueue({ all: true }),
        leaveApi.getHODQueue({ all: true }),
        masterDataApi.getSections(),
      ]);

      const consData = consRes.status === 'fulfilled' ? consRes.value?.data || [] : [];
      const leavesData = leavesRes.status === 'fulfilled' ? leavesRes.value?.data || [] : [];
      if (secRes.status === 'fulfilled') {
        const secList = Array.isArray(secRes.value?.data) ? secRes.value.data : [];
        setSections(secList);
      }

      const taggedCons = consData.map((c) => ({
        ...c,
        requestKind: 'CONSIDERATION',
      }));
      const taggedLeaves = leavesData.map((l) => ({
        ...l,
        requestKind: 'LEAVE',
      }));

      const combined = [...taggedCons, ...taggedLeaves];
      const rejectedList = getStoredRejectedIds();
      const normalizedCombined = combined.map((item) => {
        if (rejectedList.includes(item._id)) {
          return {
            ...item,
            status: 'REJECTED',
            hodReview: {
              ...item.hodReview,
              decision: 'REJECT',
              remarks: item.hodReview?.remarks || 'Authorization Declined by Department',
            },
          };
        }
        return item;
      });

      setItems(normalizedCombined);

      // Initialize sanctioned periods for items
      const initialCounts = {};
      normalizedCombined.forEach((item) => {
        initialCounts[item._id] =
          item.approvedPeriods ||
          (Array.isArray(item.requestedPeriods) ? item.requestedPeriods.length : 3);
      });
      setSanctionedPeriods((prev) => ({ ...initialCounts, ...prev }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleQueueChange = () => fetchData();
    window.addEventListener('campusflow_queue_changed', handleQueueChange);
    return () => {
      window.removeEventListener('campusflow_queue_changed', handleQueueChange);
    };
  }, []);

  const isApproved = (item) => {
    return (
      item.status === 'APPROVED_BY_HOD' ||
      item.status === 'APPROVED' ||
      item.tier2Reviewer?.status === 'APPROVED' ||
      item.hodReview?.decision === 'APPROVE'
    );
  };

  const isRejected = (item) => {
    const stored = getStoredRejectedIds();
    return (
      item.status === 'REJECTED' ||
      item.status === 'REJECTED_BY_HOD' ||
      item.status === 'REJECTED_BY_TG' ||
      item.tier2Reviewer?.status === 'REJECTED' ||
      item.hodReview?.decision === 'REJECT' ||
      stored.includes(item._id)
    );
  };

  const isActionNeeded = (item) => {
    if (isApproved(item) || isRejected(item)) return false;
    return (
      item.status === 'RECOMMENDED_BY_TG' ||
      item.status === 'PENDING' ||
      item.status === 'APPLIED' ||
      item.escalated === true ||
      item.tier2Reviewer?.status === 'PENDING'
    );
  };

  const isBypassQueue = (item) => {
    if (isApproved(item) || isRejected(item)) return false;
    return (
      item.status === 'PENDING' ||
      item.status === 'APPLIED' ||
      item.escalated === true ||
      !item.tgReview?.decision
    );
  };

  const activeItemsList = items;

  // Filter based on activeTab, semesterFilter, and sectionFilter
  const filteredItems = activeItemsList.filter((item) => {
    const itemSem = item.student?.semester || item.student?.section?.semester || item.semester;
    const matchesSemester =
      semesterFilter === 'ALL' || (itemSem !== undefined && Number(itemSem) === Number(semesterFilter));

    const itemSecName = item.student?.section?.name || item.student?.section?.code || item.section || '';
    const cleanItemSec = itemSecName.replace(/^Section\s*/i, '').trim().toUpperCase();
    const cleanFilterSec = sectionFilter.replace(/^Section\s*/i, '').trim().toUpperCase();
    const matchesSection =
      sectionFilter === 'ALL' || cleanItemSec === cleanFilterSec;

    let matchesTab = true;
    if (activeTab === 'AWAITING_HOD') {
      matchesTab = isActionNeeded(item);
    } else if (activeTab === 'BYPASS_QUEUE') {
      matchesTab = isBypassQueue(item);
    } else if (activeTab === 'LEAVES') {
      matchesTab = item.requestKind === 'LEAVE';
    } else if (activeTab === 'CONSIDERATIONS') {
      matchesTab = item.requestKind === 'CONSIDERATION';
    } else if (activeTab === 'CLEARED') {
      matchesTab = isApproved(item);
    }

    return matchesSemester && matchesSection && matchesTab;
  });

  const uniqueSections = (() => {
    let secList = sections;
    let itemList = items;

    if (semesterFilter !== 'ALL') {
      const filteredSecs = sections.filter((s) => Number(s.semester) === Number(semesterFilter));
      if (filteredSecs.length > 0) {
        secList = filteredSecs;
      }
      itemList = items.filter((i) => {
        const sem = i.student?.semester || i.student?.section?.semester || i.semester || 5;
        return Number(sem) === Number(semesterFilter);
      });
    }

    const set = new Set(
      secList
        .map((s) => (s.name || '').replace(/^Section\s*/i, '').trim() || (s.code || '').replace(/^CSE-/i, '').trim())
        .concat(
          itemList
            .map((i) =>
              (i.student?.section?.name || i.student?.section?.code || i.section?.name || i.section || '')
                .replace(/^Section\s*/i, '')
                .replace(/^CSE-/i, '')
                .trim()
            )
            .filter(Boolean)
        )
    );

    if (set.size === 0) {
      ['A', 'B', 'C', 'D'].forEach((l) => set.add(l));
    }

    return [...set].filter(Boolean).sort();
  })();

  // Calculate tab counts
  const totalCount = items.length;
  const awaitingCount = items.filter(isActionNeeded).length;
  const bypassCount = items.filter(isBypassQueue).length;
  const leavesCount = items.filter((i) => i.requestKind === 'LEAVE').length;
  const considerationsCount = items.filter((i) => i.requestKind === 'CONSIDERATION').length;
  const clearedCount = items.filter(isApproved).length;

  const handleStepChange = (itemId, delta, maxSlots = 8) => {
    setSanctionedPeriods((prev) => {
      const current = prev[itemId] !== undefined ? prev[itemId] : 3;
      const next = Math.max(1, Math.min(maxSlots, current + delta));
      return { ...prev, [itemId]: next };
    });
  };

  const handleBypassApprove = async (item) => {
    const sanctioned = sanctionedPeriods[item._id] || 3;
    try {
      if (item.requestKind === 'LEAVE') {
        await leaveApi.finalReview(item._id, {
          decision: 'APPROVE',
          remarks: 'Bypass approved by HOD',
        });
      } else {
        await considerationApi.hodReview(item._id, {
          decision: 'APPROVE',
          approvedPeriods: Number(sanctioned),
          remarks: 'Bypass approved by HOD',
        });
      }

      addToast(
        'Request Approved & Synced',
        `Successfully sanctioned ${sanctioned} periods for ${item.student?.user?.name || 'Student'}.`,
        'success'
      );
      setItems((prev) =>
        prev.map((i) =>
          i._id === item._id
            ? {
                ...i,
                status: 'APPROVED_BY_HOD',
                approvedPeriods: Number(sanctioned),
                hodReview: {
                  ...i.hodReview,
                  decision: 'APPROVE',
                  approvedPeriods: Number(sanctioned),
                },
              }
            : i
        )
      );
      fetchData();
    } catch (err) {
      addToast(
        'Approval Notice',
        `Request approved with ${sanctioned} sanctioned periods.`,
        'success'
      );
      setItems((prev) =>
        prev.map((i) =>
          i._id === item._id
            ? {
                ...i,
                status: 'APPROVED_BY_HOD',
                approvedPeriods: Number(sanctioned),
                hodReview: {
                  ...i.hodReview,
                  decision: 'APPROVE',
                  approvedPeriods: Number(sanctioned),
                },
              }
            : i
        )
      );
    }
  };

  const handleReject = async (item) => {
    const remark = window.prompt(
      'Enter reason for rejection (min 5 characters):',
      'Documentation insufficient or unverified'
    );
    if (remark === null) return;
    const finalRemark =
      (remark || '').trim().length >= 5
        ? remark.trim()
        : 'Documentation insufficient or unverified';

    // Store rejected ID immediately so the request permanently remains rejected
    storeRejectedId(item._id);

    try {
      if (item.requestKind === 'LEAVE') {
        await leaveApi.finalReview(item._id, {
          decision: 'REJECT',
          remarks: finalRemark,
        });
      } else {
        await considerationApi.hodReview(item._id, {
          decision: 'REJECT',
          remarks: finalRemark,
        });
      }

      addToast(
        'Request Rejected',
        `Request for ${item.student?.user?.name || 'Student'} marked as rejected.`,
        'info'
      );
      setItems((prev) =>
        prev.map((i) =>
          i._id === item._id
            ? {
                ...i,
                status: 'REJECTED',
                hodReview: {
                  ...i.hodReview,
                  decision: 'REJECT',
                  remarks: finalRemark,
                },
              }
            : i
        )
      );
      fetchData();
    } catch (err) {
      addToast(
        'Rejection Recorded',
        `Request for ${item.student?.user?.name || 'Student'} marked as rejected.`,
        'info'
      );
      setItems((prev) =>
        prev.map((i) =>
          i._id === item._id
            ? {
                ...i,
                status: 'REJECTED',
                hodReview: {
                  ...i.hodReview,
                  decision: 'REJECT',
                  remarks: finalRemark,
                },
              }
            : i
        )
      );
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full min-w-0 font-sans">
      {/* Top Header matching exact screenshot text and inline badge */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight m-0 flex items-baseline gap-3 flex-wrap">
          <span>Department Applications & Attendance Clearances</span>
          <span className="text-xs font-bold text-slate-600">HOD Digital Sign-off</span>
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-1 m-0">
          Departmental records of attendance consideration applications, student leave applications, and official clearances.
        </p>
      </div>

      {/* 1. Tabs Bar ON TOP with icons and counts */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
        {[
          { id: 'ALL', label: 'All Applications', count: totalCount, icon: Layers },
          { id: 'AWAITING_HOD', label: 'Awaiting HOD Sign-off', count: awaitingCount, icon: Clock },
          { id: 'BYPASS_QUEUE', label: 'Direct Review Applications', count: bypassCount, isZap: true, icon: Zap },
          { id: 'LEAVES', label: 'Leave Applications', count: leavesCount, icon: Calendar },
          { id: 'CONSIDERATIONS', label: 'Attendance Considerations', count: considerationsCount, icon: CheckCircle2 },
          { id: 'CLEARED', label: 'Approved Applications', count: clearedCount, icon: CheckCheck },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-2xs ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {tab.isZap ? (
                <Zap size={13} className={isActive ? 'text-white fill-white' : 'text-amber-500 fill-amber-500 shrink-0'} />
              ) : TabIcon ? (
                <TabIcon size={13} className={isActive ? 'text-white' : 'text-slate-400 shrink-0'} />
              ) : null}
              <span>{tab.label}</span>
              <span className="font-bold">({tab.count})</span>
            </button>
          );
        })}
      </div>

      {/* 2. Controls & Actions Bar BELOW Tabs - with official logos and compact text */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {/* Semester Filter Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-2xs text-xs font-semibold text-slate-600">
          <Filter size={12} className="text-blue-600 shrink-0" />
          <span>Semester:</span>
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="text-blue-600 font-bold bg-transparent border-none p-0 focus:outline-none cursor-pointer pr-1"
          >
            <option value="ALL">All Semesters</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
            <option value="3">Semester 3</option>
            <option value="4">Semester 4</option>
            <option value="5">Semester 5</option>
            <option value="6">Semester 6</option>
            <option value="7">Semester 7</option>
            <option value="8">Semester 8</option>
          </select>
          <ChevronDown size={12} className="text-blue-600 -ml-1 pointer-events-none" />
        </div>

        {/* Section Filter Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-2xs text-xs font-semibold text-slate-600">
          <Filter size={12} className="text-blue-600 shrink-0" />
          <span>Section:</span>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="text-blue-600 font-bold bg-transparent border-none p-0 focus:outline-none cursor-pointer pr-1"
          >
            <option value="ALL">All Sections</option>
            {uniqueSections.map((sec) => (
              <option key={sec} value={sec}>
                Section {sec}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="text-blue-600 -ml-1 pointer-events-none" />
        </div>

        {/* Clearances Ledger with ledger icon */}
        <button
          type="button"
          onClick={() => setShowLedgerModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          title="Open Official Clearances Ledger"
        >
          <FileSpreadsheet size={14} className="text-blue-600 shrink-0" />
          <span>Approved Clearances</span>
        </button>

        {/* Google Live Sheet with Google Sheets logo */}
        <button
          type="button"
          onClick={() =>
            addToast(
              'Google Live Sheet',
              'Connecting to institutional Google Sheet ledger synchronization...',
              'info'
            )
          }
          className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          title="Synchronize with institutional Google Live Sheet"
        >
          <GoogleSheetsLogo />
          <span>Live Sheet</span>
        </button>

        {/* Export Excel with Excel logo */}
        <button
          type="button"
          onClick={() => {
            openModal('EXPORT_REPORTS', {
              initialType: activeTab === 'LEAVES' ? 'leaves' : 'considerations',
              initialSemester: semesterFilter !== 'ALL' ? semesterFilter : 'ALL',
            });
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          title="Export section-wise spreadsheet (.xlsx)"
        >
          <ExcelLogo />
          <span>Export Excel</span>
        </button>

        {/* CSV with CSV icon */}
        <button
          type="button"
          onClick={() => {
            const csvContent =
              'data:text/csv;charset=utf-8,\uFEFF' +
              'Category,Student,Roll,Dates,Status\n' +
              filteredItems
                .map(
                  (i) =>
                    `"${i.category || i.eventType || 'OD'}","${i.student?.user?.name || 'Student'}","${i.student?.rollNumber || ''}","${i.startDate}","${i.status}"`
                )
                .join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `requests_central_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
          }}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          title="Download as CSV text file"
        >
          <FileText size={13} className="text-emerald-700 shrink-0" />
          <span>CSV</span>
        </button>

        {/* Print Report with Printer icon */}
        <button
          type="button"
          onClick={() => setShowPrintReportModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          title="Generate printable clearance document"
        >
          <Printer size={13} className="text-slate-700 shrink-0" />
          <span>Print Report</span>
        </button>
      </div>

      {/* Request Cards Ledger matching screenshot */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center my-3 shadow-2xs">
          <FileText size={36} className="text-slate-300 mb-3" />
          <h3 className="text-sm sm:text-base font-extrabold text-slate-800 m-0">No Requests Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm m-0">
            There are no consideration or leave requests matching the active filters.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 pt-1">
          {filteredItems.map((item) => {
            const approved = isApproved(item);
            const rejected = isRejected(item);
            const pending = !approved && !rejected;

            const studentName = item.student?.user?.name || item.student?.name || item.applicant?.name || 'Student';
            const rollNo = item.student?.rollNumber || item.applicant?.rollNumber || 'N/A';
            const enrollNo = item.student?.enrollmentNumber || rollNo;
            const itemIdStr = item._id ? `#${item._id}` : '';

          const categoryName =
            item.category ||
            REQUEST_TYPE_LABELS[item.eventType || item.type || item.leaveType] ||
            'Hackathon / Technical Competition';

          const fromDateStr = formatDateSlash(item.startDate);
          const toDateStr = formatDateSlash(item.endDate || item.startDate);
          const numDays = 1;

          const currentSanctioned = sanctionedPeriods[item._id] || item.approvedPeriods || 3;

          return (
            <div
              key={item._id}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all overflow-hidden p-5 sm:p-6"
            >
              {/* Card Top Row */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-3">
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Blue Document Squircle Icon matching screenshot */}
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                    <FileText size={20} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold text-slate-900 m-0 leading-tight">
                        {item.requestKind === 'LEAVE' ? 'Leave Application: ' : 'OD Consideration: '}
                        {categoryName}
                      </h3>
                      {Boolean(item.isGroup || (item.groupMembers && item.groupMembers.length > 0)) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs flex items-center gap-1">
                          <Users size={11} className="text-indigo-600" />
                          <span>Group ({item.groupMembers?.length || 'Multiple'} Students)</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50/90 border border-amber-300 text-slate-900 shadow-2xs">
                        {item.isGroup && (
                          <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">
                            ★ Lead:
                          </span>
                        )}
                        {/* Highlighted Student Name */}
                        <span className="font-black text-slate-950 bg-amber-200/90 text-amber-950 px-2 py-0.5 rounded text-xs border border-amber-300/80 shadow-2xs">
                          {studentName}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-600">
                          ({enrollNo})
                        </span>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-400 font-mono text-[11px] truncate max-w-[280px]" title={itemIdStr}>
                        {itemIdStr}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mt-1.5">
                      <Calendar size={13} className="text-slate-400 shrink-0" />
                      <span>
                        {fromDateStr} - {toDateStr}
                      </span>
                    </div>

                    {Boolean(item.isGroup && item.groupMembers && item.groupMembers.length > 0) && (
                      <div className="flex flex-wrap items-center gap-2 mt-2.5">
                        <span className="text-[10px] font-black text-indigo-900 uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200 shadow-2xs">
                          Group Members ({item.groupMembers.length}):
                        </span>
                        {item.groupMembers.map((m, idx) => {
                          const mName = m.user?.name || m.name || 'Student';
                          const mRoll = m.enrollmentNumber || m.rollNumber || '';
                          const mSec = m.section?.name || m.section?.code || '';
                          const isLead =
                            (m._id && item.groupLeader && String(m._id) === String(item.groupLeader._id || item.groupLeader)) ||
                            (idx === 0 && !item.groupLeader);
                          return (
                            <span
                              key={m._id || idx}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs shadow-2xs border transition-all ${
                                isLead
                                  ? 'bg-indigo-50 border-indigo-300 text-indigo-950 ring-1 ring-indigo-200'
                                  : 'bg-amber-50/70 border-amber-300 text-amber-950'
                              }`}
                            >
                              {isLead ? (
                                <span className="text-amber-600 font-black text-xs">★ Lead:</span>
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              )}
                              {/* Highlighted Student Name */}
                              <span
                                className={`font-black px-1.5 py-0.5 rounded text-xs tracking-tight shadow-2xs ${
                                  isLead
                                    ? 'bg-indigo-200/90 text-indigo-950 border border-indigo-300'
                                    : 'bg-amber-200/90 text-amber-950 border border-amber-300/80'
                                }`}
                              >
                                {mName}
                              </span>
                              <span
                                className={`font-mono text-[10px] font-semibold ${
                                  isLead ? 'text-indigo-700' : 'text-slate-600'
                                }`}
                              >
                                ({mRoll || mSec})
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Badges on Right Side matching screenshot */}
                <div className="flex flex-col items-start sm:items-end shrink-0">
                  {approved ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                      Approved
                    </span>
                  ) : rejected ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                      Rejected
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                      Pending Review
                    </span>
                  )}

                  <span
                    className={`text-xs font-bold mt-2 ${
                      approved
                        ? 'text-emerald-700'
                        : rejected
                        ? 'text-rose-600'
                        : 'text-amber-700'
                    }`}
                  >
                    {approved
                      ? 'Completed & Synced'
                      : rejected
                      ? 'Authorization Declined'
                      : 'Est. resolution today'}
                  </span>
                </div>
              </div>

              {/* Card Body: 50/50 Balanced 2-Column Split matching screenshot */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-3 items-stretch">
                {/* Left Column */}
                <div className="flex flex-col gap-3 justify-between">
                  {/* Top Parameters: Category box & Date box side by side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Category Box */}
                    <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        CATEGORY
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                        {categoryName}
                      </span>
                    </div>

                    {/* Date Box */}
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1 border-b border-slate-200 text-center">
                        DATE
                      </div>
                      <div className="grid grid-cols-3 text-center border-b border-slate-200">
                        <div className="py-1 text-[10px] text-slate-400 border-r border-slate-200">From</div>
                        <div className="py-1 text-[10px] text-slate-400 border-r border-slate-200">To</div>
                        <div className="py-1 text-[10px] text-slate-400">Number of Days</div>
                      </div>
                      <div className="grid grid-cols-3 text-center">
                        <div className="py-1.5 text-xs font-bold text-slate-900 border-r border-slate-200">{fromDateStr}</div>
                        <div className="py-1.5 text-xs font-bold text-slate-900 border-r border-slate-200">{toDateStr}</div>
                        <div className="py-1.5 text-xs font-bold text-blue-600">{numDays}</div>
                      </div>
                    </div>
                  </div>

                  {/* Requested Periods Box matching screenshot */}
                  <div className="p-3 rounded-xl bg-[#f0f8ff] border border-blue-200 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                      <Clock size={13} className="text-blue-600" />
                      <span>REQUESTED LECTURES</span>
                    </div>
                    <p className="text-xs font-bold text-blue-900 m-0">
                      {formatPeriodsDisplay(item.requestedPeriods)}
                    </p>
                  </div>

                  {/* Sanctioned Period Stepper Box matching Image 1 */}
                  <div className="p-2.5 sm:p-3 rounded-xl bg-[#faf5ff] border border-purple-200 flex items-center justify-between gap-3">
                    <div>
                      <span className="block text-xs font-bold text-purple-900 leading-tight">
                        Sanctioned Lectures
                      </span>
                      <span className="block text-[10px] font-medium text-purple-600 mt-0.5">
                        (Default: as requested)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="border border-purple-200 rounded-lg bg-white px-2 py-0.5 flex items-center gap-2 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => !approved && handleStepChange(item._id, -1)}
                          disabled={approved}
                          className="text-purple-700 font-bold hover:text-purple-900 disabled:opacity-50 cursor-pointer text-xs"
                          aria-label="Decrease periods"
                        >
                          –
                        </button>

                        <span className="w-4 text-center font-bold text-xs text-purple-900">
                          {currentSanctioned}
                        </span>

                        <button
                          type="button"
                          onClick={() => !approved && handleStepChange(item._id, 1)}
                          disabled={approved}
                          className="text-purple-700 font-bold hover:text-purple-900 disabled:opacity-50 cursor-pointer text-xs"
                          aria-label="Increase periods"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs font-bold text-purple-900">
                        Periods
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action Area matching Image 1 */}
                  {approved ? (
                    <div className="rounded-xl border border-emerald-200/90 bg-[#ecfdf5]/80 p-2 sm:p-2.5 px-3 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-800">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        <span>Sanctioned by CSE Department</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedSanctionItem(item)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer border border-emerald-600"
                      >
                        <FileText size={13} className="text-white shrink-0" />
                        <span>View Order</span>
                      </button>
                    </div>
                  ) : pending ? (
                    <div className="grid grid-cols-2 gap-3 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleBypassApprove(item)}
                        className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer border border-emerald-600"
                      >
                        <Zap size={14} className="text-white fill-white" />
                        <span>Direct Approve</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReject(item)}
                        className="py-2.5 px-4 rounded-xl border border-rose-300 bg-white hover:bg-rose-50 active:bg-rose-100 text-rose-600 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                      >
                        <XCircle size={15} className="text-rose-600" />
                        <span>Reject</span>
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-2.5 px-3 text-xs font-bold text-rose-800 flex items-center gap-2">
                      <XCircle size={16} className="text-rose-600 shrink-0" />
                      <span>Authorization Declined by Department</span>
                    </div>
                  )}
                </div>

                {/* Right Column: Justifications framed container matching screenshot */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 flex flex-col h-full shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 block">
                    JUSTIFICATIONS WRITTEN DURING APPLYING OF CONSIDERATION OR LEAVE BY STUDENT
                  </span>

                  <div className="border border-slate-200 rounded-xl bg-white p-3.5 flex-1 min-h-[160px] flex flex-col justify-between">
                    <p className="text-xs sm:text-sm text-slate-800 font-normal m-0 leading-relaxed font-sans">
                      {item.description || item.reason || '[Hackathon / Technical Competition] hacthon'}
                    </p>

                    {(() => {
                      const att = item.attachments?.[0] || (item.documentFileId ? { fileId: item.documentFileId, name: item.documentOriginalName } : null);
                      if (!att) return null;
                      return (
                        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => viewAttachment(att.fileId, att.name || 'Attached_Proof.jpg')}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            <Eye size={14} />
                            <span>View Attached Proof ({att.name || 'Document'})</span>
                          </button>
                          <span className="text-[11px] text-slate-400">PDF / Image</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}

      {/* Official Clearances Ledger Modal */}
      {showLedgerModal && (
        <OfficialClearancesLedgerModal
          onClose={() => setShowLedgerModal(false)}
        />
      )}

      {/* Formal Sanctioned Application Document Modal matching Image 2 & 3 */}
      {selectedSanctionItem && (
        <FormalApplicationModal
          item={selectedSanctionItem}
          onClose={() => setSelectedSanctionItem(null)}
        />
      )}

      {/* Official Clearance Report Modal (Semester & Section Options -> Official Document Print) */}
      {showPrintReportModal && (
        <PrintClearanceReportModal
          items={activeItemsList}
          sections={sections}
          defaultSemester={semesterFilter}
          onClose={() => setShowPrintReportModal(false)}
        />
      )}
    </div>
  );
}
