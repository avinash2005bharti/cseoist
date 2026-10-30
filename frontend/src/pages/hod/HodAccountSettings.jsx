import React, { useState } from 'react';
import { Mail, KeyRound, ShieldCheck } from 'lucide-react';
import { useERP } from '../../context/ERPContext.jsx';
import { Card, PageHeader, Button } from '../../components/common';
import StudentAccountSettingsModal from '../../components/modals/StudentAccountSettingsModal.jsx';

export default function HodAccountSettings() {
  const { currentUser } = useERP();
  const [settingsTab, setSettingsTab] = useState('password');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const openSettings = (tab) => {
    setSettingsTab(tab);
    setShowSettingsModal(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Account Settings"
        description="Manage your HOD email address and account password."
      />

      <Card className="max-w-2xl p-6">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <ShieldCheck size={23} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 m-0">{currentUser?.name || 'HOD Account'}</h2>
            <p className="text-xs text-slate-500 mt-1 mb-0">{currentUser?.email || 'Email not available'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <Button
            variant="outline"
            icon={<Mail size={15} />}
            onClick={() => openSettings('email')}
          >
            Change Email Address
          </Button>
          <Button
            variant="outline"
            icon={<KeyRound size={15} />}
            onClick={() => openSettings('password')}
          >
            Change Password
          </Button>
        </div>
      </Card>

      {showSettingsModal && (
        <StudentAccountSettingsModal
          initialTab={settingsTab}
          accountLabel="HOD"
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
}
