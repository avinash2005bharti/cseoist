import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import ApiError from '../../utils/ApiError.js';
import User from '../../models/User.js';
import Student from '../../models/Student.js';
import Teacher from '../../models/Teacher.js';
import MentorGroup from '../../models/MentorGroup.js';
import RefreshToken from '../../models/RefreshToken.js';
import Department from '../../models/Department.js';
import Section from '../../models/Section.js';
import Otp from '../../models/Otp.js';
import { sendOtpEmail } from '../../utils/sendEmail.js';

// Escape special regex characters in user input to prevent ReDoS
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const hashOtp = (otp) => {
  if (!otp) return null;
  return crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
};

const generateAccessToken = (user, extraClaims = {}) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      ...extraClaims,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );
};

const createRefreshTokenRecord = async (userId, userAgent = null, ip = null) => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    user: userId,
    tokenHash,
    expiresAt,
    userAgent,
    ip,
  });

  return rawToken;
};

export const login = async ({ email, password, userAgent, ip }) => {
  const query = email?.trim() || '';
  let user = await User.findOne({ email: query.toLowerCase(), isActive: true }).select('+passwordHash');

  if (!user) {
    const student = await Student.findOne({ rollNumber: new RegExp(`^${escapeRegex(query)}$`, 'i') });
    if (student) {
      user = await User.findOne({ _id: student.user, isActive: true }).select('+passwordHash');
    }
  }

  if (!user) {
    const teacher = await Teacher.findOne({ employeeId: new RegExp(`^${escapeRegex(query)}$`, 'i') });
    if (teacher) {
      user = await User.findOne({ _id: teacher.user, isActive: true }).select('+passwordHash');
    }
  }

  if (!user) {
    throw ApiError.badRequest('Invalid email or password');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw ApiError.badRequest('Invalid email or password');
  }

  user.lastLoginAt = new Date();
  await user.save();

  // Resolve TG & Profile details
  let isTG = false;
  let mentorGroupId = null;
  let profile = null;

  if (user.role === 'TEACHER' || user.role === 'HOD') {
    const teacher = await Teacher.findOne({ user: user._id }).populate('department');
    if (teacher) {
      profile = teacher;
      const group = await MentorGroup.findOne({ tg: teacher._id, isActive: true });
      if (group) {
        isTG = true;
        mentorGroupId = group._id.toString();
      }
    }
  } else if (user.role === 'STUDENT') {
    const student = await Student.findOne({ user: user._id })
      .populate('department')
      .populate('section')
      .populate({
        path: 'mentorGroup',
        populate: { path: 'tg', populate: { path: 'user', select: 'name email phone' } },
      });
    profile = student;
    if (student?.mentorGroup) {
      mentorGroupId = student.mentorGroup._id.toString();
    }
  }

  const accessToken = generateAccessToken(user, {
    isTG,
    teacherId: user.role === 'TEACHER' || user.role === 'HOD' ? profile?._id?.toString() : undefined,
  });
  const refreshToken = await createRefreshTokenRecord(user._id, userAgent, ip);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      isTG,
      mentorGroupId,
      profile,
    },
    accessToken,
    refreshToken,
  };
};

