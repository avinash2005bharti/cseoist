import React, { useState, useEffect } from 'react';
import { reportApi } from '../../api';
import { useERP } from '../../context/ERPContext.jsx';
import {
  X,
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  Check,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Filter,
} from 'lucide-react';

export default function AttendanceLeaveReportsModal({ onClose, modalData = {} }) {
  const { addToast } = useERP();

  const [reportType, setReportType] = useState(() => modalData?.initialType || 'considerations');
  const [semester, setSemester] = useState(() => (modalData?.initialSemester !== undefined ? modalData.initialSemester : 5));
  const [datePreset, setDatePreset] = useState('all'); // 'today' | 'last7days' | 'lastmonth' | 'all' | 'custom'
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  // Helper to get formatted YYYY-MM-DD
  const formatYMD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Handle Preset Clicks (as requested in the excalidraw diagram)
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = formatYMD(now);

    if (preset === 'today') {
      setFrom(todayStr);
      setTo(todayStr);
    } else if (preset === 'last7days') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setFrom(formatYMD(past7));
      setTo(todayStr);
    } else if (preset === 'lastmonth') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setFrom(formatYMD(past30));
      setTo(todayStr);
    } else if (preset === 'all') {
      setFrom('');
      setTo('');
    }
  };

  const handleCustomDateChange = (field, val) => {
    setDatePreset('custom');
    if (field === 'from') setFrom(val);
    if (field === 'to') setTo(val);
  };

  const handleDownload = async () => {
    setError(null);
    setDownloading(true);

    try {
      const params = {};
      if (semester && semester !== 'ALL') params.semester = semester;
      if (from) params.from = from;
      if (to) params.to = to;
      if (datePreset && datePreset !== 'custom') params.range = datePreset;
      if (status) params.status = status;

      if (reportType === 'considerations') {
        await reportApi.downloadConsiderationsExcel(params);
        addToast(
          'Excel Generated',
          `Downloaded attendance consideration records for ${semester === 'ALL' ? 'All Semesters' : `Semester ${semester}`}.`,
          'success'
        );
      } else {
        await reportApi.downloadLeavesExcel(params);
        addToast(
          'Excel Generated',
          `Downloaded section-wise leave records for ${semester === 'ALL' ? 'All Semesters' : `Semester ${semester}`}.`,
          'success'
        );
      }

      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to generate Excel file.');
    } finally {
      setDownloading(false);
    }
  };

  const semesterList = [
    { value: 1, label: 'Sem 1' },
    { value: 2, label: 'Sem 2' },
    { value: 3, label: 'Sem 3' },
    { value: 4, label: 'Sem 4' },
    { value: 5, label: 'Sem 5' },
    { value: 6, label: 'Sem 6' },
    { value: 7, label: 'Sem 7' },
    { value: 8, label: 'Sem 8' },
    { value: 'ALL', label: 'All Semesters' },
  ];

  return (
    <div className="modal-backdrop" style={{ zIndex: 100050 }} onClick={onClose}>
      <div
        className="modal-container max-w-xl w-[96%] bg-white p-6 sm:p-7 rounded-3xl text-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 m-0">
                Export to Excel (.xlsx)
              </h3>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Section-wise multi-sheet workbook generation matching institution hierarchy
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

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 shrink-0">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="py-4 space-y-4 overflow-y-auto pr-1">
          {/* 1. Report Scope Toggle (Consideration / Leave) */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5">
              1. Report Scope
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setReportType('considerations')}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  reportType === 'considerations'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Attendance Considerations (OD)</span>
              </button>

              <button
                type="button"
                onClick={() => setReportType('leaves')}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  reportType === 'leaves'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Leave Applications</span>
              </button>
            </div>
          </div>

          {/* 2. Select Semester (Step from Diagram: "select semester") */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-black text-slate-700">
                2. Select Semester
              </label>
              <span className="text-[11px] font-bold text-blue-600">
                Selected: {semester === 'ALL' ? 'All Semesters' : `Semester ${semester}`}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-1 bg-slate-50 rounded-2xl border border-slate-200">
              {semesterList.map((sem) => {
                const isSelected = semester === sem.value;
                return (
                  <button
                    key={sem.value}
                    type="button"
                    onClick={() => setSemester(sem.value)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    {sem.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Select Date Range (Step from Diagram: "select data range" - today, last 7 days, last month, from, to) */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-700">
                3. Select Date Range
              </label>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {datePreset === 'all'
                  ? 'All Dates'
                  : datePreset === 'today'
                  ? 'Today Only'
                  : datePreset === 'last7days'
                  ? 'Past 7 Days'
                  : datePreset === 'lastmonth'
                  ? 'Past 30 Days'
                  : 'Custom Range'}
              </span>
            </div>

            {/* Quick Preset Buttons (exact as in user drawing) */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handlePresetChange('today')}
                className={`py-1.5 px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border text-center ${
                  datePreset === 'today'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                today
              </button>

              <button
                type="button"
                onClick={() => handlePresetChange('last7days')}
                className={`py-1.5 px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border text-center ${
                  datePreset === 'last7days'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                last 7 days
              </button>

              <button
                type="button"
                onClick={() => handlePresetChange('lastmonth')}
                className={`py-1.5 px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border text-center ${
                  datePreset === 'lastmonth'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                last month
              </button>

              <button
                type="button"
                onClick={() => handlePresetChange('all')}
                className={`py-1.5 px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border text-center ${
                  datePreset === 'all'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                all time
              </button>
            </div>

            {/* Custom from and to date inputs (drawn as "from [ ] to [ ]" in diagram) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  From Date
                </label>
                <div className="relative">
                  <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => handleCustomDateChange('from', e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  To Date
                </label>
                <div className="relative">
                  <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => handleCustomDateChange('to', e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Filter by Status (Optional refinement) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Status Scope
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="">All Statuses (Pending, Approved, Recommended, Rejected)</option>
              <option value="APPROVED_BY_HOD,APPROVED">Approved Only</option>
              <option value="PENDING">Pending Review Only</option>
              <option value="RECOMMENDED_BY_TG">Recommended by TG</option>
              <option value="REJECTED_BY_HOD,REJECTED_BY_TG,REJECTED">Rejected Only</option>
            </select>
          </div>

          {/* 5. Visual Representation of the Resulting Excel Sheet (Right side of diagram) */}
          <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-blue-900">
              <FileSpreadsheet size={15} className="text-blue-600" />
              <span>Resulting Excel Workbook Architecture (.xlsx)</span>
            </div>
            <p className="text-[11px] text-blue-700 m-0">
              Data will be packaged into a single workbook containing a consolidated master sheet, plus dedicated worksheets for each section:
            </p>

            {/* Workbook Sheet Tabs (as drawn in diagram: sec A, sec B, sec C, sec D) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5">
              <span className="px-2.5 py-1 rounded-md bg-blue-800 text-white text-[10px] font-mono font-extrabold shadow-2xs shrink-0">
                All Sections
              </span>
              <span className="px-2.5 py-1 rounded-md bg-blue-600 text-white text-[10px] font-mono font-extrabold shadow-2xs shrink-0">
                sec A
              </span>
              <span className="px-2.5 py-1 rounded-md bg-purple-600 text-white text-[10px] font-mono font-extrabold shadow-2xs shrink-0">
                sec B
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-mono font-extrabold shadow-2xs shrink-0">
                sec C
              </span>
              <span className="px-2.5 py-1 rounded-md bg-amber-600 text-white text-[10px] font-mono font-extrabold shadow-2xs shrink-0">
                sec D
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={downloading}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 cursor-pointer transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            style={{ backgroundColor: '#059669', borderColor: '#059669' }}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all cursor-pointer flex items-center gap-2"
          >
            {downloading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            <span>
              {downloading ? 'Generating XLSX...' : 'Download Excel Sheet (.xlsx)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
