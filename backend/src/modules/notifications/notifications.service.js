import Notification from '../../models/Notification.js';
import SystemSetting from '../../models/SystemSetting.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import ApiError from '../../utils/ApiError.js';
import { getISTTime, isWithinConsiderationWindow } from '../../utils/dates.js';
import env from '../../config/env.js';

const normalizeScope = (scope, fallback = 'user') => {
  const normalized = String(scope || fallback).toLowerCase();
  return ['student', 'teacher', 'tg', 'hod', 'admin'].includes(normalized) ? normalized : fallback;
};

export const getNotificationScope = (user, requestedScope) => {
  const fallback = user.sharedTeacher ? 'teacher' : String(user.role || 'user').toLowerCase();
  const scope = normalizeScope(requestedScope, fallback);
  const allowedScopes = user.sharedTeacher
    ? ['teacher']
    : user.role === 'ADMIN'
    ? ['admin']
    : user.role === 'HOD'
    ? ['hod', ...(user.isTG ? ['tg', 'teacher'] : [])]
    : user.role === 'TEACHER'
    ? ['teacher', ...(user.isTG ? ['tg'] : [])]
    : ['student'];

  return allowedScopes.includes(scope) ? scope : fallback;
};

export const getUserNotifications = async (userId, query, scope = 'user') => {
  const { page, limit, skip } = parsePagination(query);
  const unreadFilter = {
    user: userId,
    isRead: false,
    readStates: { $not: { $elemMatch: { scope } } },
  };

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query.unread === 'true' || query.unread === true ? unreadFilter : { user: userId })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Notification.countDocuments(query.unread === 'true' || query.unread === true ? unreadFilter : { user: userId }),
    Notification.countDocuments(unreadFilter),
  ]);

  const meta = buildPaginationMeta(total, page, limit);
  meta.unreadCount = unreadCount;

  return {
    notifications,
    meta,
  };
};

export const markAsRead = async (id, userId, scope = 'user') => {
  const notification = await Notification.findOne({ _id: id, user: userId });
  if (!notification) {
    throw ApiError.notFound('Notification not found');
  }

  const readAt = new Date();
  const existingState = notification.readStates.find((state) => state.scope === scope);
  if (existingState) {
    existingState.readAt = readAt;
  } else {
    notification.readStates.push({ scope, readAt });
  }
  await notification.save();

  return notification;
};

export const markAllAsRead = async (userId, scope = 'user') => {
  const notifications = await Notification.find({
    user: userId,
    isRead: false,
    readStates: { $not: { $elemMatch: { scope } } },
  });
  const readAt = new Date();
  for (const notification of notifications) {
    notification.readStates.push({ scope, readAt });
  }
  if (notifications.length > 0) {
    await Notification.bulkSave(notifications);
  }

  return { modifiedCount: notifications.length };
};

export const savePushSubscription = async (userId, subscription, userAgent = '') => {
  const { default: PushSubscription } = await import('../../models/PushSubscription.js');
  if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    throw ApiError.badRequest('Invalid push subscription format');
  }

  const isSharedTeacher = userId === 'shared-teacher';
  const updated = await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      ...(isSharedTeacher ? { user: null, ownerKey: 'shared-teacher' } : { user: userId, ownerKey: null }),
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userAgent,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { success: true, subscriptionId: updated._id };
};

export const removePushSubscription = async (userId, endpoint) => {
  const { default: PushSubscription } = await import('../../models/PushSubscription.js');
  if (!endpoint) {
    throw ApiError.badRequest('Endpoint is required to remove subscription');
  }

  await PushSubscription.deleteOne(
    userId === 'shared-teacher'
      ? { ownerKey: 'shared-teacher', endpoint }
      : { user: userId, endpoint }
  );
  return { success: true };
};

export const getConsiderationWindowStatus = async () => {
  const now = new Date();
  const time = getISTTime(now);
  const setting = await SystemSetting.findOne({ key: 'CONSIDERATION_TIME_LIMIT_ENABLED' });
  const isTimeLimitEnabled = setting !== null ? Boolean(setting.value) : true;
  const isWithinWindow = isWithinConsiderationWindow(now);
  const isOpen = !isTimeLimitEnabled ? true : isWithinWindow;

  const pad = (n) => String(n).padStart(2, '0');
  const currentTimeIST = `${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}`;

  return {
    isOpen,
    isTimeLimitEnabled,
    windowStart: '09:00',
    windowEnd: '16:00',
    currentTimeIST,
    timezone: 'Asia/Kolkata',
    message: !isTimeLimitEnabled
      ? '24x7 Submissions Enabled (Testing Mode: Time Restriction Bypassed).'
      : isOpen
      ? 'Consideration application window is OPEN (9:00 AM - 4:00 PM IST).'
      : 'Consideration application window is CLOSED. Submissions are only accepted between 9:00 AM and 4:00 PM IST.',
  };
};

export const triggerReminderManually = async (slot = 'MIDDAY', user) => {
  if (!['HOD', 'ADMIN'].includes(user.role) || user.sharedTeacher) {
    throw ApiError.forbidden('Only HOD or Admin users can trigger attendance reminders');
  }

  const { runAttendanceReminder } = await import('../../jobs/reminder.job.js');
  return runAttendanceReminder(slot);
};

export default {
  getUserNotifications,
  getNotificationScope,
  markAsRead,
  markAllAsRead,
  savePushSubscription,
  removePushSubscription,
  getConsiderationWindowStatus,
  triggerReminderManually,
};
