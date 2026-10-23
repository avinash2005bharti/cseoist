import React, { useState, useEffect } from 'react';
import {
  X,
  GraduationCap,
  Users,
  ShieldCheck,
  AlertCircle,
  Edit2,
  UserCheck,
  ArrowRight,
  UserX,
} from 'lucide-react';
import { masterDataApi, mentorshipApi } from '../../api';

export default function SectionTgMatrixModal({
  initialSemester = 5,
  teachers = [],
  groups = [],
  onClose,
  onAppointForSection,
  onChangeSectionForTeacher,
  onRevokeTg,
}) {
  const [selectedSemester, setSelectedSemester] = useState(initialSemester);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [secRes, stuRes] = await Promise.allSettled([
          masterDataApi.getSections(),
          masterDataApi.getStudents({ all: 'true' }),
        ]);
        if (secRes.status === 'fulfilled' && secRes.value?.data?.length) {
          setSections(secRes.value.data);
        } else {
          setSections([
            { _id: 'sec_a', name: 'Section A', code: 'CSE-A', semester: 5 },
            { _id: 'sec_b', name: 'Section B', code: 'CSE-B', semester: 5 },
            { _id: 'sec_c', name: 'Section C', code: 'CSE-C', semester: 5 },
            { _id: 'sec_d', name: 'Section D', code: 'CSE-D', semester: 5 },
          ]);
        }

        if (stuRes.status === 'fulfilled' && stuRes.value?.data) {
          setStudents(stuRes.value.data);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Filter active groups for selected semester
  const activeGroups = groups.filter(
    (g) => g.isActive !== false && Number(g.semester || g.section?.semester || 5) === Number(selectedSemester)
  );

  // Standard sections list for selected semester
  const semesterSections = sections.filter(
    (s) => Number(s.semester || 5) === Number(selectedSemester)
  );

  const displaySections = semesterSections.length > 0 ? semesterSections : [
    { _id: `sec_a_${selectedSemester}`, name: 'Section A', code: 'CSE-A', semester: selectedSemester },
    { _id: `sec_b_${selectedSemester}`, name: 'Section B', code: 'CSE-B', semester: selectedSemester },
    { _id: `sec_c_${selectedSemester}`, name: 'Section C', code: 'CSE-C', semester: selectedSemester },
    { _id: `sec_d_${selectedSemester}`, name: 'Section D', code: 'CSE-D', semester: selectedSemester },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container max-w-4xl w-[96%] max-h-[92vh] overflow-y-auto bg-white p-6 sm:p-7 rounded-3xl text-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching user annotation */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200 shadow-2xs">
              <GraduationCap size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 m-0">
                Section ↔ Tutor Guardian Allocations
              </h2>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Departmental Class Section & Tutor Guardian Allocation Matrix
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Top Filter Bar: Select Semester */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 my-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2.5">
            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
              Select Semester:
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(Number(e.target.value))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-blue-700 focus:outline-none cursor-pointer shadow-2xs"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={sem}>
                  Semester {sem}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Academic Session:</span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 text-xs font-black">
              2025-26
            </span>
          </div>
        </div>

        {/* Table: section | tg name */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Section</th>
                <th className="py-3 px-4">TG Name</th>
                <th className="py-3 px-4">Enrolled Students</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {displaySections.map((sec) => {
                const secLetter = sec.name.replace(/Section\s*/i, '').trim().toUpperCase();

                // Find active cohort for this section
                const group = activeGroups.find((g) => {
                  const gSecId = g.section?._id?.toString() || g.section?.toString();
                  if (gSecId && sec._id && gSecId === sec._id.toString()) return true;
                  const gCode = (g.section?.code || g.section?.name || g.name || '').toUpperCase();
                  return gCode.includes(`CSE-${secLetter}`) || gCode.includes(`SECTION ${secLetter}`);
                });

                // Find assigned teacher
                const assignedTeacher = group?.tg
                  ? teachers.find(
                      (t) =>
                        t._id?.toString() === (group.tg?._id || group.tg)?.toString() ||
                        t.user?._id?.toString() === (group.tg?._id || group.tg)?.toString()
                    ) || group.tg
                  : null;

                const teacherName =
                  assignedTeacher?.user?.name ||
                  assignedTeacher?.name ||
                  assignedTeacher?.designation ||
                  null;

                const teacherEmail =
                  assignedTeacher?.user?.email || assignedTeacher?.email || null;

                // Count students enrolled in this section
                const secStudentCount = students.filter((s) => {
                  const sSecId = s.section?._id?.toString() || s.section?.toString();
                  if (sSecId && sec._id && sSecId === sec._id.toString()) return true;
                  const sSecName = (s.section?.name || s.section?.code || '').toUpperCase();
                  return sSecName.includes(secLetter);
                }).length;

                return (
                  <tr key={sec._id || secLetter} className="hover:bg-slate-50/80 transition-colors">
                    {/* Section */}
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-black text-xs flex items-center justify-center shrink-0">
                          {secLetter}
                        </span>
                        <div>
                          <span className="block font-black text-slate-900">{sec.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {sec.code || `CSE-${secLetter}`} • Sem {selectedSemester}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* TG Name */}
                    <td className="py-3.5 px-4">
                      {teacherName ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-900">{teacherName}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Appointed TG
                            </span>
                          </div>
                          {teacherEmail && (
                            <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                              {teacherEmail}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs">
                          <AlertCircle size={13} />
                          <span>No TG Appointed</span>
                        </div>
                      )}
                    </td>

                    {/* Enrolled Students */}
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      <span className="font-extrabold text-slate-900">{secStudentCount}</span> students
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      {assignedTeacher ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onChangeSectionForTeacher(assignedTeacher, group);
                            }}
                            style={{
                              backgroundColor: '#EEF2FF',
                              color: '#1D4ED8',
                              borderColor: '#C7D2FE',
                            }}
                            className="px-2.5 py-1.5 rounded-lg border text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer shadow-2xs"
                          >
                            Change Section
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onRevokeTg(assignedTeacher);
                            }}
                            style={{
                              backgroundColor: '#FFF1F2',
                              color: '#BE123C',
                              borderColor: '#FECDD3',
                            }}
                            className="px-2.5 py-1.5 rounded-lg border text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer shadow-2xs"
                          >
                            Revoke TG
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onAppointForSection(secLetter, selectedSemester);
                          }}
                          style={{
                            backgroundColor: '#047857',
                            color: '#ffffff',
                            borderColor: '#065F46',
                          }}
                          className="px-3 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer border hover:bg-emerald-800 transition-colors ml-auto"
                        >
                          <ShieldCheck size={13} className="text-white" />
                          <span className="text-white">Appoint TG</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
          <span className="text-xs text-slate-500 font-medium">
            Tutor Guardians handle first-tier review and attendance consideration credit for their section.
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: '#ffffff',
              color: '#334155',
              borderColor: '#CBD5E1',
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 border cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
