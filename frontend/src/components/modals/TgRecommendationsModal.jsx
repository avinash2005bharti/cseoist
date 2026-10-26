import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import {
  ShieldCheck,
  X,
  ExternalLink,
  Calendar,
  Clock,
  FileText,
  Eye,
  CheckCircle2,
  Users,
  Award,
  ChevronRight,
  Filter,
} from 'lucide-react';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number);
      return `${month}/${day}/${year}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
  } catch {
    return '—';
  }
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

export default function TgRecommendationsModal({
  considerations = [],
  leaves = [],
  onClose,
}) {
  const navigate = useNavigate();
  const { viewAttachment, openModal } = useERP();
  const [activeTab, setActiveTab] = useState('CONSIDERATIONS'); // 'CONSIDERATIONS' | 'LEAVES'

  const rejectedIds = getStoredRejectedIds();

  const isStillPending = (item) => {
    if (!item || !item._id) return false;
    if (rejectedIds.includes(item._id)) return false;
    const status = (item.status || '').toUpperCase();
    if (
      status === 'REJECTED' ||
      status === 'REJECTED_BY_HOD' ||
      status === 'REJECTED_BY_TG' ||
      status === 'APPROVED' ||
      status === 'APPROVED_BY_HOD'
    ) {
      return false;
    }
    if (item.hodReview?.decision === 'REJECT' || item.hodReview?.decision === 'APPROVE') {
      return false;
    }
    if (item.finalReview?.decision === 'REJECT' || item.finalReview?.decision === 'APPROVE') {
      return false;
    }
    return true;
  };

  const isTgRec = (item) => {
    if (!item) return false;
    const status = (item.status || '').toUpperCase();
    const decision = (item.tgReview?.decision || '').toUpperCase();
    if (decision === 'REJECT') return false;
    if (status === 'REJECTED' || status === 'REJECTED_BY_TG') return false;
    return status === 'RECOMMENDED_BY_TG' || decision === 'RECOMMEND';
  };

  const filteredConsiderations = (considerations || []).filter((item) => isStillPending(item) && isTgRec(item));
  const filteredLeaves = (leaves || []).filter((item) => isStillPending(item) && isTgRec(item));

  const handleReviewConsideration = (item) => {
    openModal('REVIEW_ACTION', {
      type: 'CONSIDERATION',
      role: 'HOD',
      item,
    });
  };

  const handleReviewLeave = (item) => {
    openModal('REVIEW_ACTION', {
      type: 'LEAVE',
      role: 'HOD',
      item,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container max-w-3xl w-[96%] bg-white p-5 sm:p-6 rounded-3xl text-slate-900 shadow-2xl border border-slate-100 flex flex-col max-h-[86vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200 shadow-2xs">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 m-0">
                  TG Recommendations
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  {filteredConsiderations.length + filteredLeaves.length} Total
                </span>
              </div>
              <p className="text-xs text-slate-500 m-0 mt-0.5 font-medium">
                Applications endorsed by Teacher Guardians awaiting HOD approval
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Category Switcher Tabs */}
        <div className="flex items-center gap-2 pt-3 pb-2 shrink-0 border-b border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab('CONSIDERATIONS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'CONSIDERATIONS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Award size={15} />
            <span>Consideration Recommendations</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                activeTab === 'CONSIDERATIONS'
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {filteredConsiderations.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('LEAVES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'LEAVES'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Clock size={15} />
            <span>Leave Recommendations</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                activeTab === 'LEAVES'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {filteredLeaves.length}
            </span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="my-3 overflow-y-auto space-y-3.5 pr-1 flex-1">
          {activeTab === 'CONSIDERATIONS' ? (
            filteredConsiderations.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Award size={34} className="mx-auto text-slate-300 mb-2" />
                <h4 className="text-sm font-bold text-slate-700 m-0">No Consideration Recommendations</h4>
                <p className="text-xs text-slate-400 mt-1 m-0">
                  All TG-recommended attendance considerations have been reviewed.
                </p>
              </div>
            ) : (
              filteredConsiderations.map((item) => {
                const studentName =
                  item.student?.user?.name ||
                  item.studentName ||
                  item.applicant?.name ||
                  'Student';
                const enrollment =
                  item.student?.enrollmentNumber ||
                  item.student?.rollNumber ||
                  item.enrollment ||
                  'N/A';
                const sectionName =
                  item.student?.section?.name ||
                  item.student?.section?.code ||
                  item.sectionName ||
                  '';
                const semester = item.student?.semester || item.student?.section?.semester || '';
                const category = item.eventType || item.categoryTag || item.eventTitle || 'Consideration';
                const reason = item.reason || item.description || '—';
                const fromDate = formatDate(item.startDate);
                const toDate = formatDate(item.endDate || item.startDate);
                const periods = item.requestedPeriods || item.periods || 1;
                const tgName = item.tg?.user?.name || item.tg?.name || 'Teacher Guardian';
                const tgRemarks = item.tgReview?.remarks || 'Recommended for HOD authorization.';

                const isGroup = item.isGroup || (item.groupMembers && item.groupMembers.length > 0);
                const memberCount = (item.groupMembers?.length || 0) + 1;

                const att =
                  item.attachments?.[0] ||
                  (item.documentFileId
                    ? { fileId: item.documentFileId, name: item.documentOriginalName }
                    : null);

                return (
                  <div
                    key={item._id}
                    className="p-4 sm:p-4.5 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-xs transition-all shadow-2xs flex flex-col gap-3 group"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading font-black text-sm text-slate-900">
                          {studentName}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {enrollment}
                        </span>
                        {(sectionName || semester) && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {semester ? `Sem ${semester}` : ''} {sectionName ? `Sec ${sectionName}` : ''}
                          </span>
                        )}
                        {isGroup && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <Users size={12} />
                            <span>Group ({memberCount})</span>
                          </span>
                        )}
                      </div>

                      <div className="shrink-0">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>{category}</span>
                        </span>
                      </div>
                    </div>

                    {/* Middle: Reason */}
                    <div className="text-xs text-slate-700 font-medium">
                      <span className="font-bold text-slate-900 mr-1.5">Reason:</span>
                      <span className="text-slate-600">{reason}</span>
                    </div>

                    {/* TG Endorsement Callout Box */}
                    <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <ShieldCheck size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                            <span>Recommended by TG:</span>
                            <span className="font-extrabold text-indigo-950">{tgName}</span>
                          </div>
                          <div className="text-xs text-indigo-800 mt-0.5 font-medium italic">
                            "{tgRemarks}"
                          </div>
                        </div>
                      </div>

                      {item.tgReview?.reviewedAt && (
                        <span className="text-[10px] text-indigo-500 font-medium whitespace-nowrap self-end sm:self-auto">
                          {formatDate(item.tgReview.reviewedAt)}
                        </span>
                      )}
                    </div>

                    {/* Attachment preview if present */}
                    {att && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => viewAttachment(att.fileId, att.name || 'Proof Document')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-blue-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer"
                        >
                          <FileText size={13} className="text-blue-600" />
                          <span className="truncate max-w-[240px]">{att.name || 'View Proof'}</span>
                          <Eye size={12} className="text-blue-600 ml-0.5" />
                        </button>
                      </div>
                    )}

                    {/* Footer Row: Dates/Periods & Review Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap">
                        <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                          <Calendar size={13} className="text-slate-400" />
                          <span>{fromDate} - {toDate}</span>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                          <Clock size={13} className="text-slate-400" />
                          <span>{periods} {Number(periods) === 1 ? 'Period' : 'Periods'}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isGroup && (
                          <button
                            type="button"
                            onClick={() =>
                              openModal('AUDIT_GROUP_STUDENTS', {
                                request: item,
                                userRole: 'HOD',
                              })
                            }
                            className="px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Users size={13} />
                            <span>Audit Members</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleReviewConsideration(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Review & Approve</span>
                          <ChevronRight size={14} className="text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            filteredLeaves.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Clock size={34} className="mx-auto text-slate-300 mb-2" />
                <h4 className="text-sm font-bold text-slate-700 m-0">No Leave Recommendations</h4>
                <p className="text-xs text-slate-400 mt-1 m-0">
                  All TG-recommended leave applications have been reviewed.
                </p>
              </div>
            ) : (
              filteredLeaves.map((item) => {
                const studentName =
                  item.student?.user?.name ||
                  item.studentName ||
                  item.applicant?.name ||
                  'Student';
                const enrollment =
                  item.student?.enrollmentNumber ||
                  item.student?.rollNumber ||
                  item.enrollment ||
                  'N/A';
                const sectionName =
                  item.student?.section?.name ||
                  item.student?.section?.code ||
                  item.sectionName ||
                  '';
                const semester = item.student?.semester || item.student?.section?.semester || '';
                const leaveType = item.leaveType || item.category || 'Leave';
                const reason = item.reason || item.description || '—';
                const fromDate = formatDate(item.startDate);
                const toDate = formatDate(item.endDate || item.startDate);
                const duration = item.durationDays || 1;
                const tgName = item.tg?.user?.name || item.tg?.name || 'Teacher Guardian';
                const tgRemarks = item.tgReview?.remarks || 'Recommended for HOD approval.';

                const att =
                  item.attachments?.[0] ||
                  (item.documentFileId
                    ? { fileId: item.documentFileId, name: item.documentOriginalName }
                    : null);

                return (
                  <div
                    key={item._id}
                    className="p-4 sm:p-4.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition-all shadow-2xs flex flex-col gap-3 group"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading font-black text-sm text-slate-900">
                          {studentName}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {enrollment}
                        </span>
                        {(sectionName || semester) && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {semester ? `Sem ${semester}` : ''} {sectionName ? `Sec ${sectionName}` : ''}
                          </span>
                        )}
                      </div>

                      <div className="shrink-0">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{leaveType}</span>
                        </span>
                      </div>
                    </div>

                    {/* Middle: Reason */}
                    <div className="text-xs text-slate-700 font-medium">
                      <span className="font-bold text-slate-900 mr-1.5">Reason:</span>
                      <span className="text-slate-600">{reason}</span>
                    </div>

                    {/* TG Endorsement Callout Box */}
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <ShieldCheck size={16} className="text-emerald-700 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                            <span>Recommended by TG:</span>
                            <span className="font-extrabold text-emerald-900">{tgName}</span>
                          </div>
                          <div className="text-xs text-emerald-800 mt-0.5 font-medium italic">
                            "{tgRemarks}"
                          </div>
                        </div>
                      </div>

                      {item.tgReview?.reviewedAt && (
                        <span className="text-[10px] text-emerald-600 font-medium whitespace-nowrap self-end sm:self-auto">
                          {formatDate(item.tgReview.reviewedAt)}
                        </span>
                      )}
                    </div>

                    {/* Attachment preview if present */}
                    {att && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => viewAttachment(att.fileId, att.name || 'Medical Document')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-emerald-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer"
                        >
                          <FileText size={13} className="text-emerald-600" />
                          <span className="truncate max-w-[240px]">{att.name || 'View Proof'}</span>
                          <Eye size={12} className="text-emerald-600 ml-0.5" />
                        </button>
                      </div>
                    )}

                    {/* Footer Row: Dates/Duration & Review Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap">
                        <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                          <Calendar size={13} className="text-slate-400" />
                          <span>{fromDate} - {toDate}</span>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                          <Clock size={13} className="text-slate-400" />
                          <span>{duration} {Number(duration) === 1 ? 'Day' : 'Days'}</span>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleReviewLeave(item)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <span>Review & Approve</span>
                        <ChevronRight size={14} className="text-white" />
                      </button>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/hod/considerations');
              }}
              className="text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Considerations Central</span>
              <ExternalLink size={12} />
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/hod/leaves');
              }}
              className="text-emerald-600 hover:text-emerald-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Leaves Central</span>
              <ExternalLink size={12} />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold shadow-2xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
