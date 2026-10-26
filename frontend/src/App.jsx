import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useERP } from './context/ERPContext.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import { lazyWithRetry as lazy } from './utils/lazyWithRetry.js';

// Auth Pages (Lazy with auto-retry)
const LoginPage = lazy(() => import('./pages/auth/LoginPage.jsx'));
const ChangePasswordPage = lazy(() => import('./pages/auth/ChangePasswordPage.jsx'));
const StudentRegisterPage = lazy(() => import('./pages/auth/StudentRegisterPage.jsx'));
const TeacherRegisterPage = lazy(() => import('./pages/auth/TeacherRegisterPage.jsx'));

// Student Pages (Lazy with auto-retry)
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard.jsx'));
const StudentMyRequests = lazy(() => import('./pages/student/StudentMyRequests.jsx'));
const StudentConsiderations = lazy(() => import('./pages/student/StudentConsiderations.jsx'));
const StudentLeaves = lazy(() => import('./pages/student/StudentLeaves.jsx'));
const StudentProfile = lazy(() => import('./pages/student/StudentProfile.jsx'));

// TG Pages (Lazy with auto-retry)
const TgDashboard = lazy(() => import('./pages/tg/TgDashboard.jsx'));
const TgRequests = lazy(() => import('./pages/tg/TgRequests.jsx'));
const TgMyStudents = lazy(() => import('./pages/tg/TgMyStudents.jsx'));

// HOD Pages (Lazy with auto-retry)
const HodDashboard = lazy(() => import('./pages/hod/HodDashboard.jsx'));
const HodConsiderations = lazy(() => import('./pages/hod/HodConsiderations.jsx'));
const HodTgRecommendations = lazy(() => import('./pages/hod/HodTgRecommendations.jsx'));
const HodLeaves = lazy(() => import('./pages/hod/HodLeaves.jsx'));
const HodMentorship = lazy(() => import('./pages/hod/HodMentorship.jsx'));
const HodStudents = lazy(() => import('./pages/hod/HodStudents.jsx'));
const HodTeachers = lazy(() => import('./pages/hod/HodTeachers.jsx'));
const HodReports = lazy(() => import('./pages/hod/HodReports.jsx'));
const HodSections = lazy(() => import('./pages/hod/HodSections.jsx'));

// Admin Pages (Lazy with auto-retry)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'));
const AdminBulkImport = lazy(() => import('./pages/admin/AdminBulkImport.jsx'));
const AdminHodLeaves = lazy(() => import('./pages/admin/AdminHodLeaves.jsx'));
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit.jsx'));

// Teacher Pages (Lazy with auto-retry)
const TeacherDashboard = lazy(() => import('./pages/teacher/TeacherDashboard.jsx'));
const TeacherLeaves = lazy(() => import('./pages/teacher/TeacherLeaves.jsx'));

const NotFound = lazy(() => import('./pages/NotFound.jsx'));

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
    <span className="text-xs text-slate-500 font-bold">Loading Academic Module...</span>
  </div>
);

import { ShieldAlert, ArrowLeft } from 'lucide-react';

