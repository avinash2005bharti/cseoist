import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.jsx';
import { PageHeader, Card, CardHeader, CardTitle, Badge, Button } from '../../components/common';
import { User, GraduationCap, ShieldCheck, Mail, Phone, Building2, Calendar, KeyRound } from 'lucide-react';
import StudentAccountSettingsModal from '../../components/modals/StudentAccountSettingsModal.jsx';

export default function StudentProfile() {
  const { currentUser } = useERP();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState('password');
  const profile = currentUser?.profile || {};
  const mentor = profile?.mentorGroup?.tg?.user;

  const studentMobile = currentUser?.phone || profile?.studentPhone || profile?.guardianPhone || 'Not Provided';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Profile & Mentor"
        description="Your academic enrollment details and assigned Tutor Guardian."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Card */}
        <Card className="md:col-span-1 text-center p-6 flex flex-col items-center">
          <div className="w-20 h-20 rounded-3xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-2xl mb-3 shadow-xs">
            {currentUser?.name?.charAt(0) || 'S'}
          </div>
          <h2 className="text-lg font-black text-slate-900 m-0">{currentUser?.name}</h2>
          <span className="badge badge-indigo text-xs mt-1.5 font-bold">Student</span>
          <div className="text-xs text-slate-500 mt-2">{currentUser?.email}</div>
          <div className="text-xs text-slate-700 font-semibold mt-0.5">{studentMobile}</div>

          <div className="w-full pt-4 mt-6 border-t border-slate-100 flex flex-col gap-2">
            <Button
              variant="outline"
              size="xs"
              icon={<KeyRound size={14} />}
              fullWidth
              onClick={() => {
                setSettingsTab('password');
                setShowSettingsModal(true);
              }}
            >
              Change Password
            </Button>
            <Button
              variant="ghost"
              size="xs"
              icon={<Mail size={14} />}
              fullWidth
              onClick={() => {
                setSettingsTab('email');
                setShowSettingsModal(true);
              }}
            >
              Change Email Address
            </Button>
          </div>
        </Card>

        {/* Academic Details */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Academic Enrollment Details</CardTitle>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-bold block mb-1">Roll Number</span>
              <span className="text-base font-extrabold text-slate-900 font-mono">
                {profile.enrollmentNumber || profile.rollNumber || 'Not provided'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-bold block mb-1">Class Section</span>
              <span className="text-base font-extrabold text-slate-900">
                {profile.section?.code || profile.section?.name || 'CSE-B'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-bold block mb-1">Department</span>
              <span className="text-sm font-extrabold text-slate-900">
                {profile.department?.name || 'Computer Science and Engineering'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-bold block mb-1">Enrollment Year</span>
              <span className="text-sm font-extrabold text-slate-900">
                {profile.enrollmentYear || 2023}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-bold block mb-1">Student Mobile Number</span>
              <span className="text-sm font-extrabold text-slate-900">
                {studentMobile}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-bold block mb-1">Current Semester</span>
              <span className="text-sm font-extrabold text-slate-900">
                Semester {profile.section?.semester || 5} (Enrolled)
              </span>
            </div>
          </div>

          {/* TG Card */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Assigned Tutor Guardian (TG)
            </h4>
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  TG
                </div>
                <div>
                  <div className="text-sm font-extrabold text-slate-900">
                    {mentor?.name ? `${mentor.name} (${mentor?.designation || 'Tutor Guardian'})` : mentor?.designation ? `${mentor.designation} (TG)` : 'Not assigned'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {mentor?.email || 'Not provided'}
                  </div>
                </div>
              </div>
              <Badge variant="primary">Faculty Mentor</Badge>
            </div>
          </div>
        </Card>
      </div>

      {showSettingsModal && (
        <StudentAccountSettingsModal
          initialTab={settingsTab}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
}

