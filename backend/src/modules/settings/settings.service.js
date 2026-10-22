import SystemSetting from '../../models/SystemSetting.js';
import AuditLog from '../../models/AuditLog.js';
import { isWithinConsiderationWindow } from '../../utils/dates.js';

export const getConsiderationWindowSetting = async (clock = new Date()) => {
  const setting = await SystemSetting.findOne({ key: 'CONSIDERATION_TIME_LIMIT_ENABLED' }).populate(
    'updatedBy',
    'name email role'
  );

  const isTimeLimitEnabled = setting ? Boolean(setting.value) : true;
  const isWithinWindow = isWithinConsiderationWindow(clock);

  // If time limit is disabled (OFF), it is always open (24x7 testing mode)
  const isCurrentlyOpen = !isTimeLimitEnabled ? true : isWithinWindow;

  return {
    isTimeLimitEnabled,
    isCurrentlyOpen,
    mode: isTimeLimitEnabled ? 'RESTRICTED_WINDOW' : '24X7_TESTING',
    windowText: '9:00 AM – 4:00 PM IST',
    updatedAt: setting?.updatedAt || null,
    updatedBy: setting?.updatedBy || null,
  };
};

export const setConsiderationWindowSetting = async (user, enabled) => {
  const isEnabled = Boolean(enabled);
  const now = new Date();

  const setting = await SystemSetting.findOneAndUpdate(
    { key: 'CONSIDERATION_TIME_LIMIT_ENABLED' },
    {
      key: 'CONSIDERATION_TIME_LIMIT_ENABLED',
      value: isEnabled,
      description: 'Enforce 9:00 AM - 4:00 PM IST consideration application window for students',
      updatedBy: user._id,
      updatedAt: now,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate('updatedBy', 'name email role');

  await AuditLog.create({
    actor: user._id,
    action: `TOGGLE_CONSIDERATION_WINDOW_${isEnabled ? 'ON' : 'OFF'}`,
    entityType: 'SystemSetting',
    entityId: setting._id,
    after: {
      key: 'CONSIDERATION_TIME_LIMIT_ENABLED',
      value: isEnabled,
      mode: isEnabled ? 'RESTRICTED_WINDOW' : '24X7_TESTING',
    },
  });

  const isWithinWindow = isWithinConsiderationWindow(now);
  const isCurrentlyOpen = !isEnabled ? true : isWithinWindow;

  return {
    isTimeLimitEnabled: isEnabled,
    isCurrentlyOpen,
    mode: isEnabled ? 'RESTRICTED_WINDOW' : '24X7_TESTING',
    windowText: '9:00 AM – 4:00 PM IST',
    updatedAt: setting.updatedAt,
    updatedBy: setting.updatedBy,
  };
};

export default {
  getConsiderationWindowSetting,
  setConsiderationWindowSetting,
};
