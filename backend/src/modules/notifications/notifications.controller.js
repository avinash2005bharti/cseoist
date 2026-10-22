import notificationsService from './notifications.service.js';
import { sendSuccess } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const getNotifications = asyncHandler(async (req, res) => {
  const result = await notificationsService.getUserNotifications(req.user.id, req.query);
  return sendSuccess(res, result.notifications, result.meta);
});

export const markRead = asyncHandler(async (req, res) => {
  const notif = await notificationsService.markAsRead(req.params.id, req.user.id);
  return sendSuccess(res, notif);
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationsService.markAllAsRead(req.user.id);
  return sendSuccess(res, result);
});

export const getVapidPublicKey = asyncHandler(async (req, res) => {
  const { default: env } = await import('../../config/env.js');
  return sendSuccess(res, { publicKey: env.VAPID_PUBLIC_KEY });
});

export const subscribePush = asyncHandler(async (req, res) => {
  const { subscription } = req.body;
  const userAgent = req.headers['user-agent'] || '';
  const result = await notificationsService.savePushSubscription(req.user.id, subscription, userAgent);
  return sendSuccess(res, result);
});

export const unsubscribePush = asyncHandler(async (req, res) => {
  const { endpoint } = req.body;
  const result = await notificationsService.removePushSubscription(req.user.id, endpoint);
  return sendSuccess(res, result);
});

export const getConsiderationWindow = asyncHandler(async (req, res) => {
  const status = await notificationsService.getConsiderationWindowStatus();
  return sendSuccess(res, status);
});

export const sendReminderNow = asyncHandler(async (req, res) => {
  const { slot = 'MIDDAY' } = req.body;
  const result = await notificationsService.triggerReminderManually(slot, req.user);
  return sendSuccess(res, result);
});

export default {
  getNotifications,
  markRead,
  markAllRead,
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
  getConsiderationWindow,
  sendReminderNow,
};

