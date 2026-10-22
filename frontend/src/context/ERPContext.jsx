import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  authApi,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  notificationApi,
  uploadApi,
} from '../api';

// Singleton Context instance preserved across Vite HMR reloads to prevent provider desync
const ERPContext =
  typeof window !== 'undefined'
    ? (window.__CAMPUSFLOW_ERP_CONTEXT__ ||= createContext(null))
    : createContext(null);

export function ERPProvider({ children }) {
  const [token, setToken] = useState(() => getAuthToken());
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('campusflow_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [currentRole, setCurrentRole] = useState(() => {
    return localStorage.getItem('campusflow_role') || 'student';
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAuthToken()));
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Notifications & Realtime state
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [socket, setSocket] = useState(null);

  // Global Modal & File Preview state
  const [activeModal, setActiveModal] = useState(null);
  const [modalData, setModalData] = useState({});
  const [previewFile, setPreviewFile] = useState(null); // { url, name, loading }

  // Toast System - strictly Green (success/info) and Red (error/danger/warning) themes
  const addToast = useCallback((arg1, arg2, arg3) => {
    let title = '';
    let message = '';
    let type = 'success';

    if (typeof arg1 === 'object' && arg1 !== null) {
      title = arg1.title || '';
      message = arg1.message || '';
      type = arg1.type || 'success';
    } else {
      title = arg1 || '';
      message = arg2 || '';
      type = arg3 || 'info';
    }

    // Map strictly to 'danger' (Red) or 'success' (Green)
    const isRed = ['danger', 'error', 'warning', 'fail', 'failure', 'alert', 'rejected'].includes(
      String(type).toLowerCase()
    );
    const normalizedType = isRed ? 'danger' : 'success';

    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast = { id, title, message, type: normalizedType, time: 'Just now' };
    setToasts((prev) => [newToast, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Modal Handlers
  const openModal = useCallback((name, data = {}) => {
    setActiveModal(name);
    setModalData(data);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalData({});
  }, []);

  // File Preview Handler with signed URLs
  const viewAttachment = useCallback(async (target, fallbackName = 'Document') => {
    let fileId = target;
    let fileName = fallbackName;
    let directUrl = null;

    if (target && typeof target === 'object') {
      fileId = target.fileId || target.url || target._id;
      fileName = target.name || target.fileName || target.documentName || fallbackName;
      if (target.url && typeof target.url === 'string' && (target.url.startsWith('http') || target.url.startsWith('data:'))) {
        directUrl = target.url;
      }
    }

    if (typeof fileId === 'string' && (fileId.startsWith('http://') || fileId.startsWith('https://') || fileId.startsWith('data:'))) {
      directUrl = fileId;
    }

    if (directUrl) {
      setPreviewFile({ name: fileName, url: directUrl, loading: false });
      return;
    }

    if (!fileId) {
      addToast('Cannot Open Attachment', 'No attachment reference found for preview', 'warning');
      return;
    }

    try {
      setPreviewFile({ name: fileName, url: '', loading: true });
      const res = await uploadApi.getSignedUrl(fileId);
      const signedUrl = res?.data?.url || res?.url;
      if (!signedUrl) throw new Error('No preview URL generated');
      setPreviewFile({ name: fileName, url: signedUrl, loading: false });
    } catch (err) {
      addToast('Cannot Open Attachment', err.message || 'Permission denied or file unavailable', 'danger');
      setPreviewFile(null);
    }
  }, [addToast]);

  const closeFilePreview = useCallback(() => {
    setPreviewFile(null);
  }, []);

  // Sync / Verify current user session on mount
  const checkSession = useCallback(async () => {
    const storedToken = getAuthToken();
    if (!storedToken) {
      setLoadingAuth(false);
      setIsAuthenticated(false);
      return;
    }

    try {
      const res = await authApi.getMe();
      const user = res?.data || res;
      setCurrentUser(user);
      setIsAuthenticated(true);

      const roleStr = user.role?.toLowerCase() || 'student';
      // If user is a teacher who is also TG, role can be tg or teacher
      const isFaculty = user.role === 'TEACHER' || user.role === 'HOD';
      const isTg = isFaculty && Boolean(user.isTG);
      const effectiveRole = isTg && localStorage.getItem('campusflow_role') === 'tg' ? 'tg' : roleStr;

      setCurrentRole(effectiveRole);
      localStorage.setItem('campusflow_user', JSON.stringify(user));
      localStorage.setItem('campusflow_role', effectiveRole);
    } catch (err) {
      console.warn('Session verification failed, logging out');
      clearAuthToken();
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Fetch initial notifications
  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await notificationApi.getNotifications({ limit: 15 });
      const list = res?.data || [];
      setNotifications(list);
      setUnreadNotifCount(res?.meta?.unreadCount || list.filter((n) => !n.isRead).length);
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshNotifications();
    }
  }, [isAuthenticated, refreshNotifications]);

  // Real-Time Socket.IO connection
  useEffect(() => {
    if (!isAuthenticated || !getAuthToken()) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const socketUrl =
      import.meta.env.VITE_BACKEND_URL ||
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000'
        : window.location.origin);

    const socketInstance = io(socketUrl, {
      auth: { token: getAuthToken() },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
    });

    socketInstance.on('connect_error', (err) => {
      // Gracefully handle auth or connection errors without uncaught browser WebSocket errors
      console.warn('Realtime feed notice:', err.message);
    });

    socketInstance.on('connect', () => {
      // Live connected
    });

    socketInstance.on('new_notification', (data) => {
      addToast(data.title, data.message, data.type === 'ESCALATION' ? 'warning' : 'info');
      refreshNotifications();

      // Trigger system-level native notification
      showSystemNotification(data.title || 'CampusFlow Notification', {
        body: data.message || 'You have a new update.',
        tag: `notif-${data.id || Date.now()}`,
        data: { url: data.link || '/' },
      });
    });

    socketInstance.on('attendance_reminder', (data) => {
      addToast(data.title, data.message, 'warning');
      refreshNotifications();

      // Trigger system-level native reminder notification
      showSystemNotification(data.title || 'Attendance & Consideration Reminder', {
        body: data.message || 'Please review pending student consideration requests and update attendance.',
        tag: `attendance-${data.slot || 'reminder'}`,
        data: { url: data.link || '/tg/attendance' },
      });
    });

    socketInstance.on('request_updated', (data) => {
      addToast('Status Updated', `${data.kind} status changed to ${data.status.replace(/_/g, ' ')}`, 'info');
    });

    socketInstance.on('queue_changed', () => {
      window.dispatchEvent(new CustomEvent('campusflow_queue_changed'));
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [isAuthenticated, addToast, refreshNotifications]);

  // System Notification Helper (Native Service Worker + Desktop Notification fallback)
  const showSystemNotification = useCallback(async (title, options = {}) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    let permission = Notification.permission;
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = Notification.permission;
      }
    }

    if (permission !== 'granted') {
      return false;
    }

    const defaultOptions = {
      icon: '/iit.png',
      badge: '/iit.png',
      vibrate: [200, 100, 200],
      ...options,
    };

    // 1. Try Service Worker showNotification
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.showNotification) {
          await reg.showNotification(title, defaultOptions);
          return true;
        }
      }
    } catch (err) {
      console.warn('[SystemNotification] SW showNotification error:', err);
    }

    // 2. Fallback to Window Notification constructor
    try {
      const notif = new Notification(title, defaultOptions);
      const targetUrl = options.data?.url || options.url;
      if (targetUrl) {
        notif.onclick = () => {
          window.focus();
          window.location.href = targetUrl;
        };
      }
      return true;
    } catch (err) {
      console.warn('[SystemNotification] Native Notification constructor error:', err);
      return false;
    }
  }, []);

  // Service Worker & PWA Web Push state
  const [pwaPushEnabled, setPwaPushEnabled] = useState(false);
  const [pwaPushSupported, setPwaPushSupported] = useState(() => {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  });

  // Register service worker on initial mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(async (reg) => {
          if (reg.update) {
            reg.update().catch(() => {});
          }
          if ('PushManager' in window) {
            const existingSub = await reg.pushManager.getSubscription();
            if (existingSub) {
              setPwaPushEnabled(true);
            }
          }
        })
        .catch((err) => {
          console.warn('[PWA] Service worker registration failed:', err.message);
        });
    }
  }, []);

  // Helper to convert VAPID public key
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Enable PWA push reminders for faculty / TG / HOD
  const enablePWAReminders = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      addToast('Not Supported', 'Web Push notifications are not supported in this browser.', 'warning');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        addToast('Permission Denied', 'Please allow notifications in browser settings to receive PWA reminders.', 'warning');
        return false;
      }

      let reg = null;
      if ('serviceWorker' in navigator) {
        reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          reg = await navigator.serviceWorker.register('/service-worker.js');
        }
      }

      if (reg && 'pushManager' in reg) {
        try {
          const vapidRes = await notificationApi.getVapidPublicKey();
          const vapidKey = vapidRes?.data?.publicKey || vapidRes?.publicKey;

          if (vapidKey) {
            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
              sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
              });
            }

            const rawJson = sub.toJSON();
            await notificationApi.subscribePush({
              endpoint: sub.endpoint,
              keys: {
                p256dh: rawJson.keys?.p256dh,
                auth: rawJson.keys?.auth,
              },
            });
          }
        } catch (pushErr) {
          console.warn('[PWA] Push backend registration notice:', pushErr.message);
        }
      }

      setPwaPushEnabled(true);

      // Trigger confirmation system notification
      await showSystemNotification('PWA Reminders Active', {
        body: 'You will receive automatic system notifications for consideration requests & attendance updates.',
        tag: 'pwa-active',
        data: { url: '/tg/attendance' },
      });

      addToast(
        'PWA Reminders Active',
        'System notifications enabled! You will now receive automatic alerts at 12:30–1:30 PM & 4:00–4:30 PM.',
        'success'
      );
      return true;
    } catch (err) {
      console.warn('PWA notification setup error:', err.message);
      setPwaPushEnabled(true);
      return true;
    }
  }, [addToast, showSystemNotification]);

  // Trigger immediate test reminder (for faculty / TG / HOD testing)
  const sendTestReminder = useCallback(async (slot = 'MIDDAY') => {
    try {
      // Trigger system desktop notification immediately
      await showSystemNotification(
        slot === 'MIDDAY'
          ? 'Midday Attendance & Consideration Reminder (Test)'
          : 'Final Attendance & Consideration Review (Test)',
        {
          body: 'Please review pending student consideration requests and update class attendance.',
          tag: `attendance-test-${Date.now()}`,
          data: { url: '/tg/attendance' },
        }
      );

      const res = await notificationApi.sendReminderNow(slot);
      addToast('Test Reminder Dispatched', `Sent ${slot} reminder to all TGs and HODs.`, 'success');
      return res;
    } catch (err) {
      addToast('Failed to Send Reminder', err.message || 'Cannot trigger test reminder.', 'danger');
    }
  }, [addToast, showSystemNotification]);

  // Auto-subscribe if user is TG or HOD and notification permission was previously granted
  useEffect(() => {
    if (isAuthenticated && currentUser && ['TEACHER', 'HOD', 'ADMIN'].includes(currentUser.role)) {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        enablePWAReminders().catch(() => {});
      }
    }
  }, [isAuthenticated, currentUser, enablePWAReminders]);


  // Auth Actions
  const login = async ({ email, password }) => {
    const data = await authApi.login({ email, password });
    const user = data.user;
    const role = (user.role || '').toLowerCase();
    const isFaculty = user.role === 'TEACHER' || user.role === 'HOD';
    const effectiveRole = isFaculty && user.isTG ? 'tg' : role;

    setToken(data.accessToken);
    setCurrentUser(user);
    setCurrentRole(effectiveRole);
    setIsAuthenticated(true);

    localStorage.setItem('campusflow_user', JSON.stringify(user));
    localStorage.setItem('campusflow_role', effectiveRole);

    addToast('Welcome Back', `Logged in as ${user.name}`, 'success');
    return user;
  };

  const loginWithToken = async (accessToken) => {
    setAuthToken(accessToken);
    setToken(accessToken);
    const res = await authApi.getMe();
    const user = res?.data || res;
    const role = (user.role || '').toLowerCase();
    const isFaculty = user.role === 'TEACHER' || user.role === 'HOD';
    const effectiveRole = isFaculty && user.isTG ? 'tg' : role;

    setCurrentUser(user);
    setCurrentRole(effectiveRole);
    setIsAuthenticated(true);

    localStorage.setItem('campusflow_user', JSON.stringify(user));
    localStorage.setItem('campusflow_role', effectiveRole);

    addToast('Welcome Back', `Logged in via Google as ${user.name}`, 'success');
    return user;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      clearAuthToken();
      setToken(null);
      setCurrentUser(null);
      setIsAuthenticated(false);
      setCurrentRole('student');
      if (socket) socket.disconnect();
      addToast('Logged Out', 'You have been safely signed out.', 'info');
    }
  };

  const switchRole = (newRole) => {
    if (currentUser?.role === 'STUDENT') {
      return; // Students are not permitted to switch roles
    }
    setCurrentRole(newRole);
    localStorage.setItem('campusflow_role', newRole);
  };

  const updateCurrentUser = useCallback((newUserData) => {
    setCurrentUser((prev) => {
      const merged = { ...prev, ...newUserData };
      try {
        localStorage.setItem('campusflow_user', JSON.stringify(merged));
      } catch (e) {
        console.warn('Failed to persist user to localStorage', e);
      }
      return merged;
    });
  }, []);

  return (
    <ERPContext.Provider
      value={{
        token,
        currentUser,
        updateCurrentUser,
        currentRole,
        isAuthenticated,
        loadingAuth,
        notifications,
        unreadNotifCount,
        refreshNotifications,
        toasts,
        addToast,
        removeToast,
        activeModal,
        modalData,
        openModal,
        closeModal,
        previewFile,
        viewAttachment,
        closeFilePreview,
        login,
        loginWithToken,
        logout,
        switchRole,
        pwaPushEnabled,
        pwaPushSupported,
        enablePWAReminders,
        sendTestReminder,
        showSystemNotification,
      }}
    >
      {children}
    </ERPContext.Provider>
  );
}

export function useERP() {
  const context = useContext(ERPContext);
  if (!context) {
    throw new Error('useERP must be used within an ERPProvider');
  }
  return context;
}

export { ERPContext };
export default ERPProvider;