export const rotateRefreshToken = async (rawRefreshToken, userAgent, ip) => {
  if (!rawRefreshToken) {
    throw ApiError.unauthenticated('Refresh token required');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const tokenDoc = await RefreshToken.findOne({ tokenHash });

  if (!tokenDoc) {
    throw ApiError.unauthenticated('Invalid refresh token');
  }

  // Token reuse detection: if token is already revoked, suspect token theft! Revoke all tokens for this user.
  if (tokenDoc.revokedAt) {
    await RefreshToken.updateMany({ user: tokenDoc.user }, { revokedAt: new Date() });
    throw ApiError.forbidden('Refresh token reuse detected. Please log in again.');
  }

  if (tokenDoc.expiresAt < new Date()) {
    throw ApiError.unauthenticated('Refresh token expired');
  }

  // Revoke current token
  tokenDoc.revokedAt = new Date();
  await tokenDoc.save();

  // Find user
  const user = await User.findById(tokenDoc.user);
  if (!user || !user.isActive) {
    throw ApiError.unauthenticated('User not found or inactive');
  }

  // Determine TG status
  let isTG = false;
  let teacherId = null;
  if (user.role === 'TEACHER' || user.role === 'HOD') {
    const teacher = await Teacher.findOne({ user: user._id });
    if (teacher) {
      teacherId = teacher._id.toString();
      const group = await MentorGroup.findOne({ tg: teacher._id, isActive: true });
      if (group) isTG = true;
    }
  }

  const newAccessToken = generateAccessToken(user, { isTG, teacherId });
  const newRefreshToken = await createRefreshTokenRecord(user._id, userAgent, ip);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

export const logout = async (rawRefreshToken) => {
  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    await RefreshToken.updateOne({ tokenHash }, { revokedAt: new Date() });
  }
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw ApiError.badRequest('Current password does not match');
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();

  // Revoke other refresh tokens on password change
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
};

export const updateProfile = async (userId, data) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !user.isActive) {
    throw ApiError.unauthenticated('User not found');
  }

  // 1. If email is being changed
  if (data.email) {
    const cleanEmail = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw ApiError.badRequest('Please provide a valid email address');
    }
    if (cleanEmail !== user.email) {
      const duplicate = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
      if (duplicate) {
        throw ApiError.conflict('This email address is already in use by another account');
      }
      user.email = cleanEmail;
    }
  }

  // 2. If phone is being changed
  if (data.phone !== undefined) {
    user.phone = data.phone ? data.phone.trim() : null;
  }

  // 3. If password is being changed
  if (data.newPassword) {
    if (!data.currentPassword) {
      throw ApiError.badRequest('Current password is required to change password');
    }
    const isMatch = await user.comparePassword(data.currentPassword);
    if (!isMatch) {
      throw ApiError.badRequest('Current password does not match');
    }
    if (data.newPassword.length < 6) {
      throw ApiError.badRequest('New password must be at least 6 characters long');
    }
    user.passwordHash = await User.hashPassword(data.newPassword);
    user.mustChangePassword = false;
  }

  await user.save();
  return getMe(user._id);
};

export const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw ApiError.unauthenticated('User not found');
  }

  let profile = null;
  let isTG = false;
  let mentorGroupId = null;

  if (user.role === 'TEACHER' || user.role === 'HOD') {
    const teacher = await Teacher.findOne({ user: user._id }).populate('department');
    if (teacher) {
      profile = teacher;
      const group = await MentorGroup.findOne({ tg: teacher._id, isActive: true }).populate('department');
      if (group) {
        isTG = true;
        mentorGroupId = group._id.toString();
      }
    }
  } else if (user.role === 'STUDENT') {
    const student = await Student.findOne({ user: user._id })
      .populate('department')
      .populate('section')
      .populate({
        path: 'mentorGroup',
        populate: { path: 'tg', populate: { path: 'user', select: 'name email phone' } },
      });
    profile = student;
    if (student?.mentorGroup) {
      mentorGroupId = student.mentorGroup._id.toString();
    }
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    phone: user.phone,
    profileImage: user.profileImage,
    isTG,
    mentorGroupId,
    profile,
  };
};

// In-memory registration OTP cache as secondary fallback
const registrationOtps = new Map();

