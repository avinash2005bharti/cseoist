import React, { useEffect, useState } from 'react';
import { useERP } from '../../context/ERPContext.jsx';
import { masterDataApi } from '../../api/modulesApi.js';
import {
  GraduationCap,
  Search,
  Users,
  ShieldCheck,
  Mail,
  Phone,
  Edit2,
  Trash2,
  Plus,
  RefreshCw,
  X,
  UserCheck,
} from 'lucide-react';
import AddStudentModal from '../../components/modals/AddStudentModal.jsx';
import EditStudentModal from '../../components/modals/EditStudentModal.jsx';
import { getSectionLetter } from '../../utils/constants.js';

export default function HodStudents() {
  const { addToast } = useERP();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [sectionFilter, setSectionFilter] = useState('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await masterDataApi.getStudents();
      setStudents(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteStudent = async (student) => {
    const studentName = student.user?.name || student.rollNumber || 'Student';
    if (!window.confirm(`Are you sure you want to remove ${studentName} from the roster?`)) {
      return;
    }

    try {
      await masterDataApi.deleteStudent(student._id);
      addToast('Student Removed', `${studentName} was removed from the roster.`, 'info');
      fetchData();
    } catch (err) {
      addToast('Error', err?.message || 'Failed to remove student.', 'error');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const filteredStudents = students.filter((st) => {
    const name = (st.user?.name || '').toLowerCase();
    const roll = (st.rollNumber || '').toLowerCase();
    const enrollment = (st.enrollmentNumber || '').toLowerCase();
    const email = (st.user?.email || '').toLowerCase();
    const q = search.toLowerCase();

    const matchesSearch =
      !search ||
      name.includes(q) ||
      roll.includes(q) ||
      enrollment.includes(q) ||
      email.includes(q);

    const matchesSection =
      sectionFilter === 'ALL' || getSectionLetter(st.section) === sectionFilter.toUpperCase();

    const sem = st.semester || st.section?.semester || 5;
    const matchesSemester =
      semesterFilter === 'ALL' || Number(sem) === Number(semesterFilter);

    return matchesSearch && matchesSection && matchesSemester;
  });

  return (
    <div className="flex flex-col gap-5 w-full min-w-0 font-sans">
      {/* Header matching Image 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight m-0">
              Department Student Directory
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black">
              {filteredStudents.length} of {students.length} Students
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium m-0">
            Official student directory and section allocation records.
          </p>
        </div>

        {/* Action Buttons: Refresh & Add Student */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchData}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer min-h-[42px]"
            title="Refresh student directory"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : 'text-slate-500'} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer min-h-[42px]"
          >
            <Plus size={16} />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar matching Image 1 annotations */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student by name, email, or enrollment number..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none transition-all font-medium min-h-[42px]"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Select Semester Filter matching Image 1 */}
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer min-h-[42px] transition-all shadow-2xs"
            aria-label="Filter by Semester"
          >
            <option value="ALL">All Semesters</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
            <option value="3">Semester 3</option>
            <option value="4">Semester 4</option>
            <option value="5">Semester 5</option>
            <option value="6">Semester 6</option>
            <option value="7">Semester 7</option>
            <option value="8">Semester 8</option>
          </select>

          {/* All Sections Filter matching Image 1 */}
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer min-h-[42px] transition-all shadow-2xs"
            aria-label="Filter by Section"
          >
            <option value="ALL">All Sections</option>
            <option value="A">Section A</option>
            <option value="B">Section B</option>
            <option value="C">Section C</option>
            <option value="D">Section D</option>
          </select>

          {(semesterFilter !== 'ALL' || sectionFilter !== 'ALL' || search) && (
            <button
              type="button"
              onClick={() => {
                setSemesterFilter('ALL');
                setSectionFilter('ALL');
                setSearch('');
              }}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
              title="Reset all filters"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Student Cards Grid matching Image 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-2xs">
            <Users size={36} className="mx-auto text-slate-300 mb-2" />
            <h3 className="text-base font-black text-slate-800">No Students Found</h3>
            <p className="text-xs text-slate-400 mt-1">
              No enrolled student records match your active search filters.
            </p>
          </div>
        ) : (
          filteredStudents.map((st) => {
            const studentName = st.user?.name || st.rollNumber || 'Student';
            const rollNo = st.rollNumber || st.enrollmentNumber || 'CF05/CS24/105';
            const email = st.user?.email || 'authenticated@gmail.com';
            const phone = st.user?.phone || '+918305072434';
            const sem = st.semester || st.section?.semester || 5;
            const sec = st.section?.name?.replace(/Section\s*/i, '') || st.section?.code || 'B';
            const batch = st.batch || 'Batch 2023';
            const isActive = st.user?.isActive !== false;
            const initials = getInitials(studentName);

            return (
              <div
                key={st._id}
                className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Row: Avatar + Name + Roll + Status Pill */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Initials Avatar matching Image 1 */}
                      <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-black text-sm flex items-center justify-center shrink-0 shadow-2xs">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-black text-slate-900 m-0 uppercase leading-snug truncate">
                          {studentName}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono m-0 mt-0.5 truncate">
                          {rollNo}
                        </p>
                      </div>
                    </div>

                    {/* Status Pill matching Image 1 */}
                    <div className="shrink-0">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>ACTIVE</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>SUSPENDED</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle Row: Academic Class + Semester */}
                  <div className="grid grid-cols-2 gap-3 py-3 border-t border-slate-100 my-2">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        ACADEMIC CLASS
                      </span>
                      <span className="block text-xs font-black text-slate-800 mt-0.5 truncate">
                        {batch} • Sec {sec}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        SEMESTER
                      </span>
                      <span className="block text-xs font-black text-blue-600 mt-0.5 truncate">
                        Semester {sem}
                      </span>
                    </div>
                  </div>

                  {/* Contact Info Lines: Email & Phone */}
                  <div className="space-y-1.5 py-1">
                    <div className="flex items-center gap-2 text-xs text-slate-600 font-medium truncate">
                      <Mail size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate" title={email}>
                        {email}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                      <Phone size={13} className="text-slate-400 shrink-0" />
                      <span className="font-mono">{phone}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Row matching Image 1 */}
                <div className="pt-3.5 border-t border-slate-100 flex items-center justify-end gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setStudentToEdit(st)}
                    className="px-3.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteStudent(st)}
                    className="px-3.5 py-1.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Student Modal */}
      {studentToEdit && (
        <EditStudentModal
          student={studentToEdit}
          onClose={() => setStudentToEdit(null)}
          onSuccess={() => {
            setStudentToEdit(null);
            fetchData();
          }}
        />
      )}

      {/* Enroll New Student Modal */}
      {showAddModal && (
        <AddStudentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
