import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, UserCheck, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { mentorshipApi, masterDataApi } from '../../api';
import { useERP } from '../../context/ERPContext.jsx';
import { DEFAULT_ACADEMIC_SESSION, getSectionLetter } from '../../utils/constants.js';

export default function AppointTgModal({
  teachers = [],
  preselectedTeacher = null,
  existingCohort = null,
  isChangeSection = false,
  onClose,
  onSuccess,
}) {
  const { addToast } = useERP();

  const [availableSections, setAvailableSections] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState(
    preselectedTeacher?._id || existingCohort?.tg?._id || existingCohort?.tg || teachers[0]?._id || ''
  );

  const initialSemester = existingCohort?.semester
    ? `Semester ${existingCohort.semester}`
    : 'Semester 5';

  const initialSection = typeof existingCohort?.section === 'string'
    ? (existingCohort.section.startsWith('Section ') ? existingCohort.section : `Section ${existingCohort.section}`)
    : existingCohort?.section?.name
    ? existingCohort.section.name
    : existingCohort?.section?.code
    ? `Section ${existingCohort.section.code.replace('CSE-', '')}`
    : existingCohort?.name?.includes('CSE-')
    ? `Section ${existingCohort.name.split('CSE-')[1]?.trim()}`
    : 'Section A';

  const [semester, setSemester] = useState(initialSemester);
  const [section, setSection] = useState(initialSection);
  const [session, setSession] = useState(existingCohort?.academicYear || DEFAULT_ACADEMIC_SESSION);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    masterDataApi.getSections()
      .then((res) => {
        if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
          setAvailableSections(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const selectedTeacher =
    teachers.find((t) => t._id === selectedTeacherId) || preselectedTeacher || teachers[0];

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedTeacherId) {
      setError('Please select a faculty member.');
      return;
    }

    if (!session || !session.trim()) {
      setError('Please provide a valid academic session (e.g. 2025-26).');
      return;
    }

    const semNum = parseInt(semester.replace(/\D/g, ''), 10) || 5;
    const secLetter = section.replace('Section ', '').trim().toUpperCase() || 'A';

    // Find section doc if available
    const matchedDoc = availableSections.find(
      (s) =>
        (Number(s.semester) === semNum || !s.semester) &&
        (getSectionLetter(s) === secLetter ||
          s.code === `CSE-${secLetter}` ||
          s.code === `CSE-${secLetter}-S${semNum}` ||
          s.name === section ||
          s.code === section ||
          s.name === `Section ${secLetter}`)
    ) || availableSections.find(
      (s) =>
        getSectionLetter(s) === secLetter ||
        s.code === `CSE-${secLetter}` ||
        s.name === `Section ${secLetter}`
    );

    const payload = {
      department: selectedTeacher?.department?._id || selectedTeacher?.department,
      tgId: selectedTeacherId,
      academicYear: session.trim(),
      semester: semNum,
      sectionId: matchedDoc?._id || undefined,
      section: section,
      sectionCode: secLetter,
      name: `TG Cohort - Sem ${semNum} CSE-${secLetter}`,
      reassign: true,
    };

    setSubmitting(true);
    try {
      const facultyName =
        selectedTeacher?.user?.name || selectedTeacher?.designation || 'Faculty Member';

      if (isChangeSection && existingCohort?._id) {
        await mentorshipApi.updateGroup(existingCohort._id, payload);
        addToast(
          'TG Section Reassigned',
          `${facultyName} has been reassigned to ${semester}, ${section} (${session.trim()}).`,
          'success'
        );
      } else {
        await mentorshipApi.createGroup(payload);
        addToast(
          'TG Appointed',
          `${facultyName} is now appointed as Tutor Guardian for ${semester}, ${section} (${session.trim()}).`,
          'success'
        );
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to assign TG cohort.');
    } finally {
      setSubmitting(false);
    }
  };

  const facultyDisplayName =
    selectedTeacher?.user?.name || selectedTeacher?.designation || 'Faculty Member';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container max-w-lg w-[95%] bg-white p-6 sm:p-7 rounded-3xl text-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 m-0">
                {isChangeSection ? 'Change TG Section Allocation' : 'Appoint Tutor Guardian (TG)'}
              </h3>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                {isChangeSection
                  ? 'Reassign mentor group cohort and student roster'
                  : 'HOD Departmental Governance & Mentorship Assignment'}
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

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleConfirm} className="space-y-3.5 mt-3">
          {/* Selected Faculty Member Box */}
          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200">
            <span className="block text-[10px] font-extrabold text-blue-800 uppercase tracking-wider">
              FACULTY MEMBER
            </span>
            <span className="block text-sm font-black text-slate-900 mt-0.5">
              {facultyDisplayName}
            </span>
            <span className="block text-xs text-slate-600 mt-0.5">
              {selectedTeacher?.designation || 'Professor & Head (HOD)'} • {selectedTeacher?.user?.email || 'authenticated@mail.in'}
            </span>
          </div>

          {/* Faculty Member dropdown if not locked to single preselected teacher */}
          {!isChangeSection && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Faculty Member <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer"
              >
                {teachers.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.user?.name || t.designation || 'Faculty'} ({t.designation || 'Faculty'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Semester & Section */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Semester <span className="text-rose-500">*</span>
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={`Semester ${s}`}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Section <span className="text-rose-500">*</span>
              </label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                {(() => {
                  const semNum = parseInt(semester.replace(/[^0-9]/g, '')) || 5;
                  const semSecs = availableSections.filter((s) => Number(s.semester) === semNum);
                  const list = semSecs.length > 0 ? semSecs : availableSections;
                  if (list.length === 0) {
                    return (
                      <>
                        <option value="Section A">Section A (CSE-A)</option>
                        <option value="Section B">Section B (CSE-B)</option>
                        <option value="Section C">Section C (CSE-C)</option>
                        <option value="Section D">Section D (CSE-D)</option>
                      </>
                    );
                  }
                  return list.map((s) => (
                    <option key={s._id} value={s.name}>
                      {s.name} ({s.code} - Sem {s.semester})
                    </option>
                  ));
                })()}
              </select>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 m-0">
            All students in {semester}, {section} will report directly to this Tutor Guardian.
          </p>

          {/* Academic Session */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Academic Session <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              placeholder="e.g. 2025-26"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none"
            />
          </div>

          {/* TG Powers & Mentorship Scope Box */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 space-y-1">
            <span className="block font-black text-emerald-800 text-[11px] uppercase tracking-wider mb-1">
              TG Powers & Mentorship Scope:
            </span>
            <div className="flex items-start gap-1.5 text-[11px] text-emerald-800">
              <span>•</span>
              <span>First-tier review & approval for student leave requests</span>
            </div>
            <div className="flex items-start gap-1.5 text-[11px] text-emerald-800">
              <span>•</span>
              <span>Sanctioning attendance consideration requests for departmental students</span>
            </div>
            <div className="flex items-start gap-1.5 text-[11px] text-emerald-800">
              <span>•</span>
              <span>Direct TG portal workspace with assigned student roster</span>
            </div>
          </div>

          {/* Footer buttons with high-contrast, fully visible styles */}
          <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                backgroundColor: '#ffffff',
                color: '#334155',
                borderColor: '#CBD5E1',
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 border cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                backgroundColor: '#047857',
                color: '#ffffff',
                borderColor: '#065F46',
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-60 border"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin text-white" />
                  <span className="text-white">Processing...</span>
                </>
              ) : (
                <>
                  <UserCheck size={14} className="text-white" />
                  <span className="text-white">
                    {isChangeSection ? 'Save Section Change' : 'Confirm TG Appointment'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
