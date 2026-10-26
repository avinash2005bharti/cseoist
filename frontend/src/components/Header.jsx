import React, { useState, useRef, useEffect } from 'react';
import { useERP } from '../context/ERPContext.jsx';
import { Bell, ShieldCheck, BadgeCheck, User, Menu, LogOut, CheckCheck, RefreshCw, GraduationCap, Landmark } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { notificationApi } from '../api';
import { formatDateTimeIST } from '../utils/constants.js';

const roleEmojiMap = {
  student: '🎓',
  teacher: '👨‍🏫',
  tg: '🛡️',
  hod: '🏛️',
  admin: '👑',
};

const roleTitleMap = {
  student: 'Student Portal',
  teacher: 'Faculty Dashboard',
  tg: 'TG Dashboard',
  hod: 'HOD Dashboard',
  admin: 'Administrator Portal',
};

export default function Header({ isSidebarOpen, onToggleSidebar }) {
  const {
    currentRole,
    currentUser,
    notifications,
    unreadNotifCount,
    refreshNotifications,
    logout,
    switchRole,
    pwaPushEnabled,
    enablePWAReminders,
    sendTestReminder,
  } = useERP();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const [expandedNotifId, setExpandedNotifId] = useState(null);
  const location = useLocation();
  const roleStr = (currentUser?.role || currentRole || '').toLowerCase();
  const isFaculty = roleStr === 'teacher' || roleStr === 'hod';
  const isTg = roleStr === 'tg' || location.pathname.startsWith('/tg');
  const isStudent = roleStr === 'student' || location.pathname.startsWith('/student');
  const isHod = roleStr === 'hod' || location.pathname.startsWith('/hod');
  const isHodDashboard = location.pathname === '/hod';

  // Close notifications on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotifications]);

  const handleNotificationClick = async (notif) => {
    setExpandedNotifId(expandedNotifId === notif._id ? null : notif._id);
    if (!notif.isRead) {
      try {
        await notificationApi.markAsRead(notif._id);
        refreshNotifications();
      } catch {
        // ignore
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      refreshNotifications();
    } catch {
      // ignore
    }
  };

  const handleLogoClick = (path) => (e) => {
    e.preventDefault();
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className={`flex items-center justify-between gap-3 px-4 md:px-6 h-16 w-full ${isHodDashboard ? 'max-w-7xl mx-auto px-4 sm:px-8' : ''}`}>
        {/* Left: Desktop Menu Trigger & Branding or Mobile Dynamic Role Header (Screen 4 & Screen 6) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          {/* Menu Trigger: Visible in header ONLY when sidebar is closed/off. When sidebar is open, toggle button is inside sidebar */}
          {!isSidebarOpen && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer flex items-center justify-center"
              title="Open Menu"
              aria-label="Toggle Navigation Menu"
            >
              <Menu size={18} />
            </button>
          )}

          {/* Desktop Branding Link (Screen 5, Screen 7, Screen 9) */}
          {isHod ? (
            <Link
              to="/hod"
              onClick={handleLogoClick('/hod')}
              className="hidden sm:flex items-center gap-3 no-underline cursor-pointer group select-none"
              title="Return to HOD Dashboard"
            >
              <span className="font-bold text-lg tracking-tight text-foreground">
                CampusFlow Lite
              </span>
              <span className="font-semibold uppercase rounded-md bg-secondary text-secondary-foreground text-xs tracking-wider px-3 py-1">
                HOD WORKSPACE
              </span>
            </Link>
          ) : isTg ? (
            <Link
              to="/tg"
              onClick={handleLogoClick('/tg')}
              className="hidden sm:flex items-center gap-4 no-underline cursor-pointer group select-none"
              title="Return to TG Dashboard"
            >
              <div className="rounded-lg bg-primary text-primary-foreground flex justify-center items-center size-10 shadow-xs group-hover:opacity-90 transition-opacity">
                <ShieldCheck className="size-5" />
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-lg tracking-tight text-foreground">
                  CampusFlow Lite
                </span>
                <span className="font-semibold uppercase rounded-full bg-primary/10 text-primary text-xs tracking-wider border border-primary/20 px-3 py-1">
                  TG WORKSPACE
                </span>
              </div>
            </Link>
          ) : isStudent ? (
            <Link
              to="/student"
              onClick={handleLogoClick('/student')}
              className="hidden sm:flex items-center gap-2.5 no-underline cursor-pointer group select-none"
              title="Return to Student Dashboard"
            >
              <div className="rounded-lg bg-primary text-primary-foreground flex justify-center items-center size-8 shadow-xs group-hover:opacity-90 transition-opacity">
                <GraduationCap className="size-4" />
              </div>
              <span className="font-heading text-sm font-bold text-foreground">CampusFlow Lite</span>
            </Link>
          ) : (
            <Link
              to={`/${roleStr || 'student'}`}
              onClick={handleLogoClick(`/${roleStr || 'student'}`)}
              className="flex items-center gap-2.5 no-underline cursor-pointer group select-none"
              title="Return to Dashboard"
            >
              <div className="w-9 h-9 rounded-xl bg-white p-0.5 flex items-center justify-center border border-slate-200 shadow-xs group-hover:scale-105 transition-transform overflow-hidden">
                <img
                  src="/iit.png"
                  alt="IIT Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
              <div className="flex flex-col">
                <span className="font-heading text-base font-extrabold text-slate-900 leading-tight">
                  OIST CSE
                </span>
                <span className="text-xs text-blue-700 font-bold leading-none">
                  CampusFlow ERP
                </span>
              </div>
            </Link>
          )}

          {/* HOD Mobile Header (Screen 10: Squircle Landmark + CampusFlow Lite / HOD WORKSPACE) */}
          {isHod && (
            <Link
              to="/hod"
              onClick={handleLogoClick('/hod')}
              className="flex sm:hidden items-center gap-2 min-w-0 no-underline cursor-pointer select-none"
              title="Return to HOD Dashboard"
            >
              <div className="rounded-lg bg-primary text-primary-foreground flex justify-center items-center shrink-0 size-9 shadow-xs">
                <Landmark className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-ellipsis whitespace-nowrap text-sm text-foreground overflow-hidden">
                  CampusFlow Lite
                </div>
                <div className="text-ellipsis whitespace-nowrap text-muted-foreground text-xs overflow-hidden">
                  HOD WORKSPACE
                </div>
              </div>
            </Link>
          )}

          {/* Student Mobile Header (Screen 4: Squircle GraduationCap + CampusFlow Lite / STUDENT WORKSPACE) */}
          {isStudent && (
            <Link
              to="/student"
              onClick={handleLogoClick('/student')}
              className="flex sm:hidden items-center gap-2 min-w-0 no-underline cursor-pointer select-none"
              title="Return to Student Dashboard"
            >
              <div className="rounded-md bg-primary text-primary-foreground flex justify-center items-center shrink-0 size-9 shadow-xs">
                <GraduationCap className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm leading-tight truncate m-0">
                  CampusFlow Lite
                </p>
                <p className="font-semibold uppercase text-primary text-[11px] tracking-wide m-0">
                  Student Workspace
                </p>
              </div>
            </Link>
          )}

          {/* TG Mobile Header (Screen 6 / Screen 8: Squircle ShieldCheck + Tutor Guardian / TG Dashboard) */}
          {isTg && (
            <Link
              to="/tg"
              onClick={handleLogoClick('/tg')}
              className="flex sm:hidden items-center gap-2 min-w-0 no-underline cursor-pointer select-none"
              title="Return to TG Dashboard"
            >
              <div className="rounded-lg bg-primary text-primary-foreground flex justify-center items-center shrink-0 size-9 shadow-xs">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-base text-foreground leading-tight truncate m-0">
                  Tutor Guardian
                </p>
                <p className="text-muted-foreground text-xs leading-none m-0 mt-0.5">
                  TG Dashboard
                </p>
              </div>
            </Link>
          )}
        </div>

        {/* Center: Role Badge or Student / TG / HOD Portal Pill (Screen 7, Screen 3, Screen 9) */}
        <div className="hidden md:flex items-center gap-3">
          {isHod ? (
            <div className="font-semibold rounded-md bg-accent text-accent-foreground text-sm hidden px-4 py-2 items-center gap-2 lg:flex">
              <BadgeCheck className="size-4" />
              <span>HOD Dashboard</span>
            </div>
          ) : isTg ? (
            <div className="font-semibold rounded-full bg-muted text-foreground text-sm border border-border px-4 py-2 hidden md:flex items-center gap-2 shadow-2xs">
              <BadgeCheck className="text-primary size-4" />
              <span>TG Dashboard</span>
            </div>
          ) : isStudent ? (
            <div className="font-medium rounded-full bg-muted text-muted-foreground text-sm border border-border px-4 py-1.5 shadow-2xs">
              Student Portal
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-full shadow-xs">
              <span className="text-sm shrink-0">{roleEmojiMap[currentRole] || '🎓'}</span>
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold text-slate-900 leading-tight">
                  {roleTitleMap[currentRole] || 'Academic Portal'}
                </span>
                <span className="text-xs text-slate-600 leading-none mt-0.5">
                  {currentUser?.name || 'Verified User'}
                </span>
              </div>
              <span className="badge badge-indigo text-xs ml-1 py-0.5 px-2 font-bold">
                <ShieldCheck size={11} className="mr-0.5 inline" />
                Verified
              </span>
            </div>
          )}
        </div>

        {/* Right: Actions, Notification Bell & Profile */}
        <div className="flex items-center gap-2">

          {/* Notification Bell with Dropdown */}
          <div className="relative" ref={notifRef} style={{ zIndex: 50 }}>
            <button
              type="button"
              onClick={() => setShowNotifications((prev) => !prev)}
              className={
                isHod
                  ? "notif-bell-btn cursor-pointer"
                  : isTg
                  ? "relative p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer flex items-center justify-center w-10 h-10 shrink-0 shadow-2xs"
                  : "relative p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              }
              title="Notifications"
              aria-label="View notifications"
            >
              <Bell className={isHod ? "w-5 h-5 text-slate-600 shrink-0" : isTg ? "w-5 h-5 text-slate-600 shrink-0" : "w-[18px] h-[18px]"} />
              {unreadNotifCount > 0 && (
                <span
                  className={
                    isHod || isTg
                      ? "notif-badge-count"
                      : `absolute w-4 h-4 rounded-full ${isStudent ? 'bg-primary' : 'bg-rose-600'} text-white text-[10px] font-bold flex items-center justify-center pointer-events-none ${isStudent ? '' : 'animate-pulse'}`
                  }
                  style={{ position: 'absolute', top: '-4px', right: '-4px' }}
                >
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <>
                {/* Mobile Backdrop to dim background and dismiss on tap outside (Mobile Only) */}
                <div
                  className="notif-mobile-backdrop"
                  onClick={() => setShowNotifications(false)}
                />

                <div className="notification-dropdown-panel shadow-2xl">
                  <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900">Notification Centre</span>
                      {unreadNotifCount > 0 && (
                        <span className="badge badge-rose text-[11px] py-0.5 px-2 font-black rounded-full shadow-2xs">
                          {unreadNotifCount} new
                        </span>
                      )}
                    </div>
                    {notifications && notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className={`text-xs font-bold flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-md transition-all ${
                          unreadNotifCount > 0
                            ? 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                        }`}
                        title="Mark all notifications as read"
                      >
                        <CheckCheck size={14} className={unreadNotifCount > 0 ? "text-blue-600" : "text-slate-400"} />
                        <span>Mark all as read</span>
                      </button>
                    )}
                  </div>

                  {/* PWA Attendance Reminder Controls for Faculty / TGs / HODs */}
                  {(isFaculty || ['tg', 'hod', 'admin'].includes(currentRole)) && (
                    <div className="shrink-0 p-3 bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border-b border-blue-100 flex items-center justify-between gap-2.5 text-xs flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm shrink-0">⏰</span>
                        <div className="min-w-0">
                          <span className="font-extrabold text-blue-950 block text-[11px] leading-tight">
                            Attendance & Consideration Reminders
                          </span>
                          <span className="text-[10px] text-blue-700 block opacity-85 leading-tight mt-0.5">
                            Daily at 12:30–1:30 PM & 4:00–4:30 PM IST
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
                        {!pwaPushEnabled ? (
                          <button
                            type="button"
                            onClick={() => enablePWAReminders()}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] shadow-2xs transition-colors cursor-pointer"
                          >
                            Enable PWA Alert
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            ✓ Active
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => sendTestReminder('MIDDAY')}
                          className="px-2 py-1 rounded-lg bg-white border border-blue-200 hover:bg-blue-100 text-blue-800 font-bold text-[10px] transition-colors cursor-pointer"
                          title="Send test reminder now"
                        >
                          Test
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="notification-dropdown-scroll divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 font-medium">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const isExpanded = expandedNotifId === n._id;
                        return (
                          <div
                            key={n._id}
                            onClick={() => handleNotificationClick(n)}
                            className={`p-3.5 sm:p-4 text-xs transition-colors hover:bg-slate-50 cursor-pointer ${!n.isRead ? 'bg-blue-50/60' : 'text-slate-700'
                              }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="font-extrabold text-slate-900 flex items-start gap-2 min-w-0 flex-1">
                                {!n.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                                )}
                                <span className="leading-snug break-words">{n.title}</span>
                              </div>
                              <span className="text-[11px] text-slate-400 shrink-0 font-semibold whitespace-nowrap pt-0.5">
                                {formatDateTimeIST(n.createdAt)}
                              </span>
                            </div>
                            <div
                              className="text-xs text-slate-600 mt-1.5 leading-relaxed break-words"
                              style={{
                                display: isExpanded ? 'block' : '-webkit-box',
                                WebkitLineClamp: isExpanded ? 'unset' : 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: isExpanded ? 'visible' : 'hidden',
                              }}
                            >
                              {n.message}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Panel Footer */}
                  <div className="shrink-0 px-4 py-2 border-t border-slate-100 bg-slate-50/90 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>
                      {notifications.length > 0
                        ? `${notifications.length} notification${notifications.length > 1 ? 's' : ''}`
                        : 'All caught up'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User Name & Role (Desktop only) */}
          {isHod ? (
            <div className="border-l hidden pl-4 items-center gap-3 sm:flex">
              <div className="font-bold rounded-full bg-secondary text-secondary-foreground text-sm flex justify-center items-center size-9 shrink-0">
                {currentUser?.name
                  ? currentUser.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                  : 'HC'}
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-foreground m-0 leading-tight">
                  {currentUser?.name || 'Hod cse'}
                </p>
                <p className="text-muted-foreground text-xs m-0 mt-0.5">
                  HOD
                </p>
              </div>
            </div>
          ) : isStudent ? (
            <div className="hidden sm:flex rounded-lg bg-card border border-border px-3 py-1.5 items-center gap-3 shadow-2xs">
              <div className="font-semibold rounded-full bg-secondary text-secondary-foreground text-sm flex justify-center items-center size-8 shrink-0">
                {currentUser?.name
                  ? currentUser.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                  : 'AM'}
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm text-foreground leading-tight truncate max-w-[140px]">
                  {currentUser?.name || 'Ayush Mishra'}
                </div>
                <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mt-0.5">
                  STUDENT
                </div>
              </div>
            </div>
          ) : isTg ? (
            <div className="rounded-lg bg-card border border-border hidden sm:flex px-3 py-2 items-center gap-3">
              <div className="font-bold rounded-full bg-secondary text-secondary-foreground text-sm flex justify-center items-center w-9 h-9 shrink-0">
                {currentUser?.name
                  ? currentUser.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                  : 'TT'}
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground m-0 leading-tight">
                  {currentUser?.name || 'Test Teacher'}
                </p>
                <p className="uppercase text-muted-foreground text-xs tracking-wider m-0 mt-0.5">
                  {currentUser?.role === 'TEACHER' ? 'Teacher' : (currentUser?.role || 'Teacher')}
                </p>
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex flex-col text-right max-w-[160px] pl-2 border-l border-slate-200">
              <span
                className="text-sm font-bold text-slate-900 leading-tight truncate"
                title={currentUser?.name || currentUser?.designation || 'User'}
              >
                {currentUser?.name || currentUser?.designation || 'User'}
              </span>
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider truncate mt-0.5">
                {currentUser?.designation || currentUser?.role || currentRole}
              </span>
            </div>
          )}

          {/* Logout Button */}
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className={
              isHod
                ? "rounded-md bg-card text-muted-foreground border flex justify-center items-center size-10 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors shadow-2xs"
                : `rounded-lg bg-card text-muted-foreground border border-border flex justify-center items-center w-10 h-10 shrink-0 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors shadow-2xs ${isTg ? 'hidden sm:flex' : 'flex'}`
            }
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className={isHod ? "size-4 text-muted-foreground shrink-0" : "w-5 h-5 text-muted-foreground shrink-0"} />
          </button>
        </div>
      </div>
    </header>
  );
}
