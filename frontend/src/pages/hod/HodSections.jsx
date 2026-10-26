import React, { useEffect, useState } from 'react';
import {
  Layers,
  ArrowRight,
  ArrowLeft,
  Users,
  GraduationCap,
  Calendar,
  Search,
  RefreshCw,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { useERP } from '../../context/ERPContext.jsx';
import { masterDataApi } from '../../api';
import MoveSemesterModal from '../../components/modals/MoveSemesterModal.jsx';
import ClassesCurriculumModal from '../../components/modals/ClassesCurriculumModal.jsx';

export default function HodSections() {
  const { addToast } = useERP();

  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('ALL');

  // Modal states
  const [moveModalData, setMoveModalData] = useState(null); // { section, direction: 'next' | 'prev' }
  const [showCurriculumModal, setShowCurriculumModal] = useState(false);

  const fetchSections = async () => {
    setLoading(true);
    try {
      const res = await masterDataApi.getSections();
      setSections(res?.data || []);
    } catch (err) {
      addToast('Error', 'Failed to load class sections.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  // Filter sections
  const filteredSections = sections.filter((sec) => {
    const sem = Number(sec.semester) || 5;
    if (semesterFilter !== 'ALL' && sem !== Number(semesterFilter)) {
      return false;
    }
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const name = (sec.name || '').toLowerCase();
    const code = (sec.code || '').toLowerCase();
    const tg = (sec.tgName || '').toLowerCase();
    return name.includes(q) || code.includes(q) || tg.includes(q);
  });

  // Calculate statistics
  const totalStudents = sections.reduce((acc, s) => acc + (s.studentCount || 0), 0);
  const uniqueSemesters = new Set(sections.map((s) => s.semester)).size;
  const sectionsWithTg = sections.filter((s) => s.hasActiveTG || s.tgName).length;

  return (
    <div className="flex flex-col gap-6 w-full min-w-0 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0 shadow-2xs">
              <Layers size={22} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight m-0">
                Class Section & Semester Progression
              </h1>
              <span className="text-xs text-blue-600 font-bold">
                CSE Department • Academic Administration
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium m-0 mt-1">
            Promote or demote class sections across semesters. All enrolled students and active Tutor Guardian assignments synchronize automatically.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchSections}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer min-h-[42px]"
            title="Refresh sections"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : 'text-slate-500'} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCurriculumModal(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer min-h-[42px]"
          >
            <Plus size={16} />
            <span>Manage Curriculum & Sections</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5 min-h-[96px]">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">
            <Layers size={22} />
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              TOTAL CLASS SECTIONS
            </span>
            <span className="block text-xl font-black text-slate-900 mt-0.5">
              {sections.length} Sections
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5 min-h-[96px]">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center shrink-0">
            <Users size={22} />
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              ENROLLED STUDENTS
            </span>
            <span className="block text-xl font-black text-slate-900 mt-0.5">
              {totalStudents} Students
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5 min-h-[96px]">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              TUTOR GUARDIANS ASSIGNED
            </span>
            <span className="block text-xl font-black text-emerald-700 mt-0.5">
              {sectionsWithTg} / {sections.length} Active
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5 min-h-[96px]">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center shrink-0">
            <Calendar size={22} />
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              ACTIVE SEMESTERS
            </span>
            <span className="block text-xl font-black text-slate-900 mt-0.5">
              {uniqueSemesters} Semesters Active
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left Semester Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <button
            type="button"
            onClick={() => setSemesterFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border whitespace-nowrap shadow-2xs ${
              semesterFilter === 'ALL'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Semesters ({sections.length})
          </button>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
            const count = sections.filter((s) => Number(s.semester) === sem).length;
            const isSelected = semesterFilter === String(sem);
            return (
              <button
                key={sem}
                type="button"
                onClick={() => setSemesterFilter(String(sem))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border whitespace-nowrap shadow-2xs ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Sem {sem} ({count})
              </button>
            );
          })}
        </div>

        {/* Right Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search section by code, name, or TG..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none transition-all font-medium min-h-[40px]"
          />
        </div>
      </div>

      {/* Sections Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400">
            <RefreshCw size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
            Loading class sections...
          </div>
        ) : filteredSections.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-2xs">
            <Layers size={36} className="mx-auto text-slate-300 mb-2" />
            <h3 className="text-base font-black text-slate-800">No Class Sections Found</h3>
            <p className="text-xs text-slate-400 mt-1">
              No class sections match the active filter criteria.
            </p>
          </div>
        ) : (
          filteredSections.map((sec) => {
            const currentSem = Number(sec.semester) || 5;
            const currentYear = sec.year || Math.ceil(currentSem / 2);
            const studentCount = sec.studentCount || 0;
            const capacity = sec.capacity || 60;
            const pct = Math.min(100, Math.round((studentCount / capacity) * 100));

            return (
              <div
                key={sec._id}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all flex flex-col justify-between shadow-2xs min-h-[220px]"
              >
                <div>
                  {/* Top Header: Code, Name, Semester pill */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        {sec.code}
                      </span>
                      <h3 className="text-base font-black text-slate-900 m-0 leading-tight">
                        {sec.name}
                      </h3>
                      <span className="text-xs text-slate-500 font-medium">
                        Year {currentYear} of 4 • Undergraduate
                      </span>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black shrink-0 shadow-2xs">
                      Semester {currentSem}
                    </span>
                  </div>

                  {/* Student Quota / Capacity */}
                  <div className="space-y-1.5 py-2.5 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-bold">Enrolled Students:</span>
                      <span className="font-black text-slate-900">
                        {studentCount} <span className="text-slate-400 font-normal">/ {capacity}</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          pct >= 90 ? 'bg-amber-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Tutor Guardian Badge */}
                  <div className="py-2 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      TUTOR GUARDIAN (TG)
                    </span>
                    <span className="font-bold text-slate-800 mt-0.5 block truncate">
                      {sec.tgName ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 size={13} className="shrink-0" />
                          <span className="truncate">{sec.tgName}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No Tutor Guardian Assigned</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Bottom Action Buttons: Demote & Promote */}
                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    disabled={currentSem <= 1}
                    onClick={() => setMoveModalData({ section: sec, direction: 'prev' })}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-all ${
                      currentSem <= 1
                        ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 cursor-pointer shadow-2xs hover:border-slate-400'
                    }`}
                    title={currentSem <= 1 ? 'Minimum semester reached' : `Demote section to Semester ${currentSem - 1}`}
                  >
                    <ArrowLeft size={13} className={currentSem <= 1 ? 'text-slate-300' : 'text-slate-600'} />
                    <span>Sem {currentSem - 1}</span>
                  </button>

                  <button
                    type="button"
                    disabled={currentSem >= 8}
                    onClick={() => setMoveModalData({ section: sec, direction: 'next' })}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-all ${
                      currentSem >= 8
                        ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700 cursor-pointer shadow-xs'
                    }`}
                    title={currentSem >= 8 ? 'Maximum semester reached' : `Promote section to Semester ${currentSem + 1}`}
                  >
                    <span>Sem {currentSem + 1}</span>
                    <ArrowRight size={13} className={currentSem >= 8 ? 'text-slate-300' : 'text-white'} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Move Semester Confirmation Modal */}
      {moveModalData && (
        <MoveSemesterModal
          section={moveModalData.section}
          direction={moveModalData.direction}
          onClose={() => setMoveModalData(null)}
          onSuccess={(result) => {
            setMoveModalData(null);
            fetchSections();
            window.dispatchEvent(new Event('campusflow_sections_changed'));
            if (result?.newSemester && semesterFilter !== 'ALL') {
              setSemesterFilter(String(result.newSemester));
            }
          }}
        />
      )}

      {/* Curriculum & Classes Modal */}
      {showCurriculumModal && (
        <ClassesCurriculumModal
          onClose={() => setShowCurriculumModal(false)}
          onUpdated={() => fetchSections()}
        />
      )}
    </div>
  );
}
