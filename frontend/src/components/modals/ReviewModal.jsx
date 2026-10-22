import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.jsx';
import { considerationApi, leaveApi } from '../../api';
import { X, CheckCircle2, AlertTriangle, AlertCircle, ShieldCheck, FileText, Eye, Users, UserCheck } from 'lucide-react';
import { Button, FormField, Input, Textarea } from '../common';

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
  const [approvedPeriods, setApprovedPeriods] = useState(item.requestedPeriods || 1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isReject = decision === 'REJECT';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isReject && (!remarks.trim() || remarks.trim().length < 5)) {
      setError('Please provide detailed rejection remarks (minimum 5 characters).');
      return;
    }

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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container max-w-md w-[95%]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              role === 'TG' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="modal-title">
                {role === 'TG' ? 'Tutor Guardian Review' : 'Head of Department Review'}
              </h3>
              <p className="modal-subtitle">
                {item.eventTitle || `${item.leaveType} Leave (${item.totalDays} days)`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 mt-2">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Supporting Attachment if present */}
          {(() => {
            const att = item.attachments?.[0] || (item.documentFileId ? { fileId: item.documentFileId, name: item.documentOriginalName } : null);
            if (!att) return null;
            return (
              <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 truncate">{att.name || 'Student_Certificate.pdf'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => viewAttachment(att.fileId, att.name || 'Document')}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0"
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

          {/* Decision Buttons */}
          <FormField label="Decision Action" required>
            <div className="grid grid-cols-2 gap-2.5">
              {role === 'TG' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDecision('RECOMMEND')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
                      decision === 'RECOMMEND'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                        : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                    }`}
                  >
                    <CheckCircle2 size={15} className={decision === 'RECOMMEND' ? 'text-white' : 'text-emerald-700'} />
                    <span>Recommend to HOD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('REJECT')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 ${
                      decision === 'REJECT'
                        ? 'bg-rose-700 text-white border-rose-700 shadow-sm'
                        : 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100'
                    }`}
                  >
                    <AlertTriangle size={15} className={decision === 'REJECT' ? 'text-white' : 'text-rose-700'} />
                    <span>Reject</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setDecision('APPROVE')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      decision === 'APPROVE'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 size={15} />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('REJECT')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      decision === 'REJECT'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <AlertTriangle size={15} />
                    <span>Reject</span>
                  </button>
                </>
              )}
            </div>
          </FormField>

          {/* Approved Lectures for HOD Consideration approval */}
          {type === 'CONSIDERATION' && role !== 'TG' && decision === 'APPROVE' && (
            <FormField label={`Lectures to Approve (Requested: ${item.requestedPeriods})`} required>
              <Input
                type="number"
                min="1"
                max={item.requestedPeriods}
                value={approvedPeriods}
                onChange={(e) => setApprovedPeriods(e.target.value)}
                required
              />
            </FormField>
          )}

          <FormField label={isReject ? 'Rejection Remarks (Mandatory, min 5 chars)' : 'Review Remarks (Optional)'} required={isReject}>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={isReject ? 'State reason for rejection...' : 'Optional notes or guidance for student...'}
              rows={3}
              required={isReject}
            />
          </FormField>

          <div className="modal-footer mt-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={isReject ? 'danger' : 'primary'}
              size="sm"
              loading={submitting}
            >
              {decision === 'RECOMMEND' ? 'Confirm Recommendation' : decision === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
