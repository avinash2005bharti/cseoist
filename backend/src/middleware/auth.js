import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/User.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import MentorGroup from '../models/MentorGroup.js';
import teacherPasscodeService from '../modules/auth/teacherPasscode.service.js';

export const auth = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return next(ApiError.unauthenticated('Authorization token missing'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    } catch (err) {
      return next(ApiError.unauthenticated('Invalid or expired access token'));
    }

    if (decoded.sharedTeacher) {
      if (!(await teacherPasscodeService.isSharedTeacherTokenCurrent(decoded))) {
        return next(ApiError.unauthenticated('Invalid or expired access token'));
      }
      req.user = {
        _id: null,
        id: 'shared-teacher',
        name: 'Teacher',
        email: null,
        role: 'TEACHER',
        mustChangePassword: false,
        isTG: false,
        teacherId: null,
        studentId: null,
        mentorGroupId: null,
        departmentId: null,
        sharedTeacher: true,
      };
      const sharedTeacherAllowedPaths = new Set([
        '/api/v1/auth/me',
        '/api/v1/auth/logout',
        '/api/v1/considerations/teacher-approved',
        '/api/v1/notifications/push-subscribe',
        '/api/v1/notifications/push-unsubscribe',
      ]);
      const requestPath = req.originalUrl.split('?')[0];
      if (!sharedTeacherAllowedPaths.has(requestPath)) {
        return next(ApiError.forbidden('Shared Teacher access is limited to approved consideration records'));
      }
      return next();
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return next(ApiError.unauthenticated('User account not found or deactivated'));
    }

    // Attach basic user info
    req.user = {
      _id: user._id,
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      isTG: false,
      teacherId: null,
      studentId: null,
      mentorGroupId: null,
      departmentId: null,
    };

    // If TEACHER or HOD, check Teacher profile and TG mentor status
    if (user.role === 'TEACHER' || user.role === 'HOD') {
      const teacherProfile = await Teacher.findOne({ user: user._id });
      if (teacherProfile) {
        req.user.teacherId = teacherProfile._id.toString();
        req.user.departmentId = teacherProfile.department ? teacherProfile.department.toString() : null;

        // Check if teacher leads an active MentorGroup
        const activeGroup = await MentorGroup.findOne({ tg: teacherProfile._id, isActive: true });
        if (activeGroup) {
          req.user.isTG = true;
          req.user.mentorGroupId = activeGroup._id.toString();
        }
      }
    }

    // If STUDENT, attach student profile
    if (user.role === 'STUDENT') {
      const studentProfile = await Student.findOne({ user: user._id });
      if (studentProfile) {
        req.user.studentId = studentProfile._id.toString();
        req.user.departmentId = studentProfile.department ? studentProfile.department.toString() : null;
        req.user.mentorGroupId = studentProfile.mentorGroup ? studentProfile.mentorGroup.toString() : null;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default auth;
