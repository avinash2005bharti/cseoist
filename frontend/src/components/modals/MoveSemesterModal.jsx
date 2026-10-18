import React, { useState } from 'react';
import { Layers, ArrowRight, ArrowLeft, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useERP } from '../../context/ERPContext.jsx';
import { masterDataApi } from '../../api';

export default function MoveSemesterModal({
  section,
  direction = 'next',
  onClose,
  onSuccess,
}) {
  const { addToast } = useERP();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!section) return null;

  const currentSem = Number(section.semester) || 5;
  const isPromote = direction === 'next' || direction === 'forward';
  const newSemester = isPromote ? currentSem + 1 : currentSem - 1;
  const currentYear = section.year || Math.ceil(currentSem / 2);
  const newYear = Math.ceil(newSemester / 2);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await masterDataApi.moveSectionSemester(section._id, isPromote ? 'next' : 'prev');
      addToast(
        isPromote ? 'Section Promoted' : 'Section Demoted',
        res?.data?.message || `Section ${section.code || section.name} moved to Semester ${newSemester} successfully.`,
        'success'
      );
      if (onSuccess) onSuccess(res?.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update section semester.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                isPromote
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-amber-100 text-amber-700 border border-amber-200'
              }`}
            >
              <Layers size={22} />
            </div>
            <div>
              <h3 className="font-heading font-black text-base text-slate-900 leading-tight">
                {isPromote ? 'Promote Section to Next Semester' : 'Demote Section to Previous Semester'}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {section.name || `Section ${section.code}`} ({section.code})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Transition Details Box */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
          <div className="flex items-center justify-between font-bold">
            <span className="text-slate-500">Current Academic Standing:</span>
            <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
              Semester {currentSem} (Year {currentYear})
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 py-1 text-slate-400">
            <span className="font-mono text-[11px] font-bold text-slate-500">Semester {currentSem}</span>
            {isPromote ? (
              <ArrowRight size={16} className="text-blue-600 animate-pulse" />
            ) : (
              <ArrowLeft size={16} className="text-amber-600 animate-pulse" />
            )}
            <span className="font-mono text-[11px] font-black text-blue-700">Semester {newSemester}</span>
          </div>

          <div className="flex items-center justify-between font-bold text-blue-700 pt-1.5 border-t border-slate-200/80">
            <span>New Target Standing:</span>
            <span className="font-black text-sm bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded-lg border border-blue-200">
              Semester {newSemester} (Year {newYear})
            </span>
          </div>

          <div className="flex items-center justify-between font-bold text-slate-700 pt-1.5 border-t border-slate-200/80">
            <span>Affected Enrolled Students:</span>
            <span className="font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              {section.studentCount || 0} Students
            </span>
          </div>
        </div>

        {/* Notice Paragraph */}
        <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-[11px] text-blue-900 space-y-1">
          <p className="font-medium m-0">
            This action will update the semester on the section record, advance all enrolled students, and adjust active Tutor Guardian records automatically.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || newSemester < 1 || newSemester > 8}
            onClick={handleConfirm}
            className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              isPromote
                ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
            }`}
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Updating Section...</span>
              </>
            ) : (
              <span>Confirm {isPromote ? 'Promotion' : 'Demotion'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