export const sendStudentRegistrationOtp = async ({ email, name }) => {
  const normEmail = (email || '').toLowerCase().trim();
  if (!normEmail || !normEmail.includes('@')) {
    throw ApiError.badRequest('A valid email address is required');
  }

  const existingUser = await User.findOne({ email: normEmail });
  if (existingUser) {
    throw ApiError.conflict(`An account with email '${normEmail}' already exists. Please sign in.`);
  }

  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity
  const hashedOtp = hashOtp(otp);

  // 1. Save persistently in MongoDB Otp collection with hashed OTP
  await Otp.deleteMany({ email: normEmail, purpose: 'REGISTRATION' });
  await Otp.create({
    email: normEmail,
    otp: hashedOtp,
    purpose: 'REGISTRATION',
    expiresAt,
  });

  // 2. Also keep in memory map as immediate fallback with hashed OTP
  registrationOtps.set(normEmail, {
    otp: hashedOtp,
    expiresAt: expiresAt.getTime(),
    name: (name || 'Student').trim(),
  });

  // 3. Dispatch OTP email via Brevo
  sendOtpEmail(normEmail, otp, name || 'Student').catch((err) => {
    console.error('❌ [Brevo Send OTP Error]:', err.message);
  });

  // Sanitized operational logging - never leak raw OTPs
  const maskedEmail = normEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3');
  console.log(`[AuthService] Dispatched student registration verification code to ${maskedEmail}`);

  return {
    message: `A 6-digit verification code has been dispatched to ${normEmail}.`,
    email: normEmail,
  };
};

export const verifyRegistrationOtp = async ({ email, otp }) => {
  const normEmail = (email || '').toLowerCase().trim();
  const cleanOtp = String(otp || '').replace(/\D/g, '').trim();

  if (!normEmail || !cleanOtp) {
    throw ApiError.badRequest('Email and 6-digit verification code are required.');
  }

  const dbOtp = await Otp.findOne({
    email: normEmail,
    purpose: 'REGISTRATION',
  }).sort({ createdAt: -1 });

  const memOtp = registrationOtps.get(normEmail);
  const rawStoredOtp = dbOtp?.otp || memOtp?.otp;
  const storedOtp = rawStoredOtp ? String(rawStoredOtp).trim() : null;
  const isExpired =
    (dbOtp && dbOtp.expiresAt < new Date()) ||
    (memOtp && memOtp.expiresAt < Date.now());

  const hashedInput = hashOtp(cleanOtp);
  const matchesStored = storedOtp && (storedOtp === hashedInput || storedOtp === cleanOtp);
  const isTestBypass = cleanOtp === '123456' && process.env.NODE_ENV === 'test';

  if (!storedOtp && !isTestBypass) {
    throw ApiError.badRequest('No active verification code found for this email. Please request a new code.');
  }

  if (isExpired) {
    await Otp.deleteMany({ email: normEmail, purpose: 'REGISTRATION' });
    registrationOtps.delete(normEmail);
    throw ApiError.badRequest('Verification code has expired. Please request a new code.');
  }

  if (!matchesStored && !isTestBypass) {
    throw ApiError.badRequest('Invalid verification code. Please check your email.');
  }

  if (dbOtp) {
    dbOtp.isVerified = true;
    await dbOtp.save();
  }

  return { success: true, verified: true, message: 'Verification code verified successfully!' };
};

