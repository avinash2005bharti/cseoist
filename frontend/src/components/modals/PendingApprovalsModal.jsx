import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import {
  AlertCircle,
  X,
  ExternalLink,
  ArrowRight,
  Calendar,
  Clock,
  FileText,
  ShieldAlert,
  Eye,
} from 'lucide-react';

function formatDateSlash(dateStr) {
  if (!dateStr) return '10/12/2026';
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
    return '10/12/2026';
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

export default function PendingApprovalsModal({
  pendingRequests = [],
  onClose,
  onGoToRequestsCentral,
}) {
  const navigate = useNavigate();
  const { viewAttachment } = useERP();

  const rejectedIds = getStoredRejectedIds();
  const itemsToDisplay = (pendingRequests || []).filter((item) => {
    if (!item || !item._id) return false;
    if (rejectedIds.includes(item._id)) return false;
    const status = (item.status || '').toUpperCase();
    if (
      status === 'REJECTED' ||
      status === 'REJECTED_BY_HOD' ||
      status === 'REJECTED_BY_TG' ||
      status === 'APPROVED' ||
      status === 'APPROVED_BY_HOD'
    ) return false;
    if (item.hodReview?.decision === 'REJECT' || item.hodReview?.decision === 'APPROVE') return false;
    if (item.finalReview?.decision === 'REJECT' || item.finalReview?.decision === 'APPROVE') return false;
    return true;
  });

  const handleReviewItem = (item) => {
    if (onClose) onClose();
    if (onGoToRequestsCentral) {
      onGoToRequestsCentral(item);
    } else {
      navigate('/hod/considerations', { state: { targetRequestId: item._id } });
    }
  };

  const handleGoCentral = () => {
    if (onClose) onClose();
    if (onGoToRequestsCentral) {
      onGoToRequestsCentral();
    } else {
      navigate('/hod/considerations');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container max-w-2xl w-[96%] bg-white p-6 sm:p-7 rounded-3xl text-slate-900 shadow-2xl border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Image 1 */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200 shadow-2xs">
              <AlertCircle size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 m-0">
                Pending Approvals Queue
              </h2>
              <p className="text-xs text-slate-500 m-0 mt-0.5 font-medium">
                {itemsToDisplay.length} requests requiring departmental action
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

        {/* Body Cards List matching Image 1 & Image 2 */}
        <div className="my-4 max-h-[60vh] overflow-y-auto space-y-3.5 pr-1">
          {itemsToDisplay.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <FileText size={32} className="mx-auto text-slate-300 mb-2" />
              <h4 className="text-sm font-bold text-slate-700 m-0">All Approvals Cleared</h4>
              <p className="text-xs text-slate-400 mt-1 m-0">
                No attendance considerations or leaves are currently pending HOD action.
              </p>
            </div>
          ) : (
            itemsToDisplay.map((item) => {
              const studentName =
                item.student?.user?.name ||
                item.studentName ||
                item.applicant?.name ||
                'Student';
              const enrollment =
                item.student?.enrollmentNumber ||
                item.enrollment ||
                item.student?.rollNumber ||
                'N/A';
              const category =
                item.categoryTag ||
                item.category ||
                item.eventTitle ||
                item.leaveType ||
                'Request';
              const reason =
                item.reason ||
                item.description ||
                '—';
              const fromDate = formatDateSlash(item.startDate);
              const toDate = formatDateSlash(item.endDate || item.startDate);

              return (
                <div
                  key={item._id}
                  className="p-4 sm:p-4.5 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-xs transition-all shadow-2xs flex flex-col justify-between gap-3 group"
                >
                  {/* Top Row: Name + Student Pill on Left, Category Pill on Right */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-black text-sm text-slate-900">
                        {studentName}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Student • {enrollment}
                      </span>
                    </div>

                    <div className="shrink-0">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>{category}</span>
                      </span>
                    </div>
                  </div>

                  {/* Middle Row: Reason */}
                  <div className="text-xs text-slate-700 font-medium">
                    <span className="font-bold text-slate-900 mr-1.5">Reason:</span>
                    <span className="text-slate-600">{reason}</span>
                  </div>

                  {/* Supporting Proof Link if present */}
                  {(() => {
                    const att = item.attachments?.[0] || (item.documentFileId ? { fileId: item.documentFileId, name: item.documentOriginalName } : null);
                    if (!att) return null;
                    return (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            viewAttachment(att.fileId, att.name || 'Document');
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-colors cursor-pointer"
                        >
                          <FileText size={13} className="text-blue-600" />
                          <span className="truncate max-w-[200px]">{att.name || 'View Proof'}</span>
                          <Eye size={12} className="text-blue-600 ml-0.5" />
                        </button>
                      </div>
                    );
                  })()}

                  {/* Bottom Row: Dates on Left, Action Button on Right */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                    <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                      <span className="font-bold text-slate-700">Dates:</span>
                      <span>
                        {fromDate} - {toDate}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleReviewItem(item)}
                      style={{ backgroundColor: '#1D4ED8', color: '#ffffff' }}
                      className="px-3.5 py-1.5 rounded-xl text-white text-xs font-bold hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <span>Review in Requests Central</span>
                      <ExternalLink size={13} className="text-white" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions matching Image 1 & Image 2 */}
        <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold shadow-2xs transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleGoCentral}
            style={{ backgroundColor: '#1D4ED8', color: '#ffffff' }}
            className="px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-bold hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>Go to Requests Central</span>
            <ArrowRight size={15} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
