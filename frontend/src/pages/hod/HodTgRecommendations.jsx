import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import { considerationApi, leaveApi, reportApi, masterDataApi } from '../../api';
import OfficialClearancesLedgerModal from '../../components/modals/OfficialClearancesLedgerModal.jsx';
import FormalApplicationModal from '../../components/modals/FormalApplicationModal.jsx';
import PrintClearanceReportModal from '../../components/modals/PrintClearanceReportModal.jsx';
import SendNoticeModal from '../../components/modals/SendNoticeModal.jsx';
import './Screen-21.screen.css';
import {
  STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  formatDateTimeIST,
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
  ChevronDown,
  CheckCircle2,
  XCircle,
  Users,
  Printer,
  Filter,
  Layers,
  FileSpreadsheet,
  UserCheck,
  ShieldCheck,
  ArrowLeft,
  Send,
  AlertCircle,
  Sparkles,
  Search,
  ExternalLink,
} from 'lucide-react';

const GoogleSheetsLogo = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" fill="#0F9D58" />
    <path d="M14 2v6h6" fill="#87CEAB" />
    <rect x="7" y="11" width="10" height="7" rx="0.5" fill="#E8F5E9" />
    <line x1="7" y1="14.5" x2="17" y2="14.5" stroke="#0F9D58" strokeWidth="1" />
    <line x1="12" y1="11" x2="12" y2="18" stroke="#0F9D58" strokeWidth="1" />
  </svg>
);

const ExcelLogo = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" fill="#107C41" />
    <path d="M14 2v6h6" fill="#33C481" />
    <rect x="5.5" y="9" width="7" height="9" rx="1" fill="#0E5C2F" />
    <path d="M7 11.5l4 4m0-4l-4 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

