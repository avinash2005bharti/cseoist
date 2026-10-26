import React, { useEffect, useState } from 'react';
import { useERP } from '../../context/ERPContext.jsx';
import { considerationApi, leaveApi } from '../../api';
import {
  Eye,
  SquareCheck,
  X,
  FileText,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import WorkflowTimeline from '../../components/WorkflowTimeline.jsx';
import './Screen-7.screen.css';

export default function TgRequests() {
  const { addToast, viewAttachment, openModal } = useERP();

  // Primary Category Tab: 'attendance' | 'leave'
  const [activeCategory, setActiveCategory] = useState('attendance');

  // Status Filter Tab: 'pending' | 'recommended' | 'rejected' | 'all'
  const [statusFilter, setStatusFilter] = useState('pending');

  // Data states
  const [considerations, setConsiderations] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pending counts for badges
  const [pendingConsCount, setPendingConsCount] = useState(0);
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0);

  // Review drawer state
  const [reviewingItem, setReviewingItem] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('recommend'); // 'recommend' | 'reject'
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  // Details drawer/modal state
  const [selectedDetailsItem, setSelectedDetailsItem] = useState(null);

  const fetchPendingCounts = async () => {
    try {
      const [consRes, leavesRes] = await Promise.allSettled([
        considerationApi.getTGQueue({ status: 'PENDING' }),
        leaveApi.getTGQueue({ status: 'PENDING' }),
      ]);
      if (consRes.status === 'fulfilled') {
        const val = consRes.value?.data || consRes.value?.requests || consRes.value || [];
        setPendingConsCount(Array.isArray(val) ? val.length : 0);
      }
      if (leavesRes.status === 'fulfilled') {
        const val = leavesRes.value?.data || leavesRes.value?.leaves || leavesRes.value || [];
        setPendingLeavesCount(Array.isArray(val) ? val.length : 0);
      }
    } catch (e) {
      console.error('Error fetching pending counts:', e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let apiStatus = '';
      if (statusFilter === 'pending') apiStatus = 'PENDING';
      else if (statusFilter === 'recommended') apiStatus = 'RECOMMENDED_BY_TG';
      else if (statusFilter === 'rejected') apiStatus = 'REJECTED';
      else if (statusFilter === 'all') apiStatus = 'ALL';

      const params = apiStatus === 'ALL'
        ? { status: 'ALL', all: 'true' }
        : (apiStatus ? { status: apiStatus } : {});

      if (activeCategory === 'attendance') {
        const res = await considerationApi.getTGQueue(params);
        const data = res?.data || [];
        setConsiderations(Array.isArray(data) ? data : []);
        if (statusFilter === 'pending') {
          setPendingConsCount(data.length);
        }
      } else {
        const res = await leaveApi.getTGQueue(params);
        const data = res?.data || [];
        setLeaves(Array.isArray(data) ? data : []);
        if (statusFilter === 'pending') {
          setPendingLeavesCount(data.length);
        }
      }
    } catch (err) {
      console.error('Error fetching TG review queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchPendingCounts();

    const handleQueueChange = () => {
      fetchData();
      fetchPendingCounts();
    };
    window.addEventListener('campusflow_queue_changed', handleQueueChange);
    return () => {
      window.removeEventListener('campusflow_queue_changed', handleQueueChange);
    };
  }, [activeCategory, statusFilter]);

  const handleOpenReview = (item) => {
    setReviewingItem(item);
    setReviewDecision('recommend');
    setReviewRemarks('');
    setReviewError(null);
  };

  const handleConfirmReview = async () => {
    if (!reviewingItem) return;
    setReviewError(null);

    const isReject = reviewDecision === 'reject';

    setSubmitting(true);
    try {
      const decisionPayload = isReject ? 'REJECT' : 'RECOMMEND';

      if (activeCategory === 'attendance') {
        await considerationApi.tgReview(reviewingItem._id, {
          decision: decisionPayload,
          remarks: reviewRemarks.trim(),
        });
      } else {
        await leaveApi.tgReview(reviewingItem._id, {
          decision: decisionPayload,
          remarks: reviewRemarks.trim(),
        });
      }

      addToast(
        'Review Submitted',
        `Application successfully ${isReject ? 'rejected' : 'recommended to HOD'}.`,
        'success'
      );
      setReviewingItem(null);
      setReviewRemarks('');
      setReviewDecision('recommend');
      fetchData();
      fetchPendingCounts();
    } catch (err) {
      setReviewError(err?.response?.data?.message || err?.message || 'Failed to submit review decision.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentList = activeCategory === 'attendance' ? considerations : leaves;

  return (
    <div data-appearance="light" className="w-full">
      {/* Page Title & Subtitle (Screen 7 & Screen 8) */}
      <div className="mb-8">
        <h1 className="font-bold text-2xl sm:text-3xl tracking-tight text-foreground">
          Review Applications
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
          Review and recommend attendance consideration and leave applications for your assigned students.
        </p>
      </div>

      {/* Primary Category Tabs: Attendance Consideration vs Leave Applications */}
      <div className="mb-6">
        <div className="flex bg-transparent p-0 gap-2 flex-wrap items-center">
          <button
            type="button"
            onClick={() => {
              setActiveCategory('attendance');
              setSelectedDetailsItem(null);
            }}
            className={`rounded-md border px-4 gap-2 h-11 inline-flex items-center text-sm font-medium transition-colors cursor-pointer ${
              activeCategory === 'attendance'
                ? 'bg-primary text-primary-foreground border-primary sm:bg-card sm:text-foreground sm:border-border sm:shadow-xs'
                : 'bg-card text-foreground border-border sm:bg-transparent sm:text-muted-foreground sm:border-transparent sm:hover:text-foreground'
            }`}
          >
            <span>Attendance Consideration</span>
            {pendingConsCount > 0 && (
              <span
                className={`font-semibold rounded-full text-xs inline-flex px-1.5 py-0.5 justify-center items-center min-w-5 ${
                  activeCategory === 'attendance'
                    ? 'bg-primary-foreground text-primary sm:bg-muted sm:text-muted-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {pendingConsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('leave');
              setSelectedDetailsItem(null);
            }}
            className={`rounded-md border px-4 gap-2 h-11 inline-flex items-center text-sm font-medium transition-colors cursor-pointer ${
              activeCategory === 'leave'
                ? 'bg-primary text-primary-foreground border-primary sm:bg-card sm:text-foreground sm:border-border sm:shadow-xs'
                : 'bg-card text-foreground border-border sm:bg-transparent sm:text-muted-foreground sm:border-transparent sm:hover:text-foreground'
            }`}
          >
            <span>Leave Applications</span>
            {pendingLeavesCount > 0 && (
              <span
                className={`font-semibold rounded-full text-xs inline-flex px-1.5 py-0.5 justify-center items-center min-w-5 ${
                  activeCategory === 'leave'
                    ? 'bg-primary-foreground text-primary sm:bg-muted sm:text-muted-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {pendingLeavesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Secondary Status Filters: Pending Review, Recommended by TG, Rejected, All Applications */}
      <div className="flex mb-6 p-0 flex-wrap gap-2 w-fit">
        {[
          { id: 'pending', label: 'Pending Review' },
          { id: 'recommended', label: 'Recommended by TG' },
          { id: 'rejected', label: 'Rejected' },
          { id: 'all', label: 'All Applications' },
        ].map((tab) => {
          const isSelected = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatusFilter(tab.id);
                setSelectedDetailsItem(null);
              }}
              className={`rounded-md border px-4 h-10 inline-flex items-center text-sm font-medium transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary sm:bg-card sm:text-foreground sm:border-border sm:shadow-xs'
                  : 'bg-card text-foreground border-border sm:bg-transparent sm:text-muted-foreground sm:border-transparent sm:hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Application Cards List (Screen 7 & Screen 8 layout) */}
      <div className="space-y-4 max-w-4xl">
        {loading ? (
          <div className="p-12 text-center bg-card rounded-xl border border-border shadow-xs">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground text-sm font-medium">Loading applications...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="shadow-sm rounded-xl border border-border bg-card p-12 text-center">
            <p className="font-semibold text-card-foreground text-base">
              {statusFilter === 'pending'
                ? 'No Pending Applications'
                : statusFilter === 'recommended'
                ? 'No Recommended Applications'
                : statusFilter === 'rejected'
                ? 'No Rejected Applications'
                : 'No Applications Found'}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {statusFilter === 'pending'
                ? 'All applications for your assigned students have been reviewed.'
                : 'There are no applications matching the current filter.'}
            </p>
          </div>
        ) : (
          currentList.map((item) => {
            const studentName = item.student?.user?.name || item.student?.name || 'Student';
            const rollNumber = item.student?.rollNumber || item.student?.enrollmentNumber || '-';
            const sectionName = item.student?.section?.code || item.student?.section?.name || 'CSE-B';
            const isAttendance = activeCategory === 'attendance';
            const eventTitle = isAttendance ? (item.eventTitle || 'Academic Event') : (item.leaveType || 'Leave Application');
            const dateDisplay = isAttendance
              ? (item.startDate || '25 Oct 2026')
              : (`${item.startDate || ''} to ${item.endDate || ''}`);
            const quantity = isAttendance
              ? `${item.requestedPeriods || 1} Lectures`
              : `${item.totalDays || 1} Days`;
            const justification = item.description || item.reason || 'Participated in an approved department activity.';

            let badgeLabel = 'Pending Review';
            let badgeStyle = 'bg-secondary text-secondary-foreground';
            if (item.status === 'RECOMMENDED_BY_TG') {
              badgeLabel = 'Recommended by TG';
              badgeStyle = 'bg-amber-100 text-amber-800';
            } else if (item.status === 'APPROVED_BY_HOD' || item.status === 'APPROVED') {
              badgeLabel = 'Approved';
              badgeStyle = 'bg-emerald-100 text-emerald-800';
            } else if (item.status === 'REJECTED') {
              badgeLabel = 'Rejected';
              badgeStyle = 'bg-rose-100 text-rose-800';
            }

            return (
              <div
                key={item._id}
                className="shadow-sm rounded-xl border border-border bg-card p-4 sm:p-6 transition-all hover:border-border/80"
              >
                {/* Header: Student Name, Roll & Section, Status Badge */}
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-lg text-card-foreground truncate">
                      {studentName}
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                      Roll: {rollNumber} · {sectionName}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 ${badgeStyle}`}>
                    {badgeLabel}
                  </span>
                </div>

                {/* Group consideration pill */}
                {Boolean(item.isGroup && item.sectionStudents && item.sectionStudents.length > 0) && (
                  <div className="mt-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Group Application ({item.sectionStudents.length} students from Section)
                    </span>
                  </div>
                )}

                {/* 2-Column Details Grid */}
                <div className="grid mt-6 gap-3 sm:gap-4 grid-cols-2">
                  <div className="rounded-lg bg-muted/50 border border-border/60 p-3 sm:p-4">
                    <div className="font-semibold uppercase text-muted-foreground text-xs tracking-wider">
                      {isAttendance ? 'Event' : 'Category'}
                    </div>
                    <div className="font-semibold text-card-foreground text-sm sm:text-base mt-1 sm:mt-2 truncate">
                      {eventTitle}
                    </div>
                    <div className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">
                      {dateDisplay}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 border border-border/60 p-3 sm:p-4">
                    <div className="font-semibold uppercase text-muted-foreground text-xs tracking-wider">
                      {isAttendance ? 'Lectures' : 'Duration'}
                    </div>
                    <div className="font-semibold text-card-foreground text-sm sm:text-base mt-1 sm:mt-2">
                      {quantity}
                    </div>
                  </div>
                </div>

                {/* Student Justification (Screen 7) */}
                <div className="rounded-lg border border-border/70 mt-6 p-3 sm:p-4">
                  <div className="font-semibold uppercase text-muted-foreground text-xs tracking-wider">
                    Justification
                  </div>
                  <p className="text-card-foreground text-sm mt-1 sm:mt-2">
                    {justification}
                  </p>
                </div>

                {/* Card Actions Footer: Details and Review buttons */}
                <div className="border-t border-border/60 flex mt-6 pt-4 flex-wrap sm:justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDetailsItem(item)}
                    className="flex-1 sm:flex-initial rounded-lg border border-border bg-card hover:bg-accent text-card-foreground text-sm font-medium px-4 py-2 inline-flex items-center justify-center gap-2 cursor-pointer transition-colors min-h-11 sm:min-h-10"
                  >
                    <Eye className="size-4" />
                    <span>Details</span>
                  </button>

                  {item.isGroup && (
                    <button
                      type="button"
                      onClick={() => openModal('AUDIT_GROUP_STUDENTS', { request: item, userRole: 'TG' })}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold px-3 py-2 inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors min-h-11 sm:min-h-10"
                      title="Audit Students"
                    >
                      <UserCheck className="size-4" />
                      <span>Audit</span>
                    </button>
                  )}

                  {item.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => handleOpenReview(item)}
                      className="review-action-btn flex-1 sm:flex-initial rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium px-4 py-2 inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors min-h-11 sm:min-h-10"
                    >
                      <SquareCheck className="size-4" />
                      <span>Review</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* =====================================================================
          DESKTOP REVIEW SIDE DRAWER (Exact Screen 7 layout: aside slide-over)
          ===================================================================== */}
      {reviewingItem && (
        <div
          className="tg-details-drawer-overlay hidden md:flex fixed inset-0 bg-black/40 backdrop-blur-xs justify-end animate-in fade-in-0 duration-200"
          style={{ zIndex: 9999 }}
        >
          <aside
            className="tg-details-drawer shadow-2xl bg-card border-l border-border flex flex-col size-full max-w-xl slide-in-right"
            style={{ zIndex: 10000 }}
          >
            <div className="border-b border-border flex px-6 py-4 sm:px-8 sm:py-5 justify-between items-start shrink-0">
              <div>
                <h2 className="font-semibold text-xl text-card-foreground">
                  Review {activeCategory === 'attendance' ? 'Consideration' : 'Leave'} Application
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {reviewingItem.student?.user?.name || reviewingItem.student?.name} · Roll {reviewingItem.student?.rollNumber || reviewingItem.student?.enrollmentNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingItem(null)}
                className="rounded-md text-muted-foreground flex justify-center items-center size-9 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                aria-label="Close Review"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="px-6 py-5 sm:px-8 sm:py-5 flex-1 overflow-y-auto space-y-5">
              {reviewError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {reviewError}
                </div>
              )}

              <div className="rounded-lg bg-muted/50 border border-border p-4">
                <div className="font-semibold uppercase text-muted-foreground text-xs tracking-wider">
                  Student Justification
                </div>
                <p className="text-sm mt-2 text-card-foreground">
                  {reviewingItem.description || reviewingItem.reason || 'Participated in an approved department activity.'}
                </p>
              </div>

              <div>
                <div className="font-semibold text-sm mb-3 text-card-foreground">
                  Review Decision
                </div>
                <div className="grid gap-3">
                  <label
                    onClick={() => setReviewDecision('recommend')}
                    className={`cursor-pointer rounded-lg border p-4 flex items-center gap-3 transition-colors ${
                      reviewDecision === 'recommend'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reviewDecisionDesktop"
                      checked={reviewDecision === 'recommend'}
                      onChange={() => setReviewDecision('recommend')}
                      className="accent-primary size-4"
                    />
                    <span className="font-medium text-sm text-card-foreground">
                      Recommend to HOD
                    </span>
                  </label>

                  <label
                    onClick={() => setReviewDecision('reject')}
                    className={`cursor-pointer rounded-lg border p-4 flex items-center gap-3 transition-colors ${
                      reviewDecision === 'reject'
                        ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-500'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reviewDecisionDesktop"
                      checked={reviewDecision === 'reject'}
                      onChange={() => setReviewDecision('reject')}
                      className="accent-primary size-4"
                    />
                    <span className="font-medium text-sm text-card-foreground">
                      Reject
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="font-semibold text-sm text-card-foreground block mb-2">
                  Review Remarks (Optional)
                </label>
                <textarea
                  placeholder="Add remarks for the student or HOD"
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  className="w-full resize-none p-3 rounded-lg border border-input min-h-32 bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="border-t border-border flex px-6 py-4 sm:px-8 sm:py-5 justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setReviewingItem(null)}
                className="rounded-lg border border-border bg-card text-card-foreground px-4 py-2 text-sm font-medium hover:bg-accent cursor-pointer min-h-10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReview}
                disabled={submitting}
                className="rounded-lg bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:bg-primary/90 cursor-pointer min-h-10 shadow-xs disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? 'Submitting...'
                  : reviewDecision === 'recommend'
                  ? 'Confirm Recommendation'
                  : 'Confirm Rejection'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* =====================================================================
          MOBILE REVIEW BOTTOM SHEET (Exact Screen 8 layout: bottom sheet)
          ===================================================================== */}
      {reviewingItem && (
        <div
          className="tg-details-drawer-overlay md:hidden fixed inset-0 flex flex-col justify-end"
          style={{ zIndex: 9999 }}
        >
          <div
            className="bg-foreground/40 fixed inset-0 backdrop-blur-xs"
            onClick={() => setReviewingItem(null)}
          />
          <section
            className="tg-details-drawer shadow-2xl rounded-t-2xl bg-popover text-popover-foreground border-t border-x border-border flex relative inset-x-0 bottom-0 mx-auto p-5 pb-6 flex-col gap-4 w-full max-w-md max-h-[92vh] overflow-y-auto slide-in-bottom"
            style={{ zIndex: 10000 }}
          >
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="font-bold text-lg text-card-foreground">
                  Review {activeCategory === 'attendance' ? 'Consideration' : 'Leave'} Application
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {reviewingItem.student?.user?.name || reviewingItem.student?.name} • {reviewingItem.student?.rollNumber || reviewingItem.student?.enrollmentNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingItem(null)}
                className="rounded-lg bg-popover text-popover-foreground border border-border p-2 min-w-11 min-h-11 flex items-center justify-center hover:bg-accent cursor-pointer"
                aria-label="Close Review"
              >
                <X className="size-5" />
              </button>
            </div>

            {reviewError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {reviewError}
              </div>
            )}

            <div className="rounded-lg bg-muted flex p-3 flex-col gap-2">
              <span className="font-semibold uppercase text-muted-foreground text-xs tracking-wider">
                Student Justification
              </span>
              <p className="text-muted-foreground text-sm m-0">
                {reviewingItem.description || reviewingItem.reason || 'testing'}
              </p>
            </div>

            <div className="grid gap-3 grid-cols-2">
              <button
                type="button"
                onClick={() => setReviewDecision('recommend')}
                className={`rounded-lg min-h-11 text-sm font-semibold transition-colors cursor-pointer border ${
                  reviewDecision === 'recommend'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border hover:bg-accent'
                }`}
              >
                Recommend to HOD
              </button>
              <button
                type="button"
                onClick={() => setReviewDecision('reject')}
                className={`rounded-lg min-h-11 text-sm font-semibold transition-colors cursor-pointer border ${
                  reviewDecision === 'reject'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border hover:bg-accent'
                }`}
              >
                Reject
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="remarksMobile" className="font-semibold text-sm text-card-foreground">
                Review Remarks (Optional)
              </label>
              <textarea
                id="remarksMobile"
                placeholder="Review Remarks (Optional)"
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                className="resize-none rounded-lg border border-input p-3 min-h-24 bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid gap-3 grid-cols-2">
              <button
                type="button"
                onClick={() => setReviewingItem(null)}
                className="rounded-lg bg-popover text-popover-foreground border border-border min-h-11 text-sm font-medium hover:bg-accent cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReview}
                disabled={submitting}
                className="rounded-lg bg-primary text-primary-foreground min-h-11 text-sm font-semibold hover:bg-primary/90 cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? 'Submitting...'
                  : reviewDecision === 'recommend'
                  ? 'Confirm Recommendation'
                  : 'Confirm Rejection'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          DETAILS DRAWER (When clicking 'Details' button)
          ===================================================================== */}
      {selectedDetailsItem && (
        <div
          className="tg-details-drawer-overlay fixed inset-0 bg-background/50 backdrop-blur-xs flex justify-end animate-in fade-in-0 duration-200"
          style={{ zIndex: 9999 }}
        >
          <div
            className="fixed inset-0 bg-transparent"
            onClick={() => setSelectedDetailsItem(null)}
          />
          <aside
            className="tg-details-drawer shadow-2xl bg-card border-l border-border flex flex-col size-full max-w-xl relative slide-in-right"
            style={{ zIndex: 10000 }}
          >
            <div className="border-b border-border flex px-6 py-5 justify-between items-center">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Application Details
                </span>
                <h3 className="text-lg font-bold text-card-foreground mt-0.5">
                  {selectedDetailsItem.eventTitle || `${selectedDetailsItem.leaveType} Leave`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailsItem(null)}
                className="rounded-md text-muted-foreground flex justify-center items-center size-9 hover:bg-accent hover:text-accent-foreground cursor-pointer"
                aria-label="Close Details"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-muted/50 border border-border">
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block uppercase">Student</span>
                  <span className="font-bold text-card-foreground block mt-0.5">
                    {selectedDetailsItem.student?.user?.name || selectedDetailsItem.student?.name}
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    Roll: {selectedDetailsItem.student?.rollNumber || selectedDetailsItem.student?.enrollmentNumber || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block uppercase">Status</span>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-secondary text-secondary-foreground">
                    {selectedDetailsItem.status}
                  </span>
                </div>
              </div>

              {Boolean(selectedDetailsItem.isGroup && selectedDetailsItem.sectionStudents?.length > 0) && (
                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900 uppercase">
                      Section Members ({selectedDetailsItem.sectionStudents.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => openModal('AUDIT_GROUP_STUDENTS', { request: selectedDetailsItem, userRole: 'TG' })}
                      className="px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-2xs"
                    >
                      Audit Members
                    </button>
                  </div>
                  <div className="divide-y divide-indigo-100 max-h-36 overflow-y-auto">
                    {selectedDetailsItem.sectionStudents.map((st, i) => (
                      <div key={i} className="py-1.5 flex justify-between text-xs">
                        <span className="font-semibold text-slate-800">{st.user?.name || st.name || 'Student'}</span>
                        <span className="text-slate-500 font-mono">{st.enrollmentNumber || st.rollNumber}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="text-xs uppercase font-bold text-muted-foreground block mb-1">
                  Justification / Remarks
                </span>
                <p className="p-3.5 rounded-xl bg-muted/40 border border-border text-card-foreground leading-relaxed">
                  {selectedDetailsItem.description || selectedDetailsItem.reason || 'No specific justification was provided.'}
                </p>
              </div>

              {selectedDetailsItem.attachments && selectedDetailsItem.attachments.length > 0 && (
                <div>
                  <span className="text-xs uppercase font-bold text-muted-foreground block mb-1.5">
                    Attached Verification Documents
                  </span>
                  <div className="space-y-2">
                    {selectedDetailsItem.attachments.map((att, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => viewAttachment(att.fileId, att.name)}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border hover:bg-accent text-card-foreground text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="size-4 text-primary shrink-0" />
                          <span className="truncate">{att.name}</span>
                        </div>
                        <Eye className="size-4 text-primary shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Workflow timeline */}
              <div>
                <span className="text-xs uppercase font-bold text-muted-foreground block mb-2">
                  Workflow Progression
                </span>
                <WorkflowTimeline
                  history={selectedDetailsItem.history}
                  currentStatus={selectedDetailsItem.status}
                />
              </div>
            </div>

            <div className="border-t border-border p-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedDetailsItem(null)}
                className="px-4 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm font-medium hover:bg-accent cursor-pointer min-h-10"
              >
                Close
              </button>
              {selectedDetailsItem.status === 'PENDING' && (
                <button
                  type="button"
                  onClick={() => {
                    const itm = selectedDetailsItem;
                    setSelectedDetailsItem(null);
                    handleOpenReview(itm);
                  }}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 cursor-pointer min-h-10 shadow-xs"
                >
                  Conduct TG Review
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