export const registerStudent = async ({
  name,
  email,
  password,
  rollNumber,
  enrollment_no,
  year,
  semester,
  section,
  batch,
  phone,
  enrollmentYear,
  otp,
}) => {
  const normEmail = (email || '').toLowerCase().trim();
  if (!normEmail) {
    throw ApiError.badRequest('Valid email address is required');
  }

  // If OTP is provided, verify against database and memory
  if (otp) {
    const cleanOtp = String(otp).replace(/\D/g, '').trim();
    const hashedInput = hashOtp(cleanOtp);
    const dbOtp = await Otp.findOne({
      email: normEmail,
      purpose: 'REGISTRATION',
    }).sort({ createdAt: -1 });

    const memOtp = registrationOtps.get(normEmail);
    const rawStoredOtp = dbOtp?.otp || memOtp?.otp;
    const storedOtp = rawStoredOtp ? String(rawStoredOtp).trim() : null;
    const isExpired =
      (dbOtp && dbOtp.expiresAt < new Date()) ||
      (memOtp && memOtp.expiresAt < Date.now());

    const matchesStored = storedOtp && (storedOtp === hashedInput || storedOtp === cleanOtp);
    const isTestBypass = cleanOtp === '123456' && process.env.NODE_ENV === 'test';

    if (storedOtp) {
      if (isExpired) {
        await Otp.deleteMany({ email: normEmail, purpose: 'REGISTRATION' });
        registrationOtps.delete(normEmail);
        throw ApiError.badRequest('Verification code has expired. Please request a new code.');
      }
      if (!matchesStored && !isTestBypass) {
        throw ApiError.badRequest('Invalid verification code. Please check the code sent to your email.');
      }
      // Verified! Remove OTP from store
      await Otp.deleteMany({ email: normEmail, purpose: 'REGISTRATION' });
      registrationOtps.delete(normEmail);
    } else if (!isTestBypass) {
      const verifiedRecord = await Otp.findOne({
        email: normEmail,
        purpose: 'REGISTRATION',
        isVerified: true,
      });
      if (!verifiedRecord) {
        throw ApiError.badRequest('Verification code not found or expired. Please request a new code.');
      }
      await Otp.deleteMany({ email: normEmail, purpose: 'REGISTRATION' });
    }
  }

  const existingUser = await User.findOne({ email: normEmail });
  if (existingUser) {
    throw ApiError.conflict(`An account with email '${normEmail}' already exists. Please sign in.`);
  }

  const roll = (rollNumber || enrollment_no || '').trim().toUpperCase();
  if (!roll) {
    throw ApiError.badRequest('Roll Number / Enrollment Number is required');
  }

  const existingStudent = await Student.findOne({ rollNumber: roll });
  if (existingStudent) {
    throw ApiError.conflict(`Student with Roll Number '${roll}' already exists`);
  }

  // Resolve Department (default to CSE)
  let dept = await Department.findOne({ code: 'CSE' });
  if (!dept) {
    dept = await Department.findOne();
    if (!dept) {
      dept = await Department.create({ name: 'Computer Science & Engineering', code: 'CSE' });
    }
  }

  // Resolve Section (find by code or name or create, scoped by semester)
  const semNum = semester ? parseInt(semester, 10) || 5 : 5;
  const yrNum = year ? parseInt(year, 10) || Math.ceil(semNum / 2) || 3 : Math.ceil(semNum / 2) || 3;
  const cleanSec = (section || 'A').replace(/^Section\s*/i, '').trim().toUpperCase();
  let sec = await Section.findOne({
    department: dept._id,
    semester: semNum,
    $or: [
      { name: `Section ${cleanSec}` },
      { code: `CSE-${cleanSec}-S${semNum}` },
      { code: `CSE-${cleanSec}` },
      { name: cleanSec },
    ],
  });

  if (!sec) {
    let codeToUse = `CSE-${cleanSec}`;
    const codeConflict = await Section.findOne({ code: codeToUse });
    if (codeConflict && codeConflict.semester !== semNum) {
      codeToUse = `CSE-${cleanSec}-S${semNum}`;
    }
    sec = await Section.create({
      department: dept._id,
      year: yrNum,
      semester: semNum,
      name: `Section ${cleanSec}`,
      code: codeToUse,
    });
  }

  const passwordHash = await User.hashPassword(password || 'Password@123');
  const user = await User.create({
    name: (name || 'Student').trim(),
    email: normEmail,
    passwordHash,
    role: 'STUDENT',
    phone: phone ? phone.trim() : null,
    isActive: true,
    isVerified: true,
    mustChangePassword: false,
  });

  const parsedEnrollYear = enrollmentYear
    ? parseInt(enrollmentYear)
    : batch && batch.includes('-')
    ? parseInt(batch.split('-')[0]) || 2022
    : new Date().getFullYear() - 2;

  const student = await Student.create({
    user: user._id,
    department: dept._id,
    section: sec._id,
    rollNumber: roll,
    semester: semNum,
    enrollmentYear: parsedEnrollYear,
  });

  // Auto-assign to active MentorGroup based strictly on student's Section
  try {
    let assignedGroup = await MentorGroup.findOne({ section: sec._id, isActive: true });
    if (!assignedGroup) {
      assignedGroup = await MentorGroup.findOne({ section: sec._id });
      if (assignedGroup) {
        assignedGroup.isActive = true;
        await assignedGroup.save();
      }
    }
    if (!assignedGroup) {
      const peer = await Student.findOne({
        section: sec._id,
        mentorGroup: { $ne: null },
        _id: { $ne: student._id },
      });
      if (peer?.mentorGroup) {
        assignedGroup = await MentorGroup.findById(peer.mentorGroup);
      }
    }
    if (assignedGroup) {
      student.mentorGroup = assignedGroup._id;
      await student.save();
      if (!assignedGroup.students.some((sId) => sId.toString() === student._id.toString())) {
        assignedGroup.students.push(student._id);
        await assignedGroup.save();
      }
    }
  } catch (err) {
    // Non-fatal if mentor group auto-assign fails
    console.warn('Auto-assigning student to mentor group notice:', err.message);
  }

  return {
    message: 'Student account registered successfully! You can now sign in.',
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    student: {
      id: student._id,
      rollNumber: student.rollNumber,
    },
  };
};

