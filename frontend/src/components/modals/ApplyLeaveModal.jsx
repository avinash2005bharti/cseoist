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
        className="modal-container max-w-lg w-[95%]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header pb-3 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 m-0">
                Apply for Leave
              </h3>
              <p className="text-xs text-slate-500 m-0">
                Apply for medical, personal, or college duty leave
              </p>
            </div>
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-3">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Leave Category Segmented Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Leave Category <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
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
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                From Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                disabled={submitting}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                To Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                disabled={submitting}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Reason / Justification */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Reason for Leave <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Prescribed medical rest due to viral fever / Attending official college event..."
              rows={3}
              required
              disabled={submitting}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Supporting Document */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Supporting Document (Optional)
            </label>
            <DocumentUploader
              value={attachment}
              onChange={setAttachment}
              placeholder="Attach medical prescription, certificate, or official duty slip (PDF/PNG/JPG)"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? <span>Submitting Application...</span> : <span>Submit Application</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
