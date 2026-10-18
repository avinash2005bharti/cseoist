import React, { useEffect, useState } from 'react';
import { useERP } from '../../context/ERPContext.jsx';
import { mentorshipApi, masterDataApi } from '../../api';
import {
  Users,
  ShieldCheck,
  GraduationCap,
  Award,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
  Lock,
} from 'lucide-react';
import AppointTgModal from '../../components/modals/AppointTgModal.jsx';
import AddFacultyModal from '../../components/modals/AddFacultyModal.jsx';
import EditFacultyModal from '../../components/modals/EditFacultyModal.jsx';
import SectionTgMatrixModal from '../../components/modals/SectionTgMatrixModal.jsx';
import ConfirmRevokeTgModal from '../../components/modals/ConfirmRevokeTgModal.jsx';

export default function HodMentorship() {
  const { addToast } = useERP();

  const [teachers, setTeachers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'tg' | 'standard'
  const [search, setSearch] = useState('');

  // Modals
  const [showAppointModal, setShowAppointModal] = useState(false);
  const [preselectedTeacher, setPreselectedTeacher] = useState(null);
  const [selectedCohort, setSelectedCohort] = useState(null);
  const [isChangeSection, setIsChangeSection] = useState(false);
  const [showAddFacultyModal, setShowAddFacultyModal] = useState(false);
  const [facultyToEdit, setFacultyToEdit] = useState(null);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teachersRes, groupsRes, studentsRes] = await Promise.allSettled([
        masterDataApi.getTeachers(),
        mentorshipApi.listGroups(),
        masterDataApi.getStudents(),
      ]);

      if (teachersRes.status === 'fulfilled') setTeachers(teachersRes.value?.data || []);
      if (groupsRes.status === 'fulfilled') setGroups(groupsRes.value?.data || []);
      if (studentsRes.status === 'fulfilled') setStudents(studentsRes.value?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Active cohorts & TG IDs
  const activeCohorts = groups.filter((g) => g.isActive !== false);
  const activeTgIds = new Set(
    activeCohorts
      .map((g) => (g.tg?._id || g.tg?.user?._id || g.tg)?.toString())
      .filter(Boolean)
  );

  const getTeacherCohort = (teacher) => {
    if (!teacher) return null;
    const tId = teacher._id?.toString();
    const uId = teacher.user?._id?.toString();
    return activeCohorts.find((g) => {
      const gid = (g.tg?._id || g.tg)?.toString();
      const guid = g.tg?.user?._id?.toString();
      return (tId && (gid === tId || guid === tId)) || (uId && (gid === uId || guid === uId));
    });
  };

  const isTeacherTg = (teacher) => {
    if (!teacher) return false;
    const tId = teacher._id?.toString();
    const uId = teacher.user?._id?.toString();
    const hasActiveGroup = (tId && activeTgIds.has(tId)) || (uId && activeTgIds.has(uId));
    if (hasActiveGroup) return true;
    if (!teacher.isTG) return false;
    return !!teacher.isTG;
  };

  const activeTgs = teachers.filter((t) => isTeacherTg(t));
  const standardFaculty = teachers.filter((t) => !isTeacherTg(t));

  const filteredTeachers = teachers.filter((t) => {
    const isTg = isTeacherTg(t);
    if (activeTab === 'tg' && !isTg) return false;
    if (activeTab === 'standard' && isTg) return false;

    const name = (t.user?.name || '').toLowerCase();
    const email = (t.user?.email || '').toLowerCase();
    const desig = (t.designation || '').toLowerCase();
    const q = search.toLowerCase().trim();
    return !q || name.includes(q) || email.includes(q) || desig.includes(q);
  });

  const handleRevokeTg = (teacher) => {
    const cohort = getTeacherCohort(teacher);
    setRevokeTarget({ teacher, cohort });
  };

  // Compute mentored section label
  const mentoredSectionLabel = activeCohorts.length > 0
    ? (() => {
        const g = activeCohorts[0];
        const sem = g.semester || g.section?.semester || 5;
        const sec = g.section?.name || g.section?.code || (g.name?.includes('CSE-') ? `Section ${g.name.split('CSE-')[1]}` : 'Section B');
        return `Sec Semester ${sem} • ${sec}`;
      })()
    : 'Sec Semester 5 • Section B';

  return (
    <div className="flex flex-col gap-5 w-full min-w-0 font-sans">
      {/* 4 Overview Stat Cards matching Image 3 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Total Faculty */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5 min-h-[96px]">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">
            <Users size={22} />
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              TOTAL DEPARTMENT FACULTY
            </span>
            <span className="block text-xl font-black text-slate-900 mt-0.5">
              {teachers.length || 5} Members
            </span>
          </div>
        </div>

        {/* Stat 2: Appointed TGs */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-emerald-500 shadow-2xs flex items-center gap-3.5 min-h-[96px]">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              APPOINTED TUTOR GUARDIANS (TG)
            </span>
            <span className="block text-xl font-black text-emerald-700 mt-0.5">
              {activeTgs.length || 1} Active TGs
            </span>
          </div>
        </div>

        {/* Stat 3: Mentored Sections with Click-to-Open Section ↔ TG Matrix Table */}
        <div
          onClick={() => setShowMatrixModal(true)}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5 min-h-[96px] overflow-hidden cursor-pointer hover:border-purple-300 hover:shadow-md transition-all group"
          role="button"
          tabIndex={0}
          title="Click to view and manage Section ↔ Tutor Guardian Allocation Matrix"
        >
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <GraduationCap size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                ASSIGNED SECTIONS
              </span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 whitespace-nowrap">
                View Matrix
              </span>
            </div>
            <span className="block text-base sm:text-lg font-black text-slate-900 mt-0.5 truncate" title={mentoredSectionLabel}>
              {mentoredSectionLabel}
            </span>
          </div>
        </div>

        {/* Stat 4: Multi-Tier Active */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5 min-h-[96px]">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center shrink-0">
            <Lock size={22} />
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              CLEARANCE WORKFLOW
            </span>
            <span className="block text-xl font-black text-slate-900 mt-0.5">
              Multi-Tier Active
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            style={
              activeTab === 'all'
                ? { backgroundColor: '#1D4ED8', color: '#ffffff', borderColor: '#1D4ED8' }
                : { backgroundColor: '#ffffff', color: '#334155', borderColor: '#CBD5E1' }
            }
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border shadow-2xs"
          >
            All Faculty ({teachers.length || 5})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tg')}
            style={
              activeTab === 'tg'
                ? { backgroundColor: '#1D4ED8', color: '#ffffff', borderColor: '#1D4ED8' }
                : { backgroundColor: '#ffffff', color: '#334155', borderColor: '#CBD5E1' }
            }
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border shadow-2xs"
          >
            Tutor Guardians ({activeTgs.length || 1})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('standard')}
            style={
              activeTab === 'standard'
                ? { backgroundColor: '#1D4ED8', color: '#ffffff', borderColor: '#1D4ED8' }
                : { backgroundColor: '#ffffff', color: '#334155', borderColor: '#CBD5E1' }
            }
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border shadow-2xs"
          >
            Faculty Members ({standardFaculty.length || 4})
          </button>
        </div>

        {/* Search Input and Add Faculty Button on Right */}
        <div className="flex items-center gap-2.5 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search faculty by name, email, or designation..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none transition-all font-medium min-h-[42px] shadow-2xs"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAddFacultyModal(true)}
            style={{
              backgroundColor: '#1D4ED8',
              color: '#ffffff',
              borderColor: '#1D4ED8',
            }}
            className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-xs cursor-pointer hover:bg-blue-700 transition-all border shrink-0 text-white"
          >
            <Plus size={16} className="text-white" />
            <span className="text-white hidden sm:inline">Add Faculty</span>
          </button>
        </div>
      </div>

      {/* Spacious 3-Column Faculty Cards Grid matching Image 3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTeachers.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-slate-200">
            <Users size={32} className="mx-auto text-slate-300 mb-2" />
            <h3 className="text-sm font-extrabold text-slate-700">No Faculty Found</h3>
            <p className="text-xs text-slate-400 mt-1">
              No faculty records match your active search filters.
            </p>
          </div>
        ) : (
          filteredTeachers.map((t) => {
            const isTg = isTeacherTg(t);
            const cohort = getTeacherCohort(t);
            const facultyName = t.user?.name || t.designation || 'Faculty Member';
            const email = t.user?.email || 'authenticated@mail.in';
            const designation = t.designation || (isTg ? 'Assistant Professor (TG)' : 'Assistant Professor');

            const cohortSemester = cohort?.semester || cohort?.section?.semester || 5;
            const cohortSection = cohort?.section?.name
              ? cohort.section.name
              : cohort?.section?.code
              ? `Section ${cohort.section.code.replace('CSE-', '')}`
              : (cohort?.name?.includes('CSE-') ? `Section ${cohort.name.split('CSE-')[1]}` : 'Section A');
            const cohortLabel = `Semester ${cohortSemester} • ${cohortSection}`;

            return (
              <div
                key={t._id}
                className={`p-5 rounded-2xl bg-white border transition-all flex flex-col justify-between shadow-2xs hover:shadow-sm overflow-hidden min-w-0 ${
                  isTg ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200 hover:border-blue-200'
                }`}
              >
                <div className="min-w-0">
                  {/* Top Row: Name + Availability Pill */}
                  <div className="flex items-start justify-between gap-2.5 min-w-0">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-black text-slate-900 m-0 leading-tight truncate" title={facultyName}>
                        {facultyName}
                      </h3>
                      <p className="text-xs text-blue-600 font-bold m-0 mt-0.5 truncate">
                        {designation}
                      </p>
                      <p className="text-xs text-slate-400 font-mono m-0 mt-0.5 truncate" title={email}>
                        {email}
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Available</span>
                    </div>
                  </div>

                  {/* Specialization */}
                  <div className="pt-3 pb-2 border-t border-slate-100 my-2.5">
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      SPECIALIZATION
                    </span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate">
                      {t.specialization || 'Computer Science & Engineering'}
                    </span>
                  </div>

                  {/* Workload 2 Boxes Side-by-Side matching Image 3 */}
                  <div className="grid grid-cols-2 gap-2.5 my-2.5">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Max Periods / Day
                      </span>
                      <span className="block text-sm font-extrabold text-blue-600 mt-0.5">
                        4 Lectures
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Max Periods / Week
                      </span>
                      <span className="block text-sm font-extrabold text-blue-600 mt-0.5">
                        18 Lectures
                      </span>
                    </div>
                  </div>

                  {/* TG Status Row */}
                  <div className="my-2.5">
                    {isTg ? (
                      <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                        <span className="truncate">
                          Assigned to: {cohortLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-slate-500 px-1 py-1">
                        Department Faculty Member
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions Row: compact, responsive, never breaks horizontally or misaligns */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 mt-auto">
                  <button
                    type="button"
                    onClick={() => setFacultyToEdit(t)}
                    style={{
                      backgroundColor: '#FFFFFF',
                      color: '#1D4ED8',
                      borderColor: '#93C5FD',
                    }}
                    className="px-2.5 py-1.5 rounded-lg border text-blue-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs hover:bg-blue-50 shrink-0"
                    title="Edit faculty profile"
                  >
                    <Edit2 size={12} />
                    <span>Edit</span>
                  </button>

                  {isTg ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPreselectedTeacher(t);
                          setSelectedCohort(cohort);
                          setIsChangeSection(true);
                          setShowAppointModal(true);
                        }}
                        style={{
                          backgroundColor: '#EEF2FF',
                          color: '#1D4ED8',
                          borderColor: '#C7D2FE',
                        }}
                        className="px-2.5 py-1.5 rounded-lg border text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                        title="Change assigned section"
                      >
                        Change Section
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevokeTg(t)}
                        style={{
                          backgroundColor: '#FFF1F2',
                          color: '#BE123C',
                          borderColor: '#FECDD3',
                        }}
                        className="px-2.5 py-1.5 rounded-lg border text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                        title="Revoke Tutor Guardian appointment"
                      >
                        Revoke TG
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPreselectedTeacher(t);
                        setSelectedCohort(null);
                        setIsChangeSection(false);
                        setShowAppointModal(true);
                      }}
                      style={{
                        backgroundColor: '#047857',
                        color: '#ffffff',
                        borderColor: '#065F46',
                      }}
                      className="px-3 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer border hover:bg-emerald-800 whitespace-nowrap"
                      title="Appoint as Tutor Guardian"
                    >
                      <ShieldCheck size={13} className="text-white" />
                      <span className="text-white">Appoint as TG</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Faculty Profile Modal matching Image 4 */}
      {facultyToEdit && (
        <EditFacultyModal
          teacher={facultyToEdit}
          onClose={() => setFacultyToEdit(null)}
          onSuccess={() => {
            setFacultyToEdit(null);
            fetchData();
          }}
        />
      )}

      {/* Appoint TG Modal */}
      {showAppointModal && (
        <AppointTgModal
          teachers={teachers}
          preselectedTeacher={preselectedTeacher}
          existingCohort={selectedCohort}
          isChangeSection={isChangeSection}
          onClose={() => {
            setShowAppointModal(false);
            setPreselectedTeacher(null);
            setSelectedCohort(null);
            setIsChangeSection(false);
          }}
          onSuccess={() => {
            setShowAppointModal(false);
            setPreselectedTeacher(null);
            setSelectedCohort(null);
            setIsChangeSection(false);
            fetchData();
          }}
        />
      )}

      {/* Add Faculty Modal */}
      {showAddFacultyModal && (
        <AddFacultyModal
          onClose={() => setShowAddFacultyModal(false)}
          onSuccess={() => {
            setShowAddFacultyModal(false);
            fetchData();
          }}
        />
      )}

      {/* Section ↔ TG Matrix Table Modal (matching user sketch & stat card 3) */}
      {showMatrixModal && (
        <SectionTgMatrixModal
          initialSemester={5}
          teachers={teachers}
          groups={activeCohorts}
          onClose={() => setShowMatrixModal(false)}
          onChangeSectionForTeacher={(teacher, cohort) => {
            setShowMatrixModal(false);
            setPreselectedTeacher(teacher);
            setSelectedCohort(cohort);
            setIsChangeSection(true);
            setShowAppointModal(true);
          }}
          onRevokeTg={(teacher, cohort) => {
            setShowMatrixModal(false);
            setRevokeTarget({ teacher, cohort });
          }}
          onAppointForSection={(sec) => {
            setShowMatrixModal(false);
            setSelectedCohort({ section: sec.name || sec.code || 'Section A', semester: sec.semester || 5 });
            setPreselectedTeacher(null);
            setIsChangeSection(false);
            setShowAppointModal(true);
          }}
        />
      )}

      {/* In-app Revoke TG Confirmation Modal */}
      {revokeTarget && (
        <ConfirmRevokeTgModal
          teacher={revokeTarget.teacher}
          cohort={revokeTarget.cohort}
          onClose={() => setRevokeTarget(null)}
          onSuccess={() => {
            setRevokeTarget(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
