import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import { considerationApi, leaveApi } from '../../api';
import {
  FileText,
  CalendarDays,
  CalendarRange,
  Clock3,
  Eye,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import FormalApplicationModal from '../../components/modals/FormalApplicationModal.jsx';

// Helper to format date cleanly like '24 Oct 2026'
function formatDisplayDate(startDate, endDate) {
  if (!startDate) return '—';
  try {
    const parse = (dStr) => {
      if (!dStr) return '';
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      const day = d.getDate();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };
    if (startDate === endDate || !endDate) {
      return parse(startDate);
    }
    return `${parse(startDate)} – ${parse(endDate)}`;
  } catch {
    return startDate;
  }
}

export default function StudentMyRequests() {
  const { openModal, currentUser } = useERP();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const urlStatus = searchParams.get('status');

  const resolveInitialTab = () => {
    if (urlTab === 'active' || urlTab === 'pending' || urlStatus === 'PENDING' || urlStatus === 'pending') {
      return 'active';
    }
    if (urlTab === 'completed' || urlStatus === 'APPROVED' || urlStatus === 'APPROVED_BY_HOD') {
      return 'completed';
    }
    return urlTab || 'all';
  };

  const [activeTab, setActiveTab] = useState(resolveInitialTab);
  const [requests, setRequests] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSanction, setSelectedSanction] = useState(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);

  useEffect(() => {
    if (urlTab === 'active' || urlTab === 'pending' || urlStatus === 'PENDING' || urlStatus === 'pending') {
      setActiveTab('active');
    } else if (urlTab === 'completed' || urlStatus === 'APPROVED' || urlStatus === 'APPROVED_BY_HOD') {
      setActiveTab('completed');
    } else if (urlTab === 'all') {
      setActiveTab('all');
    }
  }, [urlTab, urlStatus]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [conRes, leaveRes] = await Promise.allSettled([
        considerationApi.getMine(),
        leaveApi.getMine(),
      ]);

      const conList = conRes.status === 'fulfilled' ? conRes.value?.data || [] : [];
      const leaveList = leaveRes.status === 'fulfilled' ? leaveRes.value?.data || [] : [];

      setRequests(conList);
      setLeaves(leaveList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleRefresh = () => fetchData();
    window.addEventListener('campusflow_refresh_considerations', handleRefresh);
    window.addEventListener('campusflow_refresh_leaves', handleRefresh);
    return () => {
      window.removeEventListener('campusflow_refresh_considerations', handleRefresh);
      window.removeEventListener('campusflow_refresh_leaves', handleRefresh);
    };
  }, []);

  // Merge items with a type indicator and sort newest first
  const allItems = [
    ...requests.map((r) => ({ ...r, itemType: 'CONSIDERATION' })),
    ...leaves.map((l) => ({ ...l, itemType: 'LEAVE' })),
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const activeItems = allItems.filter(
    (i) => i.status === 'PENDING' || i.status === 'RECOMMENDED_BY_TG'
  );

  const completedItems = allItems.filter(
    (i) => i.status === 'APPROVED_BY_HOD' || i.status === 'APPROVED' || i.status === 'REJECTED' || i.status === 'CANCELLED'
  );

  const displayedItems =
    activeTab === 'active'
      ? activeItems
      : activeTab === 'completed'
      ? completedItems
      : allItems;

  const studentProfile = currentUser?.profile || {};
  const studentName = currentUser?.name || currentUser?.designation || 'Student';
  const enrollmentNo = studentProfile.enrollmentNumber || studentProfile.rollNumber || 'Not provided';

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RECOMMENDED_BY_TG':
        return (
          <span className="font-semibold rounded-full bg-primary/10 text-primary text-xs px-3 py-1 border border-primary/20 shrink-0">
            Recommended by TG
          </span>
        );
      case 'APPROVED_BY_HOD':
      case 'APPROVED':
        return (
          <span className="font-semibold rounded-full bg-emerald-50 text-emerald-700 text-xs px-3 py-1 border border-emerald-200 shrink-0">
            Approved
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="font-semibold rounded-full bg-muted text-muted-foreground text-xs px-3 py-1 border border-border shrink-0">
            Cancelled
          </span>
        );
      case 'REJECTED':
        return (
          <span className="font-semibold rounded-full bg-rose-50 text-rose-700 text-xs px-3 py-1 border border-rose-200 shrink-0">
            Rejected
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="font-semibold rounded-full bg-amber-50 text-amber-700 text-xs px-3 py-1 border border-amber-200 shrink-0">
            Pending
          </span>
        );
    }
  };

  const getSubStatusText = (status) => {
    switch (status) {
      case 'RECOMMENDED_BY_TG':
        return 'Awaiting HOD approval';
      case 'APPROVED_BY_HOD':
      case 'APPROVED':
      case 'CANCELLED':
      case 'REJECTED':
        return 'Processed';
      case 'PENDING':
      default:
        return 'Awaiting TG recommendation';
    }
  };

  return (
    <div className="flex mx-auto p-4 sm:p-8 flex-col gap-6 w-full max-w-6xl pb-24 font-sans">
      {/* =======================================================================
          1. PAGE HEADER: Title + Status Tracking Pill + Apply for Leave Button
          ======================================================================= */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-bold text-foreground text-2xl sm:text-3xl tracking-tight m-0">
              My Applications & Requests
            </h1>
            <span className="font-bold rounded-sm bg-primary/10 text-primary text-xs tracking-wide border border-primary/20 px-3 py-1">
              STATUS TRACKING
            </span>
          </div>
          <p className="text-muted-foreground text-sm m-0">
            Track your attendance consideration requests and student leave applications
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModal('APPLY_LEAVE')}
          className="shadow-sm rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-5 gap-2 h-11 flex items-center justify-center font-semibold text-sm transition-all cursor-pointer shrink-0"
        >
          <Plus className="size-4" />
          <span>Apply for Leave</span>
        </button>
      </section>

      {/* =======================================================================
          2. APPROVAL WORKFLOW STEPPER CARD (DESKTOP: Screen 17 / MOBILE: Screen 18)
          ======================================================================= */}
      {/* Desktop Stepper */}
      <section className="shadow-xs rounded-xl bg-card border border-border p-6 hidden md:block">
        <div className="flex mb-5 justify-between items-center">
          <span className="font-bold uppercase text-primary text-sm tracking-wide">
            Approval workflow
          </span>
          <span className="text-muted-foreground text-sm">
            Standard review timeline
          </span>
        </div>
        <div className="grid relative gap-4 grid-cols-3">
          <div className="bg-primary/30 absolute inset-x-1/6 top-1/2 h-0.5 -translate-y-1/2" />
          <div className="text-center rounded-lg bg-muted/50 border border-border flex relative z-10 p-4 flex-col items-center gap-2 shadow-2xs">
            <span className="font-bold rounded-full bg-primary text-primary-foreground text-xs flex justify-center items-center size-6">
              1
            </span>
            <span className="font-semibold text-foreground text-sm">
              Student Submits
            </span>
            <span className="text-muted-foreground text-xs">
              Online Request
            </span>
          </div>
          <div className="text-center rounded-lg bg-muted/50 border border-border flex relative z-10 p-4 flex-col items-center gap-2 shadow-2xs">
            <span className="font-bold rounded-full bg-primary text-primary-foreground text-xs flex justify-center items-center size-6">
              2
            </span>
            <span className="font-semibold text-foreground text-sm">
              Tutor Guardian (TG)
            </span>
            <span className="text-muted-foreground text-xs">
              Recommendation
            </span>
          </div>
          <div className="text-center rounded-lg bg-muted/50 border border-border flex relative z-10 p-4 flex-col items-center gap-2 shadow-2xs">
            <span className="font-bold rounded-full bg-primary text-primary-foreground text-xs flex justify-center items-center size-6">
              3
            </span>
            <span className="font-semibold text-foreground text-sm">
              Head of Department (HOD)
            </span>
            <span className="text-muted-foreground text-xs">
              Final Approval
            </span>
          </div>
        </div>
      </section>

      {/* Mobile Stepper (Screen 18) */}
      <section className="shadow-xs rounded-lg bg-card border border-border p-4 block md:hidden">
        <div className="flex mb-4 justify-between items-center gap-2">
          <h2 className="font-bold uppercase text-primary text-sm tracking-wide m-0">
            Approval workflow
          </h2>
        </div>
        <div className="flex relative flex-col gap-4">
          <div className="bg-primary/30 absolute inset-y-8 left-4 w-0.5" />
          <div className="flex relative items-center gap-3">
            <span className="font-bold rounded-full bg-primary text-primary-foreground text-sm flex z-10 justify-center items-center shrink-0 size-8">
              1
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm m-0">
                Student Submits
              </p>
              <p className="text-muted-foreground text-xs m-0">
                Online Request
              </p>
            </div>
          </div>
          <div className="flex relative items-center gap-3">
            <span className="font-bold rounded-full bg-primary text-primary-foreground text-sm flex z-10 justify-center items-center shrink-0 size-8">
              2
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm m-0">
                Tutor Guardian
              </p>
              <p className="text-muted-foreground text-xs m-0">
                Recommendation
              </p>
            </div>
          </div>
          <div className="flex relative items-center gap-3">
            <span className="font-bold rounded-full bg-primary text-primary-foreground text-sm flex z-10 justify-center items-center shrink-0 size-8">
              3
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm m-0">
                Head of Department
              </p>
              <p className="text-muted-foreground text-xs m-0">
                Final Approval
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =======================================================================
          3. TABS: ALL / ACTIVE / COMPLETED
          ======================================================================= */}
      <div className="w-full">
        {/* Desktop tabs (Screen 17) */}
        <div className="hidden sm:flex rounded-xl bg-card border border-border p-1.5 justify-start gap-1 w-full h-12 shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setSearchParams({});
            }}
            className={`font-semibold rounded-lg text-sm px-6 h-full transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            All ({allItems.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('active');
              setSearchParams({ tab: 'active' });
            }}
            className={`font-semibold rounded-lg text-sm px-6 h-full transition-all cursor-pointer ${
              activeTab === 'active'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            Active ({activeItems.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('completed');
              setSearchParams({ tab: 'completed' });
            }}
            className={`font-semibold rounded-lg text-sm px-6 h-full transition-all cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            Completed ({completedItems.length})
          </button>
        </div>

        {/* Mobile tabs (Screen 18) */}
        <div className="sm:hidden rounded-lg bg-muted grid p-1 gap-1 grid-cols-3 w-full border border-border">
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setSearchParams({});
            }}
            className={`text-xs px-2 min-h-11 font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({allItems.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('active');
              setSearchParams({ tab: 'active' });
            }}
            className={`text-xs px-2 min-h-11 font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'active'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Active ({activeItems.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('completed');
              setSearchParams({ tab: 'completed' });
            }}
            className={`text-xs px-2 min-h-11 font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Completed ({completedItems.length})
          </button>
        </div>
      </div>

      {/* =======================================================================
          4. APPLICATION CARDS LIST (Screen 17 & Screen 18 Design)
          ======================================================================= */}
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="p-12 text-center bg-card rounded-xl border border-border">
            <Clock className="size-8 mx-auto text-muted-foreground/60 animate-spin mb-3" />
            <p className="text-sm font-semibold text-muted-foreground m-0">
              Loading requests and applications...
            </p>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="p-12 text-center bg-card rounded-xl border border-border">
            <Clock className="size-8 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="text-sm font-bold text-foreground m-0">No Applications Found</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-0">
              No clearance requests recorded in this filter view.
            </p>
          </div>
        ) : (
          displayedItems.map((item) => {
            const isApproved =
              item.status === 'APPROVED_BY_HOD' || item.status === 'APPROVED';
            const isConsideration = item.itemType === 'CONSIDERATION';

            const title = isConsideration
              ? `Attendance Consideration: ${item.eventTitle}`
              : `Leave Application: ${item.leaveType ? item.leaveType.replace(/_/g, ' ') : 'Leave'}`;

            const periodOrDaysText = isConsideration
              ? (item.hodReview?.approvedPeriods
                  ? `Approved lectures: ${item.hodReview.approvedPeriods} lectures`
                  : `Requested lectures: ${item.requestedPeriods || 1} lectures`)
              : `${item.totalDays || 1} days leave`;

            const subStatus = getSubStatusText(item.status);

            return (
              <article
                key={item._id}
                className="shadow-xs rounded-xl bg-card border border-border p-4 sm:p-6 transition-all hover:border-border/80"
              >
                {/* Top Row: Icon + Title/Details + Status Badge */}
                <div className="flex justify-between items-start gap-4 sm:gap-6">
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                    <div className="rounded-lg bg-accent text-primary flex justify-center items-center shrink-0 size-10 sm:size-11">
                      <FileText className="size-5" />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <h2 className="font-bold text-foreground text-sm sm:text-base m-0 leading-snug">
                        {title}
                      </h2>
                      <p className="text-muted-foreground text-xs sm:text-sm m-0">
                        {studentName} · {enrollmentNo}
                      </p>
                      <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-1.5 m-0">
                        <CalendarDays className="size-3.5 sm:size-4 text-muted-foreground/70" />
                        <span>{formatDisplayDate(item.startDate, item.endDate)}</span>
                      </p>
                      {/* On mobile: sub-status shown directly under date as in Screen 18 */}
                      <p className="font-semibold text-muted-foreground text-xs block sm:hidden m-0 mt-0.5">
                        {subStatus}
                      </p>
                    </div>
                  </div>

                  {/* Right side status badge on desktop */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {getStatusBadge(item.status)}
                    <span className="font-medium text-muted-foreground text-xs sm:text-sm hidden sm:block">
                      {subStatus}
                    </span>
                  </div>
                </div>

                {/* Reason box (Screen 17 & Screen 18) */}
                <div className="rounded-lg bg-muted text-muted-foreground text-xs sm:text-sm mt-3 sm:mt-5 px-3 sm:px-4 py-2 sm:py-3">
                  Reason:{' '}
                  <span className="font-medium text-foreground">
                    {item.reason || item.description || 'Attendance consideration application'}
                  </span>
                </div>

                {/* Bottom Row: Requested lectures / days + Action Buttons */}
                <div className="border-t border-border flex flex-col sm:flex-row mt-3 sm:mt-5 pt-3 sm:pt-4 sm:justify-between sm:items-center gap-3">
                  <span className="font-medium text-primary text-xs sm:text-sm flex items-center gap-2">
                    <Clock3 className="size-4" />
                    <span>{periodOrDaysText}</span>
                  </span>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* View details button (opens ApplicationDetailModal) */}
                    <button
                      type="button"
                      onClick={() => setSelectedDetailItem(item)}
                      className="rounded-lg border border-border bg-card hover:bg-accent text-foreground text-xs sm:text-sm font-semibold px-4 py-2 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs w-full sm:w-auto min-h-10 sm:min-h-9"
                    >
                      <Eye className="size-4" />
                      <span>View details</span>
                    </button>

                    {/* View Order button: ONLY FOR APPROVED APPLICATIONS! Gives official printable letter */}
                    {isApproved && (
                      <button
                        type="button"
                        onClick={() => setSelectedSanction({
                          ...item,
                          student: item.student || {
                            name: studentName,
                            rollNumber: enrollmentNo,
                            user: { name: studentName },
                            enrollmentNumber: enrollmentNo,
                            section: studentProfile.section,
                            semester: studentProfile.semester,
                          },
                        })}
                        className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-semibold px-4 py-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs w-full sm:w-auto min-h-10 sm:min-h-9"
                        title="Print / View Official Sanction Order"
                      >
                        <FileText className="size-4" />
                        <span>View Order</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* =======================================================================
          5. APPLICATION DETAILS MODAL (When student clicks "View details")
          ======================================================================= */}
      {selectedDetailItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedDetailItem(null)}
        >
          <div
            className="relative w-full max-w-xl bg-card text-foreground rounded-2xl shadow-2xl border border-border overflow-hidden my-8 animate-in fade-in-0 zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-accent text-primary flex items-center justify-center size-9">
                  <FileText className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base m-0 leading-tight">
                    Application Details
                  </h3>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Ref #{selectedDetailItem._id?.slice(-8) || 'ID'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                className="size-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
              {/* Status Header Pill */}
              <div className="flex flex-col items-start gap-2 p-3.5 rounded-xl bg-muted/50 border border-border sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Current Status:</span>
                  {getStatusBadge(selectedDetailItem.status)}
                </div>
                <span className="text-xs font-semibold text-muted-foreground sm:text-right">
                  {getSubStatusText(selectedDetailItem.status)}
                </span>
              </div>

              {/* Title & Metadata */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  {selectedDetailItem.itemType === 'CONSIDERATION' ? 'Attendance Consideration' : 'Leave Application'}
                </span>
                <h4 className="font-bold text-lg text-foreground m-0">
                  {selectedDetailItem.eventTitle || (selectedDetailItem.leaveType ? `${selectedDetailItem.leaveType.replace(/_/g, ' ')} Leave` : 'Leave')}
                </h4>
                <p className="text-xs text-muted-foreground m-0">
                  Applicant: <span className="font-semibold text-foreground">{studentName}</span> ({enrollmentNo})
                </p>
              </div>

              {/* Grid Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block">
                    Duration / Dates
                  </span>
                  <span className="text-xs font-bold text-foreground mt-1 flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 text-primary" />
                    {formatDisplayDate(selectedDetailItem.startDate, selectedDetailItem.endDate)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block">
                    Requested Scope
                  </span>
                  <span className="text-xs font-bold text-foreground mt-1 flex items-center gap-1.5">
                    <Clock3 className="size-3.5 text-primary" />
                    {selectedDetailItem.itemType === 'CONSIDERATION'
                      ? `${selectedDetailItem.requestedPeriods || 1} Lectures`
                      : `${selectedDetailItem.totalDays || 1} Days`}
                  </span>
                </div>
              </div>

              {/* Reason / Statement */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-foreground">Reason / Justification:</span>
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground leading-relaxed">
                  {selectedDetailItem.reason || selectedDetailItem.description || 'No specific statement provided.'}
                </div>
              </div>

              {/* Review Timeline Details */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-foreground">Approval Review Trail:</span>
                <div className="flex flex-col gap-2">
                  {/* Step 1: TG */}
                  <div className="p-3 rounded-xl bg-muted/30 border border-border flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        TG
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground block">
                          Tutor Guardian Review
                        </span>
                        <span className="text-[11px] text-muted-foreground block mt-0.5">
                          {selectedDetailItem.tgReview?.remarks
                            ? `Remarks: "${selectedDetailItem.tgReview.remarks}"`
                            : selectedDetailItem.status === 'PENDING'
                            ? 'Awaiting TG verification'
                            : 'Recommended without extra remarks'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-primary">
                      {selectedDetailItem.status === 'PENDING' ? 'Pending' : 'Recommended'}
                    </span>
                  </div>

                  {/* Step 2: HOD */}
                  <div className="p-3 rounded-xl bg-muted/30 border border-border flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        HOD
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground block">
                          Head of Department Review
                        </span>
                        <span className="text-[11px] text-muted-foreground block mt-0.5">
                          {selectedDetailItem.hodReview?.remarks
                            ? `Remarks: "${selectedDetailItem.hodReview.remarks}"`
                            : (selectedDetailItem.status === 'APPROVED_BY_HOD' || selectedDetailItem.status === 'APPROVED')
                            ? 'Formally sanctioned and signed by HOD'
                            : 'Pending final department sign-off'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700">
                      {(selectedDetailItem.status === 'APPROVED_BY_HOD' || selectedDetailItem.status === 'APPROVED')
                        ? 'Approved'
                        : selectedDetailItem.status === 'REJECTED'
                        ? 'Rejected'
                        : 'Awaiting Sign-off'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
              <button
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
              {(selectedDetailItem.status === 'APPROVED_BY_HOD' || selectedDetailItem.status === 'APPROVED') && (
                <button
                  type="button"
                  onClick={() => {
                    const itemToSanction = selectedDetailItem;
                    setSelectedDetailItem(null);
                    setSelectedSanction({
                      ...itemToSanction,
                      student: itemToSanction.student || {
                        name: studentName,
                        rollNumber: enrollmentNo,
                        user: { name: studentName },
                        enrollmentNumber: enrollmentNo,
                        section: studentProfile.section,
                        semester: studentProfile.semester,
                      },
                    });
                  }}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <FileText className="size-3.5" />
                  <span>View & Print Sanction Order</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          6. FORMAL SANCTION ORDER MODAL (Official Printable Letter)
          ======================================================================= */}
      {selectedSanction && (
        <FormalApplicationModal
          item={selectedSanction}
          onClose={() => setSelectedSanction(null)}
        />
      )}
    </div>
  );
}
