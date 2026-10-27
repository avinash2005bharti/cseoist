import cron from 'node-cron';
import env from '../config/env.js';

let cronTask = null;

/**
 * Runs the escalation scan logic.
 * Finds PENDING consideration requests and student leaves older than ESCALATION_HOURS
 * or where the TG is currently on approved leave.
 * @param {Date|null} mockClock - Optional clock override for testing
 */
export const runEscalationScan = async (mockClock = null) => {
  try {
    // Dynamic import to avoid circular dependency before models are loaded
    const { default: ConsiderationRequest } = await import('../models/ConsiderationRequest.js');
    const { default: LeaveApplication } = await import('../models/LeaveApplication.js');
    const { default: User } = await import('../models/User.js');
    const { default: Notification } = await import('../models/Notification.js');
    const { default: AuditLog } = await import('../models/AuditLog.js');
    const { default: Teacher } = await import('../models/Teacher.js');
    const { emitNotification, emitQueueChanged } = await import('../sockets/emitters.js');
    const { getTodayIST } = await import('../utils/dates.js');
    const { acquireDistributedLock, releaseDistributedLock } = await import('../utils/distributedLock.js');

    // FLAW-BKD-04: Prevent multi-instance / clustered duplicate execution
    if (!mockClock) {
      const lockAcquired = await acquireDistributedLock('escalation_scan', 10 * 60 * 1000);
      if (!lockAcquired) {
        console.log('[EscalationJob] Another worker instance is currently executing or holds lock. Skipping cycle.');
        return;
      }
    }

    const now = mockClock || new Date();
    const escalationHours = env.ESCALATION_HOURS || 48;
    const thresholdTime = new Date(now.getTime() - escalationHours * 60 * 60 * 1000);
    const todayIST = getTodayIST();

    // 1. Find all active faculty leaves approved for today
    const activeFacultyLeaves = await LeaveApplication.find({
      applicantRole: 'TEACHER',
      status: 'APPROVED',
      startDate: { $lte: todayIST },
      endDate: { $gte: todayIST },
    }).select('teacher');

    const absentTeacherIds = activeFacultyLeaves.map((l) => l.teacher.toString());

    // 2. Scan Consideration Requests
    const pendingConsiderations = await ConsiderationRequest.find({
      status: 'PENDING',
      escalated: false,
      $or: [
        { createdAt: { $lte: thresholdTime } },
        { tg: { $in: absentTeacherIds } },
      ],
    }).populate('student tg');

    for (const req of pendingConsiderations) {
      req.escalated = true;
      req.escalatedAt = now;
      req.history.push({
        status: 'PENDING',
        actor: null,
        actorRole: 'SYSTEM',
        remarks: 'Escalated to HOD due to 48-hour TG inactivity or TG leave',
        at: now,
        via: 'ESCALATION',
      });
      await req.save();

      // FLAW-AUTH-06: Find HOD users for this student's department specifically (and Admin)
      let deptHodQuery = { role: { $in: ['HOD', 'ADMIN'] }, isActive: true };
      if (req.student?.department) {
        const deptTeachers = await Teacher.find({ department: req.student.department }).select('user');
        const deptTeacherUserIds = deptTeachers.map((t) => t.user);
        deptHodQuery = {
          $or: [
            { role: 'ADMIN' },
            { role: 'HOD', _id: { $in: deptTeacherUserIds } },
          ],
          isActive: true,
        };
      }
      const hodUsers = await User.find(deptHodQuery);
      for (const hod of hodUsers) {
        const notif = await Notification.create({
          user: hod._id,
          title: 'Consideration Request Escalated',
          message: `Request for "${req.eventTitle}" was escalated to your queue.`,
          type: 'ESCALATION',
          link: `/hod/considerations/${req._id}`,
          isRead: false,
        });
        emitNotification(hod._id.toString(), notif);
      }

      // Notify assigned TG of escalation
      if (req.tg && req.tg.user) {
        const tgNotif = await Notification.create({
          user: req.tg.user,
          title: 'Consideration Request Escalated',
          message: `The consideration request for "${req.eventTitle}" was escalated to HOD due to timeout or absence.`,
          type: 'ESCALATION',
          link: `/tg/considerations/${req._id}`,
          isRead: false,
        });
        emitNotification(req.tg.user.toString(), tgNotif);
      }

      await AuditLog.create({
        actor: null,
        action: 'ESCALATE_CONSIDERATION',
        entityType: 'ConsiderationRequest',
        entityId: req._id,
        after: { escalated: true, escalatedAt: now },
      });
    }

    // 3. Scan Student Leaves
    const pendingLeaves = await LeaveApplication.find({
      applicantRole: 'STUDENT',
      status: 'PENDING',
      escalated: false,
      $or: [
        { createdAt: { $lte: thresholdTime } },
        { tg: { $in: absentTeacherIds } },
      ],
    }).populate('student tg');

    for (const leave of pendingLeaves) {
      leave.escalated = true;
      leave.escalatedAt = now;
      leave.history.push({
        status: 'PENDING',
        actor: null,
        actorRole: 'SYSTEM',
        remarks: 'Escalated to HOD due to 48-hour TG inactivity or TG leave',
        at: now,
        via: 'ESCALATION',
      });
      await leave.save();

      // FLAW-AUTH-06: Find HOD users for this student's department specifically (and Admin)
      let deptHodQuery = { role: { $in: ['HOD', 'ADMIN'] }, isActive: true };
      if (leave.student?.department) {
        const deptTeachers = await Teacher.find({ department: leave.student.department }).select('user');
        const deptTeacherUserIds = deptTeachers.map((t) => t.user);
        deptHodQuery = {
          $or: [
            { role: 'ADMIN' },
            { role: 'HOD', _id: { $in: deptTeacherUserIds } },
          ],
          isActive: true,
        };
      }
      const hodUsers = await User.find(deptHodQuery);
      for (const hod of hodUsers) {
        const notif = await Notification.create({
          user: hod._id,
          title: 'Leave Application Escalated',
          message: `Student leave application was escalated to your queue.`,
          type: 'ESCALATION',
          link: `/hod/leaves/${leave._id}`,
          isRead: false,
        });
        emitNotification(hod._id.toString(), notif);
      }

      // Notify assigned TG of escalation
      if (leave.tg && leave.tg.user) {
        const tgNotif = await Notification.create({
          user: leave.tg.user,
          title: 'Leave Application Escalated',
          message: 'A student leave application assigned to you was escalated to HOD due to timeout or absence.',
          type: 'ESCALATION',
          link: `/tg/leaves/${leave._id}`,
          isRead: false,
        });
        emitNotification(leave.tg.user.toString(), tgNotif);
      }

      await AuditLog.create({
        actor: null,
        action: 'ESCALATE_LEAVE',
        entityType: 'LeaveApplication',
        entityId: leave._id,
        after: { escalated: true, escalatedAt: now },
      });
    }

    if (pendingConsiderations.length > 0 || pendingLeaves.length > 0) {
      emitQueueChanged('HOD', 'ESCALATION');
      emitQueueChanged('TG', 'ESCALATION');
      console.log(`[EscalationJob] Escalated ${pendingConsiderations.length} considerations and ${pendingLeaves.length} leaves.`);
    }
  } catch (error) {
    console.error('[EscalationJob] Error running escalation scan:', error.message);
  } finally {
    if (!mockClock) {
      try {
        const { releaseDistributedLock } = await import('../utils/distributedLock.js');
        await releaseDistributedLock('escalation_scan');
      } catch {}
    }
  }
};

export const initEscalationJob = () => {
  // Run once every hour at minute 0
  cronTask = cron.schedule('0 * * * *', () => {
    runEscalationScan();
  });
  console.log('⏰ Escalation cron job scheduled (hourly)');
  return cronTask;
};

export const stopEscalationJob = () => {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
};

export default {
  initEscalationJob,
  stopEscalationJob,
  runEscalationScan,
};
