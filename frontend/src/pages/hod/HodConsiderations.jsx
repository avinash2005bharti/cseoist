import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import { considerationApi, leaveApi, reportApi, masterDataApi } from '../../api';
import OfficialClearancesLedgerModal from '../../components/modals/OfficialClearancesLedgerModal.jsx';
import FormalApplicationModal from '../../components/modals/FormalApplicationModal.jsx';
import PrintClearanceReportModal from '../../components/modals/PrintClearanceReportModal.jsx';
import './Screen-21.screen.css';
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
  UserCheck,
  AlertCircle,
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

  // Screen 7 Desktop Drawer & Screen 8 Mobile Bottom Sheet Review State
  const [reviewingItem, setReviewingItem] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('APPROVE');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewApprovedPeriods, setReviewApprovedPeriods] = useState(3);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  const [currentDateTime, setCurrentDateTime] = useState({
    date: 'Sat, Oct 24, 2026',
    time: '07:35 PM',
  });

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

      const combined = [...taggedCons, ...taggedLeaves].sort((a, b) => {
        const timeA = new Date(a.createdAt || a.appliedAt || a.startDate || 0).getTime();
        const timeB = new Date(b.createdAt || b.appliedAt || b.startDate || 0).getTime();
        return timeB - timeA;
      });
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

  const sortedFilteredItems = [...filteredItems].sort((a, b) => {
    if (location.state?.targetRequestId) {
      if (a._id === location.state.targetRequestId) return -1;
      if (b._id === location.state.targetRequestId) return 1;
    }
    const aPending = isActionNeeded(a);
    const bPending = isActionNeeded(b);
    if (aPending && !bPending) return -1;
    if (!aPending && bPending) return 1;
    const timeA = new Date(a.createdAt || a.appliedAt || a.startDate || 0).getTime();
    const timeB = new Date(b.createdAt || b.appliedAt || b.startDate || 0).getTime();
    return timeB - timeA;
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
          remarks: 'Approved by HOD',
        });
      } else {
        await considerationApi.hodReview(item._id, {
          decision: 'APPROVE',
          approvedPeriods: Number(sanctioned),
          remarks: 'Approved by HOD',
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

  const handleOpenReview = (item, defaultDecision = 'APPROVE') => {
    setReviewingItem(item);
    setReviewDecision(defaultDecision);
    setReviewRemarks('');
    const periods =
      sanctionedPeriods[item._id] ||
      item.approvedPeriods ||
      (Array.isArray(item.requestedPeriods) ? item.requestedPeriods.length : (item.requestedPeriods || 3));
    setReviewApprovedPeriods(periods);
    setReviewError(null);
  };

  const handleConfirmReview = async () => {
    if (!reviewingItem) return;
    setReviewError(null);
    const isReject = reviewDecision === 'REJECT';

    setReviewSubmitting(true);
    try {
      const decisionPayload = reviewDecision;
      const remarksPayload =
        reviewRemarks.trim() ||
        (isReject ? 'Authorization Declined by Department' : 'Approved by HOD');

      if (reviewingItem.requestKind === 'LEAVE') {
        await leaveApi.finalReview(reviewingItem._id, {
          decision: decisionPayload,
          remarks: remarksPayload,
        });
      } else {
        await considerationApi.hodReview(reviewingItem._id, {
          decision: decisionPayload,
          approvedPeriods: decisionPayload === 'APPROVE' ? Number(reviewApprovedPeriods) : undefined,
          remarks: remarksPayload,
        });
      }

      if (isReject) {
        storeRejectedId(reviewingItem._id);
      }

      addToast(
        'Review Submitted',
        `Application successfully ${decisionPayload === 'APPROVE' ? 'approved' : 'rejected'}.`,
        'success'
      );

      setItems((prev) =>
        prev.map((i) =>
          i._id === reviewingItem._id
            ? {
                ...i,
                status: decisionPayload === 'APPROVE' ? 'APPROVED_BY_HOD' : 'REJECTED',
                approvedPeriods: decisionPayload === 'APPROVE' ? Number(reviewApprovedPeriods) : i.approvedPeriods,
                hodReview: {
                  ...i.hodReview,
                  decision: decisionPayload,
                  approvedPeriods: decisionPayload === 'APPROVE' ? Number(reviewApprovedPeriods) : undefined,
                  remarks: remarksPayload,
                },
              }
            : i
        )
      );

      setReviewingItem(null);
      fetchData();
    } catch (err) {
      setReviewError(
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to submit review decision.'
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleReject = async (item) => {
    handleOpenReview(item, 'REJECT');
  };

  return (
    <div className="hod-page-container">
      {/* Top Header matching exact Screen 21 & Screen 22 */}
      <div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold w-fit mb-2">
          🏛️ HOD Office
        </span>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight m-0 flex items-center gap-3 flex-wrap">
              <span>Department Applications & Attendance Clearances</span>
              <span className="bg-sky-100 text-sky-800 text-xs font-bold px-3 py-1 rounded-full">
                HOD Digital Sign-off
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1.5 m-0">
              Departmental records of attendance consideration applications, student leave applications, and official clearances.
            </p>
          </div>

          {/* Date & Time pill (Screen 21 desktop right) */}
          <div className="hidden lg:flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs shrink-0">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600" />
              <span>{currentDateTime.date}</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-blue-600" />
              <span>{currentDateTime.time}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Category Filter Tabs (Screen 21 & Screen 22) */}
      <div className="hod-tabs-track">
        {[
          { id: 'ALL', label: 'All Applications', count: totalCount },
          { id: 'AWAITING_HOD', label: 'Awaiting HOD Sign-off', count: awaitingCount },
          { id: 'BYPASS_QUEUE', label: 'Direct Review Applications', count: bypassCount },
          { id: 'LEAVES', label: 'Leave Applications', count: leavesCount },
          { id: 'CONSIDERATIONS', label: 'Attendance Considerations', count: considerationsCount },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`hod-tab-btn ${isActive ? 'active' : ''}`}
            >
              <span>{tab.label}</span>
              <span className="font-bold">({tab.count})</span>
            </button>
          );
        })}
      </div>

      {/* 2. Filter & Action Toolbar (Screen 21 & Screen 22) */}
      <div className="hod-toolbar-card">
        {/* Top Filter Selects: distinct rectangular form select controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Semester Filter */}
          <div className="hod-filter-select-box">
            <Filter size={14} className="text-slate-500 shrink-0" />
            <span>Semester:</span>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="hod-filter-select"
            >
              <option value="ALL">All Semesters</option>
              <option value="1">Sem 1</option>
              <option value="2">Sem 2</option>
              <option value="3">Sem 3</option>
              <option value="4">Sem 4</option>
              <option value="5">Sem 5</option>
              <option value="6">Sem 6</option>
              <option value="7">Sem 7</option>
              <option value="8">Sem 8</option>
            </select>
            <ChevronDown size={14} className="text-blue-600 pointer-events-none -ml-1 shrink-0" />
          </div>

          {/* Section Filter */}
          <div className="hod-filter-select-box">
            <Filter size={14} className="text-slate-500 shrink-0" />
            <span>Section:</span>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="hod-filter-select"
            >
              <option value="ALL">All Sections</option>
              {uniqueSections.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="text-blue-600 pointer-events-none -ml-1 shrink-0" />
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          {/* Approved Clearances */}
          <button
            type="button"
            onClick={() => setShowLedgerModal(true)}
            className="hod-toolbar-btn"
            title="Open Official Clearances Ledger"
          >
            <FileSpreadsheet size={15} className="text-blue-600 shrink-0" />
            <span>Approved Clearances</span>
          </button>

          {/* Google Live Sheet */}
          <button
            type="button"
            onClick={() =>
              addToast(
                'Google Live Sheet',
                'Connecting to institutional Google Sheet ledger synchronization...',
                'info'
              )
            }
            className="hod-toolbar-btn"
            title="Synchronize with institutional Google Live Sheet"
          >
            <GoogleSheetsLogo />
            <span>Live Sheet</span>
          </button>

          {/* Export Excel */}
          <button
            type="button"
            onClick={() => {
              openModal('EXPORT_REPORTS', {
                initialType: activeTab === 'LEAVES' ? 'leaves' : 'considerations',
                initialSemester: semesterFilter !== 'ALL' ? semesterFilter : 'ALL',
              });
            }}
            className="hod-toolbar-btn"
            title="Export section-wise spreadsheet (.xlsx)"
          >
            <ExcelLogo />
            <span>Export Excel</span>
          </button>

          {/* CSV */}
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
            className="hod-toolbar-btn"
            title="Download as CSV text file"
          >
            <FileText size={14} className="text-slate-600 shrink-0" />
            <span>CSV</span>
          </button>

          {/* Print Report */}
          <button
            type="button"
            onClick={() => setShowPrintReportModal(true)}
            className="hod-toolbar-btn"
            title="Generate printable clearance document"
          >
            <Printer size={14} className="text-slate-600 shrink-0" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Application Cards (Screen 21 Desktop & Screen 22 Mobile) */}
      {sortedFilteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center my-2 shadow-2xs">
          <FileText size={40} className="text-slate-300 mb-3" />
          <h3 className="text-base font-extrabold text-slate-800 m-0">No Requests Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm m-0">
            There are no consideration or leave requests matching the active filters.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sortedFilteredItems.map((item) => {
            const approved = isApproved(item);
            const rejected = isRejected(item);
            const pending = !approved && !rejected;

            const studentName = item.student?.user?.name || item.student?.name || item.applicant?.name || 'Student';
            const rollNo = item.student?.rollNumber || item.applicant?.rollNumber || 'N/A';
            const enrollNo = item.student?.enrollmentNumber || rollNo;
            const secName = item.student?.section?.name || item.student?.section?.code || item.section || 'CSE-B';

            const categoryName =
              item.category ||
              REQUEST_TYPE_LABELS[item.eventType || item.type || item.leaveType] ||
              'Special Activity';

            const fromDateStr = formatDateSlash(item.startDate);
            const toDateStr = formatDateSlash(item.endDate || item.startDate);

            const currentSanctioned = sanctionedPeriods[item._id] || item.approvedPeriods || 3;

            return (
              <div
                key={item._id}
                className="hod-app-card"
              >
                {/* Card Top Row: Student info & Status badge */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="hod-icon-squircle">
                      <FileText size={20} />
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-base font-extrabold text-slate-900 m-0 leading-tight">
                        {studentName} <span className="font-normal text-slate-500 text-sm ml-1.5 font-mono">{enrollNo}</span>
                      </h3>
                      <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>{categoryName}</span>
                        <span>•</span>
                        <span>{fromDateStr}</span>
                        {secName && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-slate-600">{secName}</span>
                          </>
                        )}
                        {Boolean(item.isGroup || (item.groupMembers && item.groupMembers.length > 0)) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs flex items-center gap-1">
                            <Users size={11} className="text-indigo-600" />
                            <span>Group ({item.groupMembers?.length || 'Multiple'} Students)</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">
                    {approved ? (
                      <span className="hod-badge-approved">Approved</span>
                    ) : rejected ? (
                      <span className="hod-badge-rejected">Rejected</span>
                    ) : (
                      <span className="hod-badge-pending">Pending Review</span>
                    )}
                  </div>
                </div>

                {/* 3-Box Information Grid */}
                <div className="hod-info-grid">
                  {/* Box 1: Category */}
                  <div className="hod-info-box">
                    <div className="hod-info-label">
                      CATEGORY
                    </div>
                    <div className="hod-info-value">
                      {categoryName}
                    </div>
                    <div className="hod-info-subtext">
                      {fromDateStr}
                    </div>
                  </div>

                  {/* Box 2: Requested Lectures */}
                  <div className="hod-info-box">
                    <div className="hod-info-label">
                      <Clock size={12} className="text-blue-600" />
                      <span>REQUESTED LECTURES</span>
                    </div>
                    <div className="hod-info-value">
                      {formatPeriodsDisplay(item.requestedPeriods)}
                    </div>
                  </div>

                  {/* Box 3: Sanctioned Lectures Stepper */}
                  <div className="hod-info-box justify-between">
                    <div className="hod-info-label">
                      SANCTIONED LECTURES
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="hod-stepper-control">
                        <button
                          type="button"
                          onClick={() => !approved && handleStepChange(item._id, -1)}
                          disabled={approved}
                          className="hod-stepper-btn"
                          aria-label="Decrease periods"
                        >
                          –
                        </button>
                        <span className="hod-stepper-count">
                          {currentSanctioned}
                        </span>
                        <button
                          type="button"
                          onClick={() => !approved && handleStepChange(item._id, 1)}
                          disabled={approved}
                          className="hod-stepper-btn"
                          aria-label="Increase periods"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs font-semibold text-slate-600">
                        Periods
                      </span>
                    </div>
                  </div>
                </div>

                {/* Justification Box (full-width) */}
                <div className="hod-justification-box">
                  <div className="hod-info-label">
                    JUSTIFICATION
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 font-normal m-0 leading-relaxed">
                    {item.description || item.reason || 'Participated in an approved department activity.'}
                  </p>

                  {/* Proof Attachment link */}
                  {(() => {
                    const att = item.attachments?.[0] || (item.documentFileId ? { fileId: item.documentFileId, name: item.documentOriginalName } : null);
                    if (!att) return null;
                    return (
                      <div className="pt-2 mt-2 border-t border-slate-200/80 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => viewAttachment(att.fileId, att.name || 'Document')}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          <Eye size={13} />
                          <span>View Attached Proof ({att.name || 'Document'})</span>
                        </button>
                        <span className="text-[11px] text-slate-400">PDF / Image</span>
                      </div>
                    );
                  })()}

                  {/* Group Members Section */}
                  {Boolean(item.isGroup && item.groupMembers && item.groupMembers.length > 0) && (() => {
                    const activeMembers = item.groupMembers.filter((m) => {
                      const isExcluded = (item.studentAudits || []).some(
                        (a) => (a.student?._id || a.student)?.toString() === (m._id || m)?.toString() && a.status === 'EXCLUDED'
                      );
                      return !isExcluded;
                    });
                    if (activeMembers.length === 0) return null;

                    return (
                      <div className="pt-2 mt-2 border-t border-slate-200/80 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-indigo-900">
                            Participating Group Members ({activeMembers.length}):
                          </span>
                          <button
                            type="button"
                            onClick={() => openModal('AUDIT_GROUP_STUDENTS', { request: item, userRole: 'HOD' })}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                          >
                            <UserCheck size={11} />
                            <span>Audit Students</span>
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {activeMembers.map((m, idx) => {
                            const mName = m.user?.name || m.name || 'Student';
                            const mRoll = m.enrollmentNumber || m.rollNumber || '';
                            return (
                              <span
                                key={m._id || idx}
                                className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200"
                              >
                                {mName} {mRoll ? `(${mRoll})` : ''}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Bottom Action Row: Strictly No Green, No Red! */}
                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                  {approved ? (
                    <div className="flex items-center gap-3">
                      <div className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                        <CheckCircle2 size={15} />
                        <span>Sanctioned by CSE Department</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedSanctionItem(item)}
                        className="hod-btn-approve text-xs py-1.5"
                      >
                        <FileText size={13} />
                        <span>View Order</span>
                      </button>
                    </div>
                  ) : pending ? (
                    <div className="hod-card-actions justify-end">
                      {/* Slate Outline Reject Button */}
                      <button
                        type="button"
                        onClick={() => handleReject(item)}
                        className="hod-btn-reject flex-1 sm:flex-initial"
                      >
                        <XCircle size={15} />
                        <span>Reject</span>
                      </button>

                      {/* SaaS Royal Blue Approve Button */}
                      <button
                        type="button"
                        onClick={() => handleBypassApprove(item)}
                        className="hod-btn-approve flex-1 sm:flex-initial"
                      >
                        <CheckCircle2 size={15} />
                        <span>Approve</span>
                      </button>

                      {/* Review Drawer Button (Screen 7/8) */}
                      <button
                        type="button"
                        onClick={() => handleOpenReview(item, 'APPROVE')}
                        className="hod-btn-review flex-1 sm:flex-initial"
                        title="Open detailed review panel"
                      >
                        <Eye size={14} />
                        <span>Review</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <XCircle size={15} />
                      <span>Authorization Declined by Department</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Screen 7 Desktop Right Slide-Over Drawer & Screen 8 Mobile Bottom Sheet */}
      {reviewingItem && (
        <div className="hod-drawer-backdrop" onClick={() => setReviewingItem(null)}>
          <aside
            className="hod-review-drawer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Review Application Drawer"
          >
            {/* Drawer Header */}
            <div className="hod-drawer-header">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 m-0 leading-tight">
                  Review {reviewingItem.requestKind === 'LEAVE' ? 'Leave' : 'Consideration'} Application
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 m-0 truncate">
                  {reviewingItem.student?.user?.name || reviewingItem.student?.name || reviewingItem.applicant?.name || 'Student'} • Roll {reviewingItem.student?.rollNumber || reviewingItem.student?.enrollmentNumber || 'N/A'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingItem(null)}
                className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                aria-label="Close Review"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="hod-drawer-body">
              {reviewError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{reviewError}</span>
                </div>
              )}

              {/* Student Justification (Screen 7 & 8) */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  STUDENT JUSTIFICATION
                </div>
                <p className="text-xs sm:text-sm text-slate-800 font-normal mt-2 m-0 leading-relaxed">
                  {reviewingItem.description || reviewingItem.reason || 'Participated in an approved department activity.'}
                </p>
              </div>

              {/* Supporting Attachment if present */}
              {(() => {
                const att = reviewingItem.attachments?.[0] || (reviewingItem.documentFileId ? { fileId: reviewingItem.documentFileId, name: reviewingItem.documentOriginalName } : null);
                if (!att) return null;
                return (
                  <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={16} className="text-blue-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-800 truncate">{att.name || 'Document.pdf'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => viewAttachment(att.fileId, att.name || 'Document')}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>View Proof</span>
                    </button>
                  </div>
                );
              })()}

              {/* Decision Section */}
              <div>
                <div className="font-bold text-xs uppercase tracking-wider text-slate-600 mb-2.5">
                  Review Decision
                </div>
                <div className="grid gap-2.5">
                  <label
                    onClick={() => setReviewDecision('APPROVE')}
                    className={`hod-decision-card ${reviewDecision === 'APPROVE' ? 'selected-approve' : ''}`}
                  >
                    <input
                      type="radio"
                      name="hodDrawerDecision"
                      checked={reviewDecision === 'APPROVE'}
                      onChange={() => setReviewDecision('APPROVE')}
                      className="size-4 accent-blue-600 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className={reviewDecision === 'APPROVE' ? 'text-blue-600' : 'text-slate-400'} />
                      <span className="font-bold text-sm text-slate-900">Approve Application</span>
                    </div>
                  </label>

                  <label
                    onClick={() => setReviewDecision('REJECT')}
                    className={`hod-decision-card ${reviewDecision === 'REJECT' ? 'selected-reject' : ''}`}
                  >
                    <input
                      type="radio"
                      name="hodDrawerDecision"
                      checked={reviewDecision === 'REJECT'}
                      onChange={() => setReviewDecision('REJECT')}
                      className="size-4 accent-slate-600 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <XCircle size={16} className={reviewDecision === 'REJECT' ? 'text-slate-700' : 'text-slate-400'} />
                      <span className="font-bold text-sm text-slate-900">Reject Application</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Sanctioned Lectures Stepper if Consideration & Approve */}
              {reviewingItem.requestKind !== 'LEAVE' && reviewDecision === 'APPROVE' && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs font-bold text-slate-900 leading-tight">
                      Sanctioned Lectures
                    </span>
                    <span className="block text-[11px] font-medium text-slate-500 mt-0.5">
                      Requested: {Array.isArray(reviewingItem.requestedPeriods) ? reviewingItem.requestedPeriods.length : (reviewingItem.requestedPeriods || 3)} periods
                    </span>
                  </div>

                  <div className="hod-stepper-control">
                    <button
                      type="button"
                      onClick={() => setReviewApprovedPeriods((p) => Math.max(1, Number(p) - 1))}
                      className="hod-stepper-btn"
                      aria-label="Decrease"
                    >
                      –
                    </button>
                    <span className="hod-stepper-count">
                      {reviewApprovedPeriods}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReviewApprovedPeriods((p) => Math.min(8, Number(p) + 1))}
                      className="hod-stepper-btn"
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Remarks Input */}
              <div>
                <label className="font-bold text-xs uppercase tracking-wider text-slate-600 block mb-2">
                  {reviewDecision === 'REJECT' ? 'Rejection Remarks (Optional)' : 'Review Remarks (Optional)'}
                </label>
                <textarea
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder={reviewDecision === 'REJECT' ? 'State reason for rejection (optional)...' : 'Add remarks for student or department records'}
                  className="hod-drawer-textarea"
                  required={false}
                />
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="hod-drawer-footer">
              <button
                type="button"
                onClick={() => setReviewingItem(null)}
                disabled={reviewSubmitting}
                className="hod-btn-reject"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReview}
                disabled={reviewSubmitting}
                className="hod-btn-approve"
              >
                {reviewSubmitting
                  ? 'Submitting...'
                  : reviewDecision === 'APPROVE'
                  ? 'Confirm Approval'
                  : 'Confirm Rejection'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Official Clearances Ledger Modal */}
      {showLedgerModal && (
        <OfficialClearancesLedgerModal
          onClose={() => setShowLedgerModal(false)}
        />
      )}

      {/* Formal Sanctioned Application Document Modal */}
      {selectedSanctionItem && (
        <FormalApplicationModal
          item={selectedSanctionItem}
          onClose={() => setSelectedSanctionItem(null)}
        />
      )}

      {/* Official Clearance Report Modal */}
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
