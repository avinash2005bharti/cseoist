import SystemSetting from '../models/SystemSetting.js';

/**
 * Attempts to acquire an atomic distributed lease lock in MongoDB
 * Prevents multiple worker instances or PM2 cluster workers from executing the same job concurrently
 *
 * @param {string} lockKey - Unique identifier for the job
 * @param {number} leaseMs - Maximum duration the lock remains valid (default: 5 minutes)
 * @returns {Promise<boolean>} True if lock acquired, false if already locked by another instance
 */
export const acquireDistributedLock = async (lockKey, leaseMs = 300000) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseMs);
  const key = `lock:${lockKey}`;

  try {
    // 1. Try atomic update if expired or unassigned
    const updated = await SystemSetting.findOneAndUpdate(
      {
        key,
        $or: [
          { 'value.expiresAt': { $lte: now } },
          { value: null },
          { 'value.expiresAt': null },
        ],
      },
      {
        $set: {
          value: { lockedAt: now, expiresAt, owner: process.pid },
        },
      },
      { new: true }
    );

    if (updated) {
      return true;
    }

    // 2. If lock document doesn't exist yet, try creating it atomically
    const exists = await SystemSetting.findOne({ key });
    if (!exists) {
      try {
        await SystemSetting.create({
          key,
          value: { lockedAt: now, expiresAt, owner: process.pid },
          description: `Distributed lock for ${lockKey}`,
        });
        return true;
      } catch (insertErr) {
        // Race condition caught by unique index
        return false;
      }
    }

    return false;
  } catch (err) {
    console.warn(`[DistributedLock] Error acquiring lock for '${lockKey}':`, err.message);
    return false;
  }
};

/**
 * Releases the distributed lock so subsequent tasks can acquire it immediately
 *
 * @param {string} lockKey
 */
export const releaseDistributedLock = async (lockKey) => {
  const key = `lock:${lockKey}`;
  try {
    await SystemSetting.findOneAndUpdate(
      { key },
      {
        $set: {
          value: { lockedAt: null, expiresAt: new Date(0), owner: null },
        },
      }
    );
  } catch (err) {
    console.warn(`[DistributedLock] Error releasing lock for '${lockKey}':`, err.message);
  }
};

export default {
  acquireDistributedLock,
  releaseDistributedLock,
};