export const registerTeacher = async ({
  name,
  email,
  password,
  employeeId,
  designation,
  specialization,
  phone,
}) => {
  const normEmail = (email || '').toLowerCase().trim();
  if (!normEmail) {
    throw ApiError.badRequest('Valid email address is required');
  }

  const existingUser = await User.findOne({ email: normEmail });
  if (existingUser) {
    throw ApiError.conflict(`User with email '${normEmail}' already exists`);
  }

  const empId = (employeeId || `EMP_${Date.now().toString().slice(-6)}`).trim().toUpperCase();
  const existingTeacher = await Teacher.findOne({ employeeId: empId });
  if (existingTeacher) {
    throw ApiError.conflict(`Teacher with Employee ID '${empId}' already exists`);
  }

  let dept = await Department.findOne({ code: 'CSE' });
  if (!dept) {
    dept = await Department.findOne();
    if (!dept) {
      dept = await Department.create({ name: 'Computer Science & Engineering', code: 'CSE' });
    }
  }

  const passwordHash = await User.hashPassword(password || 'Password@123');
  const user = await User.create({
    name: (name || 'Faculty Member').trim(),
    email: normEmail,
    passwordHash,
    role: 'TEACHER',
    phone: phone ? phone.trim() : null,
    isActive: true,
    isVerified: true,
    mustChangePassword: false,
  });

  const teacher = await Teacher.create({
    user: user._id,
    department: dept._id,
    employeeId: empId,
    designation: designation || 'Assistant Professor',
  });

  return {
    message: 'Faculty account registered successfully! You can now sign in.',
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    teacher: {
      id: teacher._id,
      employeeId: teacher.employeeId,
    },
  };
};

export const forgotPassword = async (email) => {
  const normEmail = (email || '').toLowerCase().trim();
  const user = await User.findOne({ email: normEmail });
  if (!user) {
    // Return generic message to prevent email enumeration
    return { message: 'If this email is registered in our portal, a password reset code has been sent.' };
  }

  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  const hashedOtp = hashOtp(otp);

  user.resetPasswordOtp = hashedOtp;
  user.resetPasswordExpires = expires;
  await user.save();

  // Also persist in Otp collection with hashed value
  await Otp.deleteMany({ email: normEmail, purpose: 'RESET_PASSWORD' });
  await Otp.create({
    email: normEmail,
    otp: hashedOtp,
    purpose: 'RESET_PASSWORD',
    expiresAt: expires,
  });

  // Send OTP email
  sendOtpEmail(user.email, otp, user.name).catch((err) => {
    console.error('[Forgot Password Email Error]:', err.message);
  });

  // Sanitized operational logging - never log raw OTPs
  const maskedEmail = normEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3');
  console.log(`[AuthService] Password reset verification code dispatched to ${maskedEmail}`);

  return { message: 'If this email is registered in our portal, a password reset code has been sent.' };
};

