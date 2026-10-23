import webpush from 'web-push';
import env from '../config/env.js';
import PushSubscription from '../models/PushSubscription.js';

let isConfigured = false;

export const initWebPush = () => {
  if (isConfigured) return;
  try {
    if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        env.VAPID_SUBJECT || 'mailto:admin@campusflow.edu',
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY
      );
      isConfigured = true;
    }
  } catch (err) {
    console.warn('[WebPush] Failed to configure VAPID details:', err.message);
  }
};

// Initialize on module load
initWebPush();

/**
 * Send Web Push notification to all subscriptions of a specific user
 * @param {string} userId
 * @param {object} payload
 * @returns {Promise<number>} Number of successfully delivered push notifications
 */
export const sendPushToUser = async (userId, payload) => {
  initWebPush();
  if (!isConfigured) return 0;

  try {
    const subscriptions = await PushSubscription.find({ user: userId });
    if (!subscriptions || subscriptions.length === 0) return 0;

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    let delivered = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          },
          payloadString
        );
        delivered += 1;
      } catch (err) {
        // If subscription is expired or unsubscribed (404/410), prune it
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[WebPush] Pruning expired subscription (HTTP ${err.statusCode}) for user ${userId}: ${sub.endpoint}`);
          await PushSubscription.deleteMany({ endpoint: sub.endpoint });
        } else {
          console.warn(`[WebPush] Push error for user ${userId}:`, err.message);
        }
      }
    }

    return delivered;
  } catch (error) {
    console.warn(`[WebPush] Error retrieving subscriptions for user ${userId}:`, error.message);
    return 0;
  }
};

/**
 * Send Web Push notification to an array of user IDs
 * @param {Array<string>} userIds
 * @param {object} payload
 * @returns {Promise<number>} Total delivered
 */
export const sendPushToUsers = async (userIds, payload) => {
  if (!Array.isArray(userIds) || userIds.length === 0) return 0;
  let totalDelivered = 0;
  for (const uid of userIds) {
    const delivered = await sendPushToUser(uid, payload);
    totalDelivered += delivered;
  }
  return totalDelivered;
};

export default {
  initWebPush,
  sendPushToUser,
  sendPushToUsers,
};
