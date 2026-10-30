import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import ApiError from '../../utils/ApiError.js';
import User from '../../models/User.js';
import SystemSetting from '../../models/SystemSetting.js';
import ConsiderationRequest from '../../models/ConsiderationRequest.js';
import TeacherPasscodeAttempt from '../../models/TeacherPasscodeAttempt.js';

const SETTING_KEY = 'teacher_shared_passcode';
const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const genericInvalidPasscode = () => ApiError.badRequest('Invalid passcode');

const validatePasscode = (passcode) => {
  if (typeof passcode !== 'string' || !/^\d{4}$/.test(passcode)) {
    throw ApiError.badRequest('Passcode must be exactly four digits');
  }
  return passcode;
};

const getSetting = () => SystemSetting.findOne({ key: SETTING_KEY }).select('+value');

const checkLockout = (key) => {
  return TeacherPasscodeAttempt.findOne({ key }).then((record) => {
    if (record?.lockedUntil && record.lockedUntil > new Date()) {
      throw ApiError.rateLimited('Too many failed passcode attempts. Please try again later.');
    }
    if (record?.lockedUntil && record.lockedUntil <= new Date()) {
      return TeacherPasscodeAttempt.updateOne(
        { key },
        { $set: { failures: 0, lockedUntil: null } }
      );
    }
  });
};

const recordFailure = async (key) => {
  const record = await TeacherPasscodeAttempt.findOneAndUpdate(
    { key },
    {
      $inc: { failures: 1 },
      $set: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      $setOnInsert: { key },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (record.failures >= MAX_FAILURES) {
    await TeacherPasscodeAttempt.updateOne(
      { key },
      { $set: { lockedUntil: new Date(Date.now() + LOCKOUT_MS) } }
    );
  }
};

const clearFailures = (key) => TeacherPasscodeAttempt.deleteOne({ key });

const credentialVersion = (setting) => String(setting?.value?.credentialVersion || '');

export const isSharedTeacherTokenCurrent = async (decoded) => {
  if (
    decoded?.id !== 'shared-teacher' ||
    decoded?.role !== 'TEACHER' ||
    decoded?.tokenType !== 'SHARED_TEACHER' ||
    !decoded?.sharedTeacher ||
    !decoded.credentialVersion
  ) {
    return false;
  }
  const setting = await getSetting();
  return Boolean(setting?.value?.hash && credentialVersion(setting) === decoded.credentialVersion);
};

export const login = async ({ passcode, ip }) => {
  const cleanPasscode = validatePasscode(passcode);
  const attemptKey = crypto.createHash('sha256').update(ip || 'unknown').digest('hex');
  await checkLockout(attemptKey);

  const setting = await getSetting();
  if (!setting?.value?.hash) {
    throw ApiError.badRequest('Teacher passcode is not configured');
  }

  const matches = await bcrypt.compare(cleanPasscode, setting.value.hash);
  if (!matches) {
    await recordFailure(attemptKey);
    throw genericInvalidPasscode();
  }
  clearFailures(attemptKey);

  const identity = {
    id: 'shared-teacher',
    name: 'Teacher',
    email: null,
    role: 'TEACHER',
    isTG: false,
    mustChangePassword: false,
    sharedTeacher: true,
  };
  const accessToken = jwt.sign(
    {
      id: identity.id,
      role: identity.role,
      sharedTeacher: true,
      tokenType: 'SHARED_TEACHER',
      credentialVersion: credentialVersion(setting),
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );
  return { user: identity, accessToken };
};

const requireAuthorizedPassword = async (userId, currentPassword) => {
  if (!currentPassword) throw ApiError.badRequest('Current password is required');
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !['HOD', 'ADMIN'].includes(user.role) || !(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Current password confirmation failed');
  }
};

export const getStatus = async () => {
  const setting = await getSetting();
  return {
    configured: Boolean(setting?.value?.hash),
    maskedPasscode: setting?.value?.hash ? '••••' : null,
    updatedAt: setting?.updatedAt || null,
  };
};

export const setPasscode = async ({ userId, currentPassword, passcode }) => {
  const cleanPasscode = validatePasscode(passcode);
  await requireAuthorizedPassword(userId, currentPassword);
  const hash = await bcrypt.hash(cleanPasscode, 12);
  const version = crypto.randomUUID();
  const existing = await getSetting();
  if (!existing) {
    try {
      await SystemSetting.create({
        key: SETTING_KEY,
        value: { hash, credentialVersion: version },
        description: 'Hashed shared Teacher passcode. Never expose the hash or raw passcode.',
        updatedBy: userId,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      await SystemSetting.updateOne(
        { key: SETTING_KEY },
        { $set: { value: { hash, credentialVersion: version }, updatedBy: userId } }
      );
    }
  } else {
    await SystemSetting.updateOne(
      { key: SETTING_KEY },
      { $set: { value: { hash, credentialVersion: version }, updatedBy: userId } }
    );
  }
  return getStatus();
};

export const resetPasscode = async ({ userId, currentPassword }) => {
  await requireAuthorizedPassword(userId, currentPassword);
  await SystemSetting.updateOne(
    { key: SETTING_KEY },
    {
      $set: {
        value: { hash: null, credentialVersion: crypto.randomUUID() },
        updatedBy: userId,
      },
      $setOnInsert: {
        key: SETTING_KEY,
        description: 'Hashed shared Teacher passcode. Never expose the hash or raw passcode.',
      },
    },
    { upsert: true }
  );
  return getStatus();
};

export const getApprovedConsiderations = async (query = {}) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  const filter = { status: 'APPROVED_BY_HOD' };
  const [requests, total] = await Promise.all([
    ConsiderationRequest.find(filter)
      .populate({
        path: 'student',
        populate: [
          { path: 'user', select: 'name email' },
          { path: 'department', select: 'name' },
          { path: 'section', select: 'name code year semester' },
        ],
      })
      .populate({
        path: 'groupMembers',
        populate: [
          { path: 'user', select: 'name email' },
          { path: 'department', select: 'name' },
          { path: 'section', select: 'name code year semester' },
        ],
      })
      .populate({
        path: 'sectionStudents',
        populate: [
          { path: 'user', select: 'name email' },
          { path: 'department', select: 'name' },
          { path: 'section', select: 'name code year semester' },
        ],
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ConsiderationRequest.countDocuments(filter),
  ]);
  return { requests, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export default { login, getStatus, setPasscode, resetPasscode, getApprovedConsiderations, isSharedTeacherTokenCurrent };
