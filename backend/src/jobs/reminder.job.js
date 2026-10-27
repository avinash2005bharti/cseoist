import cron from 'node-cron';
import env from '../config/env.js';

let middayCronTask = null;
let afternoonCronTask = null;

/**
 * Resolves all active TGs and HODs in the system
 * @returns {Promise<{ hods: Array<object>, tgs: Array<object>, allRecipients: Array<object> }>}
 */
export const resolveReminderRecipients = async () => {
  const { default: User } = await import('../models/User.js');
  const { default: MentorGroup } = await import('../models/MentorGroup.js');

  // 1. All active HOD and ADMIN users
  const hodUsers = await User.find({ role: { $in: ['HOD', 'ADMIN'] }, isActive: true });

  // 2. All active TGs from active MentorGroups
  const activeGroups = await MentorGroup.find({ isActive: true }).populate({
    path: 'tg',
    populate: { path: 'user' },
  });

  const tgMap = new Map();
  for (const group of activeGroups) {
    if (group.tg?.user && group.tg.user.isActive) {
      tgMap.set(group.tg.user._id.toString(), {
        user: group.tg.user,
        role: 'TG',
        teacherId: group.tg._id,
        sectionId: group.section,
      });
    }
  }

  // Also include any direct user with role === 'TG'
  const directTgUsers = await User.find({ role: 'TG', isActive: true });
  for (const u of directTgUsers) {
    if (!tgMap.has(u._id.toString())) {
      tgMap.set(u._id.toString(), {
        user: u,
        role: 'TG',
        teacherId: null,
        sectionId: null,
      });
    }
  }

  const tgList = Array.from(tgMap.values());

  // Deduplicated combined list
  const combinedMap = new Map();
  for (const hod of hodUsers) {
    combinedMap.set(hod._id.toString(), { user: hod, role: hod.role });
  }
  for (const tg of tgList) {
    if (!combinedMap.has(tg.user._id.toString())) {
      combinedMap.set(tg.user._id.toString(), { user: tg.user, role: 'TG' });
    }
  }

  return {
    hods: hodUsers,
    tgs: tgList.map((t) => t.user),
    allRecipients: Array.from(combinedMap.values()),
  };
};

/**
 * Runs the attendance reminder dispatch logic for a given time slot.
 * @param {'MIDDAY'|'AFTERNOON'} slot
 * @param {Date|null} mockClock
 * @returns {Promise<{ recipientsCount: number, pushDelivered: number, slot: string }>}
 */
