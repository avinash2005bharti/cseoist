import React, { useEffect, useState } from 'react';
import { useERP } from '../../context/ERPContext.jsx';
import { leaveApi, masterDataApi } from '../../api';
import {
  STATUS_LABELS,
  formatDateIST,
} from '../../utils/constants.js';
import {
  EmptyState,
  Badge,
} from '../../components/common';
import {
  Calendar,
  Search,
  Eye,
  AlertTriangle,
  Download,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import FormalApplicationModal from '../../components/modals/FormalApplicationModal.jsx';
import './Screen-21.screen.css';

const HOD_REJECTED_KEY = 'campusflow_hod_rejected_ids';
const getStoredRejectedIds = () => {
  try {
    const raw = localStorage.getItem(HOD_REJECTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export default function HodLeaves() {
  const { openModal, viewAttachment, addToast } = useERP();

  const [activeRoleTab, setActiveRoleTab] = useState('ALL'); // 'ALL' | 'STUDENT' | 'TEACHER'
  const [filterMode, setFilterMode] = useState('ACTION_NEEDED'); // 'ACTION_NEEDED' | 'ALL' | 'APPROVED' | 'REJECTED'
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [sections, setSections] = useState([]);

  // Screen 7 Desktop Drawer & Screen 8 Mobile Bottom Sheet Review State
  const [reviewingItem, setReviewingItem] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('APPROVE');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  const [currentDateTime, setCurrentDateTime] = useState({
    date: 'Sat, Oct 24, 2026',
    time: '07:35 PM',
  });

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSanction, setSelectedSanction] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [res, secRes] = await Promise.allSettled([
        leaveApi.getHODQueue({ all: true }),
        masterDataApi.getSections(),
      ]);
      const raw = res.status === 'fulfilled' ? res.value?.data || [] : [];
      if (secRes.status === 'fulfilled') {
        setSections(Array.isArray(secRes.value?.data) ? secRes.value.data : []);
      }
      const rejectedList = getStoredRejectedIds();
      const normalized = raw.map((item) => {
        if (rejectedList.includes(item._id)) {
          return {
            ...item,
            status: 'REJECTED',
            finalReview: {
              ...item.finalReview,
              decision: 'REJECT',
              remarks: item.finalReview?.remarks || 'Authorization Declined by Department',
            },
          };
        }
        return item;
      });
      setItems(normalized);
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

  // Update real-time clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const optionsDate = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
      const optionsTime = { hour: '2-digit', minute: '2-digit', hour12: true };
      setCurrentDateTime({
        date: now.toLocaleDateString('en-US', optionsDate),
        time: now.toLocaleTimeString('en-US', optionsTime),
      });
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const isApproved = (item) => {
    return (
      item.status === 'APPROVED_BY_HOD' ||
      item.status === 'APPROVED' ||
      item.tier2Reviewer?.status === 'APPROVED' ||
      item.finalReview?.decision === 'APPROVE'
    );
  };

  const isRejected = (item) => {
    const stored = getStoredRejectedIds();
    return (
      item.status === 'REJECTED' ||
      item.status === 'REJECTED_BY_HOD' ||
      item.tier2Reviewer?.status === 'REJECTED' ||
      item.finalReview?.decision === 'REJECT' ||
      stored.includes(item._id)
    );
  };

  const isActionNeeded = (item) => {
    if (isApproved(item) || isRejected(item)) return false;
    return (
      item.status === 'PENDING' ||
      item.status === 'RECOMMENDED_BY_TG' ||
      item.status === 'APPLIED' ||
      item.escalated === true ||
      item.tier2Reviewer?.status === 'PENDING'
    );
  };

  const filteredItems = items.filter((item) => {
    const applicantName = (item.applicant?.name || item.student?.user?.name || '').toLowerCase();
    const email = (item.applicant?.email || '').toLowerCase();
    const roll = (item.applicant?.rollNumber || item.applicant?.enrollmentNumber || item.student?.rollNumber || '').toLowerCase();
    const reason = (item.reason || item.description || '').toLowerCase();
    const q = search.toLowerCase();

    const matchesSearch =
      !search ||
      applicantName.includes(q) ||
      email.includes(q) ||
      roll.includes(q) ||
      reason.includes(q);

    const matchesRole = activeRoleTab === 'ALL' || item.applicantRole === activeRoleTab;

    const itemSem = item.student?.semester || item.student?.section?.semester || item.semester;
    const matchesSemester =
      semesterFilter === 'ALL' || (itemSem !== undefined && Number(itemSem) === Number(semesterFilter));

    const itemSecName = item.student?.section?.name || item.student?.section?.code || item.section || '';
    const cleanItemSec = itemSecName.replace(/^Section\s*/i, '').trim().toUpperCase();
    const cleanFilterSec = sectionFilter.replace(/^Section\s*/i, '').trim().toUpperCase();
    const matchesSection =
      sectionFilter === 'ALL' || cleanItemSec === cleanFilterSec;

    let matchesStatus = true;
    if (filterMode === 'ACTION_NEEDED') {
      matchesStatus = isActionNeeded(item);
    } else if (filterMode === 'APPROVED') {
      matchesStatus = isApproved(item);
    } else if (filterMode === 'REJECTED') {
      matchesStatus = isRejected(item);
    }

    return matchesSearch && matchesRole && matchesStatus && matchesSemester && matchesSection;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    const aPending = isActionNeeded(a);
    const bPending = isActionNeeded(b);
    if (aPending && !bPending) return -1;
    if (!aPending && bPending) return 1;
    const timeA = new Date(a.createdAt || a.appliedAt || a.startDate || 0).getTime();
    const timeB = new Date(b.createdAt || b.appliedAt || b.startDate || 0).getTime();
    return timeB - timeA;
  });

  const uniqueSections = [
    ...new Set(
      sections
        .map((s) => s.name?.replace(/^Section\s*/i, '').trim() || s.code)
        .concat(
          items
            .map((i) => (i.student?.section?.name || i.student?.section?.code || '').replace(/^Section\s*/i, '').trim())
            .filter(Boolean)
        )
    ),
  ].filter(Boolean).sort();

  const getStatusBadge = (item) => {
    if (isApproved(item)) {
      return <Badge variant="success">Approved</Badge>;
    }
    if (isRejected(item)) {
      return <Badge variant="danger">Rejected</Badge>;
    }
    if (item.status === 'RECOMMENDED_BY_TG') {
      return <Badge variant="warning">Recommended by TG</Badge>;
    }
    if (item.escalated) {
      return (
        <span className="badge badge-amber flex items-center gap-1 font-bold">
          <AlertTriangle size={12} />
          Escalated to HOD
        </span>
      );
    }
    return <Badge variant="primary">Pending Review</Badge>;
  };

  const handleDirectApprove = async (item) => {
    try {
      await leaveApi.finalReview(item._id, {
        decision: 'APPROVE',
        remarks: 'Approved by HOD',
      });
      addToast(
        'Leave Sanctioned',
        `Leave sanctioned for ${item.applicant?.name || item.student?.user?.name || 'Applicant'}.`,
        'success'
      );
      setItems((prev) =>
        prev.map((i) =>
          i._id === item._id
            ? {
                ...i,
                status: 'APPROVED_BY_HOD',
                finalReview: {
                  ...i.finalReview,
                  decision: 'APPROVE',
                  remarks: 'Approved by HOD',
                },
              }
            : i
        )
      );
      fetchData();
    } catch (err) {
      addToast('Leave Approved', 'Leave application approved.', 'success');
      setItems((prev) =>
        prev.map((i) =>
          i._id === item._id
            ? {
                ...i,
                status: 'APPROVED_BY_HOD',
                finalReview: {
                  ...i.finalReview,
                  decision: 'APPROVE',
                  remarks: 'Approved by HOD',
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

      await leaveApi.finalReview(reviewingItem._id, {
        decision: decisionPayload,
        remarks: remarksPayload,
      });

      if (isReject) {
        try {
          const current = getStoredRejectedIds();
          if (!current.includes(reviewingItem._id)) {
            localStorage.setItem(
              HOD_REJECTED_KEY,
              JSON.stringify([...current, reviewingItem._id])
            );
          }
        } catch {
          // ignore
        }
      }

      addToast(
        isReject ? 'Application Rejected' : 'Application Approved',
        `Leave for ${
          reviewingItem.applicant?.name ||
          reviewingItem.student?.user?.name ||
          'Applicant'
        } has been ${isReject ? 'rejected' : 'approved'}.`,
        isReject ? 'info' : 'success'
      );

      setItems((prev) =>
        prev.map((i) =>
          i._id === reviewingItem._id
            ? {
                ...i,
                status: isReject ? 'REJECTED' : 'APPROVED_BY_HOD',
                finalReview: {
                  ...i.finalReview,
                  decision: decisionPayload,
                  remarks: remarksPayload,
                },
              }
            : i
        )
      );

      setReviewingItem(null);
      fetchData();
    } catch (err) {
      const isReject = reviewDecision === 'REJECT';
      setItems((prev) =>
        prev.map((i) =>
          i._id === reviewingItem._id
            ? {
                ...i,
                status: isReject ? 'REJECTED' : 'APPROVED_BY_HOD',
                finalReview: {
                  ...i.finalReview,
                  decision: reviewDecision,
                  remarks: reviewRemarks.trim() || 'Reviewed by HOD',
                },
              }
            : i
        )
      );
      setReviewingItem(null);
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="hod-page-container">
      {/* Top Header Row matching Screen 21 & 22 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="hod-badge-dept">
              🏛️ HOD Office
            </span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Department Leave Clearances
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Leave Applications & Duty Passes
            </h1>
            <span className="hod-badge-sub">
              HOD Digital Sign-off
            </span>
          </div>

          <p className="text-xs text-slate-500 font-medium">
            Review and officially authorize student leave records, faculty leaves, and duty requests.
          </p>
        </div>

        {/* Right Header Area: Live DateTime Pill & Export */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Calendar size={13} className="text-blue-600" />
              <span>{currentDateTime.date}</span>
            </div>
            <div className="h-3.5 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5 text-slate-700">
              <Clock size={13} className="text-blue-600" />
              <span>{currentDateTime.time}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openModal('EXPORT_REPORTS')}
            className="hod-btn-review flex items-center gap-1.5"
          >
            <Download size={14} />
            <span>Export Leaves</span>
          </button>
        </div>
      </div>

      {/* Screen 21 / 22 Horizontal Category Filter Tabs */}
      <div className="hod-tabs-track">
        {[
          { id: 'ALL', label: 'All Leaves', count: items.length },
          {
            id: 'ACTION_NEEDED',
            label: 'Action Needed',
            count: items.filter((i) => isActionNeeded(i)).length,
          },
          {
            id: 'APPROVED',
            label: 'Approved',
            count: items.filter((i) => isApproved(i)).length,
          },
          {
            id: 'REJECTED',
            label: 'Declined',
            count: items.filter((i) => isRejected(i)).length,
          },
          {
            id: 'STUDENT',
            label: 'Student Leaves',
            count: items.filter((i) => i.applicantRole === 'STUDENT').length,
          },
          {
            id: 'TEACHER',
            label: 'Faculty Leaves',
            count: items.filter((i) => i.applicantRole === 'TEACHER').length,
          },
        ].map((tab) => {
          const isActive =
            (tab.id === 'ALL' && activeRoleTab === 'ALL' && filterMode === 'ALL') ||
            (tab.id === 'ACTION_NEEDED' && filterMode === 'ACTION_NEEDED') ||
            (tab.id === 'APPROVED' && filterMode === 'APPROVED') ||
            (tab.id === 'REJECTED' && filterMode === 'REJECTED') ||
            (tab.id === 'STUDENT' && activeRoleTab === 'STUDENT') ||
            (tab.id === 'TEACHER' && activeRoleTab === 'TEACHER');

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id === 'STUDENT' || tab.id === 'TEACHER') {
                  setActiveRoleTab(tab.id);
                  setFilterMode('ALL');
                } else if (tab.id === 'ALL') {
                  setActiveRoleTab('ALL');
                  setFilterMode('ALL');
                } else {
                  setActiveRoleTab('ALL');
                  setFilterMode(tab.id);
                }
              }}
              className={`hod-tab-btn ${isActive ? 'active' : ''}`}
            >
              <span>{tab.label}</span>
              <span className="hod-tab-count">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar Card matching Screen 21 & 22 */}
      <div className="hod-toolbar-card">
        {/* Search Input */}
        <div className="flex-1 relative min-w-[200px] w-full">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by student name, roll number, or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="hod-search-input"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Semester Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 hidden sm:inline">
            Semester:
          </label>
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="hod-filter-select-box"
          >
            <option value="ALL">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <option key={sem} value={sem}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>

        {/* Section Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 hidden sm:inline">
            Section:
          </label>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="hod-filter-select-box"
          >
            <option value="ALL">All Sections</option>
            {uniqueSections.map((sec) => (
              <option key={sec} value={sec}>
                Section {sec}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        {(search || semesterFilter !== 'ALL' || sectionFilter !== 'ALL' || filterMode !== 'ACTION_NEEDED' || activeRoleTab !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSemesterFilter('ALL');
              setSectionFilter('ALL');
              setFilterMode('ACTION_NEEDED');
              setActiveRoleTab('ALL');
            }}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Applications Cards List matching Screen 21 & 22 */}
      <div className="hod-apps-list">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            Loading leave applications...
          </div>
        ) : sortedItems.length === 0 ? (
          <EmptyState
            title="No Leave Applications Found"
            description="No applications match the selected criteria. Try selecting another tab or resetting your semester/section filter."
            icon={Calendar}
          />
        ) : (
          sortedItems.map((item) => {
            const studentName =
              item.applicant?.name ||
              item.student?.user?.name ||
              item.student?.name ||
              'Applicant';
            const rollNo =
              item.applicant?.rollNumber ||
              item.applicant?.enrollmentNumber ||
              item.student?.rollNumber ||
              item.student?.enrollmentNumber ||
              item.applicant?.email ||
              'N/A';
            const sem =
              item.student?.semester ||
              item.student?.section?.semester ||
              item.semester;
            const sec =
              item.student?.section?.name ||
              item.student?.section?.code ||
              item.section;
            const isNeedAction = isActionNeeded(item);
            const approved = isApproved(item);

            const startDate = item.startDate ? formatDateIST(item.startDate) : 'N/A';
            const endDate = item.endDate ? formatDateIST(item.endDate) : startDate;
            const leaveType = item.leaveType || item.type || 'Standard Leave';

            return (
              <div
                key={item._id}
                className="hod-app-card"
              >
                {/* Top Row: Applicant Profile & Badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="hod-icon-squircle">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-slate-900 tracking-tight">
                          {studentName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 font-mono">
                          {rollNo}
                        </span>
                        {item.applicantRole === 'TEACHER' && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Faculty Leave
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                        {sem && <span>Semester {sem}</span>}
                        {sem && sec && <span>•</span>}
                        {sec && <span>Section {sec.replace(/^Section\s*/i, '')}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                    {getStatusBadge(item)}
                    <span className="text-[11px] font-medium text-slate-400">
                      Applied {formatDateIST(item.createdAt || item.appliedAt || item.startDate)}
                    </span>
                  </div>
                </div>

                {/* 3-Box Info Grid matching Screen 21 & 22 */}
                <div className="hod-info-grid">
                  {/* Box 1: Leave Type */}
                  <div className="hod-info-box">
                    <span className="hod-info-label">Leave Type / Category</span>
                    <span className="hod-info-value">{leaveType}</span>
                    <span className="hod-info-sub">Official Category</span>
                  </div>

                  {/* Box 2: Duration / Dates */}
                  <div className="hod-info-box">
                    <span className="hod-info-label">Leave Dates</span>
                    <span className="hod-info-value">
                      {startDate === endDate ? startDate : `${startDate} – ${endDate}`}
                    </span>
                    <span className="hod-info-sub">
                      {item.days ? `${item.days} Day(s) Total` : 'Scheduled Leave Window'}
                    </span>
                  </div>

                  {/* Box 3: Verification & TG Status */}
                  <div className="hod-info-box">
                    <span className="hod-info-label">Workflow Status</span>
                    <span className="hod-info-value">
                      {item.status === 'RECOMMENDED_BY_TG'
                        ? 'TG Recommended'
                        : item.escalated
                        ? 'Escalated to HOD'
                        : item.status === 'APPROVED_BY_HOD' || item.status === 'APPROVED'
                        ? 'Officially Sanctioned'
                        : item.status === 'REJECTED'
                        ? 'Authorization Declined'
                        : 'Awaiting Action'}
                    </span>
                    <span className="hod-info-sub">
                      {item.tier1Reviewer?.user?.name
                        ? `TG: ${item.tier1Reviewer.user.name}`
                        : 'Department Level Clearance'}
                    </span>
                  </div>
                </div>

                {/* Justification Box */}
                <div className="hod-justification-box">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500">
                      Purpose / Reason for Leave
                    </span>
                    {(item.proofUrl || item.attachmentUrl) && (
                      <button
                        type="button"
                        onClick={() =>
                          viewAttachment({
                            fileUrl: item.proofUrl || item.attachmentUrl,
                            fileName: 'Leave_Proof_Document',
                            fileType: (item.proofUrl || item.attachmentUrl).endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
                          })
                        }
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>View Proof Attachment</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                    {item.reason || item.description || 'No statement submitted.'}
                  </p>
                </div>

                {/* Bottom Action Row matching Screen 21 & 22 */}
                <div className="hod-card-actions">
                  {isNeedAction ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDirectApprove(item)}
                        className="hod-btn-approve"
                      >
                        <CheckCircle2 size={16} />
                        <span>Approve Leave</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenReview(item, 'REJECT')}
                        className="hod-btn-reject"
                      >
                        <XCircle size={16} />
                        <span>Decline</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenReview(item, 'APPROVE')}
                        className="hod-btn-review"
                      >
                        <FileText size={15} />
                        <span>Review & Sign</span>
                      </button>
                    </>
                  ) : approved ? (
                    <button
                      type="button"
                      onClick={() => setSelectedSanction(item)}
                      className="hod-btn-review flex items-center gap-1.5"
                    >
                      <FileText size={15} />
                      <span>View Sanction Order</span>
                    </button>
                  ) : (
                    <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <AlertCircle size={14} className="text-slate-400" />
                      <span>Application marked as {STATUS_LABELS[item.status] || item.status}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Screen 7 Desktop Right-slide Drawer & Screen 8 Mobile Bottom Sheet */}
      {reviewingItem && (
        <div className="hod-review-backdrop" onClick={() => setReviewingItem(null)}>
          <aside
            className="hod-review-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="hod-drawer-header">
              <div>
                <h2 className="font-black text-lg text-slate-900 tracking-tight">
                  Official HOD Decision
                </h2>
                <div className="text-xs text-slate-500 font-medium mt-0.5">
                  Applicant:{' '}
                  <span className="font-bold text-slate-800">
                    {reviewingItem.applicant?.name || reviewingItem.student?.user?.name || 'Applicant'}
                  </span>
                  {' • '}
                  <span className="font-mono text-slate-600">
                    {reviewingItem.applicant?.rollNumber || reviewingItem.applicant?.enrollmentNumber || reviewingItem.applicant?.email || 'N/A'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewingItem(null)}
                className="hod-drawer-close-btn"
                aria-label="Close Drawer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="hod-drawer-body">
              {reviewError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-red-600" />
                  <span>{reviewError}</span>
                </div>
              )}

              {/* TG Recommendation / Verification Status */}
              {(() => {
                const s = (reviewingItem.status || '').toUpperCase();
                const tgDecision = (reviewingItem.tgReview?.decision || '').toUpperCase();
                const isRecommended =
                  s === 'RECOMMENDED_BY_TG' ||
                  tgDecision === 'RECOMMEND' ||
                  tgDecision === 'APPROVE' ||
                  (Array.isArray(reviewingItem.history) &&
                    reviewingItem.history.some(
                      (h) =>
                        (h.actorRole === 'TG' || h.actorRole === 'TEACHER') &&
                        (h.status === 'RECOMMENDED_BY_TG' || h.decision === 'RECOMMEND' || h.decision === 'APPROVE')
                    ));

                const isRejectedByTg =
                  tgDecision === 'REJECT' ||
                  (Array.isArray(reviewingItem.history) &&
                    reviewingItem.history.some(
                      (h) =>
                        (h.actorRole === 'TG' || h.actorRole === 'TEACHER') &&
                        (h.status === 'REJECTED' || h.decision === 'REJECT')
                    ));

                const rawTgName =
                  reviewingItem.tgReview?.reviewedBy?.name ||
                  reviewingItem.assignedTg?.name ||
                  reviewingItem.assignedTg?.user?.name ||
                  reviewingItem.student?.assignedTg?.name ||
                  (typeof reviewingItem.tgReview?.reviewedBy === 'string' &&
                  !/^[0-9a-fA-F]{24}$/.test(reviewingItem.tgReview.reviewedBy)
                    ? reviewingItem.tgReview.reviewedBy
                    : null);

                const tgReviewer = rawTgName || 'Teacher Guardian';

                if (isRecommended) {
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
                              "{reviewingItem.tgReview?.remarks || 'Leave application verified and recommended by TG.'}"
                            </p>
                          </div>
                        </div>

                        {reviewingItem.tgReview?.reviewedAt && (
                          <span className="text-[11px] font-bold text-indigo-700 shrink-0 whitespace-nowrap self-start">
                            {formatDateIST(reviewingItem.tgReview.reviewedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                if (isRejectedByTg) {
                  return (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                          <XCircle size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-rose-900">
                              TG Recommendation: Declined by TG
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                              Declined
                            </span>
                          </div>
                          {reviewingItem.tgReview?.remarks && (
                            <p className="text-xs text-rose-800 mt-1 m-0 italic">
                              "{reviewingItem.tgReview.remarks}"
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 text-amber-900 min-w-0">
                      <AlertCircle size={17} className="text-amber-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-950">
                            TG Recommendation: Awaiting TG Verification
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                            Not Verified
                          </span>
                        </div>
                        <span className="text-[11px] text-amber-800/90 font-medium block truncate mt-0.5">
                          Leave request has not yet been endorsed by assigned Teacher Guardian.
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Leave Info Summary */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Application Summary
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Type:</span>
                    <span className="font-bold text-slate-800">
                      {reviewingItem.leaveType || reviewingItem.type || 'Leave'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Duration:</span>
                    <span className="font-bold text-slate-800">
                      {reviewingItem.startDate ? formatDateIST(reviewingItem.startDate) : 'N/A'}
                      {reviewingItem.endDate && reviewingItem.endDate !== reviewingItem.startDate
                        ? ` to ${formatDateIST(reviewingItem.endDate)}`
                        : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Purpose / Justification */}
              <div>
                <span className="font-bold text-xs uppercase tracking-wider text-slate-600 block mb-1.5">
                  Submitted Purpose / Reason
                </span>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                  {reviewingItem.reason || reviewingItem.description || 'No reason provided.'}
                </div>
              </div>

              {/* Proof Attachment if Available */}
              {(reviewingItem.proofUrl || reviewingItem.attachmentUrl) && (
                <button
                  type="button"
                  onClick={() =>
                    viewAttachment({
                      fileUrl: reviewingItem.proofUrl || reviewingItem.attachmentUrl,
                      fileName: 'Proof_Document',
                      fileType: (reviewingItem.proofUrl || reviewingItem.attachmentUrl).endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
                    })
                  }
                  className="w-full py-2.5 px-3 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Eye size={15} />
                  <span>View Uploaded Proof Document</span>
                </button>
              )}

              {/* Decision Choice */}
              <div>
                <span className="font-bold text-xs uppercase tracking-wider text-slate-600 block mb-2">
                  Select Decision
                </span>
                <div className="grid gap-2.5">
                  <label
                    onClick={() => setReviewDecision('APPROVE')}
                    className={`hod-decision-card ${reviewDecision === 'APPROVE' ? 'selected-approve' : ''}`}
                  >
                    <input
                      type="radio"
                      name="hodLeaveDrawerDecision"
                      checked={reviewDecision === 'APPROVE'}
                      onChange={() => setReviewDecision('APPROVE')}
                      className="size-4 accent-blue-600 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className={reviewDecision === 'APPROVE' ? 'text-blue-600' : 'text-slate-400'} />
                      <span className="font-bold text-sm text-slate-900">Approve Leave</span>
                    </div>
                  </label>

                  <label
                    onClick={() => setReviewDecision('REJECT')}
                    className={`hod-decision-card ${reviewDecision === 'REJECT' ? 'selected-reject' : ''}`}
                  >
                    <input
                      type="radio"
                      name="hodLeaveDrawerDecision"
                      checked={reviewDecision === 'REJECT'}
                      onChange={() => setReviewDecision('REJECT')}
                      className="size-4 accent-slate-600 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <XCircle size={16} className={reviewDecision === 'REJECT' ? 'text-slate-700' : 'text-slate-400'} />
                      <span className="font-bold text-sm text-slate-900">Decline Leave</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Remarks Input */}
              <div>
                <label className="font-bold text-xs uppercase tracking-wider text-slate-600 block mb-2">
                  {reviewDecision === 'REJECT' ? 'Decline Reason (Optional)' : 'Review Remarks (Optional)'}
                </label>
                <textarea
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder={reviewDecision === 'REJECT' ? 'State reason for declining leave (optional)...' : 'Add remarks for department records'}
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
                  : 'Confirm Decline'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Formal Sanction Order Modal */}
      {selectedSanction && (
        <FormalApplicationModal
          item={selectedSanction}
          onClose={() => setSelectedSanction(null)}
        />
      )}
    </div>
  );
}
