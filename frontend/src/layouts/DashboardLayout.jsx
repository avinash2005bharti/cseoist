import React, { useState, lazy, Suspense } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useERP } from '../context/ERPContext.jsx';
import Header from '../components/Header.jsx';
import Sidebar from '../components/Sidebar.jsx';
import NotificationToast from '../components/NotificationToast.jsx';
import {
  Home,
  FileText,
  Bell,
  User,
  LayoutDashboard,
  Users,
  Calendar,
  Layers,
  Building2,
} from 'lucide-react';

// Lazy-loaded on-demand modals to eliminate critical-path render blocking
const FilePreviewModal = lazy(() => import('../components/FilePreviewModal.jsx'));
const RequestConsiderationModal = lazy(() => import('../components/modals/RequestConsiderationModal.jsx'));
const ApplyLeaveModal = lazy(() => import('../components/modals/ApplyLeaveModal.jsx'));
const AttendanceLeaveReportsModal = lazy(() => import('../components/modals/AttendanceLeaveReportsModal.jsx'));
const ReviewModal = lazy(() => import('../components/modals/ReviewModal.jsx'));
const GroupStudentAuditModal = lazy(() => import('../components/modals/GroupStudentAuditModal.jsx'));

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  });

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { activeModal, modalData, closeModal, previewFile, currentRole, currentUser } = useERP();
  const location = useLocation();

  const roleStr = (currentUser?.role || currentRole || '').toLowerCase();
  const isFaculty = roleStr === 'teacher' || roleStr === 'hod';
  const isTg = roleStr === 'tg' || location.pathname.startsWith('/tg');
  const isStudent = roleStr === 'student' || location.pathname.startsWith('/student');
  const isHod = roleStr === 'hod' || location.pathname.startsWith('/hod');
  const isHodDashboard = location.pathname === '/hod';

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className={`app-container ${isStudent ? 'student-portal-mode' : ''} ${isTg ? 'tg-portal-mode' : ''} ${isHod ? 'hod-portal-mode' : ''}`}>
      {/* Navigation Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} />

      {/* Main Content Area */}
      <div className={`main-content ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Header
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={handleToggleSidebar}
        />

        <main className={`content-container ${isHodDashboard ? 'hod-content-container max-w-7xl mx-auto w-full p-4 sm:p-8' : isTg ? 'tg-content-container max-w-7xl mx-auto w-full p-4 sm:p-8' : isStudent ? 'student-content-container p-4 sm:p-6 lg:p-8 w-full' : 'p-4 sm:p-6 lg:p-8 w-full min-w-0'} pb-24 sm:pb-8`}>
          <Outlet />
        </main>
      </div>

      {/* Student Mobile Bottom Navigation (Screen 4) */}
      {isStudent && (
        <nav
          className="mobile-bottom-nav student-mobile-nav sm:hidden"
          aria-label="Student Mobile Navigation"
        >
          <NavLink
            to="/student"
            end
            className={({ isActive }) =>
              `mobile-nav-btn ${isActive ? 'active text-primary' : 'text-muted-foreground'}`
            }
            aria-label="Home"
          >
            <Home className="w-5 h-5" />
          </NavLink>

          <NavLink
            to="/student/requests"
            className={({ isActive }) =>
              `mobile-nav-btn ${isActive || location.pathname.includes('/student/considerations') ? 'active text-primary' : 'text-muted-foreground'}`
            }
            aria-label="Applications"
          >
            <FileText className="w-5 h-5" />
          </NavLink>

          <NavLink
            to="/student/leaves"
            className={({ isActive }) =>
              `mobile-nav-btn ${isActive ? 'active text-primary' : 'text-muted-foreground'}`
            }
            aria-label="Leaves & Notifications"
          >
            <Bell className="w-5 h-5" />
          </NavLink>

          <NavLink
            to="/student/profile"
            className={({ isActive }) =>
              `mobile-nav-btn ${isActive ? 'active text-primary' : 'text-muted-foreground'}`
            }
            aria-label="Profile"
          >
            <User className="w-5 h-5" />
          </NavLink>
        </nav>
      )}

      {/* TG Mobile Bottom Navigation (Screen 6) */}
      {isTg && (
        <nav
          className="mobile-bottom-nav tg-mobile-nav bg-card border-t border-border flex fixed bottom-0 inset-x-0 px-2 justify-around items-center min-h-16 z-30 sm:hidden"
          aria-label="Tutor Guardian Mobile Navigation"
        >
          <NavLink
            to="/tg"
            end
            className={({ isActive }) =>
              `mobile-nav-btn flex flex-col justify-center items-center gap-1 min-w-16 min-h-11 transition-colors ${isActive ? 'active text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <LayoutDashboard className="size-5" />
            <span className="font-semibold text-xs">Dashboard</span>
          </NavLink>

          <NavLink
            to="/tg/requests"
            className={({ isActive }) =>
              `mobile-nav-btn flex flex-col justify-center items-center gap-1 min-w-16 min-h-11 transition-colors ${isActive ? 'active text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <FileText className="size-5" />
            <span className="font-semibold text-xs">Applications</span>
          </NavLink>

          <NavLink
            to="/tg/students"
            className={({ isActive }) =>
              `mobile-nav-btn flex flex-col justify-center items-center gap-1 min-w-16 min-h-11 transition-colors ${isActive ? 'active text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Users className="size-5" />
            <span className="font-semibold text-xs">Students</span>
          </NavLink>
        </nav>
      )}

      {/* HOD Mobile Bottom Navigation */}
      {isHod && (
        <nav
          className="mobile-bottom-nav hod-mobile-nav"
          aria-label="HOD Mobile Navigation"
        >
          <NavLink
            to="/hod"
            end
            className={({ isActive }) =>
              `mobile-nav-btn ${isActive ? 'active' : ''}`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/hod/considerations"
            className={({ isActive }) =>
              `mobile-nav-btn ${isActive ? 'active' : ''}`
            }
          >
            <FileText className="w-5 h-5" />
            <span>Clearances</span>
          </NavLink>

          <NavLink
            to="/hod/leaves"
            className={({ isActive }) =>
              `mobile-nav-btn ${isActive ? 'active' : ''}`
            }
          >
            <Calendar className="w-5 h-5" />
            <span>Leaves</span>
          </NavLink>

          <NavLink
            to="/hod/sections"
            className={({ isActive }) =>
              `mobile-nav-btn ${isActive ? 'active' : ''}`
            }
          >
            <Layers className="w-5 h-5" />
            <span>Sections</span>
          </NavLink>

          <NavLink
            to="/hod/mentorship"
            className={({ isActive }) =>
              `mobile-nav-btn ${isActive ? 'active' : ''}`
            }
          >
            <Building2 className="w-5 h-5" />
            <span>TGs</span>
          </NavLink>
        </nav>
      )}

      {/* Global Toast System */}
      <NotificationToast />

      {/* Lazy-loaded Modals */}
      <Suspense fallback={null}>
        {/* Secure File Viewer Modal */}
        {previewFile && <FilePreviewModal />}

        {/* Global Action Modals */}
        {activeModal === 'REQUEST_CONSIDERATION' && (
          <RequestConsiderationModal
            onClose={closeModal}
            onSuccess={() => {
              closeModal();
              window.dispatchEvent(new CustomEvent('campusflow_refresh_considerations'));
            }}
          />
        )}

        {activeModal === 'APPLY_LEAVE' && (
          <ApplyLeaveModal
            onClose={closeModal}
            onSuccess={() => {
              closeModal();
              window.dispatchEvent(new CustomEvent('campusflow_refresh_leaves'));
            }}
          />
        )}

        {activeModal === 'EXPORT_REPORTS' && (
          <AttendanceLeaveReportsModal onClose={closeModal} modalData={modalData} />
        )}

        {activeModal === 'REVIEW_ACTION' && (
          <ReviewModal
            type={modalData.type}
            role={modalData.role}
            item={modalData.item}
            onClose={closeModal}
            onSuccess={() => {
              closeModal();
              window.dispatchEvent(new CustomEvent('campusflow_queue_changed'));
            }}
          />
        )}

        {activeModal === 'AUDIT_GROUP_STUDENTS' && (
          <GroupStudentAuditModal
            request={modalData.request || modalData.item}
            userRole={modalData.userRole || modalData.role || 'HOD'}
            onClose={closeModal}
            onSuccess={() => {
              window.dispatchEvent(new CustomEvent('campusflow_queue_changed'));
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