export const resetPasswordWithOtp = async ({ email, otp, newPassword }) => {
  const normEmail = (email || '').toLowerCase().trim();
  const cleanOtp = String(otp || '').replace(/\D/g, '').trim();
  const hashedInput = hashOtp(cleanOtp);
  const isTestBypass = cleanOtp === '123456' && process.env.NODE_ENV === 'test';

  // 1. Query User document with hashed resetPasswordOtp (or plaintext for backward compatibility)
  let user = await User.findOne({
    email: normEmail,
    resetPasswordOtp: { $in: [hashedInput, cleanOtp] },
    resetPasswordExpires: { $gt: new Date() },
  }).select('+resetPasswordOtp +resetPasswordExpires');

  // 2. Fallback to Otp collection or test mock bypass
  if (!user) {
    const dbOtp = await Otp.findOne({
      email: normEmail,
      purpose: 'RESET_PASSWORD',
      otp: { $in: [hashedInput, cleanOtp] },
      expiresAt: { $gt: new Date() },
    });
    if (dbOtp || isTestBypass) {
      user = await User.findOne({ email: normEmail }).select('+resetPasswordOtp +resetPasswordExpires');
    }
  }

  if (!user) {
    throw ApiError.badRequest('Invalid or expired reset code. Please request a new code.');
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.resetPasswordOtp = undefined;
  user.resetPasswordExpires = undefined;
  user.mustChangePassword = false;
  await user.save();

  await Otp.deleteMany({ email: normEmail, purpose: 'RESET_PASSWORD' });

  return { message: 'Password has been reset successfully. You may now log in.' };
};

export const loginWithGoogle = async ({ googleUser, userAgent, ip }) => {
  const email = (googleUser.email || '').toLowerCase().trim();
  if (!email) {
    throw ApiError.badRequest('No email address provided by Google account');
  }

  // 1. Google email verification check
  if (googleUser.email_verified === false) {
    throw ApiError.unauthorized('Your Google account email is not verified by Google.');
  }

  const user = await User.findOne({ email });

  // 2. Only allow already registered accounts
  if (!user) {
    throw ApiError.unauthorized('There is no account linked to this email. Please create one.');
  }

  // 3. Verify that the user account is verified
  if (user.isVerified === false) {
    throw ApiError.forbidden(
      'Your account is not verified yet. Please complete email verification before signing in.'
    );
  }

  // 4. Verify account is active
  if (!user.isActive) {
    throw ApiError.forbidden('Your account is deactivated. Contact Administrator.');
  }

  if (!user.profileImage?.url && googleUser.picture) {
    user.profileImage = { url: googleUser.picture };
  }
  user.lastLoginAt = new Date();
  await user.save();

  // Resolve TG & Profile details (identical to standard login)
  let isTG = false;
  let mentorGroupId = null;
  let profile = null;

  if (user.role === 'TEACHER' || user.role === 'HOD') {
    const teacher = await Teacher.findOne({ user: user._id }).populate('department');
    if (teacher) {
      profile = teacher;
      const group = await MentorGroup.findOne({ tg: teacher._id, isActive: true });
      if (group) {
        isTG = true;
        mentorGroupId = group._id.toString();
      }
    }
  } else if (user.role === 'STUDENT') {
    const student = await Student.findOne({ user: user._id })
      .populate('department')
      .populate('section')
      .populate({
        path: 'mentorGroup',
        populate: { path: 'tg', populate: { path: 'user', select: 'name email phone' } },
      });
    profile = student;
    if (student?.mentorGroup) {
      mentorGroupId = student.mentorGroup._id.toString();
    }
  }

  const accessToken = generateAccessToken(user, {
    isTG,
    teacherId: user.role === 'TEACHER' || user.role === 'HOD' ? profile?._id?.toString() : undefined,
  });
  const refreshToken = await createRefreshTokenRecord(user._id, userAgent, ip);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      isTG,
      mentorGroupId,
      profile,
    },
    accessToken,
    refreshToken,
  };
};

export default {
  login,
  loginWithGoogle,
  rotateRefreshToken,
  logout,
  changePassword,
  updateProfile,
  forgotPassword,
  resetPasswordWithOtp,
  getMe,
  sendStudentRegistrationOtp,
  verifyRegistrationOtp,
  registerStudent,
  registerTeacher,
};
