import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../api/authApi.js';
import { useERP } from '../../context/ERPContext.jsx';

export default function TeacherPasscodeManagementPage() {
  const navigate = useNavigate();
  const { currentRole } = useERP();
  const [status, setStatus] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const loadStatus = () => authApi.getTeacherPasscodeStatus().then(setStatus).catch((error) => setNotice({ error: error.message || 'Unable to load status.' })).finally(() => setLoading(false));
  useEffect(() => { loadStatus(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    setNotice(null);
    if (!/^\d{4}$/.test(passcode)) {
      setNotice({ error: 'Passcode must be exactly four digits.' });
      return;
    }
    if (!window.confirm(`${status?.configured ? 'Change' : 'Set'} the shared Teacher passcode? Existing Teacher sessions will be invalidated.`)) return;
    try {
      await authApi.updateTeacherPasscode({ currentPassword, passcode });
      setCurrentPassword('');
      setPasscode('');
      setNotice({ success: 'Teacher passcode updated. Existing Teacher sessions have been invalidated.' });
      await loadStatus();
    } catch (error) {
      setNotice({ error: error.message || 'Unable to update Teacher passcode.' });
    }
  };

  const reset = async () => {
    setNotice(null);
    if (!resetPassword) {
      setNotice({ error: 'Enter your existing password to confirm the reset.' });
      return;
    }
    if (!window.confirm('Reset the shared Teacher passcode? Teacher access will remain blocked until a new code is configured.')) return;
    try {
      await authApi.resetTeacherPasscode(resetPassword);
      setCurrentPassword('');
      setResetPassword('');
      setPasscode('');
      setShowResetConfirm(false);
      setNotice({ success: 'Teacher passcode reset. Configure a new code before Teacher access is restored.' });
      await loadStatus();
    } catch (error) {
      setNotice({ error: error.message || 'Unable to reset Teacher passcode.' });
    }
  };

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <button
        type="button"
        onClick={() => navigate(`/${currentRole === 'admin' ? 'admin' : 'hod'}`)}
        className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft size={16} />
        Back to dashboard
      </button>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-black uppercase tracking-wider text-blue-600">Security settings</p>
        <h1 className="text-2xl font-black leading-tight text-slate-900">Teacher Passcode</h1>
        <p className="text-sm leading-6 text-slate-500">The shared four-digit code is never shown or returned by the API.</p>
      </div>
      {notice?.error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-5 text-rose-700">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{notice.error}</span>
        </div>
      )}
      {notice?.success && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-5 text-emerald-700">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <span>{notice.success}</span>
        </div>
      )}
      <div className="card flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-bold text-slate-700">Current status</span>
          <span className={`text-sm font-bold ${status?.configured ? 'font-mono tracking-widest text-slate-600' : 'text-slate-500'}`}>
            {loading ? 'Loading…' : status?.maskedPasscode || 'Not configured'}
          </span>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2 text-sm font-bold text-slate-700">
            <span>Your existing password</span>
            <input type="password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3 font-normal text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100" autoComplete="current-password" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-bold text-slate-700">
            <span>New four-digit passcode</span>
            <input type="password" required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={passcode} onChange={(event) => setPasscode(event.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full rounded-xl border border-slate-300 px-3 py-3 font-normal tracking-[0.5em] text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
          </label>
          <div className="flex flex-col gap-3 pt-1">
            <button type="submit" className="btn btn-primary inline-flex w-full items-center justify-center gap-2"><KeyRound size={16} />{status?.configured ? 'Change Passcode' : 'Configure Passcode'}</button>
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setShowResetConfirm(true);
            }}
            disabled={!status?.configured}
            className="w-full rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset Passcode
          </button>
          </div>
        </form>
        {showResetConfirm && status?.configured && (
          <div className="flex flex-col gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div>
              <h2 className="text-sm font-bold text-rose-800">Confirm passcode reset</h2>
              <p className="mt-1 text-xs leading-5 text-rose-700">
                Resetting blocks Teacher login until a new passcode is configured.
              </p>
            </div>
            <label className="flex flex-col gap-2 text-sm font-bold text-slate-700">
              <span>Your existing password</span>
              <input
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-800 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                autoComplete="current-password"
                autoFocus
              />
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={reset} className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white hover:bg-rose-700">
                Confirm Reset
              </button>
              <button type="button" onClick={() => { setShowResetConfirm(false); setResetPassword(''); }} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        )}
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-700">A four-digit code has only 10,000 combinations. Failed attempts are rate-limited and temporarily locked out; use an operationally controlled distribution process.</p>
      </div>
    </section>
  );
}
