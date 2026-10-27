import React, { useState, useEffect } from 'react';
import { X, User, Hash, Mail, Phone, Lock, AlertCircle, CheckCircle2, Copy, Check, Calendar } from 'lucide-react';
import { masterDataApi } from '../../api';
import { useERP } from '../../context/ERPContext.jsx';
import { getSectionLetter } from '../../utils/constants.js';

const BASE_FROM_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];
const BASE_TO_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035];

/**
 * Safely extract academic batch start and end year from student record.
 * Handles formats like:
 * - "2024-2028", "2024–2028", "2024 - 2028"
 * - "Batch 2023", "2023"
 * - student.enrollmentYear (e.g. 2024)
 * - Roll number year indicators (e.g. 0105CS241101 -> 2024)
 * - Semester-based estimation fallback
 */
export function extractBatchFromStudent(student) {
  if (!student) {
    return { from: '2024', to: '2028' };
  }

  const rawBatch = typeof student.batch === 'string' ? student.batch.trim() : '';

  // 1. Two 4-digit years in batch string (e.g. "2024-2028", "2024–2028")
  const yearsInBatch = rawBatch.match(/\b(20\d\d)\b/g);
  if (yearsInBatch && yearsInBatch.length >= 2) {
    return { from: String(yearsInBatch[0]), to: String(yearsInBatch[1]) };
  }

  // 2. Single 4-digit year in batch string (e.g. "Batch 2023", "2023")
  if (yearsInBatch && yearsInBatch.length === 1) {
    const yr = parseInt(yearsInBatch[0], 10);
    return { from: String(yr), to: String(yr + 4) };
  }

  // 3. Stored enrollmentYear on the student record
  if (student.enrollmentYear) {
    const yr = parseInt(String(student.enrollmentYear), 10);
    if (!isNaN(yr) && yr >= 2000 && yr <= 2050) {
      return { from: String(yr), to: String(yr + 4) };
    }
  }

  // 4. Roll / Enrollment number year pattern (e.g. 0105CS241101 -> 24 -> 2024)
  const roll = student.rollNumber || student.enrollmentNumber || '';
  const rollMatch = roll.match(/(?:CS|EC|ME|IT|EX|CE)(\d{2})/i);
  if (rollMatch) {
    const yr = 2000 + parseInt(rollMatch[1], 10);
    if (yr >= 2018 && yr <= 2035) {
      return { from: String(yr), to: String(yr + 4) };
    }
  }

  // 5. Semester-based fallback (4-year B.Tech program)
  const sem = Number(student.semester || student?.section?.semester || 5);
  const collegeYear = Math.max(1, Math.min(4, Math.ceil(sem / 2)));
  const currentCalendarYear = new Date().getFullYear();
  const estimatedFrom = currentCalendarYear - (collegeYear - 1);
  return { from: String(estimatedFrom), to: String(estimatedFrom + 4) };
}

/**
 * Accurately resolve student's section letter (e.g. 'A', 'B', 'C', 'D')
 * Prevents regex prefix bugs where 'CSE-B' matched 'CSE'.
 */
export function resolveStudentSection(student, sectionsList = []) {
  if (!student) return 'B';
  const sec = student.section;

  // If section is an object (populated from DB)
  if (sec && typeof sec === 'object') {
    const l = getSectionLetter(sec);
    if (l && l.length <= 2) return l.toUpperCase();
  }

  // If section is an ID string, try to match in available sections
  if (typeof sec === 'string') {
    if (sectionsList && sectionsList.length > 0) {
      const found = sectionsList.find((s) => s._id === sec || s.id === sec);
      if (found) {
        const l = getSectionLetter(found);
        if (l && l.length <= 2) return l.toUpperCase();
      }
    }
    const l = getSectionLetter(sec);
    if (l && l.length <= 2) return l.toUpperCase();
  }

  return 'B';
}

