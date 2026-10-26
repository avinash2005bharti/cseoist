import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import { dashboardApi, considerationApi, leaveApi, masterDataApi, noticeApi } from '../../api';
import { getSectionLetter } from '../../utils/constants.js';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  Clock3,
  AlertCircle,
  Users,
  GraduationCap,
  UserPlus,
  Shield,
  ShieldCheck,
  ArrowRight,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  Send,
  Megaphone,
  Trash2,
  Layers,
  Layers3,
  Landmark,
  Building2,
} from 'lucide-react';

import { lazyWithRetry } from '../../utils/lazyWithRetry.js';
import './Screen-9.screen.css';

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

  // Selected Section Overview Semester (default to Semester 5 matching Screen 9)
  const [selectedSemNumber, setSelectedSemNumber] = useState(5);

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
    const handleSectionChange = (e) => {
      fetchDashboardData();
      if (e?.detail?.semester) {
        setSelectedSemNumber(Number(e.detail.semester));
      }
    };
    window.addEventListener('campusflow_queue_changed', handleQueueChange);
    window.addEventListener('campusflow_sections_changed', handleSectionChange);

    // Live real-time polling every 6 seconds to guarantee fresh queue counters and section updates
    const pollInterval = setInterval(() => {
      fetchDashboardData();
    }, 6000);

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('open_ledger') === 'true') {
      setShowLedgerModal(true);
    }

    return () => {
      window.removeEventListener('campusflow_queue_changed', handleQueueChange);
      window.removeEventListener('campusflow_sections_changed', handleSectionChange);
      clearInterval(pollInterval);
    };
  }, []);

  const isAllSemesters = selectedSemNumber === 'ALL' || selectedSemNumber === 'All Semesters';

  const availableSemesters = [1, 2, 3, 4, 5, 6, 7, 8];

  const realAcademicYears = [...new Set(
    students
      .map((student) => student.mentorGroup?.academicYear)
      .filter(Boolean)
  )].sort();

  useEffect(() => {
    if (selectedSemNumber === null && sections.length > 0) {
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
    return students.filter((s) => {
      const sectionId = s.section?._id || s.section;
      return String(sectionId) === String(section._id);
    }).length;
  };

  const [hoveredSem, setHoveredSem] = useState(null);

  const visibleSections = sections
    .filter((section) => {
      if (isAllSemesters) return true;
      return Number(section.semester) === Number(selectedSemNumber);
    })
    .map((section) => ({ ...section, studentCount: getSectionStudentCount(section) }));

  const openSectionDetails = (section) => {
    setSectionModalTarget({
      section: getSectionLetter(section) || 'B',
      semester: Number(selectedSemNumber && selectedSemNumber !== 'ALL' ? selectedSemNumber : section.semester || 5),
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

  // Real semester distribution calculation based strictly on enrolled students in the database
  const totalStudents = students.length;
  const semesterColors = [
    { sem: 1, label: '1st Sem', color: '#4F46E5', barColor: '#4F46E5' },
    { sem: 2, label: '2nd Sem', color: '#06B6D4', barColor: '#06B6D4' },
    { sem: 3, label: '3rd Sem', color: '#F59E0B', barColor: '#F59E0B' },
    { sem: 4, label: '4th Sem', color: '#F97316', barColor: '#F97316' },
    { sem: 5, label: '5th Sem', color: '#EC4899', barColor: '#EC4899' },
    { sem: 6, label: '6th Sem', color: '#8B5CF6', barColor: '#8B5CF6' },
    { sem: 7, label: '7th Sem', color: '#10B981', barColor: '#10B981' },
    { sem: 8, label: '8th Sem', color: '#2563EB', barColor: '#2563EB' },
  ];

  const semDistribution = semesterColors.map((sc) => {
    const realCount = students.filter(
      (s) => Number(s.semester || s.section?.semester) === sc.sem
    ).length;
    return { ...sc, count: realCount };
  });

  const totalCohortStudents = semDistribution.reduce((acc, curr) => acc + curr.count, 0) || students.length;

  const semDistributionWithPct = semDistribution.map((sc) => ({
    ...sc,
    pct: totalCohortStudents > 0 ? Math.round((sc.count / totalCohortStudents) * 100) : 0,
  }));

  // Calculate SVG donut slices strictly from active semester data with distinct colors
  const circumference = 2 * Math.PI * 38; // ≈ 238.761
  let runningOffset = 0;
  const donutSlices = semDistributionWithPct.map((item) => {
    const fraction = totalCohortStudents > 0 ? item.count / totalCohortStudents : 0;
    const sliceLength = fraction * circumference;
    const offset = -runningOffset;
    runningOffset += sliceLength;
    const dashArray = `${sliceLength} ${circumference - sliceLength}`;
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

  const sectionsToDisplay = visibleSections;

  return (
    <div data-appearance="light" className="w-full min-w-0">
      <div className="flex flex-col gap-6 sm:gap-8 w-full max-w-7xl mx-auto font-sans">
        {/* =======================================================================
            TOP ROW: HOD Office Greeting & Hero Campus Banner (Side-by-Side on Desktop)
            ======================================================================= */}
        <section className="hod-hero-grid">
          {/* Left Card: Office badge, Greeting & Action buttons */}
          <div className="hod-card flex p-4 sm:p-8 flex-col justify-between gap-5 sm:gap-6 min-w-0 max-w-full">
            <div>
              <span className="font-bold rounded-md bg-[#EEF2FF] text-[#1D4ED8] text-xs inline-flex px-3 py-1.5 items-center gap-2 border border-[#DBEAFE]">
                <Building2 className="size-3.5 text-[#2563EB]" />
                <span>HOD Office</span>
              </span>
              <h1 className="font-black text-3xl sm:text-4xl tracking-tight mt-5 text-[#0F172A]">
                {getGreeting()}, {currentUser?.name || 'Hod cse'}! 👋
              </h1>
              <p className="text-[#64748B] text-sm sm:text-base mt-2.5 font-normal">
                Here's what's happening in your CSE department today.
              </p>
            </div>

            {/* Desktop Action Controls (Screen 9) */}
            <div className="hidden sm:flex flex-wrap items-center gap-2.5 mt-auto pt-2">
              <div className="font-medium rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm text-[#64748B] flex px-3.5 py-2.5 items-center gap-2.5 shadow-2xs shrink-0">
                <CalendarDays className="text-[#2563EB] size-4 shrink-0" />
                <span>{currentDate}</span>
                <span className="bg-[#E2E8F0] w-px h-3.5" />
                <Clock3 className="text-[#2563EB] size-4 shrink-0" />
                <span>{currentTime}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowLedgerModal(true)}
                className="hod-btn-clearances-highlight"
                title="View & Export Approved Attendance Clearances Ledger"
              >
                <FileText className="size-4 shrink-0" />
                <span>Attendance Clearances</span>
                <span className="clearances-badge">
                  Official Ledger
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowSendNoticeModal(true)}
                className="hod-btn-send-notice"
              >
                <Send className="size-4 text-white shrink-0" />
                <span>Send Notice</span>
              </button>
            </div>

            {/* Mobile Action Controls (Screen 10) */}
            <div className="hod-mobile-action-bar sm:hidden">
              <div className="hod-datetime-pill">
                <div className="flex items-center gap-2">
                  <CalendarDays className="text-[#2563EB] size-4" />
                  <span>{currentDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 className="text-[#2563EB] size-4" />
                  <span>{currentTime}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowLedgerModal(true)}
                className="hod-btn-outline"
              >
                <FileText className="text-[#2563EB] size-4" />
                <span>Attendance Clearances</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSendNoticeModal(true)}
                className="hod-btn-primary"
              >
                <Send className="size-4 text-white" />
                <span>Send Notice</span>
              </button>
            </div>

            {/* Mobile Campus Banner matching Screen 10 */}
            <div className="hod-hero-image-box flex lg:hidden">
              <img
                src="https://images.unsplash.com/photo-1680084521816-cc1ad0433ceb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3ODc2NDd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBJbmRpYW4lMjBlbmdpbmVlcmluZyUyMGNvbGxlZ2UlMjBjYW1wdXMlMjBidWlsZGluZyUyMGV4dGVyaW9yfGVufDF8MHx8fDE3OTI4NTE3MTZ8MA&ixlib=rb-4.1.0&q=80&w=1080"
                onError={(e) => { e.currentTarget.src = '/campus_building.jpg'; }}
                alt="Oriental Institute of Science and Technology campus"
              />
              <div className="bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent flex absolute inset-0 p-4 items-end">
                <p className="font-bold text-white text-sm leading-snug">
                  Better systems, Better education. — OIST CSE
                </p>
              </div>
            </div>
          </div>

          {/* Right Hero Banner Card - Desktop Gradient matching Screen 9 */}
          <div className="hod-desktop-banner hidden lg:flex">
            <div className="hod-banner-stripes">
              <div className="stripe-purple" />
              <div className="stripe-cyan" />
              <div className="stripe-amber" />
            </div>
            <div className="flex relative p-8 flex-col justify-between h-full pt-10">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 flex justify-center items-center text-white">
                  <Landmark className="size-6 text-white" />
                </div>
                <span className="font-extrabold uppercase text-white/95 text-xs tracking-widest">
                  OIST CSE
                </span>
              </div>
              <p className="font-bold text-white text-2xl lg:text-3xl leading-tight max-w-md drop-shadow-xs">
                Better systems, Better education. — OIST CSE
              </p>
            </div>
          </div>
        </section>

        {/* =======================================================================
            MIDDLE ROW: 6 Key Stat & Quick Action Cards (Screen 9 & 10)
            ======================================================================= */}
        <section className="hod-kpi-grid">
          {/* 1. Pending Approvals */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowPendingModal(true)}
            onKeyDown={(e) => e.key === 'Enter' && setShowPendingModal(true)}
            className="hod-action-card p-4 sm:p-5 flex flex-col justify-between min-h-[135px] sm:min-h-[145px] cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <div className="flex justify-between items-start">
              <p className="font-bold text-sm text-[#0F172A]">Pending Approvals</p>
              <div className="size-9 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-[#E11D48] shrink-0">
                <AlertCircle className="size-5" />
              </div>
            </div>
            <p className="font-black text-[#E11D48] text-3xl sm:text-4xl mt-3 sm:mt-4 leading-none">
              {totalPendingApprovals}
            </p>
            <p className="text-[#64748B] text-xs mt-1.5 truncate">
              {totalPendingApprovals} requires attention
            </p>
          </div>

          {/* 2. TG Recommendation */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate('/hod/tg-recommendations')}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/hod/tg-recommendations')}
            className="hod-action-card p-4 sm:p-5 flex flex-col justify-between min-h-[135px] sm:min-h-[145px] cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <div className="flex justify-between items-start">
              <p className="font-bold text-sm text-[#0F172A]">TG Recommendation</p>
              <div className="size-9 rounded-lg bg-[#EEF2FF] border border-[#DBEAFE] flex items-center justify-center text-[#2563EB] shrink-0 group-hover:scale-105 transition-transform">
                <ShieldCheck className="size-5" />
              </div>
            </div>
            <p className="font-black text-[#2563EB] text-3xl sm:text-4xl mt-3 sm:mt-4 leading-none">
              {totalTgRecommendations}
            </p>
            <p className="text-[#64748B] text-xs mt-1.5 truncate">
              {tgRecommendedConsiderations.length} Cons • {tgRecommendedLeaves.length} Leaves
            </p>
          </div>

          {/* 3. Add Faculty */}
          <button
            type="button"
            onClick={() => setShowAddFacultyModal(true)}
            className="hod-action-card text-left p-4 sm:p-5 flex flex-col justify-between items-start min-h-[135px] sm:min-h-[145px] cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <div className="size-9 rounded-lg bg-[#CFF4FC] border border-[#A5F3FC] flex items-center justify-center text-[#0284C7] shrink-0 group-hover:scale-105 transition-transform">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#0F172A]">Add Faculty</p>
              <p className="text-[#64748B] text-xs mt-1">Add faculty member</p>
            </div>
          </button>

          {/* 4. Add Student */}
          <button
            type="button"
            onClick={() => setShowAddStudentModal(true)}
            className="hod-action-card text-left p-4 sm:p-5 flex flex-col justify-between items-start min-h-[135px] sm:min-h-[145px] cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <div className="size-9 rounded-lg bg-[#CFF4FC] border border-[#A5F3FC] flex items-center justify-center text-[#0284C7] shrink-0 group-hover:scale-105 transition-transform">
              <UserPlus className="size-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#0F172A]">Add Student</p>
              <p className="text-[#64748B] text-xs mt-1">Register new student</p>
            </div>
          </button>

          {/* 5. Manage TGs */}
          <button
            type="button"
            onClick={() => navigate('/hod/mentorship')}
            className="hod-action-card text-left p-4 sm:p-5 flex flex-col justify-between items-start min-h-[135px] sm:min-h-[145px] cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <div className="size-9 rounded-lg bg-[#EEF2FF] border border-[#E0E7FF] flex items-center justify-center text-[#4F46E5] shrink-0 group-hover:scale-105 transition-transform">
              <Shield className="size-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#0F172A]">Manage TGs</p>
              <p className="text-[#64748B] text-xs mt-1">Teacher Guardian allocations</p>
            </div>
          </button>

          {/* 6. Section Progression */}
          <button
            type="button"
            onClick={() => navigate('/hod/sections')}
            className="hod-action-card text-left p-4 sm:p-5 flex flex-col justify-between items-start min-h-[135px] sm:min-h-[145px] cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <div className="size-9 rounded-lg bg-[#F3E8FF] border border-[#E9D5FF] flex items-center justify-center text-[#9333EA] shrink-0 group-hover:scale-105 transition-transform">
              <Layers className="size-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#0F172A]">Section Progression</p>
              <p className="text-[#64748B] text-xs mt-1">Promote or demote sections</p>
            </div>
          </button>
        </section>

        {/* =======================================================================
            BOTTOM ROW: Semester Distribution & Section Overview (50-50 Split)
            ======================================================================= */}
        <section className="hod-bottom-grid">
          {/* CARD 1: Semester Distribution */}
          <div className="hod-card p-4 sm:p-6 flex flex-col justify-between min-w-0 max-w-full overflow-hidden">
            <div>
              <div className="flex justify-between items-center gap-4 pb-4 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-3">
                  <CalendarDays className="text-[#2563EB] size-5" />
                  <h2 className="font-bold text-lg text-[#0F172A] m-0">Semester Distribution</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClassesModal(true)}
                  className="font-semibold text-[#2563EB] text-sm hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>View all →</span>
                </button>
              </div>

              {/* Body: Donut Chart on Left, 8 Semester Cards on Right */}
              <div className="hod-distribution-layout mt-6">
                {/* Donut Chart */}
                <div className="flex flex-col justify-center items-center">
                  <div className="relative size-48 shrink-0 flex items-center justify-center">
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
                        strokeWidth="11"
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
                            strokeWidth={isHovered ? 14 : 11}
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

                    {/* Donut Center */}
                    <div className="hod-donut-center">
                      <span className="hod-donut-count">
                        {hoveredSemData ? hoveredSemData.count : totalCohortStudents}
                      </span>
                      <span className="hod-donut-label">
                        {hoveredSemData ? `${hoveredSemData.label} Enrolled` : 'Total Students Enrolled'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 8 Semester Cards in 2 columns matching Screen 9 */}
                <div className="grid gap-2.5 sm:gap-3 grid-cols-2 min-w-0">
                  {semDistributionWithPct.map((item) => {
                    const isSelected = selectedSemNumber === item.sem;
                    const isHovered = hoveredSem === item.sem;
                    return (
                      <div
                        key={item.sem}
                        role="button"
                        tabIndex={0}
                        onMouseEnter={() => setHoveredSem(item.sem)}
                        onMouseLeave={() => setHoveredSem(null)}
                        onClick={() => setSelectedSemNumber(item.sem)}
                        onKeyDown={(e) => e.key === 'Enter' && setSelectedSemNumber(item.sem)}
                        className={`hod-sem-card p-3 cursor-pointer transition-all ${
                          isSelected ? 'selected' : ''
                        } ${isHovered ? 'ring-2 ring-[#2563EB]/40 bg-[#EEF2FF]' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {/* Color indicator dot representing which color in the chart belongs to this sem */}
                            <span
                              className="hod-sem-color-dot"
                              style={{ backgroundColor: item.color }}
                              title={`Chart color for ${item.label}`}
                            />
                            <p className="font-bold text-xs text-[#0F172A] truncate">{item.label}</p>
                          </div>
                          <span
                            className="hod-sem-pct-pill"
                            style={{
                              backgroundColor: `${item.color}18`,
                              color: item.color,
                              border: `1px solid ${item.color}33`,
                            }}
                          >
                            {item.pct ?? 0}%
                          </span>
                        </div>
                        <p className="font-black text-lg mt-1 text-[#0F172A] leading-none">{item.count}</p>
                        <div className="w-full bg-slate-200/60 rounded-full h-1 mt-2.5 overflow-hidden">
                          <div
                            className="h-1 rounded-full transition-all duration-300"
                            style={{
                              width: item.count > 0 ? `${Math.max(item.pct, 20)}%` : '15%',
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: Section Overview (CSE Only) matching Screen 9 */}
          <div className="hod-card p-4 sm:p-6 flex flex-col justify-between min-w-0 max-w-full overflow-hidden">
            <div>
              <div className="flex flex-wrap justify-between items-center gap-4 pb-4 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-3">
                  <Users className="text-[#2563EB] size-5" />
                  <h2 className="font-bold text-lg text-[#0F172A] m-0">
                    Section Overview (CSE Only)
                  </h2>
                </div>

                {/* Desktop Controls (Screen 9) */}
                <div className="hidden sm:flex items-center gap-2.5">
                  <label htmlFor="hod-sem-select" className="font-semibold text-[#64748B] text-xs">
                    Sem
                  </label>
                  <select
                    id="hod-sem-select"
                    value={isAllSemesters ? 'All Semesters' : (selectedSemNumber ? `Sem ${selectedSemNumber}` : 'Sem 5')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'All Semesters' || val === 'ALL') {
                        setSelectedSemNumber('ALL');
                      } else {
                        const semNum = Number(val.replace('Sem ', ''));
                        setSelectedSemNumber(semNum);
                      }
                    }}
                    className="font-bold rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-[#1D4ED8] shadow-2xs hover:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 cursor-pointer w-32"
                  >
                    <option value="All Semesters">All Semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={`Sem ${s}`}>
                        Sem {s}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowClassesModal(true)}
                    className="font-semibold rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-[#0F172A] hover:bg-slate-50 cursor-pointer transition-colors shadow-2xs"
                  >
                    Promote / Demote
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const target = visibleSections[0];
                      if (target) openSectionDetails(target);
                      else {
                        setSectionModalTarget({ section: 'B', semester: Number(selectedSemNumber && selectedSemNumber !== 'ALL' ? selectedSemNumber : 5) });
                        setShowSectionModal(true);
                      }
                    }}
                    className="font-semibold text-[#2563EB] text-sm hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>View details →</span>
                  </button>
                </div>

                {/* Mobile View Details Button */}
                <button
                  type="button"
                  onClick={() => {
                    const target = visibleSections[0];
                    if (target) openSectionDetails(target);
                    else {
                      setSectionModalTarget({ section: 'B', semester: Number(selectedSemNumber && selectedSemNumber !== 'ALL' ? selectedSemNumber : 5) });
                      setShowSectionModal(true);
                    }
                  }}
                  className="sm:hidden font-semibold text-[#2563EB] text-sm hover:underline cursor-pointer"
                >
                  View details →
                </button>
              </div>

              {/* Mobile Controls below header (Screen 10) */}
              <div className="flex sm:hidden flex-col gap-2 mt-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="hod-sem-select-mobile" className="font-semibold text-[#64748B] text-xs shrink-0">
                    Sem
                  </label>
                  <select
                    id="hod-sem-select-mobile"
                    value={isAllSemesters ? 'All Semesters' : (selectedSemNumber ? `Sem ${selectedSemNumber}` : 'Sem 5')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'All Semesters' || val === 'ALL') {
                        setSelectedSemNumber('ALL');
                      } else {
                        const semNum = Number(val.replace('Sem ', ''));
                        setSelectedSemNumber(semNum);
                      }
                    }}
                    className="font-bold rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#1D4ED8] shadow-2xs hover:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 cursor-pointer w-full min-h-[44px]"
                  >
                    <option value="All Semesters">All Semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={`Sem ${s}`}>
                        Sem {s}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowClassesModal(true)}
                  className="font-semibold rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F172A] hover:bg-slate-50 cursor-pointer transition-colors shadow-2xs min-h-[44px] w-full"
                >
                  Promote / Demote
                </button>
              </div>

              {/* Section Cards in 2-column Grid matching Screen 9 & Screen 10 */}
              {sectionsToDisplay.length > 0 ? (
                <div className="hod-section-grid mt-6">
                  {sectionsToDisplay.map((section) => {
                    const secLetter = getSectionLetter(section);
                    const displaySecCode = secLetter ? `CSE-${secLetter}` : (section.code || section.name || 'CSE-A');

                    return (
                      <div
                        key={section._id || section.code}
                        role="button"
                        tabIndex={0}
                        onClick={() => openSectionDetails(section)}
                        onKeyDown={(e) => e.key === 'Enter' && openSectionDetails(section)}
                        className="hod-section-card p-4 sm:p-5 transition-all cursor-pointer shadow-2xs group"
                      >
                        <div className="flex justify-between items-center">
                          <p className="font-bold text-base text-[#0F172A] m-0">{displaySecCode}</p>
                          <span className="hod-active-pill">
                            <span className="hod-active-pill-dot animate-pulse" />
                            <span>Active</span>
                          </span>
                        </div>
                        <p className="font-black text-2xl mt-4 sm:mt-5 text-[#0F172A] m-0 leading-none">
                          {section.studentCount}
                          <span className="font-medium text-[#64748B] text-sm">
                            {' '}/ {section.capacity || 60}
                          </span>
                        </p>
                        <p className="text-[#64748B] text-xs mt-1.5 m-0 font-medium">
                          Students (Quota)
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-6 py-10 flex flex-col items-center justify-center text-center p-6 rounded-lg bg-slate-50/50 border border-dashed border-[#E2E8F0]">
                  <Users className="size-8 text-[#94A3B8] mb-2" />
                  <p className="font-semibold text-sm text-[#0F172A] m-0">
                    {isAllSemesters ? 'No sections found' : `No sections found for Semester ${selectedSemNumber}`}
                  </p>
                  <p className="text-[#64748B] text-xs mt-1 m-0">Create or allocate sections from the Section Progression panel.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Notice Board Section (Always visible for HOD official circular management) */}
        <section className="w-full">
          <div className="hod-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2">
                  <Megaphone size={18} className="text-[#2563EB]" />
                  <h2 className="text-sm sm:text-base font-extrabold text-[#0F172A] m-0">
                    Notice Board
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-[#EEF2FF] text-[#1D4ED8] text-[10px] font-bold">
                    Official Circulars ({notices.length})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSendNoticeModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    <Send size={13} />
                    <span>Send Notice</span>
                  </button>
                </div>
              </div>

              {notices.length > 0 ? (
                <div className="hod-notices-list mt-3.5 space-y-2">
                  {notices.map((notice) => {
                    const isUrgent = notice.priority === 'URGENT';
                    const isHigh = notice.priority === 'HIGH';
                    return (
                      <div
                        key={notice._id}
                        className="hod-notice-row flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] hover:bg-white border border-[#E2E8F0] hover:border-[#93C5FD] hover:shadow-xs transition-all gap-3"
                      >
                        <div className="hod-notice-left flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                              isUrgent
                                ? 'bg-rose-50 border-rose-200 text-rose-600'
                                : isHigh
                                ? 'bg-amber-50 border-amber-200 text-amber-600'
                                : 'bg-blue-50 border-blue-200 text-[#2563EB]'
                            }`}
                          >
                            <Megaphone size={16} />
                          </div>
                          <div className="hod-notice-meta flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="hod-notice-title text-xs sm:text-sm font-bold text-[#0F172A] truncate">
                                {notice.title}
                              </span>
                              {isUrgent && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-100 text-rose-700 uppercase">
                                  Urgent
                                </span>
                              )}
                            </div>
                            <span className="hod-notice-sub text-xs text-[#64748B] font-medium truncate mt-0.5">
                              {notice.content}
                            </span>
                          </div>
                        </div>

                        <div className="hod-notice-right flex items-center gap-2 shrink-0">
                          <span className="px-2.5 py-1 rounded-md bg-[#EEF2FF] text-[#1D4ED8] text-[10px] font-bold">
                            {notice.category}
                          </span>
                          <span className="hod-notice-date text-xs text-[#64748B] font-bold hidden sm:inline-block">
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
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
                    <Megaphone size={22} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">No official circulars published yet</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Notice board service is active. Broadcast notices and official announcements to department faculty, TGs, and students.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSendNoticeModal(true)}
                    className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Send size={14} />
                    <span>Send Notice</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
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
