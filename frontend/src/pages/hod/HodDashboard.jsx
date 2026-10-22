import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import { dashboardApi, considerationApi, leaveApi, masterDataApi, noticeApi } from '../../api';
import { getSectionLetter } from '../../utils/constants.js';
import {
  Calendar,
  Clock,
  AlertCircle,
  Users,
  GraduationCap,
  UserPlus,
  ShieldCheck,
  ArrowRight,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  Send,
  Megaphone,
  Trash2,
  Layers,
} from 'lucide-react';

import { lazyWithRetry } from '../../utils/lazyWithRetry.js';

// Lazy-loaded modals with auto-retry
const OfficialClearancesLedgerModal = lazyWithRetry(() => import('../../components/modals/OfficialClearancesLedgerModal.jsx'));
const SectionOverviewModal = lazyWithRetry(() => import('../../components/modals/SectionOverviewModal.jsx'));
const ClassesCurriculumModal = lazyWithRetry(() => import('../../components/modals/ClassesCurriculumModal.jsx'));
const AddFacultyModal = lazyWithRetry(() => import('../../components/modals/AddFacultyModal.jsx'));
const AddStudentModal = lazyWithRetry(() => import('../../components/modals/AddStudentModal.jsx'));
const PendingApprovalsModal = lazyWithRetry(() => import('../../components/modals/PendingApprovalsModal.jsx'));
const SendNoticeModal = lazyWithRetry(() => import('../../components/modals/SendNoticeModal.jsx'));
const MoveSemesterModal = lazyWithRetry(() => import('../../components/modals/MoveSemesterModal.jsx'));
const TgRecommendationsModal = lazyWithRetry(() => import('../../components/modals/TgRecommendationsModal.jsx'));

