import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import { dashboardApi, mentorshipApi, considerationApi, leaveApi, noticeApi } from '../../api';
import {
  Users,
  CheckSquare,
  FileText,
  Calendar,
  ArrowRight,
  RefreshCw,
  Bell,
  ExternalLink,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  Megaphone,
} from 'lucide-react';

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

  // Active duty status indicator
  const [activeDuty, setActiveDuty] = useState(true);

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
  const studentCount = cohort?.students?.length || summary?.totalStudents || summary?.totalMentees || 0;
  const deptCode = cohort?.department?.code || 'CSE';
  const semNum = cohort?.section?.semester || cohort?.semester || '5';
  const rawSec = cohort?.section?.name || cohort?.section?.code || 'B';
  const cleanSec = rawSec.replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim() || 'B';

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Top Header Tag */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full uppercase tracking-wider">
            Tutor Guardian Workspace
          </span>
        </div>
      </div>

      {/* Welcome & Assigned Configuration Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight m-0">
              Welcome back, {currentUser?.name || currentUser?.designation || 'Tutor Guardian'}!
            </h1>
            <p className="text-xs text-slate-500 mt-1 mb-3 font-medium">
              Here is the real-time overview for your assigned student section.
            </p>

            {/* Read-Only HOD-Enforced Configuration Chips (No Dropdowns) */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Active TG Duty</span>
              </span>

              <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold">
                Department: {cohort?.department?.name || deptCode}
              </span>

              <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold">
                Assigned: Semester {semNum} • Section {cleanSec}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Primary Action / Information Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: PENDING APPLICATIONS */}
        <div
          onClick={() => navigate('/tg/requests')}
          className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <FileText size={18} />
            </div>
            <span className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
              PENDING APPLICATIONS
            </span>
            <span className="block text-3xl font-black text-slate-900 mt-1">
              {totalPending}
            </span>
            <span className="block text-xs text-rose-600 font-semibold mt-0.5">
              Requires your action
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600 group-hover:text-blue-700">
            <span>Review Applications</span>
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 2: TOTAL STUDENTS */}
        <div
          onClick={() => navigate('/tg/students')}
          className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Users size={18} />
            </div>
            <span className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
              TOTAL STUDENTS
            </span>
            <span className="block text-3xl font-black text-slate-900 mt-1">
              {studentCount}
            </span>
            <span className="block text-xs text-slate-500 font-medium mt-0.5">
              {deptCode} • Semester {semNum} • Section {cleanSec}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600 group-hover:text-blue-700">
            <span>View Student List</span>
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 3: Attendance Consideration Records */}
        <div
          onClick={() => setLedgerModalTab('considerations')}
          className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-purple-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
              <CheckSquare size={18} />
            </div>
            <span className="block text-base font-extrabold text-slate-900 leading-snug group-hover:text-purple-700 transition-colors">
              Attendance Consideration Records
            </span>
            <span className="block text-xs text-slate-500 mt-1">
              Approved attendance clearances and official records
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-700">
            <span>View Records</span>
            <ExternalLink size={14} />
          </div>
        </div>

        {/* Card 4: Leave Application Records */}
        <div
          onClick={() => setLedgerModalTab('leaves')}
          className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <Calendar size={18} />
            </div>
            <span className="block text-base font-extrabold text-slate-900 leading-snug group-hover:text-emerald-700 transition-colors">
              Leave Application Records
            </span>
            <span className="block text-xs text-slate-500 mt-1">
              Section leave records and sanctioned leaves
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
            <span>View Records</span>
            <ExternalLink size={14} />
          </div>
        </div>
      </div>

      {/* Notice Board Section */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-blue-600" />
            <h2 className="text-sm font-extrabold text-slate-900 m-0">Notice Board</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
              Latest
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">
              Circulars
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">
              Department
            </span>
          </div>
        </div>

        {notices.length > 0 ? (
          <div className="space-y-2 mt-2">
            {notices.map((notice) => {
              const isUrgent = notice.priority === 'URGENT';
              return (
                <div
                  key={notice._id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition-all gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isUrgent
                          ? 'bg-rose-50 border-rose-200 text-rose-600'
                          : 'bg-blue-50 border-blue-200 text-blue-600'
                      }`}
                    >
                      <Megaphone size={16} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {notice.title}
                        </span>
                        {isUrgent && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-100 text-rose-700 uppercase">
                            Urgent
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-medium truncate mt-0.5">
                        {notice.content}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-200/70 text-slate-700 text-[10px] font-bold">
                      {notice.category}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold hidden sm:inline-block">
                      {new Date(notice.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 mx-auto mb-2 flex items-center justify-center">
              <Megaphone size={18} />
            </div>
            <p className="text-xs font-bold text-slate-700 m-0">No notices posted</p>
            <p className="text-[11px] text-slate-600 m-0 mt-0.5">
              No active circulars for {deptCode} • Semester {semNum} • Section {cleanSec}.
            </p>
          </div>
        )}
      </div>

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
