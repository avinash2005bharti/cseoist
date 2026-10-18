import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/authApi.js';
import { masterDataApi } from '../../api/modulesApi.js';
import {
  GraduationCap,
  User,
  Mail,
  Lock,
  Phone,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  Calendar,
  Hash,
  Shield,
  ArrowLeft,
  KeyRound,
  RotateCcw,
} from 'lucide-react';

export default function StudentRegisterPage() {
  const navigate = useNavigate();

  const [availableSections, setAvailableSections] = useState([]);
  const [step, setStep] = useState(1); // 1 = Registration form, 2 = Brevo OTP Verification
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    enrollment_no: '',
    year: '3rd Year',
    semester: 5,
    section: 'Section A',
    batch: '2022-2026',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch available sections on mount
  useEffect(() => {
    masterDataApi.getSections().then((res) => {
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        setAvailableSections(res.data);
      }
    }).catch(() => {});
  }, []);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleYearChange = (e) => {
    const yr = e.target.value;
    let sem = 1;
    if (yr === '1st Year') sem = 1;
    else if (yr === '2nd Year') sem = 3;
    else if (yr === '3rd Year') sem = 5;
    else if (yr === '4th Year') sem = 7;

    setFormData((prev) => ({
      ...prev,
      year: yr,
      semester: sem,
    }));
  };

  // Step 1: Validate form and dispatch Brevo OTP email
  const handleInitiateRegistration = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!formData.name.trim()) {
      setError('Please provide your full name.');
      return;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Please provide a valid official or personal email address.');
      return;
    }

    if (!formData.enrollment_no.trim()) {
      setError('Enrollment No. / Student ID is required.');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter (A-Z) and one number (0-9).');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);

    try {
      // Send verification code via Brevo
      const res = await authApi.sendStudentRegistrationOtp({
        email: formData.email.trim().toLowerCase(),
        name: formData.name.trim(),
      });

      setSuccessMsg(res?.message || `A 6-digit code has been dispatched to ${formData.email}`);
      setStep(2);
      setResendCooldown(45);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to dispatch verification email.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await authApi.sendStudentRegistrationOtp({
        email: formData.email.trim().toLowerCase(),
        name: formData.name.trim(),
      });
      setSuccessMsg(res?.message || `A new verification code was sent to ${formData.email}`);
      setResendCooldown(45);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and finalize student enrollment
  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!otp.trim()) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (otp.trim().length < 6) {
      setError('Verification code must be 6 digits.');
      return;
    }

    setLoading(true);

    try {
      const cleanSection = formData.section.replace(/Section\s*/i, '').trim() || 'A';
      const cleanYear = parseInt(formData.year) || 3;

      const res = await authApi.registerStudent({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        rollNumber: formData.enrollment_no.trim().toUpperCase(),
        enrollment_no: formData.enrollment_no.trim().toUpperCase(),
        year: cleanYear,
        semester: Number(formData.semester),
        section: cleanSection,
        batch: formData.batch.trim(),
        phone: formData.phone.trim() || undefined,
        otp: otp.trim(),
      });

      setSuccessMsg(res?.message || 'Student account created and verified successfully!');
      setTimeout(() => {
        navigate('/login', {
          state: {
            registeredEmail: formData.email.trim().toLowerCase(),
          },
        });
      }, 1500);
    } catch (err) {
      const serverMsg =
        err.response?.data?.error?.details?.[0]?.message ||
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message;
      setError(serverMsg || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-login-page min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 font-sans">
      {/* =======================================================================
          LEFT BRANDING PANEL (Matches LoginPage 1-to-1)
          ======================================================================= */}
      <div className="auth-brand-panel hidden lg:flex lg:w-1/2 w-full min-h-screen relative flex-col justify-between p-10 xl:p-16 text-white overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="auth-brand-header">
          <div className="auth-brand-pill">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Official Institutional Gateway • Estd. 1995</span>
          </div>

          <div className="auth-brand-title-row">
            <div className="auth-brand-emblem">
              <img
                src="/iit.png"
                alt="IIT Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="auth-brand-inst-name">
                ORIENTAL GROUP OF INSTITUTES
              </p>
              <h1 className="auth-brand-heading">
                Oriental Institute of Science & Technology
              </h1>
              <p className="auth-brand-sub">
                Department of Computer Science & Engineering (CSE)
              </p>
            </div>
          </div>

          {/* Student Self-Registration Portal Info Box */}
          <div className="mt-6 p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
            <div className="flex items-center gap-2 text-blue-200 font-bold text-sm mb-1.5">
              <GraduationCap size={18} className="text-sky-300" />
              <span>Student Self-Registration Portal</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed m-0 font-normal">
              Create your official student profile. Once enrolled, your attendance tracking, timetable sync,
              leave approvals, and exam eligibility are automatically managed through the departmental database.
            </p>
          </div>
        </div>

        {/* Accreditation Badges */}
        <div className="auth-brand-badges">
          <span className="auth-brand-badge-item">
            <Shield size={14} className="text-blue-300" />
            NAAC 'A+' Grade Accredited
          </span>
          <span className="auth-brand-badge-item">
            <Building2 size={14} className="text-blue-300" />
            Approved by AICTE, New Delhi
          </span>
          <span className="auth-brand-badge-item">
            <GraduationCap size={14} className="text-blue-300" />
            Affiliated to RGPV, Bhopal
          </span>
          <span className="auth-brand-badge-item">
            <CheckCircle2 size={14} className="text-blue-300" />
            NBA Accredited Programmes
          </span>
        </div>
      </div>

      {/* =======================================================================
          RIGHT REGISTRATION FORM
          ======================================================================= */}
      <div className="auth-register-panel w-full lg:w-1/2 min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 sm:px-8 xl:px-12 py-10">
        <div className="auth-register-card">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-blue-600 mb-1">
              <GraduationCap size={16} />
              <span>STUDENT REGISTRATION</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight m-0">
              Create Student Account
            </h2>
            <p className="auth-form-description text-sm text-slate-600 mt-1 mb-0">
              Enroll in Computer Science & Engineering department records.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{successMsg} Redirecting to login...</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleInitiateRegistration} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Ayush Sharma"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-[#F8FAFC] focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-sm text-slate-800 font-medium"
                  />
                </div>
              </div>

              {/* Email & Enrollment No */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Official / Personal Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="student@gmail.com"
                      required
                      className="w-full pl-11 pr-4 py-3 bg-[#F8FAFC] focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-sm text-slate-800 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Enrollment No. / Student ID <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      name="enrollment_no"
                      value={formData.enrollment_no}
                      onChange={handleChange}
                      placeholder="0103CS211001"
                      required
                      className="w-full pl-11 pr-4 py-3 bg-[#F8FAFC] focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-sm text-slate-800 font-medium uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Year, Semester, Section */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Year <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="year"
                    value={formData.year}
                    onChange={handleYearChange}
                    className="w-full px-3 py-3 bg-[#F8FAFC] focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-sm text-slate-800 font-medium cursor-pointer"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Semester <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="semester"
                    value={formData.semester}
                    onChange={handleChange}
                    className="w-full px-3 py-3 bg-[#F8FAFC] focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-sm text-slate-800 font-medium cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Section <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="section"
                    value={formData.section}
                    onChange={handleChange}
                    className="w-full px-3 py-3 bg-[#F8FAFC] focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-sm text-slate-800 font-medium cursor-pointer"
                  >
                    {(() => {
                      const semSecs = availableSections.filter((s) => Number(s.semester) === Number(formData.semester));
                      const list = semSecs.length > 0 ? semSecs : availableSections;
                      if (list.length === 0) {
                        return (
                          <>
                            <option value="Section A">Section A</option>
                            <option value="Section B">Section B</option>
                            <option value="Section C">Section C</option>
                            <option value="Section D">Section D</option>
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

              {/* Academic Batch & Contact Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Academic Batch <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      name="batch"
                      value={formData.batch}
                      onChange={handleChange}
                      placeholder="2022-2026"
                      required
                      className="w-full pl-11 pr-4 py-3 bg-[#F8FAFC] focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-sm text-slate-800 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Contact Phone (Optional)
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+91 98765 43210"
                      className="w-full pl-11 pr-4 py-3 bg-[#F8FAFC] focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-sm text-slate-800 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="••••••••••••"
                      required
                      className="w-full pl-11 pr-11 py-3 bg-[#F8FAFC] focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-sm text-slate-800 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Re-enter password"
                      required
                      className="w-full pl-11 pr-4 py-3 bg-[#F8FAFC] focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-sm text-slate-800 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Password Requirements Guidance */}
              <p className="text-[11px] text-slate-500 font-medium mt-1 mb-2">
                🔒 Password must be at least 8 characters with at least one uppercase letter (A-Z) and one number (0-9).
              </p>

              <button
                type="submit"
                disabled={loading}
                className="auth-submit mt-4"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending Brevo Verification Code...</span>
                  </>
                ) : (
                  <span>Verify Email & Create Account →</span>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: BREVO OTP VERIFICATION */
            <form onSubmit={handleVerifyAndRegister} className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <KeyRound size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-blue-900">
                    Verification Code Dispatched
                  </span>
                  <p className="text-xs text-blue-800 mt-0.5 mb-0">
                    A 6-digit numeric OTP was sent via Brevo to <strong>{formData.email}</strong>.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 text-center uppercase tracking-wider">
                  Enter 6-Digit OTP Code <span className="text-rose-500">*</span>
                </label>
                <div className="relative max-w-xs mx-auto">
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    autoFocus
                    required
                    className="w-full py-3.5 text-center text-2xl font-black tracking-[10px] text-blue-600 bg-[#F8FAFC] focus:bg-white border-2 border-blue-400 focus:border-blue-600 rounded-2xl shadow-xs focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500 text-center mt-2">
                  Code is valid for 10 minutes. Please check your inbox or spam folder.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="auth-submit"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Code & Enrolling...</span>
                  </>
                ) : (
                  <span>Verify Code & Complete Registration →</span>
                )}
              </button>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError('');
                  }}
                  className="text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  ← Edit Registration Details
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading || resendCooldown > 0}
                  className={`font-bold cursor-pointer ${
                    resendCooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'
                  }`}
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center pt-4 border-t border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Already have an account? </span>
            <Link to="/login" className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline">
              Sign In to ERP
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
