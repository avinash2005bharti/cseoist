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
  ChevronDown,
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
    return { isOpen, isTimeLimitEnabled: true, timeFormatted };
  } catch {
    return { isOpen: true, isTimeLimitEnabled: true, timeFormatted: 'IST' };
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
  const [selectedPeriods, setSelectedPeriods] = useState([1]);
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState(null);

  const togglePeriod = (p) => {
    setSelectedPeriods((prev) => {
      const next = prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].sort((a, b) => a - b);
      setLecturesCount(Math.max(1, next.length));
      return next;
    });
  };

  // Consideration application window (9:00 AM - 4:00 PM IST or 24/7 if disabled by Admin)
  const [windowStatus, setWindowStatus] = useState(() => checkWindowStatus());

  useEffect(() => {
    notificationApi
      .getConsiderationWindow()
      .then((res) => {
        const data = res?.data || res;
        if (data && typeof data.isOpen === 'boolean') {
          setWindowStatus({
            isOpen: data.isOpen,
            isTimeLimitEnabled: data.isTimeLimitEnabled !== false,
            timeFormatted: data.currentTimeIST ? `${data.currentTimeIST} IST` : 'IST',
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
      const fetchList = masterDataApi.getPeers
        ? masterDataApi.getPeers({ limit: 1000 })
        : masterDataApi.getStudents({ all: 'true' });

      fetchList
        .then((res) => {
          const list = res?.data || res?.students || (Array.isArray(res) ? res : []);
          setAllStudents(Array.isArray(list) ? list : []);
        })
        .catch(() => {
          masterDataApi
            .getStudents({ all: 'true' })
            .then((res) => {
              const list = res?.data || res?.students || (Array.isArray(res) ? res : []);
              setAllStudents(Array.isArray(list) ? list : []);
            })
            .catch((err) => {
              console.warn('Failed to load student directory:', err.message);
            });
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
      if (
        currentStudentId &&
        (String(st._id) === String(currentStudentId) ||
          String(st.id) === String(currentStudentId) ||
          String(st.user?._id) === String(currentStudentId))
      ) {
        return false;
      }

      // Semester filter
      if (semFilter !== 'ALL') {
        const targetSem = parseInt(semFilter, 10);
        const stSem = st.section?.semester || st.semester;
        if (Number(stSem) !== Number(targetSem)) return false;
      }

      // Section filter
      if (secFilter !== 'ALL') {
        const rawSec = (st.section?.name || st.section?.code || (typeof st.section === 'string' ? st.section : '')).toUpperCase();
        const targetSec = secFilter.toUpperCase().trim();
        if (!rawSec.includes(targetSec)) return false;
      }

      // Search query
      if (searchStudentQuery.trim()) {
        const q = searchStudentQuery.toLowerCase().trim();
        const name = (st.user?.name || st.name || '').toLowerCase();
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

    const isClosed = !windowStatus.isOpen && windowStatus.isTimeLimitEnabled !== false;
    if (isClosed) {
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
        selectedPeriods: selectedPeriods.map((p) => `P${p}`),
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
        className="modal-container max-w-2xl w-[95%] bg-white rounded-2xl border border-slate-200/80 shadow-2xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-xl text-slate-900 tracking-tight m-0">
              Request consideration
            </h2>
            <p className="text-slate-500 text-sm mt-0.5 m-0">
              Submit an attendance consideration request
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-3 pb-4">
          {/* Consideration Timing Window Indicator (9:00 AM - 4:00 PM IST or Testing Mode) */}
          {windowStatus.isTimeLimitEnabled === false ? (
            <div className="p-3.5 rounded-2xl border bg-purple-50/90 border-purple-300 text-purple-950 flex items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border bg-white border-purple-300 text-purple-700">
                  <Sparkles size={17} className="animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-xs">
                      24/7 Testing Mode Active (Time Limit Bypassed)
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-purple-600 text-white">
                      Testing Mode ON
                    </span>
                  </div>
                  <p className="text-[11px] opacity-85 m-0 mt-0.5">
                    The 9:00 AM – 4:00 PM IST time restriction has been disabled by Admin for feature testing. Applications can be submitted 24/7.
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right pl-2 border-l border-purple-200 hidden sm:block">
                <span className="text-[10px] text-purple-600 font-bold block uppercase tracking-wider">
                  Current Time
                </span>
                <span className="font-mono text-xs font-black text-purple-900">
                  {windowStatus.timeFormatted}
                </span>
              </div>
            </div>
          ) : (
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
          )}

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Application Scope Toggle: Individual vs Group */}
          <div>
            <label className="block font-semibold text-slate-800 text-sm mb-1.5">
              Application scope
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setApplicationType('INDIVIDUAL')}
                className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  applicationType === 'INDIVIDUAL'
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold ring-1 ring-indigo-500/20 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    applicationType === 'INDIVIDUAL'
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <User size={16} />
                </div>
                <div>
                  <span className="block text-sm font-bold">Individual Request</span>
                  <span className="block text-xs text-slate-500 mt-0.5 leading-snug">
                    Apply for yourself only
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setApplicationType('GROUP')}
                className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  applicationType === 'GROUP'
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold ring-1 ring-indigo-500/20 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    applicationType === 'GROUP'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Users size={16} />
                </div>
                <div>
                  <span className="block text-sm font-bold">Group / Team Request</span>
                  <span className="block text-xs text-slate-500 mt-0.5 leading-snug">
                    Include team members
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
                        {m.user?.name || m.name} ({m.rollNumber} • {m.section?.name || m.section?.code || 'Sec'})
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
                    <option value="E">Section E</option>
                    <option value="F">Section F</option>
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
                    const secLabel = st.section?.name || st.section?.code || (typeof st.section === 'string' ? st.section : 'Section');
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
                              {st.user?.name || st.name || 'Student'}
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

          {/* Event category */}
          <div>
            <label htmlFor="consideration-category" className="block font-semibold text-slate-800 text-sm mb-1.5">
              Event category
            </label>
            <div className="relative">
              <select
                id="consideration-category"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                disabled={submitting}
                className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3.5 py-2.5 text-sm appearance-none outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 cursor-pointer transition-all"
              >
                <option value="HACKATHON">Attendance consideration</option>
                <option value="SPORTS">Sports event / Competition</option>
                <option value="CULTURAL">Cultural activity / Fest</option>
                <option value="COLLEGE_DUTY">Academic event / Official duty</option>
                <option value="OTHER">Other academic activity</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Event name */}
          <div>
            <label htmlFor="consideration-event-name" className="block font-semibold text-slate-800 text-sm mb-1.5">
              Event name
            </label>
            <input
              id="consideration-event-name"
              type="text"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder="Enter event name"
              required
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3.5 py-2.5 text-sm placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
            />
          </div>

          {/* Start date & End date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="consideration-start-date" className="block font-semibold text-slate-800 text-sm mb-1.5">
                Start date
              </label>
              <input
                id="consideration-start-date"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                required
                disabled={submitting}
                className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 cursor-pointer transition-all"
              />
            </div>
            <div>
              <label htmlFor="consideration-end-date" className="block font-semibold text-slate-800 text-sm mb-1.5">
                End date
              </label>
              <input
                id="consideration-end-date"
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

          {/* Periods */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-semibold text-slate-800 text-sm">
                Periods
              </label>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                {lecturesCount} {parseInt(lecturesCount, 10) === 1 ? 'Lecture' : 'Lectures'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[1, 2, 3, 4].map((p) => {
                const isChecked = selectedPeriods.includes(p);
                return (
                  <label
                    key={p}
                    className={`cursor-pointer rounded-xl border p-2.5 flex items-center gap-2 text-sm font-semibold transition-all ${
                      isChecked
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold ring-1 ring-indigo-500/20 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => togglePeriod(p)}
                      className="size-4 rounded accent-indigo-600 cursor-pointer"
                    />
                    <span>P{p}</span>
                  </label>
                );
              })}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[5, 6, 7].map((p) => {
                const isChecked = selectedPeriods.includes(p);
                return (
                  <label
                    key={p}
                    className={`cursor-pointer rounded-xl border p-2.5 flex items-center gap-2 text-sm font-semibold transition-all ${
                      isChecked
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold ring-1 ring-indigo-500/20 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => togglePeriod(p)}
                      className="size-4 rounded accent-indigo-600 cursor-pointer"
                    />
                    <span>P{p}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Lecture Timing Schedule (Time From & To) */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 m-0">
                <Clock size={14} className="text-indigo-600" />
                <span>Lecture Time Schedule</span>
              </label>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50/70 px-2 py-0.5 rounded-md border border-indigo-200">
                {timeFrom} – {timeTo}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-bold mr-1">Presets:</span>
              {timePresets.map((p, idx) => {
                const isActive = timeFrom === p.from && timeTo === p.to;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setTimeFrom(p.from);
                      setTimeTo(p.to);
                    }}
                    className={`schedule-preset-btn px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      isActive
                        ? 'active bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    style={isActive ? { backgroundColor: '#4F46E5', color: '#FFFFFF', borderColor: '#4F46E5' } : undefined}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Time From
                </label>
                <input
                  type="text"
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                  placeholder="e.g., 10:50 AM"
                  required
                  disabled={submitting}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-600 focus:outline-none transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Time To
                </label>
                <input
                  type="text"
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                  placeholder="e.g., 01:20 PM"
                  required
                  disabled={submitting}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-600 focus:outline-none transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          {/* Justification */}
          <div>
            <label htmlFor="consideration-justification" className="block font-semibold text-slate-800 text-sm mb-1.5">
              Justification
            </label>
            <textarea
              id="consideration-justification"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the reason for your request"
              rows={3}
              required
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 p-3 text-sm placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 min-h-[90px] resize-y transition-all"
            />
          </div>

          {/* Upload supporting document */}
          <div>
            <DocumentUploader
              label=""
              selectedFile={attachment}
              onFileVerified={setAttachment}
              onFileRemove={() => setAttachment(null)}
              required={false}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex pt-2 pb-2 justify-end gap-3 items-center">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            {(() => {
              const isClosed = !windowStatus.isOpen && windowStatus.isTimeLimitEnabled !== false;
              return (
                <button
                  type="submit"
                  disabled={submitting || isClosed}
                  className={`px-7 py-2.5 rounded-xl text-sm font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                    isClosed
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                      : 'bg-primary hover:bg-indigo-700 text-white'
                  }`}
                >
                  {isClosed ? (
                    <>
                      <Lock size={15} className="shrink-0" />
                      <span>Submissions Closed (9:00 AM – 4:00 PM Only)</span>
                    </>
                  ) : submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting Application...</span>
                    </>
                  ) : (
                    <span>Submit</span>
                  )}
                </button>
              );
            })()}
          </div>
        </form>
      </div>
    </div>
  );
}