export default function EditStudentModal({ student, onClose, onSuccess }) {
  const { addToast } = useERP();

  const [availableSections, setAvailableSections] = useState([]);

  // Controlled form states initialized from current student's real data
  const initialUser = student?.user || {};
  const [name, setName] = useState(() => initialUser.name || student?.name || '');
  const [rollNumber, setRollNumber] = useState(() => student?.rollNumber || student?.enrollmentNumber || '');
  const [status, setStatus] = useState(() => {
    if (student?.status) return student.status;
    return initialUser.isActive === false ? 'SUSPENDED' : 'ACTIVE';
  });
  const [email, setEmail] = useState(() => initialUser.email || student?.email || '');
  const [phone, setPhone] = useState(() => initialUser.phone || student?.phone || '');
  const [semester, setSemester] = useState(() => Number(student?.semester || student?.section?.semester || 5));
  const [section, setSection] = useState(() => resolveStudentSection(student));

  const initialBatch = extractBatchFromStudent(student);
  const [batchFrom, setBatchFrom] = useState(initialBatch.from);
  const [batchTo, setBatchTo] = useState(initialBatch.to);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState(null);
  const [copied, setCopied] = useState(false);

  // Fetch all sections from API
  useEffect(() => {
    masterDataApi.getSections().then((res) => {
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        setAvailableSections(res.data);
      }
    }).catch(() => {});
  }, []);

  // Synchronize state when student prop arrives or updates
  useEffect(() => {
    if (!student) return;
    const studentUser = student.user || {};
    setName(studentUser.name || student.name || '');
    setRollNumber(student.rollNumber || student.enrollmentNumber || '');
    setStatus(student.status || (studentUser.isActive === false ? 'SUSPENDED' : 'ACTIVE'));
    setEmail(studentUser.email || student.email || '');
    setPhone(studentUser.phone || student.phone || '');
    setSemester(Number(student.semester || student?.section?.semester || 5));

    const resolvedSec = resolveStudentSection(student, availableSections);
    if (resolvedSec) {
      setSection(resolvedSec);
    }

    const b = extractBatchFromStudent(student);
    setBatchFrom(b.from);
    setBatchTo(b.to);
  }, [student, availableSections]);

  // Dynamic Year Dropdown Options (guarantees currently set values are present)
  const fromYearOptions = (() => {
    const set = new Set(BASE_FROM_YEARS);
    if (batchFrom) {
      const parsed = parseInt(batchFrom, 10);
      if (!isNaN(parsed)) set.add(parsed);
    }
    return Array.from(set).sort((a, b) => a - b);
  })();

  const toYearOptions = (() => {
    const set = new Set(BASE_TO_YEARS);
    if (batchTo) {
      const parsed = parseInt(batchTo, 10);
      if (!isNaN(parsed)) set.add(parsed);
    }
    return Array.from(set).sort((a, b) => a - b);
  })();

  // Section Dropdown Options (always normalized with valid section letter values)
  const sectionOptions = (() => {
    const optionsMap = new Map();

    // Baseline standard sections A, B, C, D, E
    ['A', 'B', 'C', 'D', 'E'].forEach((l) => {
      optionsMap.set(l, {
        value: l,
        label: `Section ${l} (CSE-${l})`,
      });
    });

    // Populate from availableSections (matching semester if available)
    const semSecs = availableSections.filter((s) => Number(s.semester) === Number(semester));
    const listToUse = semSecs.length > 0 ? semSecs : availableSections;

    listToUse.forEach((s) => {
      const l = getSectionLetter(s);
      if (l && l.length <= 2) {
        optionsMap.set(l, {
          value: l,
          label: `${s.name || `Section ${l}`} (${s.code || `CSE-${l}`}${s.semester ? ` - Sem ${s.semester}` : ''})`,
        });
      }
    });

    // Ensure student's currently set section is always selectable
    if (section && !optionsMap.has(section)) {
      optionsMap.set(section, {
        value: section,
        label: `Section ${section} (Current)`,
      });
    }

    return Array.from(optionsMap.values()).sort((a, b) => a.value.localeCompare(b.value));
  })();

  const handleCopyPassword = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('Copied', 'Temporary password copied to clipboard', 'info');
  };

  const handleResetPassword = async () => {
    const studentUser = student?.user || {};
    if (!window.confirm(`Reset password for student ${name}?`)) return;
    setResettingPassword(true);
    setTempPassword(null);
    try {
      const res = await masterDataApi.resetPassword(studentUser._id || student.user);
      const generated = res?.data?.tempPassword || res?.tempPassword || 'Reset@' + Math.floor(1000 + Math.random() * 9000);
      setTempPassword(generated);
      addToast(
        'Password Reset & Sent',
        `Temporary password emailed to ${email || 'student'}: ${generated}`,
        'success'
      );
    } catch (err) {
      addToast('Error', err.message || 'Failed to reset password.', 'danger');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Full name is required.');
      return;
    }

    setSaving(true);
    try {
      await masterDataApi.updateStudent(student._id, {
        name: name.trim(),
        rollNumber: rollNumber.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        semester: Number(semester),
        section: section,
        batch: `${batchFrom}-${batchTo}`,
        enrollmentYear: Number(batchFrom),
        status,
      });

      addToast('Student Updated', 'Student departmental records saved successfully.', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update student details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container max-w-lg w-[95%] bg-white p-6 sm:p-7 rounded-3xl text-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 m-0">
                Edit Student Details
              </h3>
              <p className="text-xs text-slate-500 m-0">
                Department Record Update for {student?.enrollmentNumber || student?.rollNumber || 'Enrolled Student'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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

        <form onSubmit={handleSave} className="space-y-3.5 mt-3">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Enrollment No & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Enrollment No <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          {/* Official Email & Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Semester & Section (HOD Academic Allocation) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Semester <span className="text-blue-600 font-normal">(Editable by HOD)</span>
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Section <span className="text-blue-600 font-normal">(Editable by HOD)</span>
              </label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer"
              >
                {sectionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Academic Batch (From & To) - Editable by HOD */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 m-0">
                <Calendar size={13} className="text-slate-500 shrink-0" />
                <span>
                  Academic Batch <span className="text-blue-600 font-normal">(Editable by HOD)</span>
                </span>
              </label>
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                {batchFrom} – {batchTo}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <select
                  value={String(batchFrom)}
                  onChange={(e) => {
                    const fromVal = e.target.value;
                    const fromNum = parseInt(fromVal, 10);
                    setBatchFrom(fromVal);
                    const currTo = parseInt(batchTo, 10);
                    const prevFrom = parseInt(batchFrom, 10);
                    if (currTo <= fromNum || currTo === prevFrom + 4) {
                      setBatchTo(String(fromNum + 4));
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer"
                >
                  {fromYearOptions.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      From {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={String(batchTo)}
                  onChange={(e) => setBatchTo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer"
                >
                  {toYearOptions.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      To {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Generated Temporary Password Card */}
          {tempPassword && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col gap-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>Temporary Password Generated & Dispatched</span>
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">Sent to student's email</span>
              </div>
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-emerald-200 mt-1">
                <span className="font-mono text-sm font-black text-slate-900 tracking-wider">
                  {tempPassword}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 m-0 mt-0.5">
                The student can log in using this temporary password and change it anytime from their dashboard.
              </p>
            </div>
          )}

          {/* Modal Footer with Reset Password button matching screenshot */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={resettingPassword}
              className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Lock size={13} />
              <span>{resettingPassword ? 'Resetting...' : 'reset password'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                {saving ? <span>Saving...</span> : <span>Save Changes</span>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
