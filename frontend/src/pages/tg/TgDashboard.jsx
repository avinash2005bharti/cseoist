import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import { dashboardApi, mentorshipApi, considerationApi, leaveApi, noticeApi } from '../../api';
import {
  ArrowRight,
  CalendarDays,
  ExternalLink,
  FileCheck,
  FileText,
  Megaphone,
  SquareCheckBig,
  User,
  Users,
} from 'lucide-react';
import './Screen-5.screen.css';

const OfficialClearancesLedgerModal = lazy(() => import('../../components/modals/OfficialClearancesLedgerModal.jsx'));

export default function TgDashboard() {
  const { currentUser } = useERP();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [cohort, setCohort] = useState(null);
  const [pendingConsiderations, setPendingConsiderations] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNoticeTab, setActiveNoticeTab] = useState('latest');

  // Ledger Modal State
  const [ledgerModalTab, setLedgerModalTab] = useState(null); // 'considerations' | 'leaves' | null

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sumRes, cohortRes, conRes, leaveRes, noticeRes] = await Promise.allSettled([
        dashboardApi.getSummary(),
        mentorshipApi.getMyCohort(),
        considerationApi.getTGQueue(),
        leaveApi.getTGQueue(),
        noticeApi.getNotices(),
      ]);

      if (sumRes.status === 'fulfilled') setSummary(sumRes.value?.data || sumRes.value);
      if (cohortRes.status === 'fulfilled') setCohort(cohortRes.value?.data || cohortRes.value);
      if (conRes.status === 'fulfilled') {
        const val = conRes.value?.data || conRes.value?.requests || conRes.value || [];
        setPendingConsiderations(Array.isArray(val) ? val : []);
      }
      if (leaveRes.status === 'fulfilled') {
        const val = leaveRes.value?.data || leaveRes.value?.leaves || leaveRes.value || [];
        setPendingLeaves(Array.isArray(val) ? val : []);
      }
      if (noticeRes.status === 'fulfilled') {
        setNotices(noticeRes.value?.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleQueueChange = () => fetchData();
    window.addEventListener('campusflow_queue_changed', handleQueueChange);
    return () => {
      window.removeEventListener('campusflow_queue_changed', handleQueueChange);
    };
  }, []);

  const totalPending = pendingConsiderations.length + pendingLeaves.length;
  const studentCount = cohort?.students?.length ?? summary?.totalMentees ?? summary?.totalStudents ?? 0;
  const deptCode = cohort?.department?.code || 'CSE';
  const semNum = cohort?.section?.semester || cohort?.semester || '—';
  const rawSec = cohort?.section?.name || cohort?.section?.code || '';
  const cleanSec = rawSec ? rawSec.replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim() : '—';

  return (
    <div data-appearance="light" className="flex flex-col gap-6 sm:gap-8 w-full pb-10">
      {/* Top Tag (Screen 5 & Screen 6) */}
      <section className="flex flex-col gap-3 sm:gap-5">
        <span className="font-bold uppercase rounded-full sm:bg-primary/10 text-primary text-xs tracking-wider sm:px-3 sm:py-1 inline-flex w-fit max-w-fit">
          TUTOR GUARDIAN WORKSPACE
        </span>

        {/* Welcome Card */}
        <div className="shadow-sm rounded-xl bg-card border border-border flex p-6 sm:p-8 justify-between items-start gap-8">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="rounded-lg bg-primary text-primary-foreground flex justify-center items-center shrink-0 size-12 sm:size-14">
              <User className="size-6 sm:size-7" />
            </div>
            <div>
              <h1 className="font-bold text-2xl sm:text-3xl tracking-tight text-foreground">
                Welcome back, {currentUser?.name || 'Test Teacher'}!
              </h1>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                Here is the real-time overview for your assigned student section.
              </p>
              <div className="flex mt-4 sm:mt-5 flex-wrap items-center gap-2 sm:gap-3">
                <span className="font-semibold rounded-full bg-accent text-accent-foreground text-xs sm:text-sm border border-accent inline-flex px-3 py-1.5 items-center gap-2">
                  <span className="rounded-full bg-primary size-2" />
                  Active TG Duty
                </span>
                <span className="rounded-full bg-muted text-muted-foreground text-xs sm:text-sm border border-border px-3 py-1.5 font-medium">
                  Department: {cohort?.department?.name || 'Computer Science and Engineering'}
                </span>
                <span className="rounded-full bg-muted text-muted-foreground text-xs sm:text-sm border border-border px-3 py-1.5 font-medium">
                  Assigned: Semester {semNum} • Section {cleanSec}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Cards Grid (Screen 5 & Screen 6) */}
      <section className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: PENDING APPLICATIONS */}
        <div className="shadow-sm rounded-xl bg-card border border-border flex p-6 flex-col justify-between min-h-56 sm:min-h-64 transition-all hover:border-primary/40 hover:shadow-md">
          <div>
            <div className="flex justify-between items-start gap-4">
              <div className="rounded-lg bg-secondary text-secondary-foreground flex justify-center items-center size-10 sm:size-11">
                <FileText className="size-5" />
              </div>
              <span className="font-bold text-2xl sm:hidden">{totalPending}</span>
              <span className="font-bold uppercase text-muted-foreground text-xs tracking-wider hidden sm:inline">
                PENDING APPLICATIONS
              </span>
            </div>
            <p className="font-bold uppercase text-muted-foreground text-xs tracking-wide mt-4 sm:hidden">
              Pending Applications
            </p>
            <p className="font-bold tabular-nums text-4xl mt-6 hidden sm:block">{totalPending}</p>
            <p className="font-semibold text-primary text-sm mt-1 sm:mt-2 sm:text-muted-foreground">
              Requires your action
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/tg/requests')}
            className="font-bold text-primary text-sm inline-flex mt-4 sm:mt-6 items-center gap-2 hover:underline cursor-pointer min-h-11 sm:min-h-0"
          >
            Review Applications
            <ArrowRight className="size-4" />
          </button>
        </div>

        {/* Card 2: TOTAL STUDENTS */}
        <div className="shadow-sm rounded-xl bg-card border border-border flex p-6 flex-col justify-between min-h-56 sm:min-h-64 transition-all hover:border-primary/40 hover:shadow-md">
          <div>
            <div className="flex justify-between items-start gap-4">
              <div className="rounded-lg bg-accent text-accent-foreground flex justify-center items-center size-10 sm:size-11">
                <Users className="size-5" />
              </div>
              <span className="font-bold text-2xl sm:hidden">{studentCount}</span>
              <span className="font-bold uppercase text-muted-foreground text-xs tracking-wider hidden sm:inline">
                TOTAL STUDENTS
              </span>
            </div>
            <p className="font-bold uppercase text-muted-foreground text-xs tracking-wide mt-4 sm:hidden">
              Total Students
            </p>
            <p className="font-bold tabular-nums text-4xl mt-6 hidden sm:block">{studentCount}</p>
            <p className="text-muted-foreground text-sm mt-1 sm:mt-2">
              {deptCode} • Semester {semNum} • Section {cleanSec}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/tg/students')}
            className="font-bold text-primary text-sm inline-flex mt-4 sm:mt-6 items-center gap-2 hover:underline cursor-pointer min-h-11 sm:min-h-0"
          >
            View Student List
            <ArrowRight className="size-4" />
          </button>
        </div>

        {/* Card 3: Attendance Consideration Records */}
        <div className="shadow-sm rounded-xl bg-card border border-border flex p-6 flex-col justify-between min-h-56 sm:min-h-64 transition-all hover:border-primary/40 hover:shadow-md">
          <div>
            <div className="flex justify-between items-start gap-4">
              <div className="rounded-lg bg-secondary text-secondary-foreground flex justify-center items-center size-10 sm:size-11">
                <SquareCheckBig className="size-5" />
              </div>
              <ExternalLink className="text-muted-foreground size-4 hidden sm:block" />
            </div>
            <h2 className="font-bold text-base sm:text-lg mt-4 sm:mt-6 text-foreground">
              Attendance Consideration Records
            </h2>
            <p className="text-muted-foreground text-sm leading-6 mt-1 sm:mt-2">
              Approved attendance clearances and official records
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLedgerModalTab('considerations')}
            className="font-bold text-primary text-sm inline-flex mt-4 sm:mt-6 items-center gap-2 hover:underline cursor-pointer min-h-11 sm:min-h-0"
          >
            View Records
            <ExternalLink className="size-4" />
          </button>
        </div>

        {/* Card 4: Leave Application Records */}
        <div className="shadow-sm rounded-xl bg-card border border-border flex p-6 flex-col justify-between min-h-56 sm:min-h-64 transition-all hover:border-primary/40 hover:shadow-md">
          <div>
            <div className="flex justify-between items-start gap-4">
              <div className="rounded-lg bg-accent text-accent-foreground flex justify-center items-center size-10 sm:size-11">
                <CalendarDays className="size-5" />
              </div>
              <ExternalLink className="text-muted-foreground size-4 hidden sm:block" />
            </div>
            <h2 className="font-bold text-base sm:text-lg mt-4 sm:mt-6 text-foreground">
              Leave Application Records
            </h2>
            <p className="text-muted-foreground text-sm leading-6 mt-1 sm:mt-2">
              Section leave records and sanctioned leaves
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLedgerModalTab('leaves')}
            className="font-bold text-primary text-sm inline-flex mt-4 sm:mt-6 items-center gap-2 hover:underline cursor-pointer min-h-11 sm:min-h-0"
          >
            View Records
            <ExternalLink className="size-4" />
          </button>
        </div>
      </section>

      {/* Mobile CTA Button (Screen 6) */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => navigate('/tg/requests')}
          className="text-left shadow-sm rounded-xl bg-primary text-primary-foreground flex px-4 justify-between items-center w-full min-h-12 cursor-pointer hover:bg-primary/90 transition-colors"
        >
          <span className="flex items-center gap-3">
            <FileCheck className="size-5" />
            <span>
              <span className="font-bold text-base block">
                Review Applications
              </span>
              <span className="text-primary-foreground/80 text-xs block">
                Attendance and leave requests
              </span>
            </span>
          </span>
          <span className="font-bold text-lg flex items-center gap-2">
            {totalPending}
            <ArrowRight className="size-5" />
          </span>
        </button>
      </div>

      {/* Notice Board Section (Screen 5 & Screen 6) */}
      <section className="flex flex-col gap-4 sm:gap-5">
        <div className="flex justify-between items-center gap-4 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-secondary text-secondary-foreground flex justify-center items-center size-10">
              <Megaphone className="size-5" />
            </div>
            <h2 className="font-bold text-xl sm:text-2xl tracking-tight text-foreground">
              Notice Board
            </h2>
          </div>
          <div className="rounded-lg bg-card border border-border p-1 gap-1 flex items-center h-auto">
            <button
              type="button"
              onClick={() => setActiveNoticeTab('latest')}
              className={`rounded-md text-sm px-4 py-2 font-medium transition-colors cursor-pointer ${
                activeNoticeTab === 'latest'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Latest
            </button>
            <button
              type="button"
              onClick={() => setActiveNoticeTab('circulars')}
              className={`rounded-md text-sm px-4 py-2 font-medium transition-colors cursor-pointer ${
                activeNoticeTab === 'circulars'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Circulars
            </button>
            <button
              type="button"
              onClick={() => setActiveNoticeTab('department')}
              className={`rounded-md text-sm px-4 py-2 font-medium transition-colors cursor-pointer ${
                activeNoticeTab === 'department'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Department
            </button>
          </div>
        </div>

        {notices.length > 0 ? (
          <div className="space-y-3">
            {notices.map((notice) => (
              <div
                key={notice._id}
                className="shadow-sm rounded-xl bg-card border border-border p-4 sm:p-5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-lg bg-secondary text-secondary-foreground flex justify-center items-center size-10 shrink-0">
                    <Megaphone className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-base text-card-foreground truncate">
                      {notice.title}
                    </p>
                    <p className="text-muted-foreground text-sm truncate mt-0.5">
                      {notice.content}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-muted text-muted-foreground text-xs px-3 py-1 border border-border shrink-0 font-medium">
                  {notice.category || 'General'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center shadow-xs rounded-xl bg-card border border-border flex p-8 sm:p-10 flex-col justify-center items-center gap-4 min-h-64 sm:min-h-72">
            <div className="rounded-full bg-muted text-muted-foreground flex justify-center items-center size-14">
              <Megaphone className="size-7" />
            </div>
            <p className="text-muted-foreground text-sm font-medium">
              No active circulars for {deptCode} • Semester {semNum} • Section {cleanSec}.
            </p>
          </div>
        )}
      </section>

      {/* Official Clearances Ledger Modal */}
      {ledgerModalTab && (
        <Suspense fallback={null}>
          <OfficialClearancesLedgerModal
            initialTab={ledgerModalTab}
            onClose={() => setLedgerModalTab(null)}
            isTgView={true}
            assignedSemester={semNum}
            assignedSection={cleanSec}
          />
        </Suspense>
      )}
    </div>
  );
}
