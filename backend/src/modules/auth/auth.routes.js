import { Router } from 'express';
import authController from './auth.controller.js';
import {
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  registerStudentSchema,
  registerTeacherSchema,
} from './auth.schema.js';
import { validateBody } from '../../middleware/validate.js';
import auth from '../../middleware/auth.js';
import authorize from '../../middleware/authorize.js';
import { authLimiter } from '../../middleware/rateLimit.js';

const router = Router();

router.get('/google', authController.initiateGoogleAuth);
router.get('/google/callback', authController.handleGoogleCallback);

router.post('/login', authLimiter, validateBody(loginSchema), authController.login);
router.post('/register/student/send-otp', authLimiter, authController.sendStudentRegistrationOtp);
router.post('/register/student/verify-otp', authLimiter, validateBody(verifyOtpSchema), authController.verifyRegistrationOtp);
router.post('/verify-otp', authLimiter, validateBody(verifyOtpSchema), authController.verifyRegistrationOtp);
router.post('/register/student', authLimiter, validateBody(registerStudentSchema), authController.registerStudent);
router.post('/register/teacher', auth, authorize('ADMIN', 'HOD'), validateBody(registerTeacherSchema), authController.registerTeacher);
router.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), authController.resetPasswordWithOtp);
router.post('/refresh', authController.refresh);
router.post('/logout', auth, authController.logout);
router.post('/change-password', auth, validateBody(changePasswordSchema), authController.changePassword);
router.patch('/profile', auth, authController.updateProfile);
router.get('/me', auth, authController.getMe);

export default router;