const HOD_REJECTED_KEY = 'campusflow_hod_rejected_ids';
const getStoredRejectedIds = () => {
  try {
    const raw = localStorage.getItem(HOD_REJECTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export default function HodDashboard() {
  const { currentUser, addToast, openModal } = useERP();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [pendingConsiderations, setPendingConsiderations] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal controls
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [sectionModalTarget, setSectionModalTarget] = useState(null);
  const [showClassesModal, setShowClassesModal] = useState(false);
  const [showAddFacultyModal, setShowAddFacultyModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [moveModalData, setMoveModalData] = useState(null);
  const [showSendNoticeModal, setShowSendNoticeModal] = useState(false);
  const [showTgModal, setShowTgModal] = useState(false);

  // Selected Section Overview Semester (e.g. 5)
  const [selectedSemNumber, setSelectedSemNumber] = useState(null);

  // Academic Year State & Dropdown
  const [academicYear, setAcademicYear] = useState('');
  const [showYearDropdown, setShowYearDropdown] = useState(false);

  // Formatted date and time (synchronously initialized to prevent layout shift / CLS)
  const getFormattedDateTime = () => {
    const now = new Date();
    const options = {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    };
    return {
      date: now.toLocaleDateString('en-US', options),
      time: now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
    };
  };

  const [currentDate, setCurrentDate] = useState(() => getFormattedDateTime().date);
  const [currentTime, setCurrentTime] = useState(() => getFormattedDateTime().time);

  useEffect(() => {
    const updateTime = () => {
      const { date, time } = getFormattedDateTime();
      setCurrentDate(date);
      setCurrentTime(time);
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [sumRes, consRes, leavesRes, studentsRes, noticesRes, sectionsRes] = await Promise.allSettled([
        dashboardApi.getSummary(),
        considerationApi.getHODQueue({ all: 'true' }),
        leaveApi.getHODQueue({ all: 'true' }),
        masterDataApi.getStudents({ all: 'true' }),
        noticeApi.getNotices(),
        masterDataApi.getSections(),
      ]);

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

      if (sumRes.status === 'fulfilled') setSummary(sumRes.value?.data || {});
      if (consRes.status === 'fulfilled') {
        const raw = consRes.value?.data || [];
        setPendingConsiderations(raw.filter(isStillPending));
      }
      if (leavesRes.status === 'fulfilled') {
        const raw = leavesRes.value?.data || [];
        setPendingLeaves(raw.filter(isStillPending));
      }
      if (studentsRes.status === 'fulfilled') {
        setStudents(studentsRes.value?.data || []);
      }
      if (sectionsRes.status === 'fulfilled') {
        setSections(sectionsRes.value?.data || []);
      }
      if (noticesRes.status === 'fulfilled') {
        setNotices(noticesRes.value?.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    if (!window.confirm('Are you sure you want to delete this notice?')) return;
    try {
      await noticeApi.deleteNotice(noticeId);
      setNotices((prev) => prev.filter((n) => n._id !== noticeId));
      addToast('Notice Deleted', 'Notice was removed successfully.', 'info');
    } catch (err) {
      addToast('Error', err.response?.data?.error?.message || 'Failed to delete notice.', 'error');
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const handleQueueChange = () => fetchDashboardData();
    window.addEventListener('campusflow_queue_changed', handleQueueChange);

    // Live real-time polling every 10 seconds to guarantee fresh queue counters
    const pollInterval = setInterval(() => {
      fetchDashboardData();
    }, 10000);

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('open_ledger') === 'true') {
      setShowLedgerModal(true);
    }

    return () => {
      window.removeEventListener('campusflow_queue_changed', handleQueueChange);
      clearInterval(pollInterval);
    };
  }, []);

  // Filter students by selected semester for the section overview
  const semStudents = students.filter((s) => {
    const sem = s.semester || s.section?.semester;
    return Number(sem) === Number(selectedSemNumber);
  });

  const availableSemesters = [1, 2, 3, 4, 5, 6, 7, 8];

  const realAcademicYears = [...new Set(
    students
      .map((student) => student.mentorGroup?.academicYear)
      .filter(Boolean)
  )].sort();

  useEffect(() => {
    if (selectedSemNumber === null) {
      const activeSem = sections.find((s) => s.semester)?.semester;
      setSelectedSemNumber(activeSem ? Number(activeSem) : 5);
    }
  }, [sections, selectedSemNumber]);

  useEffect(() => {
    if (!academicYear && realAcademicYears.length > 0) {
      setAcademicYear(realAcademicYears[0]);
    }
  }, [academicYear, realAcademicYears]);

  const getSectionStudentCount = (section) => {
    return semStudents.filter((s) => {
      const sectionId = s.section?._id || s.section;
      return sectionId === section._id;
    }).length;
  };

  const [hoveredSem, setHoveredSem] = useState(null);

  const visibleSections = sections
    .filter((section) => Number(section.semester) === Number(selectedSemNumber))
    .map((section) => ({ ...section, studentCount: getSectionStudentCount(section) }));

  const openSectionDetails = (section) => {
    setSectionModalTarget({
      section: getSectionLetter(section) || 'B',
      semester: Number(selectedSemNumber || section.semester || 5),
    });
    setShowSectionModal(true);
  };

  // Determine greeting based on current hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Real semester distribution calculation based on enrolled students in the database
  const totalStudents = students.length;
  const semesterColors = [
    { sem: 1, label: '1st Sem', color: '#3B82F6', dotColor: 'bg-blue-500' },
    { sem: 2, label: '2nd Sem', color: '#38BDF8', dotColor: 'bg-sky-400' },
    { sem: 3, label: '3rd Sem', color: '#06B6D4', dotColor: 'bg-cyan-500' },
    { sem: 4, label: '4th Sem', color: '#10B981', dotColor: 'bg-emerald-500' },
    { sem: 5, label: '5th Sem', color: '#F59E0B', dotColor: 'bg-amber-500' },
    { sem: 6, label: '6th Sem', color: '#EC4899', dotColor: 'bg-pink-500' },
    { sem: 7, label: '7th Sem', color: '#8B5CF6', dotColor: 'bg-purple-500' },
    { sem: 8, label: '8th Sem', color: '#6366F1', dotColor: 'bg-indigo-500' },
  ];

  const semDistribution = semesterColors.map((sc) => {
    const realCount = students.filter(
      (s) => Number(s.semester || s.section?.semester) === sc.sem
    ).length;
    return { ...sc, count: realCount };
  });

  const totalCohortStudents = semDistribution.reduce((acc, curr) => acc + curr.count, 0);

  const semDistributionWithPct = semDistribution.map((sc) => ({
    ...sc,
    pct: totalCohortStudents > 0 ? Math.round((sc.count / totalCohortStudents) * 100) : 0,
  }));

  // Calculate SVG donut slices strictly from active semester data with distinct colors
  const circumference = 2 * Math.PI * 38; // ≈ 238.761
  let runningOffset = 0;
  const activeSlices = semDistributionWithPct.filter((item) => item.count > 0);
  const donutSlices = activeSlices.map((item) => {
    const fraction = item.count / (totalCohortStudents || 1);
    const sliceLength = fraction * circumference;
    const offset = -runningOffset;
    runningOffset += sliceLength;
    const dashArray =
      activeSlices.length === 1
        ? `${circumference} 0`
        : `${sliceLength} ${circumference - sliceLength}`;
    return {
      ...item,
      dashArray,
      dashOffset: offset,
    };
  });

  const hoveredSemData = semDistributionWithPct.find((item) => item.sem === hoveredSem);

  const pendingConsCount = pendingConsiderations.length;
  const pendingLeavesCount = pendingLeaves.length;
  const totalPendingApprovals = pendingConsCount + pendingLeavesCount;

  // TG Recommendations awaiting HOD sign-off
  const isTgRecommended = (item) => {
    if (!item) return false;
    const status = (item.status || '').toUpperCase();
    const decision = (item.tgReview?.decision || '').toUpperCase();
    return status === 'RECOMMENDED_BY_TG' || decision === 'RECOMMEND';
  };

  const tgRecommendedConsiderations = pendingConsiderations.filter(isTgRecommended);
  const tgRecommendedLeaves = pendingLeaves.filter(isTgRecommended);
  const totalTgRecommendations = tgRecommendedConsiderations.length + tgRecommendedLeaves.length;

  return (
    <div className="flex flex-col gap-6 w-full min-w-0 font-sans">
      {/* =======================================================================
          TOP ROW: HOD Office Greeting & Hero Campus Banner (Side-by-Side on Desktop)
          ======================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Office badge, Greeting & View Consideration button */}
        <div className="lg:col-span-6 flex flex-col justify-between py-1 min-w-0">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900 text-sky-300 text-xs font-extrabold tracking-wide mb-3 shadow-xs border border-blue-700/60">
              <span>🏛️</span>
              <span>HOD Office</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2 m-0">
              <span>{getGreeting()}, {currentUser?.name || 'HOD'}!</span>
              <span className="text-2xl">👋</span>
            </h1>

            <p className="text-sm text-slate-600 font-medium mt-1.5 mb-0">
              Here's what's happening in your CSE department today.
            </p>
          </div>

          {/* Date pill, View Consideration Button & Send Notice Button */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs">
              <Calendar size={15} className="text-blue-600 shrink-0" />
              <span>{currentDate}</span>
              <span className="text-slate-300 font-light">|</span>
              <Clock size={15} className="text-blue-600 shrink-0" />
              <span>{currentTime}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowLedgerModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold transition-all shadow-2xs cursor-pointer group"
            >
              <FileText size={15} className="text-emerald-600 group-hover:scale-110 transition-transform" />
              <span>Attendance Clearances</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSendNoticeModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-600 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-bold transition-all shadow-sm hover:shadow cursor-pointer group"
            >
              <Send size={15} className="text-white group-hover:translate-x-0.5 transition-transform" />
              <span>Send Notice</span>
            </button>
          </div>
        </div>

        {/* Right: OIST Campus Hero Banner */}
        <div className="lg:col-span-6 relative rounded-3xl overflow-hidden shadow-sm border border-slate-200 min-h-[160px] flex flex-col justify-between p-5 sm:p-6 bg-slate-900 text-white group">
          {/* LCP High-Priority Banner Image */}
          <img
            src="/oriental.png"
            alt="Oriental Institute of Science and Technology Campus"
            fetchpriority="high"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-none"
            style={{ objectPosition: 'center 40%' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/70 to-slate-950/30 pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4 w-full min-w-0">
            <div className="max-w-xs">
              <p className="text-sm sm:text-base font-serif italic text-white/95 leading-snug drop-shadow-xs m-0">
                "Better systems, <br />
                Better education."
              </p>
              <p className="text-xs sm:text-sm text-sky-300 font-semibold mt-1 drop-shadow-xs m-0">
                — OIST CSE
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =======================================================================
          MIDDLE ROW: 6 Key Stat & Action Cards
          ======================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Pending Approvals - Opens Pending Approvals Queue Modal matching Image 1 */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowPendingModal(true)}
          onKeyDown={(e) => e.key === 'Enter' && setShowPendingModal(true)}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-rose-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between min-h-[140px] group focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-800">Pending Approvals</span>
            <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200">
              <AlertCircle size={15} />
            </div>
          </div>

          <div className="my-2">
            <span className={`text-3xl font-black block leading-tight ${totalPendingApprovals > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {totalPendingApprovals}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
            <span className={totalPendingApprovals > 0 ? "text-rose-700 font-semibold" : "text-emerald-700 font-semibold"}>
              {totalPendingApprovals > 0 ? `${totalPendingApprovals} requires attention` : "All caught up"}
            </span>
            {totalPendingApprovals > 0 ? (
              <svg
                aria-hidden="true"
                className="w-12 h-3 text-rose-500 overflow-visible"
                viewBox="0 0 48 10"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 5 Q 12 -2, 24 5 T 47 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <span className="text-[11px] font-bold text-emerald-600">✓ Clear</span>
            )}
          </div>
        </div>

        {/* 2. TG Recommendations */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowTgModal(true)}
          onKeyDown={(e) => e.key === 'Enter' && setShowTgModal(true)}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between min-h-[140px] group focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-800">Tg Recommendation</span>
            <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200">
              <ShieldCheck size={15} />
            </div>
          </div>

          <div className="my-2">
            <span className={`text-3xl font-black block leading-tight ${totalTgRecommendations > 0 ? 'text-indigo-600' : 'text-slate-900'}`}>
              {totalTgRecommendations}
            </span>
          </div>

          <div className="text-xs text-slate-600 font-medium">
            <span className={totalTgRecommendations > 0 ? "text-indigo-700 font-semibold" : "text-emerald-700 font-semibold"}>
              {totalTgRecommendations > 0
                ? `${tgRecommendedConsiderations.length} Cons • ${tgRecommendedLeaves.length} Leaves`
                : 'All clear'}
            </span>
          </div>
        </div>

        {/* 3. Add Faculty */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowAddFacultyModal(true)}
          onKeyDown={(e) => e.key === 'Enter' && setShowAddFacultyModal(true)}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer flex items-center gap-3.5 min-h-[140px] group focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <GraduationCap size={20} />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-extrabold text-slate-900 leading-snug group-hover:text-emerald-700 transition-colors">
              Add Faculty
            </span>
            <span className="block text-xs text-slate-600 font-medium truncate mt-0.5">
              Add faculty member
            </span>
          </div>
        </div>

        {/* 4. Add Student */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowAddStudentModal(true)}
          onKeyDown={(e) => e.key === 'Enter' && setShowAddStudentModal(true)}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer flex items-center gap-3.5 min-h-[140px] group focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <UserPlus size={20} />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-extrabold text-slate-900 leading-snug group-hover:text-blue-700 transition-colors">
              Add Student
            </span>
            <span className="block text-xs text-slate-600 font-medium truncate mt-0.5">
              Register new student
            </span>
          </div>
        </div>

        {/* 5. Manage TGs (matching user handwritten "manages tgs") */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/hod/mentorship')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/hod/mentorship')}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer flex items-center gap-3.5 min-h-[140px] group focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-extrabold text-slate-900 leading-snug group-hover:text-indigo-700 transition-colors">
              Manage TGs
            </span>
            <span className="block text-xs text-slate-600 font-medium truncate mt-0.5">
              Teacher Guardian allocations
            </span>
          </div>
        </div>

        {/* 6. Section Progression (Promote / Demote) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/hod/sections')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/hod/sections')}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-purple-300 hover:shadow-xs transition-all cursor-pointer flex items-center gap-3.5 min-h-[140px] group focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Layers size={20} />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-extrabold text-slate-900 leading-snug group-hover:text-purple-700 transition-colors">
              Section Progression
            </span>
            <span className="block text-xs text-slate-600 font-medium truncate mt-0.5">
              Promote or demote sections
            </span>
          </div>
        </div>
      </div>

      {/* =======================================================================
          MIDDLE-BOTTOM: Semester Distribution & Section Overview (50-50 Split)
          ======================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* CARD 1: Semester Distribution with interactive Pie Chart and structured representation */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-blue-600" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 m-0">
                  Semester Distribution
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowClassesModal(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>View all</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Split layout: Interactive Donut Chart (Left) & Rich Semester Metric Cards (Right) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-4">
              {/* Left 45%: Donut Pie Chart with interactive hover & center stats */}
              <div className="w-full sm:w-[45%] flex items-center justify-center">
                <div className="relative w-40 h-40 sm:w-44 sm:h-44 shrink-0 flex items-center justify-center">
                  <svg
                    role="img"
                    aria-label="Semester enrollment distribution chart"
                    className="w-full h-full transform -rotate-90 drop-shadow-xs"
                    viewBox="0 0 100 100"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#F1F5F9"
                      strokeWidth="12"
                    />
                    {donutSlices.map((slice) => {
                      const isHovered = hoveredSem === slice.sem;
                      return (
                        <circle
                          key={slice.sem}
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke={slice.color}
                          strokeWidth={isHovered ? 15 : 12}
                          strokeDasharray={slice.dashArray}
                          strokeDashoffset={slice.dashOffset}
                          className="transition-all duration-200 cursor-pointer"
                          onMouseEnter={() => setHoveredSem(slice.sem)}
                          onMouseLeave={() => setHoveredSem(null)}
                          onClick={() => setSelectedSemNumber(slice.sem)}
                        />
                      );
                    })}
                  </svg>

                  {/* Inner center text: Dynamic hover feedback or Total enrolled */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
                    {hoveredSemData ? (
                      <>
                        <span className="text-xl sm:text-2xl font-black text-slate-900 leading-none">
                          {hoveredSemData.count}
                        </span>
                        <span className="text-[11px] font-bold text-blue-600 mt-1 truncate max-w-full">
                          {hoveredSemData.label}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {hoveredSemData.pct}% of cohort
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-none tracking-tight">
                          {totalCohortStudents}
                        </span>
                        <span className="text-xs font-bold text-slate-500 mt-1">
                          {totalCohortStudents === 1 ? 'Student' : 'Students'}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          Total Enrolled
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right 55%: Rich structured representation of all 8 semesters */}
              <div className="w-full sm:w-[55%] grid grid-cols-2 gap-2 text-xs">
                {semDistributionWithPct.map((item) => {
                  const isHovered = hoveredSem === item.sem;
                  const isSelected = selectedSemNumber === item.sem;
                  return (
                    <div
                      key={item.sem}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedSemNumber(item.sem)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedSemNumber(item.sem)}
                      onMouseEnter={() => setHoveredSem(item.sem)}
                      onMouseLeave={() => setHoveredSem(null)}
                      title={`Click to view ${item.label} in Section Overview`}
                      className={`p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-400 shadow-2xs'
                          : isHovered
                          ? 'bg-slate-50 border-slate-300 shadow-2xs'
                          : 'bg-white border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1.5 font-bold text-slate-800 truncate text-[11px]">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.label}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-md bg-slate-100 text-[10px] font-black text-slate-700">
                          {item.pct}%
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between mt-1 text-[11px]">
                        <span className="font-extrabold text-slate-900">
                          {item.count}{' '}
                          <span className="text-[10px] font-medium text-slate-400">
                            {item.count === 1 ? 'std' : 'stds'}
                          </span>
                        </span>
                      </div>

                      {/* Mini visual proportional bar */}
                      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(item.pct, item.count > 0 ? 5 : 0)}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>💡 Click any semester to view active sections</span>
              <span className="font-bold text-slate-600">8 Semesters Active</span>
            </div>
          </div>
        </div>

        {/* CARD 2: Section Overview matching user 'recreate as' design */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-blue-600 shrink-0" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 m-0">
                  Section Overview <span className="text-xs sm:text-sm text-slate-500 font-semibold">(CSE Only)</span>
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
                  <label htmlFor="hod-semester-select">Sem</label>
                  <select
                    id="hod-semester-select"
                    aria-label="Filter sections by semester"
                    value={selectedSemNumber || ''}
                    onChange={(e) => setSelectedSemNumber(Number(e.target.value))}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs focus:outline-none cursor-pointer"
                  >
                    {availableSemesters.map((sem) => (
                      <option key={sem} value={sem}>
                        Sem {sem}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/hod/sections')}
                  className="text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  title="Open Section Progression management to promote or demote sections"
                >
                  <Layers size={13} />
                  <span>Promote / Demote</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetSec = visibleSections[0];
                    if (targetSec) openSectionDetails(targetSec);
                  }}
                  disabled={visibleSections.length === 0}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>View details</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-3.5 py-4">
              {visibleSections.map((section, index) => {
                const cardStyles = [
                  'bg-[#EEF5FF] border-[#DCE8F9] text-blue-500',
                  'bg-[#F5F0FF] border-[#EADBFF] text-purple-500',
                  'bg-[#EFFAF3] border-[#D6F5E3] text-emerald-500',
                  'bg-[#FFF6EA] border-[#FEE8CC] text-amber-500',
                ][index % 4];
                const secLetter = getSectionLetter(section);
                const displaySecCode = secLetter ? `CSE-${secLetter}` : (section.code || section.name);

                return (
                  <div
                    key={section._id}
                    role="button"
                    tabIndex={0}
                    aria-label={`View section ${displaySecCode} details`}
                    onClick={() => openSectionDetails(section)}
                    onKeyDown={(e) => e.key === 'Enter' && openSectionDetails(section)}
                    className={`py-4 px-3 rounded-2xl border hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer flex flex-col items-center justify-between text-center min-h-[165px] ${cardStyles}`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center">
                      <Users size={17} />
                    </div>
                    <div className="my-1.5">
                      <span className="block text-xs sm:text-sm font-bold text-slate-800">
                        {displaySecCode}
                      </span>
                      <span className="block text-2xl font-black text-slate-900 leading-tight mt-1">
                        {section.studentCount}
                        <span className="text-xs font-bold text-slate-400"> / {section.capacity || 60}</span>
                      </span>
                      <span className="block text-[11px] text-slate-600 font-bold mt-0.5">Students (Quota)</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white text-emerald-600 border border-slate-200/90 text-[11px] font-bold shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>Active</span>
                    </span>

                    {/* Quick Promote & Demote controls directly on section card */}
                    <div
                      className="w-full pt-2 mt-2 border-t border-slate-200/60 flex items-center justify-between gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={Number(section.semester || selectedSemNumber) <= 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMoveModalData({ section, direction: 'prev' });
                        }}
                        className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-bold border flex items-center justify-center gap-0.5 transition-all ${
                          Number(section.semester || selectedSemNumber) <= 1
                            ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 cursor-pointer shadow-2xs hover:border-slate-400'
                        }`}
                        title={Number(section.semester || selectedSemNumber) <= 1 ? 'Minimum semester' : `Demote to Semester ${Number(section.semester || selectedSemNumber) - 1}`}
                      >
                        <span>◀ Sem {Number(section.semester || selectedSemNumber) - 1}</span>
                      </button>

                      <button
                        type="button"
                        disabled={Number(section.semester || selectedSemNumber) >= 8}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMoveModalData({ section, direction: 'next' });
                        }}
                        className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-bold border flex items-center justify-center gap-0.5 transition-all ${
                          Number(section.semester || selectedSemNumber) >= 8
                            ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700 cursor-pointer shadow-2xs'
                        }`}
                        title={Number(section.semester || selectedSemNumber) >= 8 ? 'Maximum semester' : `Promote to Semester ${Number(section.semester || selectedSemNumber) + 1}`}
                      >
                        <span>Sem {Number(section.semester || selectedSemNumber) + 1} ▶</span>
                      </button>
                    </div>
                  </div>
                );
              })}
              {visibleSections.length === 0 && (
                <div className="col-span-full py-10 text-center text-sm text-slate-500">
                  No sections are available for this semester.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* =======================================================================
          BOTTOM ROW: Notice Board (Full Width)
          ======================================================================= */}
      <div className="w-full">
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-rose-500" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 m-0">
                  Notice Board
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                  Official Circulars ({notices.length})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSendNoticeModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  <Send size={13} />
                  <span>Send Notice</span>
                </button>
              </div>
            </div>

            {/* List of Notices or Empty State */}
            {notices.length > 0 ? (
              <div className="hod-notices-list mt-3.5 space-y-2">
                {notices.map((notice) => {
                  const isUrgent = notice.priority === 'URGENT';
                  const isHigh = notice.priority === 'HIGH';
                  return (
                    <div
                      key={notice._id}
                      className="hod-notice-row flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition-all gap-3"
                    >
                      <div className="hod-notice-left flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                            isUrgent
                              ? 'bg-rose-50 border-rose-200 text-rose-600'
                              : isHigh
                              ? 'bg-amber-50 border-amber-200 text-amber-600'
                              : 'bg-blue-50 border-blue-200 text-blue-600'
                          }`}
                        >
                          <Megaphone size={16} />
                        </div>
                        <div className="hod-notice-meta flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="hod-notice-title text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {notice.title}
                            </span>
                            {isUrgent && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-100 text-rose-700 uppercase">
                                Urgent
                              </span>
                            )}
                          </div>
                          <span className="hod-notice-sub text-xs text-slate-600 font-medium truncate mt-0.5">
                            {notice.content}
                          </span>
                        </div>
                      </div>

                      <div className="hod-notice-right flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-200/70 text-slate-700 text-[10px] font-bold">
                          {notice.category}
                        </span>
                        <span className="hod-notice-date text-xs text-slate-600 font-bold hidden sm:inline-block">
                          {new Date(notice.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNotice(notice._id);
                          }}
                          title="Delete notice"
                          aria-label="Delete notice"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center flex flex-col items-center justify-center">
                <p className="text-sm font-extrabold text-slate-800 m-0">
                  No official notices published yet
                </p>
                <p className="text-xs text-slate-600 font-medium m-0 mt-1 max-w-xs">
                  Broadcast departmental circulars, exam schedules, and alerts directly to students and faculty.
                </p>
                <button
                  type="button"
                  onClick={() => setShowSendNoticeModal(true)}
                  className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all cursor-pointer border border-blue-200"
                >
                  <Send size={14} />
                  <span>Send First Notice</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =======================================================================
          MODALS (Lazy-loaded on demand)
          ======================================================================= */}
      <Suspense fallback={null}>
        {showLedgerModal && (
          <OfficialClearancesLedgerModal
            initialTab="considerations"
            onClose={() => setShowLedgerModal(false)}
          />
        )}

        {showSectionModal && (
          <SectionOverviewModal
            initialSection={sectionModalTarget?.section || 'B'}
            initialSemester={sectionModalTarget?.semester || selectedSemNumber || 5}
            onClose={() => setShowSectionModal(false)}
            onOpenClassesCentral={() => {
              setShowSectionModal(false);
              setShowClassesModal(true);
            }}
          />
        )}

        {showClassesModal && (
          <ClassesCurriculumModal
            onClose={() => setShowClassesModal(false)}
            onUpdated={() => fetchDashboardData()}
          />
        )}

        {showAddFacultyModal && (
          <AddFacultyModal
            onClose={() => setShowAddFacultyModal(false)}
            onSuccess={() => {
              setShowAddFacultyModal(false);
              fetchDashboardData();
              addToast('Faculty Added', 'New faculty member enrolled successfully.', 'success');
            }}
          />
        )}

        {showAddStudentModal && (
          <AddStudentModal
            onClose={() => setShowAddStudentModal(false)}
            onSuccess={() => {
              setShowAddStudentModal(false);
              fetchDashboardData();
              addToast('Student Added', 'New student registered successfully.', 'success');
            }}
          />
        )}

        {/* Pending Approvals Queue Modal matching Image 1 */}
        {showPendingModal && (
          <PendingApprovalsModal
            pendingRequests={[...pendingConsiderations, ...pendingLeaves]}
            onClose={() => setShowPendingModal(false)}
            onGoToRequestsCentral={(item) => {
              setShowPendingModal(false);
              navigate('/hod/considerations', { state: { targetRequestId: item?._id } });
            }}
          />
        )}

        {/* TG Recommendations Queue Modal (Consideration & Leave Categories) */}
        {showTgModal && (
          <TgRecommendationsModal
            considerations={pendingConsiderations}
            leaves={pendingLeaves}
            onClose={() => setShowTgModal(false)}
          />
        )}

        {showSendNoticeModal && (
          <SendNoticeModal
            onClose={() => setShowSendNoticeModal(false)}
            onSuccess={(newNotice) => {
              if (newNotice) {
                setNotices((prev) => [newNotice, ...prev]);
              } else {
                fetchDashboardData();
              }
            }}
          />
        )}

        {/* Move Semester Confirmation Modal */}
        {moveModalData && (
          <MoveSemesterModal
            section={moveModalData.section}
            direction={moveModalData.direction}
            onClose={() => setMoveModalData(null)}
            onSuccess={() => {
              setMoveModalData(null);
              fetchDashboardData();
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
