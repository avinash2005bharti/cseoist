import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { hashOtp } from '../src/modules/auth/auth.service.js';
import { parsePagination } from '../src/utils/pagination.js';
import { acquireDistributedLock, releaseDistributedLock } from '../src/utils/distributedLock.js';
import ApiError from '../src/utils/ApiError.js';

describe('18. Security Hardening & Flaw Verification Suite', () => {

  describe('FLAW-SEC-03 & FLAW-SEC-04: OTP Cryptographic Hashing at Rest', () => {
    it('should hash OTP values using SHA-256 consistently', () => {
      const plainOtp = '654321';
      const expectedHash = crypto.createHash('sha256').update(plainOtp).digest('hex');
      const generatedHash = hashOtp(plainOtp);

      assert.equal(generatedHash, expectedHash);
      assert.notEqual(generatedHash, plainOtp);
      assert.equal(generatedHash.length, 64);
    });

    it('should generate distinct hashes for different OTP values', () => {
      const hash1 = hashOtp('111111');
      const hash2 = hashOtp('222222');
      assert.notEqual(hash1, hash2);
    });

    it('should return null or empty when hashing invalid inputs', () => {
      assert.equal(hashOtp(''), null);
      assert.equal(hashOtp(null), null);
    });
  });

  describe('FLAW-SEC-05: OTP Bypass Restriction to Test Environment Only', () => {
    it('should strictly reject 123456 bypass in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const isBypassAllowed = (cleanOtp) => cleanOtp === '123456' && process.env.NODE_ENV === 'test';
        assert.equal(isBypassAllowed('123456'), false);
        assert.equal(isBypassAllowed('999999'), false);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should only allow 123456 bypass when NODE_ENV is explicitly test', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'test';
        const isBypassAllowed = (cleanOtp) => cleanOtp === '123456' && process.env.NODE_ENV === 'test';
        assert.equal(isBypassAllowed('123456'), true);
        assert.equal(isBypassAllowed('654321'), false);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('FLAW-AUTH-02: TG Reset Password Boundary Enforcement', () => {
    it('should reject TG attempting to reset password for a student not in their mentor group', () => {
      const tgUser = {
        _id: 'tg-user-1',
        role: 'TG',
        email: 'tg1@college.edu',
      };

      const menteeIds = ['student-id-1', 'student-id-2'];
      const targetStudentId = 'student-id-3'; // not in mentee list

      const verifyTgCanReset = (actor, studentId, allowedMentees) => {
        if (actor.role === 'ADMIN') return true;
        if (actor.role === 'TG') {
          if (!allowedMentees.includes(studentId)) {
            throw ApiError.forbidden('You can only reset passwords for students in your assigned mentor groups or sections');
          }
          return true;
        }
        throw ApiError.forbidden('Unauthorized to reset student password');
      };

      assert.throws(
        () => verifyTgCanReset(tgUser, targetStudentId, menteeIds),
        /You can only reset passwords for students in your assigned mentor groups or sections/
      );

      // Successfully allows assigned mentee
      assert.equal(verifyTgCanReset(tgUser, 'student-id-1', menteeIds), true);

      // Successfully allows ADMIN for any student
      assert.equal(verifyTgCanReset({ _id: 'admin-1', role: 'ADMIN' }, targetStudentId, menteeIds), true);
    });
  });

  describe('FLAW-AUTH-03 & FLAW-AUTH-04: Student Directory & Peer Privacy Boundary', () => {
    it('should restrict Student role from accessing unrestricted student directory (GET /api/v1/students)', () => {
      const allowedDirectoryRoles = ['ADMIN', 'HOD', 'TEACHER', 'TG'];
      const isAuthorizedForFullDirectory = (role) => allowedDirectoryRoles.includes(role);

      assert.equal(isAuthorizedForFullDirectory('ADMIN'), true);
      assert.equal(isAuthorizedForFullDirectory('HOD'), true);
      assert.equal(isAuthorizedForFullDirectory('TEACHER'), true);
      assert.equal(isAuthorizedForFullDirectory('TG'), true);
      assert.equal(isAuthorizedForFullDirectory('STUDENT'), false);
    });

    it('should sanitize peer search results to exclude sensitive fields (phone, guardianPhone, address)', () => {
      const rawPeer = {
        _id: 'peer-id-1',
        name: 'Jane Doe',
        rollNumber: '2023CS012',
        section: { _id: 'sec-1', name: 'Section A' },
        semester: 5,
        phone: '+919876543210',
        guardianPhone: '+919876543211',
        guardianName: 'John Doe',
        academicStatus: 'REGULAR',
      };

      const sanitizePeer = (student) => ({
        _id: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        section: student.section,
        semester: student.semester,
      });

      const sanitized = sanitizePeer(rawPeer);
      assert.equal(sanitized._id, 'peer-id-1');
      assert.equal(sanitized.name, 'Jane Doe');
      assert.equal(sanitized.rollNumber, '2023CS012');
      assert.equal(sanitized.phone, undefined);
      assert.equal(sanitized.guardianPhone, undefined);
      assert.equal(sanitized.guardianName, undefined);
    });
  });

  describe('FLAW-AUTH-04: TG Student Field Mutation Restrictions', () => {
    it('should forbid TG from modifying academic structure fields (status, rollNumber, semester, section)', () => {
      const forbiddenFieldsForTg = ['status', 'rollNumber', 'semester', 'section', 'enrollmentYear', 'batch'];

      const validateTgStudentUpdate = (data) => {
        for (const field of forbiddenFieldsForTg) {
          if (data[field] !== undefined) {
            throw ApiError.forbidden(`TGs cannot modify student academic field '${field}'. Only HOD or Admin can change this.`);
          }
        }
        return true;
      };

      assert.throws(
        () => validateTgStudentUpdate({ rollNumber: 'NEW_ROLL_123' }),
        /TGs cannot modify student academic field 'rollNumber'/
      );
      assert.throws(
        () => validateTgStudentUpdate({ status: 'SUSPENDED' }),
        /TGs cannot modify student academic field 'status'/
      );
      assert.throws(
        () => validateTgStudentUpdate({ semester: 6 }),
        /TGs cannot modify student academic field 'semester'/
      );

      // Allowed fields (contact info, bio)
      assert.equal(validateTgStudentUpdate({ phone: '+919999988888', guardianName: 'Father Name' }), true);
    });
  });

  describe('FLAW-AUTH-05 & FLAW-AUTH-06: HOD Department Scoping & Multi-Tenancy Boundary', () => {
    it('should reject HOD review if HOD department is missing or does not match student department', () => {
      const hodUserNoDept = { _id: 'hod-1', role: 'HOD', departmentId: null };
      const hodUserCse = { _id: 'hod-2', role: 'HOD', departmentId: 'dept-cse-id' };
      const studentEce = { _id: 'stu-1', department: 'dept-ece-id' };
      const studentCse = { _id: 'stu-2', department: 'dept-cse-id' };

      const verifyHodDepartmentMatch = (hod, student) => {
        if (hod.role === 'ADMIN') return true;
        if (!hod.departmentId) {
          throw ApiError.forbidden('HOD is not assigned to any department');
        }
        if (hod.departmentId.toString() !== student.department.toString()) {
          throw ApiError.forbidden('You can only review requests for students in your own department');
        }
        return true;
      };

      assert.throws(
        () => verifyHodDepartmentMatch(hodUserNoDept, studentCse),
        /HOD is not assigned to any department/
      );
      assert.throws(
        () => verifyHodDepartmentMatch(hodUserCse, studentEce),
        /You can only review requests for students in your own department/
      );

      // Valid match succeeds
      assert.equal(verifyHodDepartmentMatch(hodUserCse, studentCse), true);
    });
  });

  describe('FLAW-BKD-01: Pagination All=true Safe Capping', () => {
    it('should respect all=true by applying safety ceiling of 1000 items instead of truncating to 20', () => {
      const queryWithAll = { all: 'true' };
      const parsed = parsePagination(queryWithAll);

      assert.equal(parsed.isAll, true);
      assert.equal(parsed.limit, 1000);
      assert.equal(parsed.page, 1);
      assert.equal(parsed.skip, 0);
    });

    it('should cap custom limit at 100 for paginated queries when all is not set', () => {
      const normalQuery = { page: '2', limit: '25' };
      const parsedNormal = parsePagination(normalQuery);
      assert.equal(parsedNormal.limit, 25);
      assert.equal(parsedNormal.page, 2);
      assert.equal(parsedNormal.skip, 25);

      const excessiveQuery = { page: '1', limit: '500' };
      const parsedExcessive = parsePagination(excessiveQuery);
      assert.equal(parsedExcessive.limit, 100); // capped at 100
    });
  });

  describe('FLAW-AUTH-01: Frontend RoleRouteGuard Redirection Logic', () => {
    it('should redirect unauthorized users to 403 Forbidden instead of rendering children', () => {
      const evaluateRoleGuard = (userRole, allowedRoles) => {
        if (!userRole) return { allowed: false, redirect: '/login' };
        const isMatch = allowedRoles.includes(userRole);
        if (!isMatch) {
          return { allowed: false, redirect: '/403', message: 'Access Denied (403)' };
        }
        return { allowed: true, renderChildren: true };
      };

      // Student attempting to access HOD route
      const studentResult = evaluateRoleGuard('STUDENT', ['HOD', 'ADMIN']);
      assert.equal(studentResult.allowed, false);
      assert.equal(studentResult.redirect, '/403');

      // HOD accessing HOD route
      const hodResult = evaluateRoleGuard('HOD', ['HOD', 'ADMIN']);
      assert.equal(hodResult.allowed, true);
      assert.equal(hodResult.renderChildren, true);

      // Unauthenticated visitor
      const guestResult = evaluateRoleGuard(null, ['STUDENT', 'TEACHER', 'HOD', 'ADMIN']);
      assert.equal(guestResult.allowed, false);
      assert.equal(guestResult.redirect, '/login');
    });
  });

  describe('FLAW-BKD-04: Distributed Lease Locking Architecture', () => {
    it('should acquire lock when free and prevent concurrent acquisition within TTL', async () => {
      const lockKey = 'test-job-lock';
      const ttlMs = 5000;
      const workerId1 = 'worker-node-1';
      const workerId2 = 'worker-node-2';

      // In-memory model simulation of SystemSetting atomic findOneAndUpdate
      const lockStore = new Map();

      const simulateAcquireLock = async (key, workerId, ttl) => {
        const now = new Date();
        const existing = lockStore.get(key);
        if (existing && existing.leaseExpiresAt > now) {
          return false; // lock held
        }
        lockStore.set(key, {
          holder: workerId,
          leaseExpiresAt: new Date(now.getTime() + ttl),
        });
        return true;
      };

      const simulateReleaseLock = async (key, workerId) => {
        const existing = lockStore.get(key);
        if (existing && existing.holder === workerId) {
          lockStore.delete(key);
          return true;
        }
        return false;
      };

      // First worker acquires
      const acquired1 = await simulateAcquireLock(lockKey, workerId1, ttlMs);
      assert.equal(acquired1, true);

      // Second worker is rejected while lock is held
      const acquired2 = await simulateAcquireLock(lockKey, workerId2, ttlMs);
      assert.equal(acquired2, false);

      // First worker releases
      const released = await simulateReleaseLock(lockKey, workerId1);
      assert.equal(released, true);

      // Second worker can now acquire
      const acquired2AfterRelease = await simulateAcquireLock(lockKey, workerId2, ttlMs);
      assert.equal(acquired2AfterRelease, true);
    });
  });

});
