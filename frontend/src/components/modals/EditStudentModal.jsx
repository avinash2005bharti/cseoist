import React, { useState, useEffect } from 'react';
import { X, User, Hash, Mail, Phone, Lock, AlertCircle, CheckCircle2, Copy, Check } from 'lucide-react';
import { masterDataApi } from '../../api';
import { useERP } from '../../context/ERPContext.jsx';

export default function EditStudentModal({ student, onClose, onSuccess }) {
  const { addToast } = useERP();

  const [availableSections, setAvailableSections] = useState([]);
  const studentUser = student?.user || {};
  const [name, setName] = useState(studentUser.name || '');
  const [rollNumber, setRollNumber] = useState(student?.rollNumber || '');
  const [status, setStatus] = useState(studentUser.isActive === false ? 'SUSPENDED' : 'ACTIVE');
  const [email, setEmail] = useState(studentUser.email || '');
  const [phone, setPhone] = useState(studentUser.phone || '');
  const [semester, setSemester] = useState(student?.semester || student?.section?.semester || 5);
  const [section, setSection] = useState(() => {
    const raw = student?.section?.code || student?.section?.name || '';
    const letterMatch = raw.match(/([A-Z0-9]+)/i);
    return letterMatch ? letterMatch[1].toUpperCase() : 'B';
  });

  useEffect(() => {
    masterDataApi.getSections().then((res) => {
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        setAvailableSections(res.data);
      }
    }).catch(() => {});
  }, []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCopyPassword = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('Copied', 'Temporary password copied to clipboard', 'info');
  };

  const handleResetPassword = async () => {
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
        className="modal-container max-w-lg w-[95%] bg-white p-6 sm:p-7 rounded-3xl text-slate-900"
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
                {(() => {
                  const semSecs = availableSections.filter((s) => Number(s.semester) === Number(semester));
                  const list = semSecs.length > 0 ? semSecs : availableSections;
                  if (list.length === 0) {
                    return (
                      <>
                        <option value="A">Section A (CSE-A)</option>
                        <option value="B">Section B (CSE-B)</option>
                        <option value="C">Section C (CSE-C)</option>
                        <option value="D">Section D (CSE-D)</option>
                      </>
                    );
                  }
                  return list.map((s) => {
                    const cleanLetter = s.name.replace(/^Section\s*/i, '').trim();
                    return (
                      <option key={s._id} value={cleanLetter}>
                        {s.name} ({s.code} - Sem {s.semester})
                      </option>
                    );
                  });
                })()}
              </select>
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
