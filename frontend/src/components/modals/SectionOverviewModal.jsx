import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Search, ExternalLink, Users, UserCheck, GraduationCap, Phone, Mail, Loader2 } from 'lucide-react';
import { masterDataApi, mentorshipApi } from '../../api';
import { getSectionLetter } from '../../utils/constants.js';

export default function SectionOverviewModal({
  initialSection = 'B',
  initialSemester = 5,
  onClose,
  onOpenClassesCentral,
}) {
  const [selectedSection, setSelectedSection] = useState(() => getSectionLetter(initialSection) || initialSection || 'B');
  const [currentSemester, setCurrentSemester] = useState(Number(initialSemester) || 5);
  const [students, setStudents] = useState([]);
  const [mentorGroups, setMentorGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialSemester) setCurrentSemester(Number(initialSemester));
  }, [initialSemester]);

  useEffect(() => {
    if (initialSection) setSelectedSection(getSectionLetter(initialSection) || initialSection || 'B');
  }, [initialSection]);

  const [dbSections, setDbSections] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studentsRes, sectionsRes, groupsRes] = await Promise.allSettled([
        masterDataApi.getStudents({ all: 'true' }),
        masterDataApi.getSections(),
        mentorshipApi.listGroups(),
      ]);
      if (studentsRes.status === 'fulfilled') setStudents(studentsRes.value?.data || []);
      if (sectionsRes.status === 'fulfilled') setDbSections(sectionsRes.value?.data || []);
      if (groupsRes.status === 'fulfilled') setMentorGroups(groupsRes.value?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const semesterDbSections = dbSections.filter(
    (s) => Number(s.semester) === Number(currentSemester)
  );

  const dynamicLetters = semesterDbSections
    .map((s) => getSectionLetter(s) || s.code?.replace('CSE-', '') || s.name?.replace('Section ', ''))
    .filter(Boolean);
  const baseLetters = ['A', 'B', 'C', 'D'];
  const allLetters = [...new Set([...baseLetters, ...dynamicLetters])];

  const palette = [
    { bgColor: '#F0F6FE', borderColor: '#BFDBFE' },
    { bgColor: '#FAF5FF', borderColor: '#E9D5FF' },
    { bgColor: '#F0FDF4', borderColor: '#BBF7D0' },
    { bgColor: '#FFF7ED', borderColor: '#FED7AA' },
    { bgColor: '#FEF2F2', borderColor: '#FECACA' },
    { bgColor: '#F5F3FF', borderColor: '#DDD6FE' },
  ];

  const sectionOptions = allLetters.map((letCode, idx) => {
    const pal = palette[idx % palette.length];
    const secDoc = semesterDbSections.find((s) => getSectionLetter(s) === letCode);
    return {
      id: letCode,
      code: `CSE-${letCode}`,
      label: `CSE-${letCode}`,
      capacity: secDoc?.capacity || 60,
      bgColor: pal.bgColor,
      borderColor: pal.borderColor,
    };
  });

  const semesterStudents = students.filter((s) => {
    const sem = s.semester || s.section?.semester;
    return Number(sem) === Number(currentSemester);
  });

  // Count per section for the current semester using precise letter extraction
  const getSectionCount = (secId) => {
    return semesterStudents.filter((s) => getSectionLetter(s.section) === secId).length;
  };

  const currentSectionStudents = semesterStudents.filter((s) => {
    return getSectionLetter(s.section) === selectedSection;
  });

  const activeSecDoc = semesterDbSections.find((s) => getSectionLetter(s) === selectedSection);
  const activeCapacity = activeSecDoc?.capacity || 60;

  // Display enrolled students from database
  const displayStudents = currentSectionStudents;

  const filteredStudents = displayStudents.filter((s) => {
    const name = (s.user?.name || '').toLowerCase();
    const roll = (s.rollNumber || '').toLowerCase();
    const enroll = (s.enrollmentNumber || '').toLowerCase();
    const email = (s.user?.email || '').toLowerCase();
    const q = search.toLowerCase().trim();
    return !q || name.includes(q) || roll.includes(q) || enroll.includes(q) || email.includes(q);
  });

  // Accurate assigned TG resolution
  const matchedGroup = mentorGroups.find((g) => {
    const groupSem = Number(g.semester || g.section?.semester);
    const groupSec = getSectionLetter(g.section);
    return groupSem === Number(currentSemester) && groupSec === selectedSection && g.isActive !== false;
  });

  const assignedTgObj = matchedGroup?.tg || currentSectionStudents[0]?.mentorGroup?.tg;
  const assignedTgName =
    assignedTgObj?.user?.name ||
    assignedTgObj?.name ||
    assignedTgObj?.designation ||
    (matchedGroup ? 'Appointed TG' : 'Not Appointed');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container max-w-4xl w-[96%] max-h-[92vh] overflow-y-auto bg-white p-6 sm:p-8 rounded-3xl text-slate-900 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching image3.png */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <h2 className="text-base sm:text-lg font-black text-slate-900 m-0">
                Section Overview (CSE Only)
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium m-0 mt-1">
              Select a section card below to view enrolled students and assigned Tutor Guardian (TG).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-slate-500 mr-0.5">Current:</span>
            <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 shadow-2xs">
              Sem {currentSemester}
            </span>

            {/* Move to Previous Semester button as requested in user feedback */}
            <button
              type="button"
              onClick={() => setCurrentSemester((prev) => Math.max(1, prev - 1))}
              disabled={currentSemester <= 1}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title={currentSemester > 1 ? `Go to Semester ${currentSemester - 1}` : 'First semester reached'}
            >
              <ArrowLeft size={14} />
              <span>Move to Prev Semester {currentSemester > 1 ? `(Sem ${currentSemester - 1})` : ''}</span>
            </button>

            {/* Move to Next Semester button */}
            <button
              type="button"
              onClick={() => setCurrentSemester((prev) => Math.min(8, prev + 1))}
              disabled={currentSemester >= 8}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title={currentSemester < 8 ? `Go to Semester ${currentSemester + 1}` : 'Last semester reached'}
            >
              <span>Move to Next Semester {currentSemester < 8 ? `(Sem ${currentSemester + 1})` : ''}</span>
              <ArrowRight size={14} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 ml-1 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Section Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {sectionOptions.map((opt) => {
            const count = getSectionCount(opt.id);
            const isSelected = selectedSection === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedSection(opt.id)}
                style={
                  isSelected
                    ? {
                        backgroundColor: '#2563EB',
                        borderColor: '#1D4ED8',
                        color: '#FFFFFF',
                        boxShadow: '0 8px 20px -3px rgba(37, 99, 235, 0.45), 0 0 0 3px rgba(147, 197, 253, 0.6)',
                        transform: 'translateY(-2px)',
                      }
                    : {
                        backgroundColor: opt.bgColor,
                        borderColor: opt.borderColor,
                        color: '#0F172A',
                      }
                }
                className="p-3.5 rounded-2xl text-center border-2 transition-all cursor-pointer shadow-xs"
              >
                <span
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '900',
                    color: isSelected ? '#FFFFFF' : '#0F172A',
                    letterSpacing: '0.02em',
                  }}
                >
                  {opt.label}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: isSelected ? '#DBEAFE' : '#64748B',
                    marginTop: '2px',
                  }}
                >
                  {count} / {opt.capacity} Students
                </span>
                {isSelected ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '6px',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '10px',
                      fontWeight: '800',
                      backgroundColor: '#FFFFFF',
                      color: '#1D4ED8',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                    }}
                  >
                    ✓ Selected
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '6px',
                      fontSize: '10px',
                      visibility: 'hidden',
                    }}
                  >
                    &nbsp;
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Student details Subheader */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <GraduationCap size={15} />
            </div>
            <span className="text-sm font-black text-slate-900">
              student details
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
              CSE-{selectedSection} - {displayStudents.length} / {activeCapacity} Enrolled (Capacity: {activeCapacity})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5">
              <UserCheck size={14} className="text-blue-600" />
              <span>TG : {assignedTgName}</span>
            </span>
          </div>
        </div>

        {/* Search Bar & Result Count */}
        <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student by name, enrollment, or email..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
            Showing {filteredStudents.length} of {displayStudents.length} students
          </span>
        </div>

        {/* Student Table matching image3.png */}
        <div className="mt-3.5 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs shrink-0">
          <div className="overflow-x-auto min-h-[220px] max-h-[380px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200">
                <tr className="text-slate-600 font-black text-[11px] tracking-wider uppercase">
                  <th className="p-3.5">NAME</th>
                  <th className="p-3.5">ENROLLMENT</th>
                  <th className="p-3.5">PHONE NUMBER</th>
                  <th className="p-3.5">EMAIL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 size={24} className="animate-spin text-blue-600" />
                        <span className="text-xs font-bold text-slate-600">Loading student roster...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500 py-2">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5 border border-blue-100">
                          <GraduationCap size={22} />
                        </div>
                        <span className="text-sm font-black text-slate-800">
                          {search ? 'No matching students found' : `No students enrolled in Semester ${currentSemester} • CSE-${selectedSection}`}
                        </span>
                        <p className="text-xs text-slate-400 mt-1 max-w-md m-0">
                          {search
                            ? `No students in CSE-${selectedSection} match "${search}". Try searching by another keyword.`
                            : `Section CSE-${selectedSection} has 0 enrolled students out of ${activeCapacity} capacity. You can provision new student user IDs from the Admin Dashboard.`}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => {
                    const name = st.user?.name || st.designation || 'Student';
                    const enroll = st.enrollmentNumber || st.rollNumber || 'Not provided';
                    const phone = st.user?.phone || 'Not provided';
                    const email = st.user?.email || 'Not provided';
                    const initial = name.charAt(0).toUpperCase();

                    return (
                      <tr key={st._id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="p-3.5 flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center text-[11px] border border-blue-200 shrink-0">
                            {initial}
                          </span>
                          <span className="font-extrabold text-slate-900">{name}</span>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-mono text-[11px] font-bold">
                            {enroll}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                            <Phone size={13} className="text-emerald-600 shrink-0" />
                            <span>{phone}</span>
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1.5 text-blue-600 truncate max-w-xs font-semibold">
                            <Mail size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate">{email}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer matching image3.png */}
        <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={() => {
              if (onOpenClassesCentral) onOpenClassesCentral();
              onClose();
            }}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <span>Manage in Classes Central</span>
            <ExternalLink size={13} className="text-slate-400" />
          </button>

          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
