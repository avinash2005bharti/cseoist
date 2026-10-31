import authService from './auth.service.js';
import crypto from 'node:crypto';
import { sendSuccess } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';
import env from '../../config/env.js';
import teacherPasscodeService from './teacherPasscode.service.js';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  path: '/',
};

const OAUTH_STATE_COOKIE = 'google_oauth_state';
const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 10 * 60 * 1000,
  path: '/auth/google/callback',
};

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const userAgent = req.headers['user-agent'];
  const ip = req.ip;

  const result = await authService.login({ email, password, userAgent, ip });

  res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

  return sendSuccess(res, {
    user: result.user,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
});

export const teacherPasscodeLogin = asyncHandler(async (req, res) => {
  const result = await teacherPasscodeService.login({
    passcode: req.body.passcode,
    ip: req.ip,
  });
  return sendSuccess(res, result);
});

export const getTeacherPasscodeStatus = asyncHandler(async (req, res) => {
  return sendSuccess(res, await teacherPasscodeService.getStatus());
});

export const changeTeacherPasscode = asyncHandler(async (req, res) => {
  const result = await teacherPasscodeService.setPasscode({
    userId: req.user.id,
    currentPassword: req.body.currentPassword,
    passcode: req.body.passcode,
  });
  return sendSuccess(res, result, 'Teacher passcode updated successfully');
});

export const resetTeacherPasscode = asyncHandler(async (req, res) => {
  const result = await teacherPasscodeService.resetPasscode({
    userId: req.user.id,
    currentPassword: req.body.currentPassword,
  });
  return sendSuccess(res, result, 'Teacher passcode reset. Configure a new code before allowing Teacher access.');
});

export const refresh = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  const userAgent = req.headers['user-agent'];
  const ip = req.ip;

  const result = await authService.rotateRefreshToken(rawRefreshToken, userAgent, ip);

  res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

  return sendSuccess(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
});

export const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  await authService.logout(rawRefreshToken);
  res.clearCookie('refreshToken', { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });

  return sendSuccess(res, { message: 'Logged out successfully' });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  await authService.changePassword(req.user.id, currentPassword, newPassword);

  return sendSuccess(res, { message: 'Password changed successfully' });
});

export const getMe = asyncHandler(async (req, res) => {
  const me = await authService.getMe(req.user.id);
  return sendSuccess(res, me);
});

export const sendStudentRegistrationOtp = asyncHandler(async (req, res) => {
  const result = await authService.sendStudentRegistrationOtp(req.body);
  return sendSuccess(res, result);
});

export const verifyRegistrationOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyRegistrationOtp(req.body);
  return sendSuccess(res, result);
});

export const getStudentRegistrationSections = asyncHandler(async (req, res) => {
  const sections = await authService.getStudentRegistrationSections();
  return sendSuccess(res, sections);
});

export const registerStudent = asyncHandler(async (req, res) => {
  const result = await authService.registerStudent(req.body);
  return sendSuccess(res, result, 201);
});

export const registerTeacher = asyncHandler(async (req, res) => {
  const result = await authService.registerTeacher(req.body);
  return sendSuccess(res, result, 201);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  return sendSuccess(res, result);
});

export const resetPasswordWithOtp = asyncHandler(async (req, res) => {
  const result = await authService.resetPasswordWithOtp(req.body);
  return sendSuccess(res, result);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user.id, req.body);
  return sendSuccess(res, user, 'Profile updated successfully');
});

const getGoogleRedirectUri = (req) => {
  if (env.GOOGLE_CALLBACK_URL) {
    return env.GOOGLE_CALLBACK_URL;
  }
  const host = req.get('host') || '';
  if (host.includes('cseoist.onrender.com')) {
    // Specifically registered by user in Google Console: https://cseoist.onrender.com//auth/google/callback
    return 'https://cseoist.onrender.com//auth/google/callback';
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return `${protocol}://${host}/auth/google/callback`;
};

export const initiateGoogleAuth = asyncHandler(async (req, res) => {
  if (!env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not configured in backend environment.' });
  }

  const redirectUri = getGoogleRedirectUri(req);
  const state = crypto.randomBytes(32).toString('base64url');
  res.cookie(OAUTH_STATE_COOKIE, state, OAUTH_STATE_COOKIE_OPTIONS);
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return res.redirect(googleAuthUrl);
});

export const handleGoogleCallback = asyncHandler(async (req, res) => {
  const { code, error, state } = req.query;
  const clientUrl = env.CLIENT_URL || 'http://localhost:5173';
  const storedState = req.cookies?.[OAUTH_STATE_COOKIE];
  res.clearCookie(OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE_OPTIONS);

  if (error) {
    console.error('❌ Google OAuth callback error:', error);
    return res.redirect(`${clientUrl}/login?error=${encodeURIComponent('Google sign in was cancelled or denied.')}`);
  }

  if (!code) {
    return res.redirect(`${clientUrl}/login?error=${encodeURIComponent('Missing authorization code from Google.')}`);
  }

  if (
    !storedState ||
    typeof state !== 'string' ||
    state.length !== storedState.length ||
    !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(storedState))
  ) {
    return res.redirect(`${clientUrl}/login?error=${encodeURIComponent('Invalid or expired Google sign-in session. Please retry.')}`);
  }

  const redirectUri = getGoogleRedirectUri(req);

  // Exchange authorization code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: String(code),
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    console.error('❌ Google Token Exchange Error:', errText);
    return res.redirect(`${clientUrl}/login?error=${encodeURIComponent('Failed to verify credentials with Google. Please retry.')}`);
  }

  const tokens = await tokenResponse.json();

  // Retrieve user details from Google userinfo API
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoRes.ok) {
    return res.redirect(`${clientUrl}/login?error=${encodeURIComponent('Failed to retrieve user profile from Google.')}`);
  }

  const googleUser = await userInfoRes.json();
  const userAgent = req.headers['user-agent'];
  const ip = req.ip;

  try {
    const result = await authService.loginWithGoogle({
      googleUser,
      userAgent,
      ip,
    });

    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    const redirectUrl = new URL(`${clientUrl}/login`);
    redirectUrl.searchParams.set('oauth', 'success');
    redirectUrl.searchParams.set('token', result.accessToken);
    redirectUrl.searchParams.set('refreshToken', result.refreshToken);

    return res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error('❌ Google OAuth sign-in error:', err.message);
    const errorMsg = err.message || 'Google authentication failed.';
    return res.redirect(`${clientUrl}/login?error=${encodeURIComponent(errorMsg)}`);
  }
});

export default {
  login,
  refresh,
  logout,
  changePassword,
  updateProfile,
  forgotPassword,
  resetPasswordWithOtp,
  getMe,
  sendStudentRegistrationOtp,
  verifyRegistrationOtp,
  getStudentRegistrationSections,
  registerStudent,
  registerTeacher,
  teacherPasscodeLogin,
  getTeacherPasscodeStatus,
  changeTeacherPasscode,
  resetTeacherPasscode,
  initiateGoogleAuth,
  handleGoogleCallback,
};
