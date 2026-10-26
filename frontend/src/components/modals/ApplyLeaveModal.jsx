import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.jsx';
import { leaveApi } from '../../api';
import { X, Calendar, AlertCircle } from 'lucide-react';
import { DocumentUploader } from '../common';

export default function ApplyLeaveModal({ onClose, onSuccess }) {
  const { addToast } = useERP();

  const [category, setCategory] = useState('Medical');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!reason.trim() || reason.trim().length < 5) {
      setFormError('Please enter a clear reason or justification (minimum 5 characters).');
      return;
    }

    // Map UI category to leaveType enum
    let leaveType = 'CASUAL';
    if (category === 'Medical') leaveType = 'MEDICAL';
    else if (category === 'College Duty') leaveType = 'DUTY';
    else if (category === 'Personal') leaveType = 'CASUAL';

    setSubmitting(true);
    try {
      await leaveApi.create({
        leaveType,
        startDate,
        endDate,
        reason: `[${category}] ${reason.trim()}`,
        attachments: attachment ? [attachment] : [],
      });

      addToast(
        'Leave Application Submitted',
        `Your ${category.toLowerCase()} application has been submitted and routed to your Tutor Guardian.`,
        'success'
      );
      window.dispatchEvent(new CustomEvent('campusflow_refresh_leaves'));
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setFormError(err.message || 'Failed to apply for leave. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={!submitting ? onClose : undefined}>
      <div
        className="modal-container max-w-lg w-[95%] bg-white rounded-2xl border border-slate-200/80 shadow-2xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-xl text-slate-900 tracking-tight m-0">
              Apply for Leave
            </h2>
            <p className="text-slate-500 text-sm mt-0.5 m-0">
              Submit a leave application for medical, duty, or personal reasons
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-3 pb-3">
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Leave Category Segmented Toggle */}
          <div>
            <label className="block font-semibold text-slate-800 text-sm mb-1.5">
              Leave category
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'Medical', label: 'Medical' },
                { id: 'College Duty', label: 'College Duty' },
                { id: 'Personal', label: 'Personal' },
              ].map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => setCategory(cat.id)}
                    className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-all border cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold ring-1 ring-indigo-500/20 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* From Date & To Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="leave-start-date" className="block font-semibold text-slate-800 text-sm mb-1.5">
                Start date
              </label>
              <input
                id="leave-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                disabled={submitting}
                className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 cursor-pointer transition-all"
              />
            </div>
            <div>
              <label htmlFor="leave-end-date" className="block font-semibold text-slate-800 text-sm mb-1.5">
                End date
              </label>
              <input
                id="leave-end-date"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                disabled={submitting}
                className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 cursor-pointer transition-all"
              />
            </div>
          </div>

          {/* Reason / Justification */}
          <div>
            <label htmlFor="leave-justification" className="block font-semibold text-slate-800 text-sm mb-1.5">
              Justification
            </label>
            <textarea
              id="leave-justification"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the reason for your request"
              rows={3}
              required
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 p-3 text-sm placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 min-h-[90px] resize-y transition-all"
            />
          </div>

          {/* Supporting Document */}
          <div>
            <DocumentUploader
              label=""
              selectedFile={attachment}
              value={attachment}
              onFileVerified={setAttachment}
              onChange={setAttachment}
              onFileRemove={() => setAttachment(null)}
              hint=""
            />
          </div>

          {/* Footer Actions */}
          <div className="flex pt-2 pb-1 justify-end gap-3 items-center">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-7 py-2.5 rounded-xl bg-primary hover:bg-indigo-700 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>Submit</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
