import Notification from '../../models/Notification.js';
import SystemSetting from '../../models/SystemSetting.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import ApiError from '../../utils/ApiError.js';
import { getISTTime, isWithinConsiderationWindow } from '../../utils/dates.js';
import env from '../../config/env.js';

export const getUserNotifications = async (userId, query) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = { user: userId };

  if (query.unread === 'true' || query.unread === true) {
    filter.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: userId, isRead: false }),
  ]);

  const meta = buildPaginationMeta(total, page, limit);
  meta.unreadCount = unreadCount;

  return {
    notifications,
    meta,
  };
};

export const markAsRead = async (id, userId) => {
  const notification = await Notification.findOne({ _id: id, user: userId });
  if (!notification) {
    throw ApiError.notFound('Notification not found');
  }

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  return notification;
};

export const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return { modifiedCount: result.modifiedCount };
};

export const savePushSubscription = async (userId, subscription, userAgent = '') => {
  const { default: PushSubscription } = await import('../../models/PushSubscription.js');
  if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    throw ApiError.badRequest('Invalid push subscription format');
  }

  const updated = await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      user: userId,
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

  await PushSubscription.deleteOne({ user: userId, endpoint });
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
  if (!['HOD', 'ADMIN', 'TEACHER'].includes(user.role)) {
    throw ApiError.forbidden('Only faculty or administrators can trigger attendance reminders');
  }

  const { runAttendanceReminder } = await import('../../jobs/reminder.job.js');
  return runAttendanceReminder(slot);
};

export default {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  savePushSubscription,
  removePushSubscription,
  getConsiderationWindowStatus,
  triggerReminderManually,
};


