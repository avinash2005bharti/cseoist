import React, { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';

const OfficialClearancesLedgerModal = lazy(
  () => import('../../components/modals/OfficialClearancesLedgerModal.jsx')
);

export default function TeacherConsiderations() {
  const navigate = useNavigate();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
          Loading consideration ledger...
        </div>
      }
    >
      <OfficialClearancesLedgerModal
        initialTab="considerations"
        initialDateMode="today"
        isTeacherView
        onClose={() => navigate('/teacher')}
      />
    </Suspense>
  );
}
