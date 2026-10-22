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
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
  const { currentRole, currentUser } = useERP();
  const location = useLocation();

  const isFaculty = currentUser?.role === 'TEACHER' || currentUser?.role === 'HOD';
  const isAppointedTg = isFaculty && Boolean(currentUser?.isTG);
  const isTgMode = (currentRole === 'tg' || location.pathname.startsWith('/tg')) && isFaculty;

  const getNavLinks = () => {
    if (isTgMode) {
      return [
        { to: '/tg', label: 'Dashboard', icon: <Home size={18} /> },
        { to: '/tg/requests', label: 'Review Applications', icon: <CheckSquare size={18} />, badge: 'Action' },
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
          { to: '/tg/requests', label: 'Review Applications', icon: <CheckSquare size={18} />, badge: 'Action' },
          { to: '/tg/students', label: 'Assigned Students', icon: <Users size={18} /> },
        ];
      case 'student':
      default:
        return [
          { to: '/student', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
          { to: '/student/considerations', label: 'Attendance Consideration', icon: <FileText size={18} /> },
          { to: '/student/leaves', label: 'Leave Applications', icon: <Calendar size={18} /> },
          { to: '/student/profile', label: 'Profile & Tutor Guardian', icon: <GraduationCap size={18} /> },
        ];
    }
  };

  const navLinks = getNavLinks();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`sidebar sidebar-container ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}
        aria-label="Navigation Sidebar"
      >
        {/* Brand Banner */}
        <div className="sidebar-brand-box flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white p-1 border border-slate-200 shadow-xs flex items-center justify-center shrink-0">
              <img src="/iit.png" alt="IIT Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-heading text-base font-black text-slate-900 truncate">
                CampusFlow Lite
              </span>
              <span className="text-xs text-blue-700 font-bold uppercase tracking-wider">
                {currentRole} Workspace
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 lg:hidden shrink-0"
            aria-label="Close Sidebar"
          >
            ✕
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1.5">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/student' || link.to === '/tg' || link.to === '/hod' || link.to === '/admin' || link.to === '/teacher'}
              onClick={() => {
                if (window.innerWidth < 1024) onClose();
              }}
              className={({ isActive }) =>
                `nav-link flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="shrink-0">{link.icon}</span>
                <span className="whitespace-nowrap overflow-hidden text-ellipsis flex-1">{link.label}</span>
              </div>
              {link.badge && (
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 border ${
                    link.badge === 'Action'
                      ? 'bg-[#FEF3C7] text-black border-[#FDE68A] shadow-2xs'
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
        <div className="p-3.5 m-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex flex-col min-w-0">
            <span
              className="font-extrabold text-slate-900 text-sm truncate leading-snug"
              title={currentUser?.name ? `${currentUser.name} (${currentUser?.designation || 'HOD'})` : 'Dr. Rajesh Sharma (HOD)'}
            >
              {currentUser?.name
                ? `${currentUser.name}${currentRole === 'hod' && !currentUser.name.includes('(HOD)') ? ' (HOD)' : ''}`
                : 'Dr. Rajesh Sharma (HOD)'}
            </span>
            <span
              className="text-xs text-slate-600 truncate leading-tight mt-0.5 font-medium"
              title={currentUser?.email || 'hod@campusflow.edu'}
            >
              {currentUser?.email || 'hod@campusflow.edu'}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
