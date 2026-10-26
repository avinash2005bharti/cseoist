import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Search, ExternalLink, Users, UserCheck, GraduationCap, Phone, Mail, Loader2, Layers } from 'lucide-react';
import { masterDataApi, mentorshipApi } from '../../api';
import { getSectionLetter } from '../../utils/constants.js';
import MoveSemesterModal from './MoveSemesterModal.jsx';

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
  const [moveTarget, setMoveTarget] = useState(null);

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
        className="modal-container max-w-4xl w-[96%] max-h-[92vh] overflow-y-auto bg-white p-5 sm:p-8 rounded-3xl text-slate-900 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Screen 26.png */}
        <div className="pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Users size={20} className="text-[#4F46E5] sm:text-blue-600" />
                <h2 className="text-base sm:text-lg font-black text-slate-900 m-0">
                  Section Overview (CSE Only)
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium m-0 mt-1">
                Select a section card below to view enrolled students and assigned Tutor Guardian (TG).
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Controls matching Screen 26.png */}
          <div className="mt-3.5 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 mr-0.5">Current:</span>
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 shadow-2xs">
                Sem {currentSemester}
              </span>

              {/* Move to Previous Semester button matching Screen 26.png */}
              <button
                type="button"
                onClick={() => setCurrentSemester((prev) => Math.max(1, prev - 1))}
                disabled={currentSemester <= 1}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                title={currentSemester > 1 ? `Go to Semester ${currentSemester - 1}` : 'First semester reached'}
              >
                <span>← Move to Prev Semester {currentSemester > 1 ? `(Sem ${currentSemester - 1})` : ''}</span>
              </button>
            </div>

            {/* Move to Next Semester button matching Screen 26.png */}
            <button
              type="button"
              onClick={() => setCurrentSemester((prev) => Math.min(8, prev + 1))}
              disabled={currentSemester >= 8}
              className="hod-btn-move-next w-full sm:w-auto px-4 py-2 sm:py-1.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title={currentSemester < 8 ? `Go to Semester ${currentSemester + 1}` : 'Last semester reached'}
            >
              <span>Move to Next Semester {currentSemester < 8 ? `(Sem ${currentSemester + 1})` : ''} →</span>
            </button>
          </div>
        </div>

        {/* Section Cards Row matching Screen 26.png */}
        <div className="hod-section-cards-track no-scrollbar mt-2">
          {sectionOptions.map((opt) => {
            const count = getSectionCount(opt.id);
            const isSelected = selectedSection === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedSection(opt.id)}
                className={`hod-section-card-btn ${isSelected ? 'is-selected' : ''}`}
              >
                <span className="block text-sm font-black text-slate-900 tracking-tight">
                  {opt.label}
                </span>
                <span className="block text-xs font-semibold text-slate-500 mt-1">
                  {count} / {opt.capacity} Students
                </span>
                {isSelected ? (
                  <span className="inline-flex items-center justify-center gap-1 mt-1 text-[11px] font-bold text-blue-600">
                    <span>✓</span>
                    <span>Selected</span>
                  </span>
                ) : (
                  <span className="inline-block mt-1 text-[11px] invisible select-none">
                    &nbsp;
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Student details Subheader matching Screen 26.png */}
        <div className="mt-4 pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <GraduationCap size={15} />
            </div>
            <span className="text-sm font-black text-slate-900">
              Student Details
            </span>
          </div>

          <div className="mb-2.5">
            <span className="inline-block px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 shadow-2xs">
              CSE-{selectedSection} · {displayStudents.length} / {activeCapacity} Enrolled (Capacity: {activeCapacity})
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-[#CFFAFE] text-[#0891B2] text-xs font-bold flex items-center gap-1.5">
              <span>TG: {assignedTgName}</span>
            </span>

            {/* Quick Promote / Demote for active section matching Screen 26.png */}
            {(() => {
              const currentSecDoc = semesterDbSections.find((s) => getSectionLetter(s) === selectedSection) || {
                _id: 'temp-' + selectedSection,
                semester: currentSemester,
                code: `CSE-${selectedSection}`,
                name: `Section ${selectedSection}`,
                studentCount: displayStudents.length,
                capacity: activeCapacity,
              };

              return (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentSemester <= 1}
                    onClick={() => setMoveTarget({ section: currentSecDoc, direction: 'prev' })}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 disabled:opacity-40 cursor-pointer shadow-2xs transition-colors"
                    title={`Demote to Semester ${currentSemester - 1}`}
                  >
                    ◀ Demote
                  </button>
                  <button
                    type="button"
                    disabled={currentSemester >= 8}
                    onClick={() => setMoveTarget({ section: currentSecDoc, direction: 'next' })}
                    className="hod-btn-promote px-3.5 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-40 cursor-pointer shadow-xs transition-colors"
                    title={`Promote to Semester ${currentSemester + 1}`}
                  >
                    Promote ▶
                  </button>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Search Bar & Result Count matching Screen 26.png */}
        <div className="mt-3.5">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student by name, enrollment, or email..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
            />
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            Showing {filteredStudents.length} of {displayStudents.length} students
          </div>
        </div>

        {/* Mobile View: Student Cards matching Screen 26.png */}
        <div className="block sm:hidden mt-3">
          {loading ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
              <Loader2 size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
              <span className="text-xs font-bold text-slate-600">Loading student directory...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
              <GraduationCap size={22} className="mx-auto text-blue-600 mb-2" />
              <span className="text-sm font-black text-slate-800">
                {search ? 'No matching students found' : `No students enrolled in Semester ${currentSemester} • CSE-${selectedSection}`}
              </span>
              <p className="text-xs text-slate-400 mt-1 max-w-md m-0">
                {search
                  ? `No students in CSE-${selectedSection} match "${search}".`
                  : `Section CSE-${selectedSection} currently has 0 enrolled students out of ${activeCapacity} capacity.`}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden shadow-2xs">
              {filteredStudents.map((st) => {
                const name = st.user?.name || st.designation || 'Student';
                const enroll = st.enrollmentNumber || st.rollNumber || 'Not provided';
                const phone = st.user?.phone || 'Not provided';
                const email = st.user?.email || 'Not provided';

                return (
                  <div key={st._id} className="p-4 space-y-1">
                    <h4 className="font-extrabold text-sm text-slate-900 m-0">{name}</h4>
                    <p className="text-xs font-mono text-slate-600 m-0">{enroll}</p>
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 pt-0.5">
                      <span className="text-emerald-600 font-bold">☎</span>
                      <span>{phone}</span>
                    </div>
                    <div className="text-xs text-blue-600 font-medium truncate">
                      {email}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden sm:block mt-3 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs shrink-0">
          <div className="overflow-x-auto min-h-[200px] max-h-[360px] overflow-y-auto">
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
                        <span className="text-xs font-bold text-slate-600">Loading student directory...</span>
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
                            : `Section CSE-${selectedSection} has 0 enrolled students out of ${activeCapacity} capacity.`}
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

        {/* Footer */}
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
            className="hod-btn-primary-blue px-6 py-2 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Move Semester Modal */}
      {moveTarget && (
        <MoveSemesterModal
          section={moveTarget.section}
          direction={moveTarget.direction}
          onClose={() => setMoveTarget(null)}
          onSuccess={() => {
            setMoveTarget(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
