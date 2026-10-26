import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import { dashboardApi, considerationApi, leaveApi, notificationApi } from '../../api';
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock,
  Clock3,
  ExternalLink,
  FileText,
  Plus,
  PlusCircle,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
} from 'lucide-react';
import { DocumentUploader } from '../../components/common';
import FormalApplicationModal from '../../components/modals/FormalApplicationModal.jsx';
import './Screen-3.screen.css';

const StudentAccountSettingsModal = lazy(() => import('../../components/modals/StudentAccountSettingsModal.jsx'));

// Helper to format date cleanly like '24 Oct 2026'
function formatDisplayDate(startDate, endDate) {
  if (!startDate) return '—';
  try {
    const parse = (dStr) => {
      if (!dStr) return '';
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      const day = d.getDate();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };
    if (startDate === endDate || !endDate) {
      return parse(startDate);
    }
    return `${parse(startDate)} – ${parse(endDate)}`;
  } catch {
    return startDate;
  }
}

export default function StudentDashboard() {
  const { currentUser, openModal, addToast } = useERP();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [recentConsiderations, setRecentConsiderations] = useState([]);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [showAccountSettingsModal, setShowAccountSettingsModal] = useState(false);
  const [selectedSanction, setSelectedSanction] = useState(null);
  const [windowStatus, setWindowStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab filter for Recent Considerations: 'all' | 'active' | 'completed'
  const [conTab, setConTab] = useState('all');
  const [leaveTab, setLeaveTab] = useState('all');

  // Quick consideration form state (Screen 3 Desktop)
  const [quickEventType, setQuickEventType] = useState('HACKATHON');
  const [quickEventName, setQuickEventName] = useState('');
  const [quickStartDate, setQuickStartDate] = useState('');
  const [quickEndDate, setQuickEndDate] = useState('');
  const [quickPeriods, setQuickPeriods] = useState([]);
  const [quickTimeFrom, setQuickTimeFrom] = useState('10:00 AM');
  const [quickTimeTo, setQuickTimeTo] = useState('04:30 PM');
  const [quickJustification, setQuickJustification] = useState('');
  const [quickAttachment, setQuickAttachment] = useState(null);
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  const quickTimePresets = [
    { label: 'Morning (10:50 AM – 01:20 PM)', from: '10:50 AM', to: '01:20 PM' },
    { label: 'Afternoon (01:40 PM – 04:10 PM)', from: '01:40 PM', to: '04:10 PM' },
    { label: 'Full Day (10:00 AM – 04:30 PM)', from: '10:00 AM', to: '04:30 PM' },
  ];

  const toggleQuickPeriod = (p) => {
    setQuickPeriods((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p].sort((a, b) => a - b)
    );
  };

  const handleQuickReset = () => {
    setQuickEventType('HACKATHON');
    setQuickEventName('');
    setQuickStartDate('');
    setQuickEndDate('');
    setQuickPeriods([]);
    setQuickTimeFrom('10:00 AM');
    setQuickTimeTo('04:30 PM');
    setQuickJustification('');
    setQuickAttachment(null);
  };

  const handleQuickSubmit = async (e) => {
    e.preventDefault();
    if (!quickEventName.trim() || quickEventName.trim().length < 3) {
      addToast('Validation Error', 'Please enter a valid event name (at least 3 characters).', 'danger');
      return;
    }
    if (!quickStartDate || !quickEndDate) {
      addToast('Validation Error', 'Please select both start date and end date.', 'danger');
      return;
    }
    if (quickEndDate < quickStartDate) {
      addToast('Validation Error', 'End date must be the same as or after start date.', 'danger');
      return;
    }
    if (quickPeriods.length === 0) {
      addToast('Validation Error', 'Please select at least one period.', 'danger');
      return;
    }
    if (!quickTimeFrom.trim() || !quickTimeTo.trim()) {
      addToast('Validation Error', 'Please specify both Time From and Time To for lecture schedule.', 'danger');
      return;
    }
    if (!quickJustification.trim() || quickJustification.trim().length < 5) {
      addToast('Validation Error', 'Please provide a justification (at least 5 characters).', 'danger');
      return;
    }

    try {
      setQuickSubmitting(true);
      const payload = {
        applicationType: 'INDIVIDUAL',
        eventTitle: quickEventName.trim(),
        eventType: quickEventType,
        startDate: quickStartDate,
        endDate: quickEndDate,
        requestedPeriods: quickPeriods.length,
        selectedPeriods: quickPeriods.sort((a, b) => a - b).map((p) => `P${p}`),
        periodTiming: `${quickTimeFrom.trim()} - ${quickTimeTo.trim()}`,
        timeFrom: quickTimeFrom.trim(),
        timeTo: quickTimeTo.trim(),
        description: quickJustification.trim(),
        attachments: quickAttachment ? [quickAttachment] : [],
      };

      await considerationApi.create(payload);
      addToast('Application Submitted', 'Your attendance consideration request has been forwarded to your TG for review.', 'success');
      handleQuickReset();
      await fetchData();
      window.dispatchEvent(new CustomEvent('campusflow_refresh_considerations'));
    } catch (err) {
      addToast('Submission Failed', err.response?.data?.message || err.message || 'Unable to submit consideration request.', 'danger');
    } finally {
      setQuickSubmitting(false);
    }
  };

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [sumRes, conRes, leaveRes, winRes] = await Promise.allSettled([
        dashboardApi.getSummary(),
        considerationApi.getMine({ limit: 10 }),
        leaveApi.getMine({ limit: 10 }),
        notificationApi.getConsiderationWindow(),
      ]);

      if (sumRes.status === 'fulfilled') setSummary(sumRes.value?.data || sumRes.value);
      if (conRes.status === 'fulfilled') setRecentConsiderations(conRes.value?.data || []);
      if (leaveRes.status === 'fulfilled') setRecentLeaves(leaveRes.value?.data || []);
      if (winRes.status === 'fulfilled') setWindowStatus(winRes.value?.data || winRes.value);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleRefresh = () => fetchData();
    window.addEventListener('campusflow_refresh_considerations', handleRefresh);
    window.addEventListener('campusflow_refresh_leaves', handleRefresh);
    return () => {
      window.removeEventListener('campusflow_refresh_considerations', handleRefresh);
      window.removeEventListener('campusflow_refresh_leaves', handleRefresh);
    };
  }, []);

  const studentProfile = currentUser?.profile || {};
  const studentName = currentUser?.name || currentUser?.designation || 'Student';
  const enrollmentNo = studentProfile.enrollmentNumber || studentProfile.rollNumber || 'Not provided';
  const sectionName = studentProfile.section?.name || studentProfile.section?.code || 'Section B';
  const semesterNum = studentProfile.section?.semester || studentProfile.semester || 5;
  const tgMentor = studentProfile.mentorGroup?.tg?.user;
  const tgTeacher = studentProfile.mentorGroup?.tg;

  // Counts for KPIs
  const approvedLeavesCount = summary?.leaves?.approved ?? recentLeaves
    .filter((l) => l.status === 'APPROVED_BY_HOD' || l.status === 'APPROVED')
    .length;

  const pendingLeavesCount = summary?.leaves?.pending ?? recentLeaves
    .filter((l) => l.status === 'PENDING' || l.status === 'RECOMMENDED_BY_TG')
    .length;

  const approvedConsiderationsCount = summary?.considerations?.approved ?? recentConsiderations
    .filter((c) => c.status === 'APPROVED_BY_HOD' || c.status === 'APPROVED')
    .length;

  const pendingConsiderationsCount = summary?.considerations?.pending ?? recentConsiderations
    .filter((c) => c.status === 'PENDING' || c.status === 'RECOMMENDED_BY_TG')
    .length;

  const approvedLeaveDays = summary?.leaves?.approvedDays ?? recentLeaves
    .filter((l) => l.status === 'APPROVED_BY_HOD' || l.status === 'APPROVED')
    .reduce((sum, l) => sum + (l.totalDays || 1), 0);

  const approvedLecturesCount = summary?.considerations?.approvedLectures ?? recentConsiderations
    .filter((c) => c.status === 'APPROVED_BY_HOD' || c.status === 'APPROVED')
    .reduce((sum, c) => sum + (c.hodReview?.approvedPeriods ?? c.requestedPeriods ?? 0), 0);

  const pendingLecturesCount = summary?.considerations?.pendingLectures ?? recentConsiderations
    .filter((c) => c.status === 'PENDING' || c.status === 'RECOMMENDED_BY_TG')
    .reduce((sum, c) => sum + (c.requestedPeriods ?? 0), 0);

  // Consideration tab counts
  const conTotal = recentConsiderations.length;
  const conActive = recentConsiderations.filter(
    (c) => c.status === 'PENDING' || c.status === 'RECOMMENDED_BY_TG'
  ).length;
  const conCompleted = recentConsiderations.filter(
    (c) => c.status !== 'PENDING' && c.status !== 'RECOMMENDED_BY_TG'
  ).length;

  const filteredConsiderations = recentConsiderations.filter((c) => {
    if (conTab === 'active') return c.status === 'PENDING' || c.status === 'RECOMMENDED_BY_TG';
    if (conTab === 'completed') return c.status !== 'PENDING' && c.status !== 'RECOMMENDED_BY_TG';
    return true;
  });

  // Leave tab counts
  const leaveTotal = recentLeaves.length;
  const leaveActive = recentLeaves.filter(
    (l) => l.status === 'PENDING' || l.status === 'RECOMMENDED_BY_TG'
  ).length;
  const leaveCompleted = recentLeaves.filter(
    (l) => l.status !== 'PENDING' && l.status !== 'RECOMMENDED_BY_TG'
  ).length;

  const filteredLeaves = recentLeaves.filter((l) => {
    if (leaveTab === 'active') return l.status === 'PENDING' || l.status === 'RECOMMENDED_BY_TG';
    if (leaveTab === 'completed') return l.status !== 'PENDING' && l.status !== 'RECOMMENDED_BY_TG';
    return true;
  });

  return (
    <div className="w-full font-sans text-foreground pb-12 max-w-7xl mx-auto">
      {/* =======================================================================
          1. GREETING ROW (Screen 3: Desktop | Screen 4: Mobile)
          ======================================================================= */}
      <section className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <p className="sm:hidden font-semibold uppercase text-primary text-xs tracking-wide mb-1 m-0">
              Student Workspace
            </p>
            <h1 className="font-bold text-2xl sm:text-3xl tracking-tight text-foreground m-0">
              <span className="hidden sm:inline">Good day, {studentName}</span>
              <span className="sm:hidden">Good day, {studentName.split(' ')[0]}</span>
            </h1>
            <p className="text-muted-foreground text-sm flex mt-1.5 items-center gap-2 flex-wrap m-0">
              <span className="hidden sm:inline-flex items-center gap-2">
                <span>CSE Department</span>
                <span>·</span>
                <span>{sectionName}</span>
                <span>·</span>
                <span>Enrolled</span>
                <span>·</span>
                <span>Semester {semesterNum}</span>
              </span>
              <span className="sm:hidden">
                CSE · {sectionName} · Semester {semesterNum}
              </span>
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowAccountSettingsModal(true)}
              className="rounded-lg border border-border bg-card hover:bg-muted text-foreground text-sm font-medium px-4 py-2 flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Settings2 className="size-4" />
              <span>Account settings</span>
            </button>
            <button
              type="button"
              onClick={fetchData}
              disabled={refreshing}
              className="rounded-lg border border-border bg-card hover:bg-muted text-foreground text-sm font-medium px-4 py-2 flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className={`size-4 ${refreshing ? 'animate-spin text-primary' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </section>

      {/* =======================================================================
          2. TOP 3 PRIMARY ACTION CARDS (Screen 3: 3 cols | Screen 4: 1 col stacked)
          ======================================================================= */}
      <section className="student-action-cards-grid mb-4 sm:mb-6">
        {/* Card 1: Apply for Consideration */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => openModal('REQUEST_CONSIDERATION')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openModal('REQUEST_CONSIDERATION');
            }
          }}
          className="shadow-xs rounded-xl bg-card border border-border hover:border-primary/40 flex p-3.5 sm:p-5 items-center gap-3 sm:gap-4 cursor-pointer transition-all group min-h-12"
        >
          <div className="rounded-lg bg-secondary text-primary flex justify-center items-center size-9 sm:size-11 shrink-0">
            <Sparkles className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate">
              Apply for Consideration
            </div>
            <div className="text-muted-foreground text-xs mt-0.5 sm:mt-1 truncate">
              <span className="hidden sm:inline">24/7 Open</span>
              <span className="sm:hidden">{windowStatus?.isTimeLimitEnabled === false ? '24/7 Open (Testing Mode)' : '24/7 Open'}</span>
            </div>
          </div>
          <ArrowRight className="hidden sm:block text-muted-foreground ml-auto size-4 shrink-0 group-hover:text-foreground transition-colors" />
          <ChevronRight className="sm:hidden text-muted-foreground ml-auto size-4 shrink-0" />
        </div>

        {/* Card 2: Apply for Leave */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => openModal('APPLY_LEAVE')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openModal('APPLY_LEAVE');
            }
          }}
          className="shadow-xs rounded-xl bg-card border border-border hover:border-primary/40 flex p-3.5 sm:p-5 items-center gap-3 sm:gap-4 cursor-pointer transition-all group min-h-12"
        >
          <div className="rounded-lg bg-accent text-accent-foreground flex justify-center items-center size-9 sm:size-11 shrink-0">
            <PlusCircle className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate">
              Apply for Leave
            </div>
            <div className="text-muted-foreground text-xs mt-0.5 sm:mt-1 truncate">
              Medical, personal, or emergency leave
            </div>
          </div>
          <ArrowRight className="hidden sm:block text-muted-foreground ml-auto size-4 shrink-0 group-hover:text-foreground transition-colors" />
          <ChevronRight className="sm:hidden text-muted-foreground ml-auto size-4 shrink-0" />
        </div>

        {/* Card 3: Application History */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/student/requests')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/student/requests');
            }
          }}
          className="shadow-xs rounded-xl bg-card border border-border hover:border-primary/40 flex p-3.5 sm:p-5 items-center gap-3 sm:gap-4 cursor-pointer transition-all group min-h-12"
        >
          <div className="rounded-lg bg-muted text-muted-foreground flex justify-center items-center size-9 sm:size-11 shrink-0">
            <Clock3 className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate">
              Application History
            </div>
            <div className="text-muted-foreground text-xs mt-0.5 sm:mt-1 truncate">
              <span className="hidden sm:inline">View submitted requests</span>
              <span className="sm:hidden">View submitted requests and sanctions</span>
            </div>
          </div>
          <ArrowRight className="hidden sm:block text-muted-foreground ml-auto size-4 shrink-0 group-hover:text-foreground transition-colors" />
          <ChevronRight className="sm:hidden text-muted-foreground ml-auto size-4 shrink-0" />
        </div>
      </section>

      {/* =======================================================================
          3. 4 KPI STAT CARDS (Screen 3: 4 cols | Screen 4: 2x2 grid)
          ======================================================================= */}
      <section className="student-kpi-grid mb-4 sm:mb-6">
        {/* Approved Leaves */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/student/leaves?status=APPROVED')}
          className="shadow-xs rounded-xl bg-card border border-border p-3.5 sm:p-5 cursor-pointer hover:border-border/80 transition-all"
        >
          <div className="flex justify-between items-center sm:items-start">
            <p className="font-semibold uppercase text-muted-foreground text-xs tracking-wider m-0">
              Approved Leaves
            </p>
            <ShieldCheck className="text-primary size-4 sm:size-5 shrink-0" />
          </div>
          <p className="font-bold tabular-nums text-2xl sm:text-3xl mt-2 sm:mt-3 text-foreground m-0">
            {approvedLeavesCount}
          </p>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1 m-0 truncate">
            {approvedLeavesCount > 0 ? `${approvedLeaveDays} Days Sanctioned` : '0 Days Sanctioned'}
          </p>
        </div>

        {/* Pending Leaves */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/student/requests?tab=active')}
          className="shadow-xs rounded-xl bg-card border border-border p-3.5 sm:p-5 cursor-pointer hover:border-border/80 transition-all"
        >
          <div className="flex justify-between items-center sm:items-start">
            <p className="font-semibold uppercase text-muted-foreground text-xs tracking-wider m-0">
              Pending Leaves
            </p>
            <CalendarDays className="text-primary size-4 sm:size-5 shrink-0" />
          </div>
          <p className="font-bold tabular-nums text-2xl sm:text-3xl mt-2 sm:mt-3 text-foreground m-0">
            {pendingLeavesCount}
          </p>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1 m-0 truncate">
            {pendingLeavesCount > 0 ? `${pendingLeavesCount} Pending Leaves` : 'No Pending Leaves'}
          </p>
        </div>

        {/* Approved Lectures */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/student/considerations?status=APPROVED')}
          className="shadow-xs rounded-xl bg-card border border-border p-3.5 sm:p-5 cursor-pointer hover:border-border/80 transition-all"
        >
          <div className="flex justify-between items-center sm:items-start">
            <p className="font-semibold uppercase text-muted-foreground text-xs tracking-wider m-0">
              Approved Lectures
            </p>
            <CircleCheck className="text-primary size-4 sm:size-5 shrink-0" />
          </div>
          <p className="font-bold tabular-nums text-2xl sm:text-3xl mt-2 sm:mt-3 text-foreground m-0">
            {approvedLecturesCount}
          </p>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1 m-0 truncate">
            {approvedConsiderationsCount > 0 ? `${approvedConsiderationsCount} Requests Approved` : '0 Requests Approved'}
          </p>
        </div>

        {/* Pending Lectures */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/student/requests?tab=active')}
          className="shadow-xs rounded-xl bg-card border border-border p-3.5 sm:p-5 cursor-pointer hover:border-border/80 transition-all"
        >
          <div className="flex justify-between items-center sm:items-start">
            <p className="font-semibold uppercase text-muted-foreground text-xs tracking-wider m-0">
              Pending Lectures
            </p>
            <Clock3 className="text-primary size-4 sm:size-5 shrink-0" />
          </div>
          <p className="font-bold tabular-nums text-2xl sm:text-3xl mt-2 sm:mt-3 text-foreground m-0">
            {pendingLecturesCount}
          </p>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1 m-0 truncate">
            {pendingConsiderationsCount > 0 ? `${pendingConsiderationsCount} Under Review` : 'No Pending Applications'}
          </p>
        </div>
      </section>

      {/* =======================================================================
          4. TWO-COLUMN MAIN CONTENT (Screen 3: [1fr_400px]; Screen 4: single column)
             Column 1:
               - Assigned Mentor / Tutor Guardian Card (Screen 3 & 4)
               - Recent Attendance Consideration Applications (Screen 3 & 4)
             Column 2 (Desktop):
               - Request consideration Quick Submission Card (Screen 3)
          ======================================================================= */}
      <section className="student-desktop-grid mb-6">
        {/* COLUMN 1 */}
        <div className="flex flex-col gap-6 w-full">
          {/* Card 1: Assigned Mentor / Tutor Guardian */}
          {/* Desktop Version (Screen 3) */}
          <div className="hidden sm:block shadow-xs rounded-xl bg-card border border-border p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary text-primary-foreground flex justify-center items-center size-12 shrink-0">
                <UserCheck className="size-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold uppercase text-primary text-xs tracking-wider m-0">
                  Assigned Mentor / Tutor Guardian
                </p>
                <h2 className="font-semibold text-lg mt-2 text-foreground m-0">
                  {tgMentor?.name || 'Test Teacher'}
                </h2>
                <p className="text-muted-foreground text-sm mt-1 m-0">
                  {tgTeacher?.designation || 'Assistant Professor'} · {sectionName}
                </p>
                <p className="text-muted-foreground text-sm mt-2 m-0">
                  Academic Session: {studentProfile.mentorGroup?.academicYear || '2025–26'}
                </p>
                <p className="text-muted-foreground text-sm leading-6 mt-4 max-w-2xl m-0">
                  Your Tutor Guardian reviews attendance consideration applications and
                  leave applications before Head of Department approval.
                </p>
              </div>
            </div>
          </div>

          {/* Mobile Version (Screen 4) */}
          <div className="sm:hidden shadow-xs rounded-lg bg-card border border-border p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary text-primary-foreground flex justify-center items-center shrink-0 size-10">
                <UserCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold uppercase text-primary text-xs tracking-wide m-0">
                  Assigned Mentor / Tutor Guardian (TG)
                </p>
                <h2 className="font-bold text-sm mt-1 text-foreground m-0">
                  {tgMentor?.name
                    ? `${tgMentor.name} (${tgTeacher?.designation || 'Assistant Professor (TG)'})`
                    : 'Test Teacher (Assistant Professor (TG))'}
                </h2>
                <p className="text-muted-foreground text-xs leading-5 mt-1 m-0">
                  Academic Session: {studentProfile.mentorGroup?.academicYear || '2025-26'} · Section: {sectionName} · Email: {tgMentor?.email || 'test_teacher@mail.in'}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground text-xs leading-5 border-t border-border mt-3 pt-3 m-0">
              Tutor Guardian reviews attendance consideration applications and
              leave applications before Head of Department approval.
            </p>
          </div>

          {/* Card 2: Recent Attendance Consideration Applications */}
          <div className="shadow-xs rounded-xl bg-card border border-border flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex flex-row justify-between items-center p-4 sm:p-6 pb-3 sm:pb-3">
                <div>
                  <h2 className="hidden sm:block font-semibold text-lg text-foreground m-0">
                    Recent applications
                  </h2>
                  <h2 className="sm:hidden font-bold uppercase text-sm tracking-wide text-foreground m-0">
                    Recent Attendance Consideration Applications
                  </h2>
                  <p className="hidden sm:block text-muted-foreground text-sm mt-1 m-0">
                    Attendance consideration requests
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openModal('REQUEST_CONSIDERATION')}
                  className="rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors shrink-0"
                >
                  <Plus className="size-4" />
                  <span>Apply</span>
                </button>
              </div>

              {/* Content with Tabs */}
              <div className="p-4 sm:p-6 pt-0 sm:pt-0">
                {/* Desktop Tabs */}
                <div className="hidden sm:inline-flex items-center gap-1 bg-muted p-1 rounded-lg w-fit mb-5">
                  <button
                    type="button"
                    onClick={() => setConTab('all')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${conTab === 'all'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    All ({conTotal})
                  </button>
                  <button
                    type="button"
                    onClick={() => setConTab('active')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${conTab === 'active'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Active ({conActive})
                  </button>
                  <button
                    type="button"
                    onClick={() => setConTab('completed')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${conTab === 'completed'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Completed ({conCompleted})
                  </button>
                </div>

                {/* Mobile Tabs */}
                <div className="sm:hidden grid grid-cols-3 w-full bg-muted p-1 rounded-lg mb-3">
                  <button
                    type="button"
                    onClick={() => setConTab('all')}
                    className={`py-2 text-xs font-semibold rounded-md text-center transition-all cursor-pointer ${conTab === 'all'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    All ({conTotal})
                  </button>
                  <button
                    type="button"
                    onClick={() => setConTab('active')}
                    className={`py-2 text-xs font-semibold rounded-md text-center transition-all cursor-pointer ${conTab === 'active'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Active ({conActive})
                  </button>
                  <button
                    type="button"
                    onClick={() => setConTab('completed')}
                    className={`py-2 text-xs font-semibold rounded-md text-center transition-all cursor-pointer ${conTab === 'completed'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Completed ({conCompleted})
                  </button>
                </div>

                {/* Item List */}
                {filteredConsiderations.length === 0 ? (
                  <div className="py-10 flex flex-col items-center justify-center text-center">
                    <div className="size-11 rounded-xl bg-muted text-muted-foreground flex items-center justify-center mb-2.5">
                      <FileText className="size-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground m-0">
                      No Attendance Consideration Applications
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-3">
                      Submit attendance consideration requests for approved academic activities and events.
                    </p>
                    <button
                      type="button"
                      onClick={() => openModal('REQUEST_CONSIDERATION')}
                      className="px-3.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                    >
                      + Apply
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredConsiderations.slice(0, 5).map((req) => {
                      const isApproved = req.status === 'APPROVED_BY_HOD' || req.status === 'APPROVED';
                      const lecturesText = req.hodReview?.approvedPeriods
                        ? `${req.hodReview.approvedPeriods} Lectures Approved`
                        : `${req.requestedPeriods} Lecture${req.requestedPeriods !== 1 ? 's' : ''}`;

                      const openSanctionModal = (e) => {
                        e.stopPropagation();
                        setSelectedSanction({
                          ...req,
                          requestKind: 'CONSIDERATION',
                          student: req.student || {
                            name: studentName,
                            rollNumber: enrollmentNo,
                            user: { name: studentName },
                            enrollmentNumber: enrollmentNo,
                            section: studentProfile.section,
                            semester: studentProfile.semester,
                          },
                        });
                      };

                      return (
                        <div key={req._id}>
                          {/* Desktop Layout (Screen 3) */}
                          <div className="hidden sm:flex rounded-lg bg-card border border-border p-4 items-center gap-4 shadow-2xs hover:border-border/80 transition-all">
                            <div className="rounded-lg bg-secondary text-primary flex justify-center items-center size-10 shrink-0">
                              <FileText className="size-5" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-foreground text-sm truncate max-w-[180px] lg:max-w-xs">
                                  {req.eventTitle}
                                </span>
                                {Boolean(req.isGroup || (req.groupMembers && req.groupMembers.length > 0)) && (
                                  <span className="font-medium rounded-full bg-secondary text-secondary-foreground text-xs px-2.5 py-0.5 border border-primary/20">
                                    Group ({req.groupMembers?.length || '2'})
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground text-sm mt-1 m-0">
                                {formatDisplayDate(req.startDate, req.endDate)} · {lecturesText}
                              </p>
                            </div>

                            {/* Status Pill */}
                            {isApproved ? (
                              <span className="font-semibold rounded-full bg-accent text-accent-foreground text-xs border border-accent px-3 py-1 shrink-0">
                                Approved by HOD
                              </span>
                            ) : req.status === 'RECOMMENDED_BY_TG' ? (
                              <span className="font-semibold rounded-full bg-primary/10 text-primary text-xs border border-primary/20 px-3 py-1 shrink-0">
                                Recommended by TG
                              </span>
                            ) : req.status === 'REJECTED' ? (
                              <span className="font-semibold rounded-full bg-rose-50 text-rose-700 text-xs border border-rose-200 px-3 py-1 shrink-0">
                                Rejected
                              </span>
                            ) : (
                              <span className="font-semibold rounded-full bg-amber-50 text-amber-700 text-xs border border-amber-200 px-3 py-1 shrink-0">
                                Pending Review
                              </span>
                            )}

                            {/* Action Links/Buttons */}
                            <button
                              type="button"
                              onClick={() => navigate('/student/requests')}
                              className="font-semibold text-primary hover:text-primary/80 text-sm flex items-center gap-1 cursor-pointer transition-colors px-2 py-1 shrink-0"
                            >
                              <span>View Details</span>
                              <ArrowRight className="size-4" />
                            </button>

                            {isApproved && (
                              <button
                                type="button"
                                onClick={openSanctionModal}
                                className="font-semibold rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3.5 py-2 flex items-center gap-1 shadow-xs transition-colors cursor-pointer shrink-0"
                                title="Print / View Official Sanction Order"
                              >
                                <span>View Order</span>
                                <ExternalLink className="size-4" />
                              </button>
                            )}
                          </div>

                          {/* Mobile Layout (Screen 4) */}
                          <article className="sm:hidden shadow-xs rounded-lg bg-card border border-border p-4">
                            <div className="flex items-start gap-3">
                              <div className="rounded-md bg-secondary text-secondary-foreground flex justify-center items-center shrink-0 size-9">
                                <FileText className="size-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-bold text-sm text-foreground m-0">
                                    {req.eventTitle}
                                  </h3>
                                  {Boolean(req.isGroup || (req.groupMembers && req.groupMembers.length > 0)) && (
                                    <span className="font-medium rounded-full bg-secondary text-secondary-foreground text-xs px-2 py-0.5">
                                      Group ({req.groupMembers?.length || '2'})
                                    </span>
                                  )}
                                </div>
                                <p className="text-muted-foreground text-xs mt-1 m-0">
                                  {formatDisplayDate(req.startDate, req.endDate)} · {lecturesText}
                                </p>
                              </div>
                              {isApproved ? (
                                <span className="font-semibold rounded-full bg-accent text-accent-foreground text-xs border border-accent px-2 py-1 shrink-0">
                                  Approved by HOD
                                </span>
                              ) : req.status === 'RECOMMENDED_BY_TG' ? (
                                <span className="font-semibold rounded-full bg-primary/10 text-primary text-xs border border-primary/20 px-2 py-1 shrink-0">
                                  Recommended
                                </span>
                              ) : req.status === 'REJECTED' ? (
                                <span className="font-semibold rounded-full bg-rose-50 text-rose-700 text-xs border border-rose-200 px-2 py-1 shrink-0">
                                  Rejected
                                </span>
                              ) : (
                                <span className="font-semibold rounded-full bg-amber-50 text-amber-700 text-xs border border-amber-200 px-2 py-1 shrink-0">
                                  Pending
                                </span>
                              )}
                            </div>
                            <div className="border-t border-border flex mt-4 pt-3 gap-2">
                              <button
                                type="button"
                                onClick={() => navigate('/student/requests')}
                                className="font-semibold rounded-md bg-card text-foreground text-xs border border-border px-3 py-2 flex-1 min-h-10 hover:bg-muted transition-colors cursor-pointer"
                              >
                                View Details
                              </button>
                              {isApproved && (
                                <button
                                  type="button"
                                  onClick={openSanctionModal}
                                  className="font-semibold rounded-md bg-primary text-primary-foreground text-xs px-3 py-2 flex-1 min-h-10 hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
                                >
                                  View Order
                                </button>
                              )}
                            </div>
                          </article>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: Request consideration Quick Submission Card (Desktop Screen 3) */}
        <div className="hidden lg:block w-full">
          <div className="shadow-xs rounded-2xl bg-white border border-slate-200/80 p-6 sm:p-7 h-fit sticky top-20">
            <div className="flex items-center justify-between mb-4">
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
                onClick={() => openModal('REQUEST_CONSIDERATION')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                title="Open Modal Form / Apply Consideration"
              >
                <span>Full Form</span>
                <ExternalLink size={13} />
              </button>
            </div>

            <form onSubmit={handleQuickSubmit} className="student-quick-form flex flex-col gap-4">
              {/* Event category */}
              <div>
                <label className="block font-semibold text-slate-800 text-sm mb-1.5">
                  Event category
                </label>
                <div className="relative">
                  <select
                    value={quickEventType}
                    onChange={(e) => setQuickEventType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3.5 py-2.5 text-sm appearance-none outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 cursor-pointer transition-all"
                  >
                    <option value="HACKATHON">Hackathon / Technical Competition</option>
                    <option value="SPORTS">Sports / Athletic Meet</option>
                    <option value="CULTURAL">Cultural / Arts Festival</option>
                    <option value="COLLEGE_DUTY">College / Department Duty</option>
                    <option value="OTHER">Other Academic Activity</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Event name */}
              <div>
                <label htmlFor="quick-event-name" className="block font-semibold text-slate-800 text-sm mb-1.5">
                  Event name
                </label>
                <input
                  id="quick-event-name"
                  type="text"
                  placeholder="e.g. Smart India Hackathon, Athletic Meet"
                  value={quickEventName}
                  onChange={(e) => setQuickEventName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3.5 py-2.5 text-sm placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
                />
              </div>

              {/* Start date & End date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="quick-start-date" className="block font-semibold text-slate-800 text-sm mb-1.5">
                    Start date
                  </label>
                  <input
                    id="quick-start-date"
                    type="date"
                    value={quickStartDate}
                    onChange={(e) => {
                      setQuickStartDate(e.target.value);
                      if (!quickEndDate || quickEndDate < e.target.value) {
                        setQuickEndDate(e.target.value);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 cursor-pointer transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="quick-end-date" className="block font-semibold text-slate-800 text-sm mb-1.5">
                    End date
                  </label>
                  <input
                    id="quick-end-date"
                    type="date"
                    value={quickEndDate}
                    onChange={(e) => setQuickEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 cursor-pointer transition-all"
                  />
                </div>
              </div>

              {/* Periods */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-800 text-sm m-0">
                    Periods
                  </label>
                  {quickPeriods.length > 0 && (
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      {quickPeriods.length} Lecture{quickPeriods.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[1, 2, 3, 4].map((p) => {
                    const isChecked = quickPeriods.includes(p);
                    return (
                      <label
                        key={p}
                        className={`cursor-pointer rounded-xl border p-2 flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                          isChecked
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold ring-1 ring-indigo-500/20 shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleQuickPeriod(p)}
                          className="size-4 rounded accent-indigo-600 cursor-pointer"
                        />
                        <span>P{p}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 6, 7].map((p) => {
                    const isChecked = quickPeriods.includes(p);
                    return (
                      <label
                        key={p}
                        className={`cursor-pointer rounded-xl border p-2 flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                          isChecked
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold ring-1 ring-indigo-500/20 shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleQuickPeriod(p)}
                          className="size-4 rounded accent-indigo-600 cursor-pointer"
                        />
                        <span>P{p}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Lecture Timing Schedule (Presets & Time From / To) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 m-0">
                    <Clock size={14} className="text-indigo-600" />
                    <span>Lecture Time Schedule</span>
                  </label>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50/70 px-2 py-0.5 rounded-md border border-indigo-200">
                    {quickTimeFrom} – {quickTimeTo}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-bold mr-1">Presets:</span>
                  {quickTimePresets.map((p, idx) => {
                    const isActive = quickTimeFrom === p.from && quickTimeTo === p.to;
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={quickSubmitting}
                        onClick={() => {
                          setQuickTimeFrom(p.from);
                          setQuickTimeTo(p.to);
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
                      value={quickTimeFrom}
                      onChange={(e) => setQuickTimeFrom(e.target.value)}
                      placeholder="e.g., 10:50 AM"
                      required
                      disabled={quickSubmitting}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-600 focus:outline-none transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Time To
                    </label>
                    <input
                      type="text"
                      value={quickTimeTo}
                      onChange={(e) => setQuickTimeTo(e.target.value)}
                      placeholder="e.g., 01:20 PM"
                      required
                      disabled={quickSubmitting}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-600 focus:outline-none transition-colors font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Justification */}
              <div>
                <label htmlFor="quick-justification" className="block font-semibold text-slate-800 text-sm mb-1.5">
                  Justification
                </label>
                <textarea
                  id="quick-justification"
                  rows={3}
                  placeholder="Explain the reason for your request (minimum 5 characters)"
                  value={quickJustification}
                  onChange={(e) => setQuickJustification(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 p-3 text-sm placeholder:text-slate-400 outline-none resize-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 min-h-[90px] transition-all"
                />
              </div>

              {/* Upload supporting document */}
              <div>
                <DocumentUploader
                  label=""
                  hint="Upload official proof or certificate (PDF, JPG, PNG up to 5 MB)"
                  selectedFile={quickAttachment}
                  onFileVerified={setQuickAttachment}
                  onFileRemove={() => setQuickAttachment(null)}
                  required={false}
                />
              </div>

              {/* Bottom buttons */}
              <div className="flex pt-1 pb-1 justify-end gap-3 items-center">
                <button
                  type="button"
                  onClick={handleQuickReset}
                  disabled={quickSubmitting}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickSubmitting}
                  className="px-7 py-2.5 rounded-xl bg-primary hover:bg-indigo-700 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {quickSubmitting && <RefreshCw className="size-4 animate-spin" />}
                  <span>Submit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Account Settings Modal */}
      {showAccountSettingsModal && (
        <Suspense fallback={null}>
          <StudentAccountSettingsModal
            onClose={() => setShowAccountSettingsModal(false)}
          />
        </Suspense>
      )}

      {/* Official Printable Sanction Order Modal */}
      {selectedSanction && (
        <FormalApplicationModal
          item={selectedSanction}
          onClose={() => setSelectedSanction(null)}
        />
      )}
    </div>
  );
}
