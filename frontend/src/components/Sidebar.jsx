import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useERP } from '../context/ERPContext.jsx';
import { Badge } from './common';
import {
  LayoutDashboard,
  Home,
  CheckSquare,
  Calendar,
  FileText,
  UserCheck,
  Users,
  Building2,
  Settings,
  Activity,
  GraduationCap,
  Database,
  Shield,
  Layers,
  FileSpreadsheet,
  BookOpen,
  Sparkles,
  PlusCircle,
  Clock3,
  Settings2,
  ShieldCheck,
  Landmark,
  Menu,
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
  const { currentRole, currentUser, openModal } = useERP();
  const location = useLocation();

  const roleStr = (currentUser?.role || currentRole || '').toLowerCase();
  const isFaculty = currentUser?.role === 'TEACHER' || currentUser?.role === 'HOD';
  const isAppointedTg = isFaculty && Boolean(currentUser?.isTG);
  const isTgMode = currentRole === 'tg' || location.pathname.startsWith('/tg') || roleStr === 'tg';
  const isStudent = roleStr === 'student' || location.pathname.startsWith('/student');
  const isHod = roleStr === 'hod' || location.pathname.startsWith('/hod') || currentRole === 'hod';

  const getNavLinks = () => {
    if (isTgMode) {
      return [
        { to: '/tg', label: 'Dashboard', icon: <Home size={18} /> },
        { to: '/tg/requests', label: 'Review Applications', icon: <CheckSquare size={18} /> },
        { to: '/tg/students', label: 'Assigned Students', icon: <Users size={18} /> },
      ];
    }

    switch (currentRole) {
      case 'admin':
        return [
          { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
          { to: '/admin/users', label: 'Users & Sections', icon: <Users size={18} /> },
          { to: '/admin/import', label: 'Bulk Import', icon: <Database size={18} />, badge: 'Excel' },

          { to: '/admin/hod-leaves', label: 'HOD Leaves', icon: <Calendar size={18} /> },
          { to: '/audit', label: 'Audit Trail', icon: <Shield size={18} /> },
        ];
      case 'hod':
        return [
          { to: '/hod', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
          { to: '/hod/tg-recommendations', label: 'TG Recommendations', icon: <ShieldCheck size={18} /> },
          { to: '/hod/considerations', label: 'Attendance Considerations', icon: <FileText size={18} /> },
          { to: '/hod/leaves', label: 'Leave Approvals', icon: <Calendar size={18} /> },
          { to: '/hod/sections', label: 'Section Progression', icon: <Layers size={18} /> },
          { to: '/hod/mentorship', label: 'Teacher Guardian Allocation', icon: <Building2 size={18} /> },
          { to: '/hod/students', label: 'Student Directory', icon: <GraduationCap size={18} /> },
          { to: '/hod/teachers', label: 'Faculty Directory', icon: <UserCheck size={18} /> },
        ];
      case 'teacher':
        return [
          { to: '/tg', label: 'Dashboard', icon: <Home size={18} /> },
          { to: '/tg/requests', label: 'Review Applications', icon: <CheckSquare size={18} /> },
          { to: '/tg/students', label: 'Assigned Students', icon: <Users size={18} /> },
        ];
      case 'student':
      default:
        return [
          { to: '/student', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
          {
            to: '/student/considerations',
            label: 'Considerations',
            icon: <FileText size={18} />,
          },
          {
            to: '/student/leaves',
            label: 'Leaves',
            icon: <Calendar size={18} />,
          },
          { to: '/student/requests', label: 'Application History', icon: <Clock3 size={18} /> },
          { to: '/student/profile', label: 'Account Settings', icon: <Settings2 size={18} /> },
        ];
    }
  };

  const navLinks = getNavLinks();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && !isHod && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`sidebar sidebar-container ${isOpen ? 'sidebar-open' : 'sidebar-closed'} ${isHod ? 'hidden lg:flex' : ''}`}
        aria-label="Navigation Sidebar"
      >
        {/* Brand Banner */}
        <div className={`sidebar-brand-box flex items-center justify-between gap-3 px-5 py-4 border-b ${isStudent ? 'border-indigo-100/80' : 'border-slate-200'}`}>
          <NavLink
            to={isTgMode ? '/tg' : `/${currentRole || 'student'}`}
            onClick={() => {
              if (onClose) onClose();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 min-w-0 no-underline cursor-pointer group"
            title="Return to Dashboard"
          >
            {isStudent ? (
              <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground shadow-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-5 h-5 shrink-0" />
              </div>
            ) : isTgMode ? (
              <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground shadow-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5 shrink-0" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground shadow-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Landmark className="w-5 h-5 shrink-0" />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-heading text-base font-bold text-slate-900 truncate">
                CampusFlow Lite
              </span>
              <span className="text-[10px] text-primary font-bold uppercase tracking-wider bg-secondary px-2 py-0.5 rounded-full w-fit mt-0.5 border border-primary/20">
                {isTgMode ? 'TG Workspace' : isStudent ? 'Student Workspace' : (currentRole === 'hod' || roleStr === 'hod') ? 'HOD Workspace' : `${currentRole} Workspace`}
              </span>
            </div>
          </NavLink>
          {/* Sidebar Toggle / Collapse Button (Moved here per user request) */}
          <button
            type="button"
            onClick={onClose}
            className="sidebar-collapse-btn p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer shrink-0 flex items-center justify-center"
            title="Collapse Sidebar"
            aria-label="Toggle Navigation Menu"
          >
            <Menu size={18} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1.5">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/student' || link.to === '/tg' || link.to === '/hod' || link.to === '/admin' || link.to === '/teacher'}
              onClick={(e) => {
                if (link.modalAction) {
                  openModal(link.modalAction);
                }
                if (window.innerWidth < 1024) onClose();
              }}
              className={({ isActive }) =>
                `nav-link flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive
                  ? 'active bg-primary text-primary-foreground shadow-xs'
                  : isStudent || isTgMode
                    ? 'text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-900'
                    : 'text-slate-700 hover:bg-blue-50/80 hover:text-blue-700'
                }`
              }
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="shrink-0">{link.icon}</span>
                <span className="whitespace-nowrap overflow-hidden text-ellipsis flex-1">{link.label}</span>
              </div>
              {link.badge && (
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 border ${link.badge === 'Action'
                      ? 'bg-[#FEF3C7] text-black border-[#FDE68A] shadow-2xs'
                      : isStudent || isTgMode
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        : 'bg-blue-100 text-blue-900 border-blue-200'
                    }`}
                  style={{
                    color: link.badge === 'Action' ? '#000000' : undefined,
                  }}
                >
                  {link.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom User Info Profile Card */}
        <div className={`p-3 m-3 rounded-2xl ${isStudent || isTgMode ? 'bg-slate-50/80 border border-indigo-100/90 shadow-2xs' : 'bg-white border border-slate-200/90 shadow-2xs'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="font-bold rounded-full bg-secondary text-secondary-foreground text-xs flex justify-center items-center w-8 h-8 shrink-0">
              {currentUser?.name
                ? currentUser.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                : (isTgMode ? 'TT' : isStudent ? 'AM' : 'HC')}
            </div>
            <div className="flex flex-col min-w-0">
              <span
                className="font-extrabold text-slate-900 text-sm truncate leading-snug"
                title={currentUser?.name || (isTgMode ? 'Test Teacher' : isStudent ? 'Ayush Mishra' : 'Hod cse')}
              >
                {currentUser?.name || (isTgMode ? 'Test Teacher' : isStudent ? 'Ayush Mishra' : 'Hod cse')}
              </span>
              <span
                className="text-xs text-slate-600 truncate leading-tight mt-0.5 font-medium uppercase tracking-wider"
                title={currentUser?.role || (isTgMode ? 'Teacher' : isStudent ? 'Student' : 'HOD')}
              >
                {currentUser?.role || (isTgMode ? 'Teacher' : isStudent ? 'Student' : 'HOD')}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