export const runAttendanceReminder = async (slot = 'MIDDAY', mockClock = null) => {
  try {
    const { default: Notification } = await import('../models/Notification.js');
    const { default: ConsiderationRequest } = await import('../models/ConsiderationRequest.js');
    const { default: AuditLog } = await import('../models/AuditLog.js');
    const { emitNotification, emitToUser } = await import('../sockets/emitters.js');
    const { sendPushToUser } = await import('../utils/webPush.js');
    const { acquireDistributedLock, releaseDistributedLock } = await import('../utils/distributedLock.js');

    // FLAW-BKD-04: Prevent multi-instance / clustered duplicate reminder dispatch
    if (!mockClock) {
      const lockKey = `reminder_${slot.toLowerCase()}`;
      const lockAcquired = await acquireDistributedLock(lockKey, 20 * 60 * 1000);
      if (!lockAcquired) {
        console.log(`[ReminderJob] Another worker instance holds lock for ${slot} reminder. Skipping.`);
        return { recipientsCount: 0, pushDelivered: 0, slot, skipped: true };
      }
    }

    const now = mockClock || new Date();
    const isMidday = slot === 'MIDDAY';

    // Pending counts for informative messaging
    const totalPending = await ConsiderationRequest.countDocuments({
      status: { $in: ['PENDING', 'RECOMMENDED_BY_TG'] },
    });

    const title = isMidday
      ? 'Midday Attendance & Consideration Reminder'
      : 'Final Attendance & Consideration Review';

    const message = isMidday
      ? `Midday Reminder (12:30 PM - 1:30 PM): Please review pending student consideration requests (${totalPending} in queue) and update class attendance.`
      : `Closing Reminder (4:00 PM - 4:30 PM): Student consideration submissions are closed. Please review all pending requests and finalize attendance records.`;

    const { allRecipients } = await resolveReminderRecipients();
    let pushDelivered = 0;

    for (const recipient of allRecipients) {
      const u = recipient.user;
      const isHod = recipient.role === 'HOD' || recipient.role === 'ADMIN';
      const targetLink = isHod ? '/hod/considerations' : '/tg/attendance';

      // 1. Create in-app Notification record
      const notif = await Notification.create({
        user: u._id,
        title,
        message,
        type: 'ATTENDANCE_REMINDER',
        link: targetLink,
        isRead: false,
      });

      // 2. Emit Real-time Socket.io Notification
      emitNotification(u._id.toString(), notif);
      emitToUser(u._id.toString(), 'attendance_reminder', {
        id: notif._id,
        title,
        message,
        slot,
        link: targetLink,
        createdAt: now,
      });

      // 3. Dispatch Native Web Push notification to PWA Service Worker
      const delivered = await sendPushToUser(u._id.toString(), {
        title,
        body: message,
        icon: '/iit.png',
        badge: '/iit.png',
        url: targetLink,
        data: {
          url: targetLink,
          type: 'ATTENDANCE_REMINDER',
          slot,
        },
      });
      pushDelivered += delivered;
    }

    // 4. Log Audit
    await AuditLog.create({
      actor: null,
      action: 'SEND_ATTENDANCE_REMINDER',
      entityType: 'Notification',
      after: {
        slot,
        recipientsCount: allRecipients.length,
        pushDelivered,
        timestamp: now,
      },
    });

    console.log(
      `[ReminderJob] Sent ${slot} reminder to ${allRecipients.length} TGs/HODs (${pushDelivered} push delivered).`
    );

    return {
      recipientsCount: allRecipients.length,
      pushDelivered,
      slot,
    };
  } catch (error) {
    console.error(`[ReminderJob] Error running ${slot} reminder:`, error.message);
    return { recipientsCount: 0, pushDelivered: 0, slot, error: error.message };
  }
};

/**
 * Initializes the automated daily reminder cron schedules
 * 1. Midday: 1:00 PM IST (0 13 * * *) - between 12:30 PM and 1:30 PM
 * 2. Afternoon: 4:00 PM IST (0 16 * * *) - between 4:00 PM and 4:30 PM
 */
export const initReminderJob = () => {
  const middayCron = env.REMINDER_MIDDAY_CRON || '0 13 * * *';
  const afternoonCron = env.REMINDER_AFTERNOON_CRON || '0 16 * * *';

  // Schedule Midday Reminder
  middayCronTask = cron.schedule(
    middayCron,
    () => {
      runAttendanceReminder('MIDDAY');
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  // Schedule Afternoon Closing Reminder
  afternoonCronTask = cron.schedule(
    afternoonCron,
    () => {
      runAttendanceReminder('AFTERNOON');
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  console.log(`⏰ Consideration & Attendance Reminder jobs scheduled (IST):`);
  console.log(`   - Midday (12:30 PM - 1:30 PM): "${middayCron}"`);
  console.log(`   - Afternoon (4:00 PM - 4:30 PM): "${afternoonCron}"`);

  return { middayCronTask, afternoonCronTask };
};

export const stopReminderJob = () => {
  middayCronTask?.stop();
  afternoonCronTask?.stop();
  middayCronTask = null;
  afternoonCronTask = null;
};

export default {
  resolveReminderRecipients,
  runAttendanceReminder,
  initReminderJob,
  stopReminderJob,
};