function RoleRedirect() {
  const { currentRole, currentUser, isAuthenticated, loadingAuth } = useERP();

  if (loadingAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-bold">Verifying Session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <Navigate to={`/${currentRole}`} replace />;
}

function ProtectedLayout() {
  const { isAuthenticated, loadingAuth } = useERP();
  const location = useLocation();

  if (loadingAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-bold">Authenticating Academic Session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <DashboardLayout />;
}

function LoginWrapper() {
  const { isAuthenticated, currentRole, currentUser, loadingAuth } = useERP();
  if (loadingAuth) return null;
  if (isAuthenticated) {
    if (currentUser?.mustChangePassword) {
      return <Navigate to="/change-password" replace />;
    }
    return <Navigate to={`/${currentRole}`} replace />;
  }
  return <LoginPage />;
}

function RoleRouteGuard({ role, children }) {
  const { currentRole, currentUser, isAuthenticated, loadingAuth } = useERP();
  const location = useLocation();

  if (loadingAuth) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = (currentUser?.role || currentRole || 'student').toLowerCase();
  const isStudent = userRole === 'student';
  const isFaculty = userRole === 'teacher' || userRole === 'hod';
  const isAppointedTg = isFaculty && Boolean(currentUser?.isTG);
  const isAdmin = userRole === 'admin';

  let isMatch = false;
  const targetRoles = Array.isArray(role) ? role : [role];

  if (isStudent) {
    isMatch = targetRoles.includes('student');
  } else if (isAdmin) {
    isMatch = targetRoles.some((r) => ['admin', 'hod', 'audit'].includes(r));
  } else if (userRole === 'hod') {
    isMatch = targetRoles.some((r) => ['hod', 'teacher', 'audit'].includes(r));
  } else if (userRole === 'tg' || isAppointedTg) {
    isMatch = targetRoles.some((r) => ['tg', 'teacher'].includes(r));
  } else if (userRole === 'teacher') {
    isMatch = targetRoles.includes('teacher');
  }

  if (!isMatch) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="card text-center max-w-md w-full p-8 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Access Restricted (403 Forbidden)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              You do not have administrative permission to access this resource. Your authenticated role is{' '}
              <strong className="text-slate-800 uppercase">{currentRole}</strong>.
            </p>
          </div>
          <Link
            to={`/${currentRole}`}
            className="btn btn-primary text-xs font-bold inline-flex items-center gap-2 mt-2"
          >
            <ArrowLeft size={15} />
            <span>Return to My Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginWrapper />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/register" element={<StudentRegisterPage />} />
      <Route path="/register/student" element={<StudentRegisterPage />} />
      <Route path="/register/teacher" element={<Navigate to="/register" replace />} />

      {/* Protected Layout Routes */}
      <Route path="/" element={<ProtectedLayout />}>
        {/* Default route redirect to user role */}
        <Route index element={<RoleRedirect />} />

        {/* Student Routes */}
        <Route
          path="student"
          element={
            <RoleRouteGuard role="student">
              <StudentDashboard />
            </RoleRouteGuard>
          }
        />
        <Route
          path="student/requests"
          element={
            <RoleRouteGuard role="student">
              <StudentMyRequests />
            </RoleRouteGuard>
          }
        />
        <Route
          path="student/considerations"
          element={
            <RoleRouteGuard role="student">
              <StudentConsiderations />
            </RoleRouteGuard>
          }
        />
        <Route
          path="student/leaves"
          element={
            <RoleRouteGuard role="student">
              <StudentLeaves />
            </RoleRouteGuard>
          }
        />
        <Route
          path="student/profile"
          element={
            <RoleRouteGuard role="student">
              <StudentProfile />
            </RoleRouteGuard>
          }
        />

        {/* TG Routes */}
        <Route
          path="tg"
          element={
            <RoleRouteGuard role="tg">
              <TgDashboard />
            </RoleRouteGuard>
          }
        />
        <Route
          path="tg/requests"
          element={
            <RoleRouteGuard role="tg">
              <TgRequests />
            </RoleRouteGuard>
          }
        />
        <Route
          path="tg/students"
          element={
            <RoleRouteGuard role="tg">
              <TgMyStudents />
            </RoleRouteGuard>
          }
        />

        {/* HOD Routes */}
        <Route
          path="hod"
          element={
            <RoleRouteGuard role="hod">
              <HodDashboard />
            </RoleRouteGuard>
          }
        />
        <Route
          path="hod/considerations"
          element={
            <RoleRouteGuard role="hod">
              <HodConsiderations />
            </RoleRouteGuard>
          }
        />
        <Route
          path="hod/tg-recommendations"
          element={
            <RoleRouteGuard role="hod">
              <HodTgRecommendations />
            </RoleRouteGuard>
          }
        />
        <Route
          path="hod/leaves"
          element={
            <RoleRouteGuard role="hod">
              <HodLeaves />
            </RoleRouteGuard>
          }
        />
        <Route
          path="hod/sections"
          element={
            <RoleRouteGuard role="hod">
              <HodSections />
            </RoleRouteGuard>
          }
        />
        <Route
          path="hod/mentorship"
          element={
            <RoleRouteGuard role="hod">
              <HodMentorship />
            </RoleRouteGuard>
          }
        />
        <Route
          path="hod/students"
          element={
            <RoleRouteGuard role="hod">
              <HodStudents />
            </RoleRouteGuard>
          }
        />
        <Route
          path="hod/teachers"
          element={
            <RoleRouteGuard role="hod">
              <HodTeachers />
            </RoleRouteGuard>
          }
        />
        <Route
          path="hod/reports"
          element={
            <RoleRouteGuard role="hod">
              <HodReports />
            </RoleRouteGuard>
          }
        />

        {/* Admin Routes */}
        <Route
          path="admin"
          element={
            <RoleRouteGuard role="admin">
              <AdminDashboard />
            </RoleRouteGuard>
          }
        />
        <Route
          path="admin/users"
          element={
            <RoleRouteGuard role="admin">
              <AdminUsers />
            </RoleRouteGuard>
          }
        />
        <Route
          path="admin/import"
          element={
            <RoleRouteGuard role="admin">
              <AdminBulkImport />
            </RoleRouteGuard>
          }
        />
        <Route
          path="admin/hod-leaves"
          element={
            <RoleRouteGuard role="admin">
              <AdminHodLeaves />
            </RoleRouteGuard>
          }
        />

        {/* Common Audit Trail (Admin and HOD) */}
        <Route
          path="audit"
          element={
            <RoleRouteGuard role={['admin', 'hod']}>
              <AdminAudit />
            </RoleRouteGuard>
          }
        />

        {/* Legacy Teacher Routes Redirect to TG Workspace */}
        <Route
          path="teacher"
          element={<Navigate to="/tg" replace />}
        />
        <Route
          path="teacher/leaves"
          element={<Navigate to="/tg/requests" replace />}
        />
      </Route>

      {/* Catch-all fallback 404 page */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}
