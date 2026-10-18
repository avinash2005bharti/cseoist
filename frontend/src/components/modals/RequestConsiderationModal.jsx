import React, { useState, useEffect, useMemo } from 'react';
import { useERP } from '../../context/ERPContext.jsx';
import { considerationApi, masterDataApi, notificationApi } from '../../api';
import {
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Calendar,
  FileText,
  Clock,
  Users,
  User,
  Search,
  Check,
  Plus,
  Trash2,
  Lock,
} from 'lucide-react';
import { DocumentUploader } from '../common';

// Helper to determine if current time is within 9:00 AM - 4:00 PM IST
const checkWindowStatus = () => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: 'numeric',
      minute: 'numeric',
    });
    const parts = formatter.formatToParts(new Date());
    let h = 0;
    let m = 0;
    for (const part of parts) {
      if (part.type === 'hour') h = parseInt(part.value, 10);
      if (part.type === 'minute') m = parseInt(part.value, 10);
    }
    if (h === 24) h = 0;
    const currentMins = h * 60 + m;
    const openMins = 9 * 60; // 09:00 AM
    const closeMins = 16 * 60; // 04:00 PM
    const isOpen = currentMins >= openMins && currentMins <= closeMins;
    const timeFormatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} IST`;
    return { isOpen, timeFormatted };
  } catch {
    return { isOpen: true, timeFormatted: 'IST' };
  }
};

export default function RequestConsiderationModal({ onClose, onSuccess }) {
  const { currentUser, addToast } = useERP();

  const [applicationType, setApplicationType] = useState('INDIVIDUAL'); // 'INDIVIDUAL' | 'GROUP'
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState('HACKATHON');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [timeFrom, setTimeFrom] = useState('10:50 AM');
  const [timeTo, setTimeTo] = useState('01:20 PM');
  const [lecturesCount, setLecturesCount] = useState(1);
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState(null);

  // Consideration application window (9:00 AM - 4:00 PM IST)
  const [windowStatus, setWindowStatus] = useState(() => checkWindowStatus());

  useEffect(() => {
    notificationApi
      .getConsiderationWindow()
      .then((res) => {
        const data = res?.data || res;
        if (data && typeof data.isOpen === 'boolean') {
          setWindowStatus({
            isOpen: data.isOpen,
            timeFormatted: `${data.currentTimeIST} IST`,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Group Members state
  const [allStudents, setAllStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchStudentQuery, setSearchStudentQuery] = useState('');
  const [semFilter, setSemFilter] = useState('ALL');
  const [secFilter, setSecFilter] = useState('ALL');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const quickLecturePresets = [1, 2, 3, 4, 6, 7];
  const timePresets = [
    { label: 'Morning (10:50 AM - 01:20 PM)', from: '10:50 AM', to: '01:20 PM' },
    { label: 'Afternoon (01:40 PM - 04:10 PM)', from: '01:40 PM', to: '04:10 PM' },
    { label: 'Full Day (10:00 AM - 04:30 PM)', from: '10:00 AM', to: '04:30 PM' },
  ];

  // Fetch all students directory when Group mode is active
  useEffect(() => {
    if (applicationType === 'GROUP' && allStudents.length === 0) {
      setLoadingStudents(true);
      masterDataApi
        .getStudents({ limit: 300 })
        .then((res) => {
          const list = res?.data || res?.students || (Array.isArray(res) ? res : []);
          setAllStudents(Array.isArray(list) ? list : []);
        })
        .catch((err) => {
          console.warn('Failed to load student directory:', err.message);
        })
        .finally(() => {
          setLoadingStudents(false);
        });
    }
  }, [applicationType]);

  const handleStartDateChange = (val) => {
    setStartDate(val);
    if (endDate < val) {
      setEndDate(val);
    }
  };

  const currentStudentId = currentUser?.profile?._id || currentUser?.studentId;

  // Filter students candidate list for group selection
  const filteredCandidates = useMemo(() => {
    return allStudents.filter((st) => {
      // Exclude applying student
      if (currentStudentId && String(st._id) === String(currentStudentId)) return false;

      // Semester filter
      if (semFilter !== 'ALL') {
        const targetSem = parseInt(semFilter, 10);
        const stSem = st.section?.semester || st.semester;
        if (Number(stSem) !== Number(targetSem)) return false;
      }

      // Section filter
      if (secFilter !== 'ALL') {
        const rawSec = (st.section?.name || st.section?.code || '').toUpperCase();
        const targetSec = secFilter.toUpperCase().trim();
        if (!rawSec.includes(targetSec)) return false;
      }

      // Search query
      if (searchStudentQuery.trim()) {
        const q = searchStudentQuery.toLowerCase().trim();
        const name = (st.user?.name || '').toLowerCase();
        const roll = (st.rollNumber || '').toLowerCase();
        const enroll = (st.enrollmentNumber || '').toLowerCase();
        if (!name.includes(q) && !roll.includes(q) && !enroll.includes(q)) return false;
      }

      return true;
    });
  }, [allStudents, currentStudentId, semFilter, secFilter, searchStudentQuery]);

  const toggleMemberSelection = (st) => {
    const isAlready = selectedMembers.some((m) => m._id === st._id);
    if (isAlready) {
      setSelectedMembers((prev) => prev.filter((m) => m._id !== st._id));
    } else {
      setSelectedMembers((prev) => [...prev, st]);
    }
  };

  const removeMember = (stId) => {
    setSelectedMembers((prev) => prev.filter((m) => m._id !== stId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!windowStatus.isOpen) {
      setFormError(
        `Consideration requests can only be submitted between 9:00 AM and 4:00 PM IST. Current time: ${windowStatus.timeFormatted}. Submissions are currently closed.`
      );
      return;
    }

    const trimmedTitle = eventTitle.trim();
    if (!trimmedTitle || trimmedTitle.length < 3) {
      setFormError('Please enter a valid event or activity name (at least 3 characters).');
      return;
    }

    if (!startDate || !endDate) {
      setFormError('Please select both start date and end date.');
      return;
    }

    if (endDate < startDate) {
      setFormError('End date must be the same as or after the start date.');
      return;
    }

    if (!timeFrom.trim() || !timeTo.trim()) {
      setFormError('Please specify both Time From and Time To for the missed lecture schedule.');
      return;
    }

    const numLectures = parseInt(lecturesCount, 10);
    if (isNaN(numLectures) || numLectures < 1) {
      setFormError('Please enter a valid number of lectures (minimum 1).');
      return;
    }

    if (applicationType === 'GROUP' && selectedMembers.length === 0) {
      setFormError('Please select at least one team member to submit a group consideration request.');
      return;
    }

    const trimmedDescription = description.trim();
    if (!trimmedDescription || trimmedDescription.length < 5) {
      setFormError('Please enter a brief reason or description (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      await considerationApi.create({
        eventTitle: trimmedTitle,
        eventType,
        startDate,
        endDate,
        timeFrom: timeFrom.trim(),
        timeTo: timeTo.trim(),
        requestedPeriods: numLectures,
        selectedPeriods: [],
        periodTiming: `${timeFrom.trim()} - ${timeTo.trim()}`,
        description: trimmedDescription,
        attachments: attachment ? [attachment] : [],
        isGroup: applicationType === 'GROUP',
        groupMembers: applicationType === 'GROUP' ? selectedMembers.map((m) => m._id) : [],
      });

      const memberMsg =
        applicationType === 'GROUP'
          ? ` and routed for ${selectedMembers.length + 1} team members to their respective Tutor Guardians`
          : `. Sent to your Tutor Guardian`;

      addToast(
        'Application Submitted Successfully',
        `Attendance consideration application submitted for ${numLectures} lecture(s)${memberMsg}.`,
        'success'
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setFormError(err.message || 'Failed to submit attendance consideration request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={!submitting ? onClose : undefined}>
      <div
        className="modal-container max-w-2xl w-[95%] max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header pb-3 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 m-0">
                Apply for Attendance Consideration
              </h3>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Apply for official attendance consideration for lectures missed during approved events or academic activities
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
          {/* Consideration Timing Window Indicator (9:00 AM - 4:00 PM IST) */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs transition-all ${
              windowStatus.isOpen
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  windowStatus.isOpen
                    ? 'bg-white border-emerald-200 text-emerald-600'
                    : 'bg-white border-amber-300 text-amber-700'
                }`}
              >
                {windowStatus.isOpen ? (
                  <Clock size={17} className="animate-pulse" />
                ) : (
                  <Lock size={17} />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-xs">
                    {windowStatus.isOpen
                      ? 'Consideration Window Active (9:00 AM – 4:00 PM IST)'
                      : 'Consideration Submissions Closed (9:00 AM – 4:00 PM Only)'}
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      windowStatus.isOpen
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-600 text-white'
                    }`}
                  >
                    {windowStatus.isOpen ? 'Window Open' : 'Window Closed'}
                  </span>
                </div>
                <p className="text-[11px] opacity-85 m-0 mt-0.5">
                  {windowStatus.isOpen
                    ? 'Students are permitted to submit attendance consideration requests now.'
                    : 'Students can only apply between 9:00 AM and 4:00 PM IST. The submission portal opens at 9:00 AM.'}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right pl-2 border-l border-slate-200/60 hidden sm:block">
              <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                Current Time
              </span>
              <span className="font-mono text-xs font-black text-slate-800">
                {windowStatus.timeFormatted}
              </span>
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Application Scope Toggle: Individual vs Group */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Application Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setApplicationType('INDIVIDUAL')}
                className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  applicationType === 'INDIVIDUAL'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    applicationType === 'INDIVIDUAL'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <User size={16} />
                </div>
                <div>
                  <span className="block text-xs font-black">Individual Request</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Apply for yourself only
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setApplicationType('GROUP')}
                className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  applicationType === 'GROUP'
                    ? 'border-purple-600 bg-purple-50/70 text-purple-900 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    applicationType === 'GROUP'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Users size={16} />
                </div>
                <div>
                  <span className="block text-xs font-black">Group / Team Request</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Include team members from any section
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Group Member Selection Section (Shown if Group selected) */}
          {applicationType === 'GROUP' && (
            <div className="p-4 rounded-2xl bg-purple-50/40 border border-purple-200 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-purple-950 m-0 flex items-center gap-1.5">
                    <Users size={15} className="text-purple-700" />
                    <span>Select Team Members</span>
                  </h4>
                  <p className="text-[11px] text-purple-800/80 m-0 mt-0.5">
                    Each member's request will be routed to their respective section's Tutor Guardian and HOD.
                  </p>
                </div>
                <span className="text-xs font-black px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                  {selectedMembers.length + 1} Total ({selectedMembers.length} added + You)
                </span>
              </div>

              {/* Selected Members Chips */}
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-white border border-purple-200">
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold">
                    <span>{currentUser?.name || 'You'} (Lead)</span>
                  </div>
                  {selectedMembers.map((m) => (
                    <div
                      key={m._id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-300 text-purple-900 text-[11px] font-bold"
                    >
                      <span>
                        {m.user?.name} ({m.rollNumber} • {m.section?.name || 'Sec'})
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMember(m._id)}
                        className="text-purple-500 hover:text-purple-800 cursor-pointer p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Candidate Filter Bar: Semester, Section, Search */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Filter Semester
                  </label>
                  <select
                    value={semFilter}
                    onChange={(e) => setSemFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="ALL">All Semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Filter Section
                  </label>
                  <select
                    value={secFilter}
                    onChange={(e) => setSecFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="ALL">All Sections</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Search Student
                  </label>
                  <div className="relative">
                    <Search
                      size={13}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={searchStudentQuery}
                      onChange={(e) => setSearchStudentQuery(e.target.value)}
                      placeholder="Name or roll..."
                      className="w-full pl-7 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Student Candidate Roster List */}
              <div className="max-h-44 overflow-y-auto rounded-xl border border-purple-200 bg-white divide-y divide-slate-100">
                {loadingStudents ? (
                  <div className="p-4 text-center text-xs text-slate-400">Loading student directory...</div>
                ) : filteredCandidates.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No matching students found.
                  </div>
                ) : (
                  filteredCandidates.map((st) => {
                    const isSelected = selectedMembers.some((m) => m._id === st._id);
                    const secLabel = st.section?.name || st.section?.code || 'Section';
                    const semLabel = st.section?.semester || st.semester || '5';
                    return (
                      <div
                        key={st._id}
                        onClick={() => toggleMemberSelection(st)}
                        className={`p-2.5 flex items-center justify-between hover:bg-purple-50/50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-purple-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-purple-600 pointer-events-none"
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 block truncate">
                              {st.user?.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium block">
                              Roll: {st.rollNumber} • Sem {semLabel} • {secLabel}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-purple-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Add'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 1. Event or Activity Name */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Event / Activity Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder="e.g., Smart India Hackathon, Annual Sports Meet, Tech Workshop"
              required
              disabled={submitting}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
            />
          </div>

          {/* 2. Category */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Activity Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
            >
              <option value="HACKATHON">Hackathon / Technical Competition</option>
              <option value="SPORTS">Sports Meet / Tournament</option>
              <option value="CULTURAL">Cultural Event / College Fest</option>
              <option value="COLLEGE_DUTY">College Duty / Official Assignment</option>
              <option value="OTHER">Other Academic Activity</option>
            </select>
          </div>

          {/* 3. Date Range (Start Date & End Date) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                required
                disabled={submitting}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                End Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                disabled={submitting}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* 4. Time From & Time To (User Input for Timing) */}
          <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-slate-900 flex items-center gap-1.5 m-0">
                <Clock size={15} className="text-blue-600" />
                <span>Lecture Time Schedule (Time From & To)</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200">
                Time Duration
              </span>
            </div>

            {/* Quick Time Presets */}
            <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
              <span className="text-[10px] text-slate-500 font-bold mr-1">Presets:</span>
              {timePresets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setTimeFrom(p.from);
                    setTimeTo(p.to);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                    timeFrom === p.from && timeTo === p.to
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Time From
                </label>
                <input
                  type="text"
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                  placeholder="e.g., 10:50 AM"
                  required
                  disabled={submitting}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Time To
                </label>
                <input
                  type="text"
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                  placeholder="e.g., 01:20 PM"
                  required
                  disabled={submitting}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          {/* 5. Number of Lectures to be Considered */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 m-0">
                Number of Lectures Missed <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                {lecturesCount} {parseInt(lecturesCount, 10) === 1 ? 'Lecture' : 'Lectures'}
              </span>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <span className="text-[11px] text-slate-500 font-medium mr-1">Quick Select:</span>
              {quickLecturePresets.map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={submitting}
                  onClick={() => setLecturesCount(num)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    parseInt(lecturesCount, 10) === num
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {num} {num === 1 ? 'Lecture' : 'Lectures'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="50"
                value={lecturesCount}
                onChange={(e) => setLecturesCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                required
                disabled={submitting}
                className="w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
              />
              <span className="text-xs text-slate-500 font-medium">
                Total lecture periods requested for attendance consideration
              </span>
            </div>
          </div>

          {/* 6. Reason & Description */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Reason / Activity Details <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Participated as a team member in the Inter-College Hackathon at nodal center..."
              rows={3}
              required
              disabled={submitting}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
            />
          </div>

          {/* 7. Supporting Document (Optional) */}
          <div>
            <DocumentUploader
              label="Supporting Document (Optional)"
              hint="Upload event certificate, invitation letter, or permission slip (PDF, JPG, PNG up to 5 MB - optional)"
              selectedFile={attachment}
              onFileVerified={setAttachment}
              onFileRemove={() => setAttachment(null)}
              required={false}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !windowStatus.isOpen}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 ${
                !windowStatus.isOpen
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white cursor-pointer'
              }`}
            >
              {!windowStatus.isOpen ? (
                <>
                  <Lock size={14} className="shrink-0" />
                  <span>Submissions Closed (9:00 AM – 4:00 PM Only)</span>
                </>
              ) : submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Application...</span>
                </>
              ) : (
                <span>
                  Submit {applicationType === 'GROUP' ? `Group Application (${selectedMembers.length + 1} Students)` : 'Application'} ({lecturesCount} {parseInt(lecturesCount, 10) === 1 ? 'Lecture' : 'Lectures'})
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
