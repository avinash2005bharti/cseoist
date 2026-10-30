import React, { useState } from 'react';
import { X, Mail, Lock, KeyRound, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { authApi } from '../../api';
import { useERP } from '../../context/ERPContext.jsx';

export default function StudentAccountSettingsModal({ onClose, defaultTab = 'email', initialTab, accountLabel = 'student' }) {
  const { currentUser, updateCurrentUser, addToast } = useERP();

  const [activeTab, setActiveTab] = useState(initialTab || defaultTab); // 'email' | 'password'

  // Email form state
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setEmailError(null);

    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    if (cleanEmail === (currentUser?.email || '').toLowerCase()) {
      setEmailError('New email address must be different from current email.');
      return;
    }

    if (!emailPassword) {
      setEmailError('Please enter your current password to authorize this email update.');
      return;
    }

    setSavingEmail(true);
    try {
      const res = await authApi.updateProfile({
        email: cleanEmail,
        currentPassword: emailPassword,
      });

      const updatedUser = res?.data || res;
      updateCurrentUser({ email: cleanEmail, ...updatedUser });

      addToast(
        'Email Address Updated',
        `Your official email has been changed to ${cleanEmail}.`,
        'success'
      );
      setNewEmail('');
      setEmailPassword('');
      onClose();
    } catch (err) {
      setEmailError(err.response?.data?.error?.message || err.message || 'Failed to update email address.');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('Current password is required.');
      return;
    }

    if (!newPassword || newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError('New password must be at least 8 characters and include one uppercase letter and one number.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
      });

      addToast('Password Changed', 'Your account password was updated successfully.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err) {
      setPasswordError(err.response?.data?.error?.message || err.message || 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="account-settings-modal modal-container max-w-md w-[95%] bg-white p-6 sm:p-7 rounded-3xl text-slate-900 shadow-2xl font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 m-0">
                Security & Account Settings
              </h3>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Manage your {accountLabel} portal login credentials
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

        {/* Tab Selection */}
        <div className="grid grid-cols-2 gap-2 mt-4 p-1 rounded-2xl bg-slate-100 border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'email'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail size={14} />
            <span>Change Email</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'password'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock size={14} />
            <span>Change Password</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: CHANGE EMAIL ADDRESS
            ========================================================================= */}
        {activeTab === 'email' && (
          <form onSubmit={handleUpdateEmail} className="flex flex-col gap-3.5 mt-4">
            {emailError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{emailError}</span>
              </div>
            )}

            {/* Current Email Display */}
            <div>
              <span className="block text-xs font-bold text-slate-700 mb-1">
                Current Registered Email
              </span>
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 select-all">
                {currentUser?.email || 'account@domain.in'}
              </div>
            </div>

            {/* New Email */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                New Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email address..."
                  required
                  className="account-settings-input w-full pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <Mail size={15} aria-hidden="true" className="account-settings-icon absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Current Password for Security Authorization */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Current Password (Authorization) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showEmailPassword ? 'text' : 'password'}
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder="Enter current password to authorize..."
                  required
                  className="account-settings-input account-settings-input-with-toggle w-full pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <Lock size={15} aria-hidden="true" className="account-settings-icon absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowEmailPassword(!showEmailPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer inline-flex items-center justify-center"
                >
                  {showEmailPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={savingEmail}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEmail}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-all disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
              >
                {savingEmail ? 'Updating...' : 'Save New Email'}
              </button>
            </div>
          </form>
        )}

        {/* =========================================================================
            TAB 2: CHANGE LOGIN PASSWORD
            ========================================================================= */}
        {activeTab === 'password' && (
          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-3.5 mt-4">
            {passwordError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {/* Current Password */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Current Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password..."
                  required
                  className="account-settings-input account-settings-input-with-toggle w-full pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <KeyRound size={15} aria-hidden="true" className="account-settings-icon absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer inline-flex items-center justify-center"
                >
                  {showCurrentPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters, 1 uppercase, 1 number..."
                  required
                  minLength={8}
                  className="account-settings-input account-settings-input-with-toggle w-full pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <Lock size={15} aria-hidden="true" className="account-settings-icon absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer inline-flex items-center justify-center"
                >
                  {showNewPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Confirm New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password..."
                  required
                  minLength={8}
                  className="account-settings-input w-full pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <Lock size={15} aria-hidden="true" className="account-settings-icon absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={savingPassword}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPassword}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-all disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
              >
                {savingPassword ? 'Changing...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