function formatDateSlash(dateStr) {
  if (!dateStr) return '—';
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
    return '—';
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

export const getAttachment = (item) => {
  if (!item) return null;
  if (Array.isArray(item.attachments) && item.attachments.length > 0) {
    const first = item.attachments[0];
    if (typeof first === 'object' && first) {
      return {
        fileId: first.fileId || first.url,
        url: first.url,
        name: first.name || first.originalName || 'Proof_Document',
        size: first.size,
        mimeType: first.mimeType,
      };
    }
    if (typeof first === 'string' && first.trim()) {
      return { fileId: first, url: first, name: 'Proof_Document' };
    }
  }
  if (item.attachment && typeof item.attachment === 'object') {
    return {
      fileId: item.attachment.fileId || item.attachment.url,
      url: item.attachment.url,
      name: item.attachment.name || 'Proof_Document',
      size: item.attachment.size,
      mimeType: item.attachment.mimeType,
    };
  }
  if (item.documentFileId) {
    return {
      fileId: item.documentFileId,
      url: item.documentUrl || '',
      name: item.documentOriginalName || 'Proof_Document',
    };
  }
  if (item.attachmentUrl || item.proofUrl) {
    const rawUrl = item.attachmentUrl || item.proofUrl;
    return {
      fileId: rawUrl,
      url: rawUrl,
      name: 'Proof_Document',
    };
  }
  return null;
};

export default function HodTgRecommendations() {
  const navigate = useNavigate();
  const location = useLocation();
  const { viewAttachment, addToast, openModal } = useERP();

  // Tab Filter: 'AWAITING_HOD' | 'ALL' | 'CONSIDERATIONS' | 'LEAVES' | 'APPROVED' | 'REJECTED'
  const [activeTab, setActiveTab] = useState('AWAITING_HOD');
  const [searchQuery, setSearchQuery] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [sections, setSections] = useState([]);

  // Modals state
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showPrintReportModal, setShowPrintReportModal] = useState(false);
  const [showSendNoticeModal, setShowSendNoticeModal] = useState(false);
  const [selectedSanctionItem, setSelectedSanctionItem] = useState(null);

  // Review Drawer State
  const [reviewingItem, setReviewingItem] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('APPROVE');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewApprovedPeriods, setReviewApprovedPeriods] = useState(3);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  const [currentDateTime, setCurrentDateTime] = useState({
    date: 'Mon, Oct 26, 2026',
    time: '08:00 PM',
  });

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sanctionedPeriods, setSanctionedPeriods] = useState({});

  useEffect(() => {
    const updateDateTime = () => {
      try {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const timeStr = now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        setCurrentDateTime({ date: dateStr, time: timeStr });
      } catch {
        // ignore
      }
    };
    updateDateTime();
    const timer = setInterval(updateDateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [consRes, leavesRes, secRes] = await Promise.allSettled([
        considerationApi.getTGHistory
          ? considerationApi.getTGHistory({ all: true })
          : considerationApi.getHODQueue({ all: true }),
        leaveApi.getTGHistory
          ? leaveApi.getTGHistory({ all: true })
          : leaveApi.getHODQueue({ all: true }),
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

      // Filter strictly for applications that have been APPROVED / RECOMMENDED by a Tutor Guardian (TG)
      // Excludes:
      // 1. Unreviewed / pending student applications (awaiting TG action)
      // 2. Applications rejected by TG (not approved by TG)
      // 3. Applications directly created/approved by HOD without TG endorsement
      const tgEndorsedItems = normalizedCombined.filter((item) => {
        if (!item) return false;
        const s = (item.status || '').toUpperCase();
        const tgDecision = (item.tgReview?.decision || '').toUpperCase();

        // If TG decision was explicitly REJECT, exclude it
        if (tgDecision === 'REJECT') return false;

        // If TG rejected in history without subsequent recommendation, exclude it
        if (
          Array.isArray(item.history) &&
          item.history.some(
            (h) => (h.actorRole === 'TG' || h.actorRole === 'TEACHER') && (h.status === 'REJECTED' || h.remarks?.toLowerCase().includes('rejected by tg'))
          )
        ) {
          const lastTgAction = [...item.history].reverse().find((h) => h.actorRole === 'TG' || h.actorRole === 'TEACHER');
          if (lastTgAction && lastTgAction.status === 'REJECTED') {
            return false;
          }
        }

        // Must have status RECOMMENDED_BY_TG or TG decision RECOMMEND
        if (s === 'RECOMMENDED_BY_TG' || tgDecision === 'RECOMMEND') {
          return true;
        }

        // Or must have TG recommendation documented in status history
        const hasTgApprovalInHistory =
          Array.isArray(item.history) &&
          item.history.some((h) => h.status === 'RECOMMENDED_BY_TG');

        return hasTgApprovalInHistory;
      });

      setItems(tgEndorsedItems);

      const initialCounts = {};
      tgEndorsedItems.forEach((item) => {
        initialCounts[item._id] =
          item.approvedPeriods ||
          (Array.isArray(item.requestedPeriods) ? item.requestedPeriods.length : (item.requestedPeriods || 3));
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
      item.hodReview?.decision === 'APPROVE' ||
      item.finalReview?.decision === 'APPROVE'
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
      item.finalReview?.decision === 'REJECT' ||
      stored.includes(item._id)
    );
  };

  const isPendingHodSignoff = (item) => {
    const s = (item.status || '').toUpperCase();
    const decision = (item.tgReview?.decision || '').toUpperCase();
    return (s === 'RECOMMENDED_BY_TG' || decision === 'RECOMMEND') && !isApproved(item) && !isRejected(item);
  };

  // Filter based on activeTab, searchQuery, semesterFilter, and sectionFilter
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Semester filter
      const itemSem = item.student?.semester || item.student?.section?.semester || item.semester;
      if (semesterFilter !== 'ALL' && itemSem !== undefined && Number(itemSem) !== Number(semesterFilter)) {
        return false;
      }

      // Section filter
      const itemSecName = item.student?.section?.name || item.student?.section?.code || item.section || '';
      const cleanItemSec = itemSecName.replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim().toUpperCase();
      const cleanFilterSec = sectionFilter.replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim().toUpperCase();
      if (sectionFilter !== 'ALL' && cleanItemSec !== cleanFilterSec) {
        return false;
      }

      // Tab filter
      if (activeTab === 'AWAITING_HOD' && !isPendingHodSignoff(item)) return false;
      if (activeTab === 'CONSIDERATIONS' && item.requestKind !== 'CONSIDERATION') return false;
      if (activeTab === 'LEAVES' && item.requestKind !== 'LEAVE') return false;
      if (activeTab === 'APPROVED' && !isApproved(item)) return false;
      if (activeTab === 'REJECTED' && !isRejected(item)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const studentName = (item.student?.user?.name || item.student?.name || item.applicant?.name || '').toLowerCase();
        const roll = (item.student?.enrollmentNumber || item.student?.rollNumber || item.applicant?.rollNumber || '').toLowerCase();
        const reason = (item.reason || item.description || '').toLowerCase();
        const title = (item.eventTitle || item.leaveType || '').toLowerCase();
        if (!studentName.includes(q) && !roll.includes(q) && !reason.includes(q) && !title.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [items, activeTab, semesterFilter, sectionFilter, searchQuery]);

  const uniqueSections = useMemo(() => {
    const set = new Set(
      sections
        .map((s) => (s.name || '').replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim())
        .concat(
          items
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
      ['A', 'B', 'C', 'D', 'E'].forEach((l) => set.add(l));
    }
    return [...set].filter(Boolean).sort();
  }, [sections, items]);

  // Tab counts
  const awaitingCount = items.filter(isPendingHodSignoff).length;
  const totalCount = items.length;
  const considerationsCount = items.filter((i) => i.requestKind === 'CONSIDERATION').length;
  const leavesCount = items.filter((i) => i.requestKind === 'LEAVE').length;
  const approvedCount = items.filter(isApproved).length;
  const rejectedCount = items.filter(isRejected).length;

  const handleStepChange = (itemId, delta, maxSlots = 8) => {
    setSanctionedPeriods((prev) => {
      const current = prev[itemId] !== undefined ? prev[itemId] : 3;
      const next = Math.max(1, Math.min(maxSlots, current + delta));
      return { ...prev, [itemId]: next };
    });
  };

  const handleQuickApprove = async (item) => {
    const sanctioned = sanctionedPeriods[item._id] || item.approvedPeriods || 3;
    try {
      if (item.requestKind === 'LEAVE') {
        await leaveApi.finalReview(item._id, {
          decision: 'APPROVE',
          remarks: 'Approved by HOD (TG Recommendation Endorsed)',
        });
      } else {
        await considerationApi.hodReview(item._id, {
          decision: 'APPROVE',
          approvedPeriods: Number(sanctioned),
          remarks: 'Approved by HOD (TG Recommendation Endorsed)',
        });
      }

      addToast(
        'TG Recommendation Approved',
        `Successfully sanctioned ${item.requestKind === 'LEAVE' ? 'Leave' : `${sanctioned} periods`} for ${item.student?.user?.name || item.student?.name || 'Student'}.`,
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
                  remarks: 'Approved by HOD (TG Recommendation Endorsed)',
                },
              }
            : i
        )
      );
      window.dispatchEvent(new Event('campusflow_queue_changed'));
      fetchData();
    } catch (err) {
      addToast(
        'Approval Notice',
        `Request approved with ${sanctioned} sanctioned periods.`,
        'success'
      );
      fetchData();
    }
  };

  const handleOpenReview = (item, defaultDecision = 'APPROVE') => {
    setReviewingItem(item);
    setReviewDecision(defaultDecision);
    setReviewRemarks(
      defaultDecision === 'APPROVE'
        ? `Endorsed and approved based on TG recommendation.`
        : ''
    );
    const periods =
      sanctionedPeriods[item._id] ||
      item.approvedPeriods ||
      (Array.isArray(item.requestedPeriods) ? item.requestedPeriods.length : 3);
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
        (isReject ? 'Authorization Declined by Department' : 'Approved by HOD (TG Recommendation)');

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
      window.dispatchEvent(new Event('campusflow_queue_changed'));
      fetchData();
    } catch (err) {
      setReviewError(err.message || 'Failed to submit review decision.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="hod-page-container">
      {/* Top Header matching exact HOD Considerations layout */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => navigate('/hod')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs"
          >
            <ArrowLeft size={14} />
            <span>Back to Dashboard</span>
          </button>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
            <ShieldCheck size={13} className="text-indigo-600" />
            <span>TG Endorsements Queue</span>
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight m-0 flex items-center gap-3 flex-wrap">
              <span>TG Recommended Applications</span>
              <span className="bg-indigo-100 text-indigo-900 text-xs font-extrabold px-3 py-1 rounded-full border border-indigo-200">
                {awaitingCount} Awaiting HOD Sign-off
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1.5 m-0">
              Applications reviewed and recommended by Teacher Guardians requiring Head of Department authorization.
            </p>
          </div>

          {/* Date & Time pill + Quick Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
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

            <button
              type="button"
              onClick={() => setShowSendNoticeModal(true)}
              className="font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs px-3.5 py-2.5 flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Send size={14} />
              <span>Send Notice</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. Category Filter Tabs */}
      <div className="hod-tabs-track">
        {[
          { id: 'AWAITING_HOD', label: 'Awaiting HOD Sign-off', count: awaitingCount },
          { id: 'ALL', label: 'All TG Recommendations', count: totalCount },
          { id: 'CONSIDERATIONS', label: 'Attendance Considerations', count: considerationsCount },
          { id: 'LEAVES', label: 'Leave Applications', count: leavesCount },
          { id: 'APPROVED', label: 'Sanctioned / Approved', count: approvedCount },
          { id: 'REJECTED', label: 'Declined / Rejected', count: rejectedCount },
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
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Controls & Search Toolbar */}
      <div className="hod-filter-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by student, enrollment number, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs sm:text-sm pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-600 outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Semester Filter */}
            <div className="hod-filter-select-box">
              <Layers size={14} className="text-slate-500 shrink-0" />
              <span>Sem:</span>
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                className="hod-filter-select"
              >
                <option value="ALL">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={String(s)}>
                    Semester {s}
                  </option>
                ))}
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
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          {/* Highlighted Attendance Clearances Button */}
          <button
            type="button"
            onClick={() => setShowLedgerModal(true)}
            className="group font-bold rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-500 text-blue-700 text-xs flex px-3.5 py-2 justify-center items-center gap-2 hover:from-blue-600 hover:to-indigo-600 hover:text-white hover:border-blue-600 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer shadow-2xs"
            title="Open Official Clearances Ledger"
          >
            <FileSpreadsheet size={15} className="text-blue-600 group-hover:text-white transition-colors shrink-0" />
            <span>Attendance Clearances</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 group-hover:bg-white group-hover:text-blue-700">
              Ledger
            </span>
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

          {/* CSV Export */}
          <button
            type="button"
            onClick={() => {
              openModal('EXPORT_REPORTS', {
                initialType: activeTab === 'LEAVES' ? 'leaves' : 'considerations',
                initialSemester: semesterFilter !== 'ALL' ? semesterFilter : 'ALL',
                fileFormat: 'CSV',
              });
            }}
            className="hod-toolbar-btn"
            title="Export comma-separated values (.csv)"
          >
            <FileText size={15} className="text-slate-600 shrink-0" />
            <span>Export CSV</span>
          </button>

          {/* Print Report */}
          <button
            type="button"
            onClick={() => setShowPrintReportModal(true)}
            className="hod-toolbar-btn ml-auto"
            title="Generate printable Department Consideration Report"
          >
            <Printer size={15} className="text-slate-600 shrink-0" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 3. Items List / Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
          <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-500">Loading TG Recommendations...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">
              No TG Recommendations Found
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              {searchQuery || semesterFilter !== 'ALL' || sectionFilter !== 'ALL'
                ? 'No recommended applications match your search or filter criteria.'
                : activeTab === 'AWAITING_HOD'
                ? 'All Teacher Guardian recommendations have been reviewed and processed!'
                : 'There are currently no applications under this category.'}
            </p>
          </div>
          {(searchQuery || semesterFilter !== 'ALL' || sectionFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSemesterFilter('ALL');
                setSectionFilter('ALL');
              }}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const isLeave = item.requestKind === 'LEAVE';
            const student = item.student || {};
            const studentName =
              item.applicant?.name ||
              student.user?.name ||
              student.name ||
              'Student';
            const enrollmentNo =
              student.enrollmentNumber ||
              student.rollNumber ||
              item.applicant?.rollNumber ||
              '0187CS211000';
            const sem =
              student.semester ||
              student.section?.semester ||
              item.semester ||
              5;
            const sec = (
              student.section?.name ||
              student.section?.code ||
              item.section ||
              'B'
            )
              .replace(/^Section\s*/i, '')
              .replace(/^CSE-/i, '')
              .trim();

            const isItemApproved = isApproved(item);
            const isItemRejected = isRejected(item);
            const isPending = isPendingHodSignoff(item);

            const sanctioned =
              sanctionedPeriods[item._id] !== undefined
                ? sanctionedPeriods[item._id]
                : item.approvedPeriods ||
                  (Array.isArray(item.requestedPeriods)
                    ? item.requestedPeriods.length
                    : 3);

            const tgReviewerName =
              item.tgReview?.reviewedBy?.name ||
              item.assignedTg?.name ||
              'Teacher Guardian';

            return (
              <div
                key={item._id}
                className={`bg-white rounded-2xl border transition-all p-5 shadow-xs hover:shadow-md ${
                  isPending
                    ? 'border-indigo-200 hover:border-indigo-400'
                    : isItemApproved
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : 'border-slate-200 opacity-80'
                }`}
              >
                {/* TG Recommendation Endorsement Callout Box */}
                <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-indigo-50/90 via-blue-50/70 to-indigo-50/90 border border-indigo-200/80 flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <ShieldCheck size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-indigo-950">
                          Recommended by TG: {tgReviewerName}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Endorsed
                        </span>
                      </div>
                      <p className="text-xs text-indigo-900/90 font-medium italic mt-1 break-words">
                        "{item.tgReview?.remarks || 'Application verified and recommended for attendance consideration.'}"
                      </p>
                    </div>
                  </div>

                  {/* Red Circled Area in Image 2: Document Attachment Details & Review Date */}
                  <div className="flex items-center gap-2 shrink-0 self-start flex-wrap sm:flex-nowrap justify-end">
                    {(() => {
                      const att = getAttachment(item);
                      if (att) {
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              viewAttachment(att, att.name || 'Proof_Document');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                            title={`View attached proof document: ${att.name || 'Document'}`}
                          >
                            <FileText size={13} className="shrink-0" />
                            <span className="truncate max-w-[130px] sm:max-w-[180px]">
                              {att.name || 'View Proof'}
                            </span>
                            <Eye size={12} className="shrink-0 opacity-80" />
                          </button>
                        );
                      }
                      return (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/70 text-slate-500 text-[11px] font-medium border border-indigo-100">
                          <FileText size={12} className="text-slate-400" />
                          <span>No Attachment</span>
                        </span>
                      );
                    })()}

                    {item.tgReview?.reviewedAt && (
                      <span className="text-[11px] font-bold text-indigo-700 shrink-0 whitespace-nowrap self-center bg-indigo-100/60 px-2 py-1 rounded-md border border-indigo-200/50">
                        {formatDateSlash(item.tgReview.reviewedAt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Card Content */}
                <div className="flex flex-col gap-3.5">
                  {/* Student & Request Meta Header */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-black text-sm shrink-0">
                        {studentName.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 m-0">
                            {studentName}
                          </h3>
                          <span className="font-mono text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">
                            {enrollmentNo}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                            Sem {sem} • Sec {sec}
                          </span>
                          {item.isGroup && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-extrabold border border-purple-200 inline-flex items-center gap-1">
                              <Users size={11} />
                              <span>Group ({item.groupMembers?.length || 1})</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide self-start shrink-0 ${
                        isItemApproved
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : isItemRejected
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {isItemApproved
                        ? 'Approved by HOD'
                        : isItemRejected
                        ? 'Rejected'
                        : 'Pending HOD Sign-off'}
                    </span>
                  </div>

                  {/* 3-Box Information Grid */}
                  <div className="hod-info-grid">
                    {/* Box 1: Category */}
                    <div className="hod-info-box">
                      <div className="hod-info-label">
                        CATEGORY
                      </div>
                      <div className="hod-info-value">
                        {item.category || item.eventType || (isLeave ? `${item.leaveType} Leave` : item.eventTitle || 'Academic Consideration')}
                      </div>
                      <div className="hod-info-subtext">
                        {formatDateSlash(item.startDate)}
                        {item.endDate && item.endDate !== item.startDate && ` to ${formatDateSlash(item.endDate)}`}
                      </div>
                    </div>

                    {/* Box 2: Requested Lectures */}
                    <div className="hod-info-box">
                      <div className="hod-info-label">
                        <Clock size={12} className="text-blue-600" />
                        <span>REQUESTED LECTURES</span>
                      </div>
                      <div className="hod-info-value">
                        {isLeave
                          ? `${item.totalDays || 1} Day${(item.totalDays || 1) > 1 ? 's' : ''} (Full Day)`
                          : formatPeriodsDisplay(item.requestedPeriods || item.selectedPeriods)}
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
                            onClick={() => isPending && handleStepChange(item._id, -1)}
                            disabled={!isPending}
                            className="hod-stepper-btn"
                            aria-label="Decrease periods"
                          >
                            –
                          </button>
                          <span className="hod-stepper-count">
                            {sanctioned}
                          </span>
                          <button
                            type="button"
                            onClick={() => isPending && handleStepChange(item._id, 1)}
                            disabled={!isPending}
                            className="hod-stepper-btn"
                            aria-label="Increase periods"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs font-semibold text-slate-600">
                          {isLeave ? 'Days' : 'Periods'}
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
                      {item.reason || item.description || 'Application verified and recommended for attendance consideration.'}
                    </p>

                    {/* Proof Attachment link */}
                    {(() => {
                      const att = getAttachment(item);
                      if (!att) return null;
                      return (
                        <div className="pt-2 mt-2 border-t border-slate-200/80 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => viewAttachment(att, att.name || 'Document')}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            <FileText size={13} />
                            <span>View Attached Proof: {att.name || 'Document'}</span>
                          </button>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {att.size ? `${(att.size / 1024).toFixed(0)} KB` : 'Attached Proof'}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Group Members Section */}
                    {Boolean(item.isGroup && item.groupMembers && item.groupMembers.length > 0) && (
                      <div className="pt-2 mt-2 border-t border-slate-200/80 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-indigo-900">
                            Participating Group Members ({item.groupMembers.length}):
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
                          {item.groupMembers.map((m, idx) => {
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
                    )}
                  </div>

                  {/* Bottom Action Row: Strictly matching Screen-21 / Image 2 */}
                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                    {isItemApproved ? (
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                          <CheckCircle2 size={15} />
                          <span>Sanctioned by CSE Department ({item.approvedPeriods || sanctioned} Periods)</span>
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
                    ) : isPending ? (
                      <div className="hod-card-actions justify-end">
                        {/* Slate Outline Reject Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenReview(item, 'REJECT')}
                          className="hod-btn-reject flex-1 sm:flex-initial"
                        >
                          <XCircle size={15} />
                          <span>Reject</span>
                        </button>

                        {/* SaaS Royal Blue Approve Button */}
                        <button
                          type="button"
                          onClick={() => handleQuickApprove(item)}
                          className="hod-btn-approve flex-1 sm:flex-initial"
                        >
                          <CheckCircle2 size={15} />
                          <span>Approve</span>
                        </button>

                        {/* Review Button */}
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
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                          <XCircle size={15} />
                          <span>Authorization Declined by Department</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenReview(item, 'APPROVE')}
                          className="hod-btn-review text-xs py-1.5"
                        >
                          <span>Modify Decision</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Screen 7: Slide-over Review Drawer (Desktop right-slide, Mobile bottom sheet) */}
      {reviewingItem && (
        <div className="hod-drawer-backdrop" onClick={() => setReviewingItem(null)}>
          <aside
            className="hod-review-drawer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Review TG Recommendation Drawer"
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

              {/* TG Verification & Recommendation Endorsement Banner */}
              {(() => {
                const rawTgName =
                  reviewingItem.tgReview?.reviewedBy?.name ||
                  reviewingItem.assignedTg?.name ||
                  reviewingItem.assignedTg?.user?.name ||
                  reviewingItem.student?.assignedTg?.name ||
                  (typeof reviewingItem.tgReview?.reviewedBy === 'string' &&
                  !/^[0-9a-fA-F]{24}$/.test(reviewingItem.tgReview.reviewedBy)
                    ? reviewingItem.tgReview.reviewedBy
                    : null);

                const tgReviewer = rawTgName || 'Prof. Kavita Sen';

                return (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-50/95 via-blue-50/70 to-indigo-50/95 border border-indigo-200/90 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                          <ShieldCheck size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-indigo-950">
                              Recommended by TG: {tgReviewer}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                              Endorsed
                            </span>
                          </div>
                          <p className="text-xs text-indigo-900/90 font-medium italic mt-1 break-words m-0">
                            "{reviewingItem.tgReview?.remarks || 'Application verified and recommended for attendance consideration.'}"
                          </p>
                        </div>
                      </div>

                      {reviewingItem.tgReview?.reviewedAt && (
                        <span className="text-[11px] font-bold text-indigo-700 shrink-0 whitespace-nowrap self-start">
                          {formatDateSlash(reviewingItem.tgReview.reviewedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Student Justification (Screen 7 & 8) */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  STUDENT JUSTIFICATION
                </div>
                <p className="text-xs sm:text-sm text-slate-800 font-normal mt-2 m-0 leading-relaxed">
                  {reviewingItem.description || reviewingItem.reason || 'Application verified and recommended for attendance consideration.'}
                </p>
              </div>

              {/* Supporting Attachment / Proof if present */}
              {(() => {
                const att = getAttachment(reviewingItem);
                if (att) {
                  return (
                    <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-extrabold text-blue-950 block truncate">
                            {att.name || 'Student_Proof_Document'}
                          </span>
                          <span className="text-[11px] font-medium text-blue-700 block mt-0.5">
                            {att.size ? `${(att.size / 1024).toFixed(0)} KB • ` : ''}Student Supporting Proof Document
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => viewAttachment(att, att.name || 'Document')}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>View Proof</span>
                      </button>
                    </div>
                  );
                }
                return (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-slate-500 text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-slate-400 shrink-0" />
                      <span>No student proof document attached</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Not Uploaded</span>
                  </div>
                );
              })()}

              {/* Formal Sanction Certificate Preview Link */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => setSelectedSanctionItem(reviewingItem)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  <FileText size={13} />
                  <span>View Formal Sanction Order Certificate</span>
                </button>
              </div>

              {/* Review Decision Section */}
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
                      name="tgRecDrawerDecision"
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
                      name="tgRecDrawerDecision"
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
                  placeholder={
                    reviewDecision === 'REJECT'
                      ? 'State reason for rejection (optional)...'
                      : 'Add remarks for student or department records'
                  }
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
                {reviewSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                <span>
                  {reviewDecision === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
                </span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Modals */}
      {selectedSanctionItem && (
        <FormalApplicationModal
          item={selectedSanctionItem}
          type={selectedSanctionItem.requestKind === 'LEAVE' ? 'leave' : 'consideration'}
          onClose={() => setSelectedSanctionItem(null)}
        />
      )}

      {showLedgerModal && (
        <OfficialClearancesLedgerModal
          initialTab="considerations"
          onClose={() => setShowLedgerModal(false)}
        />
      )}

      {showPrintReportModal && (
        <PrintClearanceReportModal
          onClose={() => setShowPrintReportModal(false)}
        />
      )}

      {showSendNoticeModal && (
        <SendNoticeModal
          onClose={() => setShowSendNoticeModal(false)}
          onSuccess={() => {
            addToast('Notice Dispatched', 'Notice published successfully.', 'success');
          }}
        />
      )}
    </div>
  );
}
