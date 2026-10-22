import React, { useState, useRef, useEffect } from 'react';
import { useERP } from '../context/ERPContext.jsx';
import { Bell, ShieldCheck, User, Menu, LogOut, CheckCheck, RefreshCw } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
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
  const [expandedNotifId, setExpandedNotifId] = useState(null);
  const notifRef = useRef(null);

  const isFaculty = currentUser?.role === 'TEACHER' || currentUser?.role === 'HOD';

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

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 h-16 w-full">
        {/* Left: Menu Trigger & Branding */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
            title={isSidebarOpen ? 'Close Menu' : 'Open Menu'}
            aria-label="Toggle Navigation Menu"
          >
            <Menu size={18} />
          </button>

          <Link
            to={`/${currentRole}`}
            className="flex items-center gap-2.5 no-underline cursor-pointer group"
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
        </div>

        {/* Center: Role Badge */}
        <div className="hidden md:flex items-center gap-3">
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
        </div>

        {/* Right: Actions, Notification Bell & Profile */}
        <div className="flex items-center gap-2">

          {/* Notification Bell with Dropdown */}
          <div className="relative" ref={notifRef} style={{ zIndex: 50 }}>
            <button
              type="button"
              onClick={() => setShowNotifications((prev) => !prev)}
              className="relative p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              title="Notifications"
              aria-label="View notifications"
            >
              <Bell size={18} />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
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
                      <span className="text-sm font-extrabold text-slate-900">Notifications</span>
                      {unreadNotifCount > 0 && (
                        <span className="badge badge-rose text-[11px] py-0.5 px-2 font-black rounded-full shadow-2xs">
                          {unreadNotifCount}
                        </span>
                      )}
                    </div>
                    {unreadNotifCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1.5 cursor-pointer hover:underline"
                      >
                        <CheckCheck size={14} />
                        <span>Mark all read</span>
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
                            className={`p-3.5 sm:p-4 text-xs transition-colors hover:bg-slate-50 cursor-pointer ${
                              !n.isRead ? 'bg-blue-50/60' : 'text-slate-700'
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

          {/* User Name & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="hidden sm:flex flex-col text-right max-w-[160px]">
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

            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-600 transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
