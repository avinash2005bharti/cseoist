import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Building2,
  GraduationCap,
  Shield,
  ArrowRight,
  AlertCircle,
  UserCheck,
  Landmark,
  CheckCircle2,
} from 'lucide-react';
import ForgotPasswordModal from '../../components/modals/ForgotPasswordModal.jsx';

export default function LoginPage() {
  const { login, loginWithToken } = useERP();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedRole, setSelectedRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [forgotNotice, setForgotNotice] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleRoleSelect = (roleKey) => {
    setSelectedRole(roleKey);
    setError('');
    // Clear fields on switching role tabs to ensure no credentials linger
    setEmail('');
    setPassword('');
  };

  // Listen for Google OAuth callback parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const oauthSuccess = searchParams.get('oauth') === 'success';
    const googleErr = searchParams.get('error');

    if (googleErr) {
      setError(decodeURIComponent(googleErr));
      navigate('/login', { replace: true });
      return;
    }

    if (oauthSuccess) {
      setLoading(true);
      setSuccessNotice('Google verification successful! Connecting to portal session...');
      loginWithToken()
        .then((user) => {
          const role = (user.role || '').toLowerCase();
          if (user.mustChangePassword) {
            navigate('/change-password');
          } else if (role === 'admin') {
            navigate('/admin');
          } else if (role === 'hod') {
            navigate('/hod');
          } else if (user.isTG || role === 'teacher') {
            navigate('/tg');
          } else {
            navigate('/student');
          }
        })
        .catch((err) => {
          setError(err.message || 'Failed to authenticate session with Google.');
          setLoading(false);
        });
      return;
    }

    if (location.state?.registeredEmail) {
      setEmail(location.state.registeredEmail);
      setPassword('');
      setSelectedRole('student');
      setSuccessNotice('Account registered successfully! Please sign in with your credentials.');
    } else {
      // Force empty values on mount to defeat browser password manager autofill
      setEmail('');
      setPassword('');
      const timer = setTimeout(() => {
        setEmail('');
        setPassword('');
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [location.search, location.state, loginWithToken, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessNotice('');
    setForgotNotice('');

    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    try {
      const user = await login({
        email: email.trim().toLowerCase(),
        password,
      });

      const role = (user.role || '').toLowerCase();
      if (user.mustChangePassword) {
        navigate('/change-password');
      } else if (role === 'admin') {
        navigate('/admin');
      } else if (role === 'hod') {
        navigate('/hod');
      } else if (user.isTG || role === 'teacher') {
        navigate('/tg');
      } else {
        navigate('/student');
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError('');
    const backendUrl =
      import.meta.env.VITE_BACKEND_URL ||
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000'
        : '');
    window.location.href = `${backendUrl}/auth/google`;
  };

  return (
    <div className="auth-login-page min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 font-sans">
      {/* =======================================================================
          LEFT SECTION: Deep Royal Blue Branding Banner (Split 50% on Desktop)
          ======================================================================= */}
      <div className="auth-brand-panel hidden lg:flex lg:w-1/2 w-full min-h-screen relative flex-col justify-between p-10 xl:p-16 text-white overflow-hidden">
        {/* Glow Spheres */}
        <div className="absolute top-1/5 right-1/4 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top: Brand Header */}
        <div className="auth-brand-header">
          <div className="auth-brand-pill">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Official Institutional Gateway • Estd. 1995</span>
          </div>

          {/* Logo & College Headline */}
          <div className="auth-brand-title-row">
            <div className="auth-brand-emblem">
              <img
                src="/iit.png"
                alt="IIT Emblem"
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

          {/* Description */}
          <p className="auth-brand-desc">
            CampusFlow ERP — Enterprise academic management powering real-time attendance ledgers,
            timetable generation, multi-tier clearances, and transparent student governance.
          </p>
        </div>

        {/* Bottom Accreditation Badges in a Row matching login-pc.png */}
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
          RIGHT SECTION: Sign-in Form (Split 50% on Desktop, 100% on Mobile)
          ======================================================================= */}
      <div className="auth-login-panel w-full lg:w-1/2 min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 sm:px-8 xl:px-12 py-10">
        <div className="auth-login-card">
          {/* Mobile-only Branding Header matching login-responsive.png */}
          <div className="lg:hidden flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white p-2 shadow-md border border-slate-200/80 mb-3 flex items-center justify-center">
              <img
                src="/iit.png"
                alt="IIT Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-base font-black text-slate-900 leading-tight">
              Oriental Institute of Science & Technology
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Department of Computer Science & Engineering
            </p>
          </div>

          {/* Form Header */}
          <div className="mb-6">
            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600 block mb-1">
              AUTHENTICATION GATEWAY
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight m-0">
              Sign in to CampusFlow
            </h2>
            <p className="auth-form-description text-sm text-slate-600 mt-1 mb-0">
              Enter your registered official email address and password to sign in.
            </p>
          </div>

          {/* Feedback Notices */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successNotice && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
              <span>{successNotice}</span>
            </div>
          )}

          {forgotNotice && (
            <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-blue-600" />
              <span>{forgotNotice}</span>
            </div>
          )}

          {/* Select Portal / Role Tabs matching screenshot */}
          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Portal / Role
            </label>
            <div className="auth-role-tabs">
              {[
                { id: 'student', label: 'Student', icon: GraduationCap },
                { id: 'tg', label: 'TG', icon: UserCheck },
                { id: 'hod', label: 'HOD', icon: Landmark },
                { id: 'admin', label: 'Admin', icon: Shield },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = selectedRole === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleRoleSelect(tab.id)}
                    data-active={isSelected ? 'true' : 'false'}
                    className={`auth-role-tab ${isSelected ? 'active' : ''}`}
                  >
                    <Icon size={18} className={isSelected ? 'text-blue-600' : 'text-slate-500'} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="email"
                  id="academic_email_entry"
                  name="academic_email_entry"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="off"
                  spellCheck="false"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-[#F8FAFC] focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-sm text-slate-800 font-medium"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="academic_password_entry"
                  name="academic_password_entry"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="new-password"
                  required
                  className="w-full pl-11 pr-11 py-3 bg-[#F8FAFC] focus:bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-sm text-slate-800 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-0.5"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="auth-submit mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <span>Sign In to ERP Portal</span>
              )}
            </button>
          </form>

          {/* Social OAuth Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                Or Continue With
              </span>
            </div>
          </div>

          {/* Google Sign-in Action Button */}
          <button
            type="button"
            id="google_oauth_signin_btn"
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 transition-all flex items-center justify-center gap-3 text-slate-700 font-bold text-sm shadow-2xs cursor-pointer group"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="group-hover:text-slate-900 transition-colors">
              Sign In with Google
            </span>
          </button>

          {/* Student Self-Registration Card */}
          <div className="auth-register-block mt-6 pt-5 border-t border-slate-200">
            <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2.5">
              STUDENT SELF-REGISTRATION
            </span>
            <Link
              to="/register/student"
              className="auth-register-link w-full p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-300 transition-all flex items-center justify-between group no-underline text-slate-800 cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <div className="auth-register-icon w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                  <GraduationCap size={20} />
                </div>
                <span className="auth-register-link-text text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                  New Student? Create Student Account
                </span>
              </div>
              <ArrowRight
                size={16}
                className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0"
              />
            </Link>
            <p className="auth-register-note text-xs text-slate-500 text-center mt-3 font-normal m-0">
              Faculty & Staff accounts are provisioned exclusively by Department Administration.
            </p>
          </div>
        </div>
      </div>

      {showForgotModal && (
        <ForgotPasswordModal
          initialEmail={email}
          onClose={() => setShowForgotModal(false)}
          onSuccess={(newEmail, _newPass, message) => {
            setEmail(newEmail || '');
            setPassword('');
            setSuccessNotice(message || 'Password reset successfully! Please log in with your new password.');
            setForgotNotice('');
            setError('');
          }}
        />
      )}
    </div>
  );
}
