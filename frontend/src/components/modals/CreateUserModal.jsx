import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  GraduationCap,
  Briefcase,
  Mail,
  Phone,
  Lock,
  Hash,
  Layers,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { masterDataApi } from '../../api';
import { useERP } from '../../context/ERPContext.jsx';
import { getSectionLetter } from '../../utils/constants.js';

export default function CreateUserModal({
  initialRole = 'STUDENT',
  availableSections = [],
  onClose,
  onSuccess,
}) {
  const { addToast } = useERP();

  const [accountType, setAccountType] = useState(
    initialRole === 'TEACHER' || initialRole === 'FACULTY' ? 'TEACHER' : 'STUDENT'
  );

  // Common Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('Password@123');
  const [showPassword, setShowPassword] = useState(false);

  // Student-specific Fields
  const [rollNumber, setRollNumber] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [studentSemester, setStudentSemester] = useState(5);
  const [studentSection, setStudentSection] = useState('Section B');
  const [enrollmentYear, setEnrollmentYear] = useState(2022);

  // Faculty-specific Fields
  const [employeeId, setEmployeeId] = useState('');
  const [designation, setDesignation] = useState('Assistant Professor');
  const [specialization, setSpecialization] = useState('Computer Science & Engineering');
  const [isTg, setIsTg] = useState(false);
  const [tgSemester, setTgSemester] = useState(5);
  const [tgSection, setTgSection] = useState('Section B');
  const [academicYear, setAcademicYear] = useState('2025-26');

  // State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [createdData, setCreatedData] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Derive available section letters for the selected semester
  const semesterSecs = availableSections.filter(
    (s) => Number(s.semester) === Number(accountType === 'STUDENT' ? studentSemester : tgSemester)
  );

  const sectionOptions =
    semesterSecs.length > 0
      ? semesterSecs.map((s) => {
          const letter = getSectionLetter(s) || s.code?.replace('CSE-', '') || s.name?.replace('Section ', '') || 'B';
          return { value: `Section ${letter}`, label: `Section ${letter} (CSE-${letter})` };
        })
      : ['A', 'B', 'C', 'D', 'E'].map((letter) => ({
          value: `Section ${letter}`,
          label: `Section ${letter} (CSE-${letter})`,
        }));

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName) {
      setError('Please provide full name.');
      return;
    }
    if (!cleanEmail) {
      setError('Please provide email address for login user ID.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: cleanName,
        email: cleanEmail,
        phone: phone.trim() || undefined,
        password: password || 'Password@123',
      };

      if (accountType === 'STUDENT') {
        const cleanRoll = (rollNumber.trim() || `0176CS${Date.now().toString().slice(-6)}`).toUpperCase();
        payload.role = 'STUDENT';
        payload.rollNumber = cleanRoll;
        payload.enrollmentNumber = (enrollmentNo.trim() || cleanRoll).toUpperCase();
        payload.semester = Number(studentSemester);
        payload.section = studentSection;
        payload.enrollmentYear = Number(enrollmentYear);
      } else {
        const cleanEmpId = (employeeId.trim() || `EMP_${Date.now().toString().slice(-5)}`).toUpperCase();
        payload.role = isTg ? 'TG' : 'TEACHER';
        payload.isTG = isTg;
        payload.employeeId = cleanEmpId;
        payload.designation = isTg ? `${designation} (TG)` : designation;
        payload.specialization = specialization.trim() || 'Computer Science & Engineering';

        if (isTg) {
          payload.semester = Number(tgSemester);
          payload.section = tgSection;
          payload.academicYear = academicYear;
        }
      }

      const res = await masterDataApi.createUser(payload);
      const userRes = res?.data?.user || res?.user || res?.data;
      const passRes = res?.data?.tempPassword || res?.tempPassword || password;

      setCreatedData({
        user: userRes,
        tempPassword: passRes,
        role: accountType === 'STUDENT' ? 'Student' : isTg ? 'Tutor Guardian (Faculty)' : 'Faculty Member',
        idNumber: accountType === 'STUDENT' ? payload.rollNumber : payload.employeeId,
      });

      addToast(
        'Account Provisioned',
        `Created ${accountType === 'STUDENT' ? 'Student' : 'Faculty'} User ID for ${cleanName}.`,
        'success'
      );

      if (onSuccess) onSuccess();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Failed to create user account.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container max-w-xl w-[96%] bg-white p-6 sm:p-7 rounded-3xl text-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 m-0">
                {createdData ? 'User ID Created' : 'Create New User ID'}
              </h3>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                {createdData
                  ? 'Account is now active and ready for login'
                  : 'Provision official Student or Faculty institutional credentials'}
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

        {/* Content Area */}
        {createdData ? (
          <div className="py-4 space-y-4 overflow-y-auto pr-1">
            {/* Success Banner */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
              <div className="flex items-center gap-2.5 font-black text-sm text-emerald-800">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <span>Account Provisioned Successfully!</span>
              </div>
              <p className="text-xs text-emerald-700 mt-1 m-0">
                <strong>{createdData.user?.name}</strong> has been enrolled as a{' '}
                <strong>{createdData.role}</strong> ({createdData.idNumber}).
              </p>
            </div>

            {/* Credentials Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                Official Login Credentials
              </span>

              {/* User ID / Email */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">User ID / Email</span>
                  <span className="text-xs font-mono font-bold text-slate-900">{createdData.user?.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdData.user?.email, 'email')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-blue-600 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedField === 'email' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copiedField === 'email' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Temporary Password */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Password</span>
                  <span className="text-xs font-mono font-bold text-slate-900">{createdData.tempPassword}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdData.tempPassword, 'password')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-blue-600 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedField === 'password' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copiedField === 'password' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const fullText = `CampusFlow Credentials:\nUser ID: ${createdData.user?.email}\nPassword: ${createdData.tempPassword}\nRole: ${createdData.role}`;
                  copyToClipboard(fullText, 'both');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {copiedField === 'both' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copiedField === 'both' ? 'All Credentials Copied!' : 'Copy Full Credentials'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="py-4 space-y-4 overflow-y-auto pr-1">
            {/* Account Type Selector */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">
                Account Classification <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setAccountType('STUDENT');
                    setError(null);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    accountType === 'STUDENT'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <GraduationCap size={15} />
                  <span>Student User ID</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAccountType('TEACHER');
                    setError(null);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    accountType === 'TEACHER'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Briefcase size={15} />
                  <span>Faculty User ID</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={accountType === 'STUDENT' ? 'e.g. Rahul Sharma' : 'e.g. Dr. Priya Verma'}
                  required
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email (User ID / Username) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={accountType === 'STUDENT' ? 'student@campusflow.edu' : 'faculty@campusflow.edu'}
                      required
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (Optional)</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +91 9876543210"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Student Specific Fields */}
            {accountType === 'STUDENT' && (
              <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-3">
                <span className="text-[11px] font-black text-blue-800 uppercase tracking-wider block">
                  Student Academic Enrollment
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Roll Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={rollNumber}
                        onChange={(e) => setRollNumber(e.target.value)}
                        placeholder="e.g. 0176CS221045"
                        required
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 uppercase focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Enrollment Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={enrollmentNo}
                      onChange={(e) => setEnrollmentNo(e.target.value)}
                      placeholder="Defaults to Roll Number"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 uppercase focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Semester</label>
                    <select
                      value={studentSemester}
                      onChange={(e) => setStudentSemester(Number(e.target.value))}
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                        <option key={sem} value={sem}>
                          Semester {sem}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Section</label>
                    <select
                      value={studentSection}
                      onChange={(e) => setStudentSection(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                    >
                      {sectionOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Batch Year</label>
                    <input
                      type="number"
                      value={enrollmentYear}
                      onChange={(e) => setEnrollmentYear(Number(e.target.value))}
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Faculty Specific Fields */}
            {accountType === 'TEACHER' && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-3">
                <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider block">
                  Faculty Profile & Appointment
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Employee ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="e.g. EMP_CSE_105"
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 uppercase focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                    <select
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-emerald-600 focus:outline-none cursor-pointer"
                    >
                      <option value="Assistant Professor">Assistant Professor</option>
                      <option value="Associate Professor">Associate Professor</option>
                      <option value="Professor">Professor</option>
                      <option value="Visiting Faculty">Visiting Faculty</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Specialization</label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g. Computer Science & Engineering"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* TG Appointment Toggle */}
                <div className="pt-2 border-t border-emerald-200/60">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isTg}
                      onChange={(e) => setIsTg(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-600" />
                      Appoint as Tutor Guardian (TG) for a Cohort Section
                    </span>
                  </label>

                  {isTg && (
                    <div className="grid grid-cols-3 gap-2.5 mt-2.5 p-2.5 rounded-xl bg-white border border-emerald-200">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">TG Semester</label>
                        <select
                          value={tgSemester}
                          onChange={(e) => setTgSemester(Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                            <option key={s} value={s}>
                              Sem {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">TG Section</label>
                        <select
                          value={tgSection}
                          onChange={(e) => setTgSection(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                        >
                          {sectionOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Academic Session</label>
                        <input
                          type="text"
                          value={academicYear}
                          onChange={(e) => setAcademicYear(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Initial Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Initial Account Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                User will be required to authenticate with this password on first login.
              </span>
            </div>

            {/* Submit / Cancel Buttons */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer flex items-center gap-1.5 transition-all ${
                  accountType === 'STUDENT'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                <span>
                  {submitting
                    ? 'Provisioning...'
                    : accountType === 'STUDENT'
                    ? 'Create Student User ID'
                    : 'Create Faculty User ID'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
