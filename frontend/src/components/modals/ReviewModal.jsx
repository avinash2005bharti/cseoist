import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.jsx';
import { considerationApi, leaveApi } from '../../api';
import { X, CheckCircle2, AlertTriangle, AlertCircle, ShieldCheck, FileText, Eye, Users, UserCheck } from 'lucide-react';
import '../../pages/hod/Screen-21.screen.css';

export default function ReviewModal({
  type = 'CONSIDERATION', // 'CONSIDERATION' | 'LEAVE'
  role = 'TG',            // 'TG' | 'HOD' | 'ADMIN'
  item = {},
  onClose,
  onSuccess,
}) {
  const { addToast, viewAttachment, openModal } = useERP();

  const [decision, setDecision] = useState(role === 'TG' ? 'RECOMMEND' : 'APPROVE');
  const [remarks, setRemarks] = useState('');
  const [approvedPeriods, setApprovedPeriods] = useState(
    item.approvedPeriods || (Array.isArray(item.requestedPeriods) ? item.requestedPeriods.length : (item.requestedPeriods || 1))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isReject = decision === 'REJECT';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    setSubmitting(true);
    try {
      if (type === 'CONSIDERATION') {
        if (role === 'TG') {
          await considerationApi.tgReview(item._id, {
            decision,
            remarks: remarks.trim(),
          });
        } else {
          await considerationApi.hodReview(item._id, {
            decision,
            remarks: remarks.trim(),
            approvedPeriods: decision === 'APPROVE' ? Number(approvedPeriods) : undefined,
          });
        }
      } else {
        // LEAVE
        if (role === 'TG') {
          await leaveApi.tgReview(item._id, {
            decision,
            remarks: remarks.trim(),
          });
        } else {
          await leaveApi.finalReview(item._id, {
            decision,
            remarks: remarks.trim(),
          });
        }
      }

      const actionLabel = decision === 'RECOMMEND' ? 'recommended to HOD' : decision === 'APPROVE' ? 'approved' : 'rejected';
      addToast('Review Submitted', `Application successfully ${actionLabel}.`, 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit review decision.');
    } finally {
      setSubmitting(false);
    }
  };

  const studentName = item.student?.user?.name || item.student?.name || item.applicant?.name || 'Student';
  const rollNo = item.student?.rollNumber || item.applicant?.rollNumber || item.student?.enrollmentNumber || item.applicant?.enrollmentNumber || 'N/A';
  const justificationText = item.description || item.reason || 'Participated in an approved academic / department activity.';

  return (
    <div className="hod-drawer-backdrop" onClick={onClose}>
      <aside
        className="hod-review-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Review Application Drawer"
      >
        {/* Drawer Header (Screen 7 & 8) */}
        <div className="hod-drawer-header">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 m-0 leading-tight">
              Review {type === 'CONSIDERATION' ? 'Consideration' : 'Leave'} Application
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 m-0 truncate">
              {studentName} • Roll {rollNo}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="hod-drawer-body">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Student Justification (Screen 7 & 8 exact layout) */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              STUDENT JUSTIFICATION
            </div>
            <p className="text-xs sm:text-sm text-slate-800 font-normal mt-2 m-0 leading-relaxed">
              {justificationText}
            </p>
          </div>

          {/* Supporting Attachment if present */}
          {(() => {
            const att =
              (Array.isArray(item.attachments) && item.attachments[0]) ||
              item.attachment ||
              (item.documentFileId ? { fileId: item.documentFileId, name: item.documentOriginalName } : null) ||
              (item.attachmentUrl || item.proofUrl ? { fileId: item.attachmentUrl || item.proofUrl, url: item.attachmentUrl || item.proofUrl, name: 'Proof_Document' } : null);
            if (!att) {
              return (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-slate-500 text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-slate-400 shrink-0" />
                    <span>No student proof document attached</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Not Uploaded</span>
                </div>
              );
            }
            return (
              <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-blue-950 block truncate">{att.name || 'Student_Proof_Document'}</span>
                    <span className="text-[11px] font-medium text-blue-700 block mt-0.5">
                      {att.size ? `${(att.size / 1024).toFixed(0)} KB • ` : ''}Student Supporting Attachment
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
          })()}

          {/* Group Consideration Details */}
          {(() => {
            const isGroup = item.isGroup || (item.groupMembers && item.groupMembers.length > 0) || (item.sectionStudents && item.sectionStudents.length > 0);
            if (!isGroup) return null;

            const roster = role === 'TG' && item.sectionStudents?.length > 0
              ? item.sectionStudents
              : (item.groupMembers?.length > 0 ? item.groupMembers : [item.student]);

            const activeRoster = roster.filter((m) => {
              const mId = (m?._id || m)?.toString();
              return !(item.studentAudits || []).some(
                (a) => (a.student?._id || a.student)?.toString() === mId && a.status === 'EXCLUDED'
              );
            });

            return (
              <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                    <Users size={14} className="text-indigo-600 shrink-0" />
                    <span>
                      {role === 'TG' ? `Section Group Members (${activeRoster.length})` : `All Group Members (${activeRoster.length})`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openModal('AUDIT_GROUP_STUDENTS', { request: item, userRole: role })}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] shadow-2xs transition-colors cursor-pointer"
                      title="Audit and exclude/verify group members"
                    >
                      <UserCheck size={11} />
                      <span>Audit Students</span>
                    </button>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      Group
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-0.5 max-h-32 overflow-y-auto">
                  {activeRoster.map((m, i) => {
                    const name = m?.user?.name || m?.name || 'Student';
                    const roll = m?.enrollmentNumber || m?.rollNumber || '';
                    const sec = m?.section?.name || m?.section?.code || '';
                    const mId = (m?._id || m)?.toString();
                    return (
                      <span
                        key={mId || i}
                        className="px-2 py-1 rounded-lg border text-[11px] font-semibold shadow-2xs flex items-center gap-1 bg-white border-indigo-100 text-slate-700"
                      >
                        <span>{name} {roll ? `(${roll})` : ''} {sec ? `• ${sec}` : ''}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Decision Section (Screen 7 & 8 Options) */}
          <div>
            <div className="font-bold text-xs uppercase tracking-wider text-slate-600 mb-2.5">
              Review Decision
            </div>
            <div className="grid gap-2.5">
              {role === 'TG' ? (
                <>
                  <label
                    onClick={() => setDecision('RECOMMEND')}
                    className={`hod-decision-card ${decision === 'RECOMMEND' ? 'selected-approve' : ''}`}
                  >
                    <input
                      type="radio"
                      name="reviewDecision"
                      checked={decision === 'RECOMMEND'}
                      onChange={() => setDecision('RECOMMEND')}
                      className="size-4 accent-blue-600 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className={decision === 'RECOMMEND' ? 'text-blue-600' : 'text-slate-400'} />
                      <span className="font-bold text-sm text-slate-900">Recommend to HOD</span>
                    </div>
                  </label>

                  <label
                    onClick={() => setDecision('REJECT')}
                    className={`hod-decision-card ${decision === 'REJECT' ? 'selected-reject' : ''}`}
                  >
                    <input
                      type="radio"
                      name="reviewDecision"
                      checked={decision === 'REJECT'}
                      onChange={() => setDecision('REJECT')}
                      className="size-4 accent-slate-600 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className={decision === 'REJECT' ? 'text-slate-700' : 'text-slate-400'} />
                      <span className="font-bold text-sm text-slate-900">Reject</span>
                    </div>
                  </label>
                </>
              ) : (
                <>
                  <label
                    onClick={() => setDecision('APPROVE')}
                    className={`hod-decision-card ${decision === 'APPROVE' ? 'selected-approve' : ''}`}
                  >
                    <input
                      type="radio"
                      name="reviewDecision"
                      checked={decision === 'APPROVE'}
                      onChange={() => setDecision('APPROVE')}
                      className="size-4 accent-blue-600 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className={decision === 'APPROVE' ? 'text-blue-600' : 'text-slate-400'} />
                      <span className="font-bold text-sm text-slate-900">Approve Application</span>
                    </div>
                  </label>

                  <label
                    onClick={() => setDecision('REJECT')}
                    className={`hod-decision-card ${decision === 'REJECT' ? 'selected-reject' : ''}`}
                  >
                    <input
                      type="radio"
                      name="reviewDecision"
                      checked={decision === 'REJECT'}
                      onChange={() => setDecision('REJECT')}
                      className="size-4 accent-slate-600 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className={decision === 'REJECT' ? 'text-slate-700' : 'text-slate-400'} />
                      <span className="font-bold text-sm text-slate-900">Reject Application</span>
                    </div>
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Sanctioned Lectures Stepper for HOD Consideration approval */}
          {type === 'CONSIDERATION' && role !== 'TG' && decision === 'APPROVE' && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <span className="block text-xs font-bold text-slate-900 leading-tight">
                  Sanctioned Lectures
                </span>
                <span className="block text-[11px] font-medium text-slate-500 mt-0.5">
                  Requested: {Array.isArray(item.requestedPeriods) ? item.requestedPeriods.length : (item.requestedPeriods || 1)} periods
                </span>
              </div>

              <div className="hod-stepper-control">
                <button
                  type="button"
                  onClick={() => setApprovedPeriods((p) => Math.max(1, Number(p) - 1))}
                  className="hod-stepper-btn"
                  aria-label="Decrease"
                >
                  –
                </button>
                <span className="hod-stepper-count">
                  {approvedPeriods}
                </span>
                <button
                  type="button"
                  onClick={() => setApprovedPeriods((p) => Math.min(Array.isArray(item.requestedPeriods) ? item.requestedPeriods.length : (item.requestedPeriods || 8), Number(p) + 1))}
                  className="hod-stepper-btn"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Remarks Section */}
          <div>
            <label className="font-bold text-xs uppercase tracking-wider text-slate-600 block mb-2">
              {isReject ? 'Rejection Remarks (Optional)' : 'Review Remarks (Optional)'}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={isReject ? 'State reason for rejection (optional)...' : 'Add remarks for the student or HOD records'}
              className="hod-drawer-textarea"
              required={false}
            />
          </div>

          {/* Drawer Footer (Sticky bottom) */}
          <div className="hod-drawer-footer mt-auto pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="hod-btn-reject"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="hod-btn-approve"
            >
              {submitting
                ? 'Submitting...'
                : decision === 'RECOMMEND'
                ? 'Confirm Recommendation'
                : decision === 'APPROVE'
                ? 'Confirm Approval'
                : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
