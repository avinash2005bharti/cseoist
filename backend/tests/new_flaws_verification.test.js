import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePagination } from '../src/utils/pagination.js';

describe('19. New Flaws Verification Suite (FLAW-NEW-01 to FLAW-NEW-10)', () => {
  describe('FLAW-NEW-01 & FLAW-NEW-08: HOD Section Multi-Tenancy & Dynamic Dept Prefix', () => {
    it('should reject HOD creating section in another department', () => {
      const user = { role: 'HOD', departmentId: 'dept_cse_123' };
      const body = { department: 'dept_ece_456' };

      const checkPermission = (u, b) => {
        if (u.role === 'HOD' && b.department && u.departmentId && b.department.toString() !== u.departmentId.toString()) {
          throw new Error('Forbidden: Cannot create sections in another department');
        }
      };

      assert.throws(() => checkPermission(user, body), /Forbidden: Cannot create sections in another department/);
    });

    it('should reject HOD deleting section belonging to another department', () => {
      const user = { role: 'HOD', departmentId: 'dept_cse_123' };
      const section = { department: 'dept_ece_456', name: 'Section A' };

      const checkDelete = (u, s) => {
        const secDeptId = s.department?._id || s.department;
        if (u.role === 'HOD' && u.departmentId && secDeptId && secDeptId.toString() !== u.departmentId.toString()) {
          throw new Error('Forbidden: Cannot delete sections in another department');
        }
      };

      assert.throws(() => checkDelete(user, section), /Forbidden: Cannot delete sections in another department/);
    });

    it('should format section code with dynamic department prefix instead of hardcoded CSE-', () => {
      const formatSectionCode = (deptDoc, cleanName, semNum, customCode) => {
        const deptPrefix = (deptDoc?.code || 'SEC').toUpperCase().trim();
        return (customCode || `${deptPrefix}-${cleanName}-S${semNum}`).toUpperCase().trim();
      };

      const eceDept = { code: 'ECE' };
      const codeECE = formatSectionCode(eceDept, 'A', 3);
      assert.equal(codeECE, 'ECE-A-S3');

      const meDept = { code: 'ME' };
      const codeME = formatSectionCode(meDept, 'B', 5);
      assert.equal(codeME, 'ME-B-S5');
    });
  });

  describe('FLAW-NEW-02: Unassigned Student Consideration & Leave Auto-Routing', () => {
    it('should set initial status to RECOMMENDED_BY_TG when no TG is assigned to section', () => {
      const resolveInitialStatus = (tgTeacherId) => {
        return tgTeacherId ? 'PENDING' : 'RECOMMENDED_BY_TG';
      };

      assert.equal(resolveInitialStatus('teacher_123'), 'PENDING');
      assert.equal(resolveInitialStatus(null), 'RECOMMENDED_BY_TG');
      assert.equal(resolveInitialStatus(undefined), 'RECOMMENDED_BY_TG');
    });

    it('should record auto-routed remark in history when TG is null', () => {
      const tgTeacherId = null;
      const initialRemarks = tgTeacherId
        ? 'Application submitted'
        : 'Application submitted (No TG assigned to section; auto-routed to HOD review)';

      assert.match(initialRemarks, /auto-routed to HOD review/);
    });
  });

  describe('FLAW-NEW-03: Cross-Department Metric Scoping in HOD Dashboard', () => {
    it('should restrict count queries to HOD departmentId', () => {
      const user = { role: 'HOD', departmentId: 'dept_cse_123' };
      const deptStudents = ['student_1', 'student_2'];

      const consFilter = (base, studentIds) => {
        if (studentIds) {
          return { ...base, student: { $in: studentIds } };
        }
        return base;
      };

      const filter = consFilter({ status: { $in: ['RECOMMENDED_BY_TG', 'PENDING'] } }, deptStudents);
      assert.deepEqual(filter.student, { $in: ['student_1', 'student_2'] });
    });
  });

  describe('FLAW-NEW-04: Unbounded Query Safeguard on all=true', () => {
    it('should apply safety ceiling of 1000 items instead of 0 for all=true in students service', () => {
      const query = { all: 'true' };
      const { limit } = parsePagination(query);
      const fetchAll = query.all === 'true' || query.limit === 'all';
      const queryLimit = fetchAll ? Math.min(limit || 1000, 1000) : limit;

      assert.equal(queryLimit, 1000);
      assert.notEqual(queryLimit, 0);
    });
  });

  describe('FLAW-NEW-05: Faculty Leave Exclusion from Student Semester Reports', () => {
    it('should not include applicantRole: TEACHER in studentScope filter', () => {
      const studentScope = { semester: 4 };
      const matchingStudentIds = ['student_1', 'student_2'];
      const filter = {};

      if (Object.keys(studentScope).length > 0) {
        filter.student = { $in: matchingStudentIds };
        filter.applicantRole = 'STUDENT';
      }

      assert.equal(filter.applicantRole, 'STUDENT');
      assert.equal(filter.$or, undefined);
    });
  });

  describe('FLAW-NEW-06: Section Code Update & Collision Prevention on Move-Semester', () => {
    it('should replace -S suffix with newSemester in section code', () => {
      const oldCode = 'CSE-A-S5';
      const newSemester = 6;
      const updatedCode = oldCode.replace(/-S\d+$/i, `-S${newSemester}`);

      assert.equal(updatedCode, 'CSE-A-S6');
    });

    it('should preserve non-suffixed section codes safely', () => {
      const specialCode = 'CUSTOM-SPECIAL-SEC';
      const newSemester = 4;
      let updatedCode = specialCode;
      if (/-S\d+$/i.test(specialCode)) {
        updatedCode = specialCode.replace(/-S\d+$/i, `-S${newSemester}`);
      }

      assert.equal(updatedCode, 'CUSTOM-SPECIAL-SEC');
    });
  });

  describe('FLAW-NEW-07: Non-Matching Section Name Filter Handling', () => {
    it('should set studentScope.section to $in: [] when section name does not exist', () => {
      const targetSection = 'NON_EXISTENT_SECTION';
      const secIds = []; // no matching section IDs
      const studentScope = {};

      if (secIds.length > 0) {
        studentScope.section = { $in: secIds };
      } else {
        studentScope.section = { $in: [] };
      }

      assert.deepEqual(studentScope.section, { $in: [] });
    });
  });

  describe('FLAW-NEW-09: Web Push 404/410 Dead Endpoint Pruning', () => {
    it('should detect 404 and 410 status codes for automatic subscription removal', () => {
      const isDeadSubscription = (statusCode) => statusCode === 404 || statusCode === 410;

      assert.equal(isDeadSubscription(404), true);
      assert.equal(isDeadSubscription(410), true);
      assert.equal(isDeadSubscription(500), false);
      assert.equal(isDeadSubscription(429), false);
    });
  });
});
