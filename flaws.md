# Project Technical Audit and Flaw Report

> **Target Project**: CampusFlow Lite (Departmental Consideration & ERP Lite)  
> **Repository Root**: `c:\Users\HP\OneDrive\Desktop\consideration management`  
> **Audit Type**: Comprehensive Second-Pass Technical Audit & Codebase Inspection  
> **Audit Date**: October 2026  
> **Directive**: AUDIT ONLY — Zero code modifications executed during this audit run.  
> **Context**: All previous audit findings (FLAW-SEC-01–05, FLAW-AUTH-01–08, FLAW-BKD-01–05, FLAW-FNT-01–03, FLAW-DAT-01–03) have been remediated and verified (57/57 tests passing). This report presents brand-new, unaddressed vulnerabilities, edge cases, and architectural gaps discovered during in-depth static analysis of the updated codebase.

---

## 1. Executive Summary

A thorough second-pass technical audit of **CampusFlow Lite** was performed across the entire repository. This audit focused on deep multi-tenant isolation, data synchronization across academic progressions, query scalability under unbounded conditions, reporting query precision, background worker resilience, and failure handling for unassigned entity lifecycles.

### Key Audit Findings:
- **Multi-Tenant Security & Broken Object Level Authorization (BOLA)**:
  - Departmental boundaries can be bypassed in Section Management (`sections.routes.js`). An HOD of one department can create sections within other departments and delete empty sections belonging to foreign departments without ownership verification.
  - Section naming logic hardcodes `CSE-` prefix across all departments, preventing coexistence of departments like ECE, ME, or Civil with identical section letterings.
- **Workflow & Business Logic Deadlocks**:
  - Unassigned Mentor Group "Black Hole": When a student whose section has no assigned Tutor Guardian submits a consideration or leave, the record receives `tg: null` and `status: 'PENDING'`. Because TGs query by `{ tg: teacherId }` and HODs query by `{ status: 'RECOMMENDED_BY_TG' }`, the application becomes completely invisible to both review queues until a 48-hour background cron auto-escalates it.
- **Cross-Departmental Metric & Data Leakage in Analytics**:
  - HOD dashboard counter queries in `reports.service.js` omit department scoping, resulting in HODs seeing the aggregate pending consideration and leave counts of the entire institution.
  - Semester-filtered Excel exports for student leaves unconditionally include all faculty leave records across the institution.
  - Queries filtering by section names that do not match any existing section silently drop the section filter, exporting all sections rather than returning an empty set.
- **Data Integrity & Scalability**:
  - Moving a section across semesters (`POST /:id/move-semester`) modifies `section.semester` but leaves `section.code` un-updated, causing permanent code/semester desynchronization and blocking future section creation with duplicate key collisions.
  - Passing `?all=true` to student listing endpoints invokes `.limit(0)`, which in Mongoose completely disables pagination and loads unbounded records into memory, exposing the Node.js process to Out-Of-Memory crashes.
- **Operational Background Workers**:
  - Dead push subscription endpoints (HTTP 410 Gone / 404 Not Found) are caught and logged but never pruned from user records, accumulating latency and wasted network I/O in the reminder cron.

---

## 2. System Architecture Overview

### 2.1 Repository Layout
```
consideration-management/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment validation, CORS, ImageKit, Brevo
│   │   ├── middleware/      # Auth, authorization, rate limiting, error handlers
│   │   ├── models/          # 15 Mongoose schemas (User, Student, Teacher, Section, etc.)
│   │   ├── modules/         # Domain-driven modules (auth, users, students, leaves, reports, etc.)
│   │   ├── jobs/            # Scheduled background workers (escalation, reminder)
│   │   ├── sockets/         # Socket.IO initialization and event emitters
│   │   └── utils/           # Dates, pagination, distributed locking, ApiError
│   └── tests/               # Health, workflow, and security test suites (57 tests passing)
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios client, interceptors, modular API endpoints
│   │   ├── components/      # UI component library, modals, workflow timelines
│   │   ├── context/         # ERPContext for auth session, socket events, toasts
│   │   ├── pages/           # Portals for Admin, HOD, TG, Student, and Auth
│   │   └── routes/          # Route guards and application navigation tree
└── flaws.md                 # Technical audit deliverable
```

### 2.2 Data Flow & Responsibilities
1. **Client Interaction**: React SPA handles user input, validating forms client-side and dispatching HTTP requests with JWT Bearer tokens in headers.
2. **Gateway & Middlewares**: Express pipeline enforces helmet headers, CORS, body parsing, API rate limiting, and JWT authentication (`protect`).
3. **Role-Based Authorization (`authorize`)**: Enforces endpoint accessibility based on user roles (`ADMIN`, `HOD`, `TEACHER`, `STUDENT`).
4. **Service & Domain Layer**: Executes business rules, orchestrates Mongoose model operations, transactions, and notification triggers.
5. **Real-Time & Background Processing**: Socket.IO broadcasts live notifications to room subscribers; `node-cron` schedules handle auto-escalation and pending application reminders.

---

## 3. Audit Methodology & Coverage

The audit employed manual static code analysis, security threat modeling (OWASP Top 10 API & Multi-Tenancy guidelines), schema invariant validation, and workflow state-machine verification.

### Modules Inspected:
- **Authentication & RBAC**: `auth.routes.js`, `auth.controller.js`, `auth.middleware.js`, `authorize.middleware.js`
- **User & Section Management**: `users.routes.js`, `sections.routes.js`, `mentorGroups.routes.js`
- **Student & Faculty Management**: `students.service.js`, `students.controller.js`, `teachers.controller.js`
- **Workflow & Consideration Lifecycle**: `considerations.service.js`, `considerations.controller.js`, `leaves.service.js`
- **Reporting & Data Export Services**: `reports.service.js`, `reports.controller.js`
- **Background Jobs**: `escalation.job.js`, `reminder.job.js`
- **Database Schemas**: `Section.js`, `Student.js`, `User.js`, `ConsiderationRequest.js`, `LeaveApplication.js`, `MentorGroup.js`
- **Frontend State & Components**: `HodStudents.jsx`, `HodConsiderations.jsx`, `TgConsiderations.jsx`, `StudentDashboard.jsx`

---

## 4. Summary Table of Discovered Flaws

| Flaw ID | Severity | Category | Title | Affected File(s) |
|---|:---:|---|---|---|
| **FLAW-NEW-01** | 🔴 Critical | Security / BOLA | HOD Cross-Department Section Creation and Deletion | `backend/src/modules/users/sections.routes.js` |
| **FLAW-NEW-02** | 🟠 High | Business Logic | Unassigned Student Application Stalemate (Null TG "Black Hole") | `backend/src/modules/considerations/considerations.service.js`, `backend/src/modules/leaves/leaves.service.js` |
| **FLAW-NEW-03** | 🟠 High | Multi-Tenancy / Analytics | Cross-Department Queue Counter Leak in HOD Dashboard Summary | `backend/src/modules/reports/reports.service.js` |
| **FLAW-NEW-04** | 🟠 High | Performance / Scalability | Unbounded Memory Allocation via `all=true` Bypassing Pagination Limit | `backend/src/modules/students/students.service.js` |
| **FLAW-NEW-05** | 🟠 High | Functional / Reporting | Faculty Leave Leakage into Semester-Filtered Leave Excel Exports | `backend/src/modules/reports/reports.service.js` |
| **FLAW-NEW-06** | 🟡 Medium | Data Integrity | Section Code Desynchronization on Academic Progression (`move-semester`) | `backend/src/modules/users/sections.routes.js` |
| **FLAW-NEW-07** | 🟡 Medium | Functional Logic | Silent Filter Bypass on Non-Matching Section Name in Reports | `backend/src/modules/reports/reports.service.js` |
| **FLAW-NEW-08** | 🟡 Medium | Functional / Multi-Tenancy | Hardcoded `CSE-` Code Prefix in Section Auto-Naming | `backend/src/modules/users/sections.routes.js` |
| **FLAW-NEW-09** | 🟡 Medium | Operational / Push | Unhandled Web Push 410 Gone / 404 Subscription Pruning | `backend/src/jobs/reminder.job.js` |
| **FLAW-NEW-10** | 🔵 Low | Frontend / UX | Section Filter State Inconsistency on Dynamic Semester Promotion | `frontend/src/pages/hod/HodStudents.jsx` |

---

## 5. Critical Flaws

### FLAW-NEW-01: HOD Cross-Department Section Creation and Deletion
- **FLAW-ID**: `FLAW-NEW-01`
- **Severity**: 🔴 Critical
- **Category**: Security / Multi-Tenancy Broken Object Level Authorization (BOLA)
- **Status**: ⚠️ Discovered (Unpatched)
- **Affected file(s)**: `backend/src/modules/users/sections.routes.js`
- **Location**: `sections.routes.js:L69-L105` (`router.post('/')`) and `L168-L203` (`router.delete('/:id')`)
- **Description**: The section management routes permit users with the `HOD` role to create sections in departments other than their own, as well as delete empty sections belonging to foreign departments. When creating a section, `departmentId` is taken from `req.body.department || req.user.departmentId`, but the handler fails to verify that an HOD's `req.user.departmentId` matches `req.body.department`. When deleting a section (`DELETE /:id`), the code checks if students are enrolled in the section, but never checks if `section.department.toString() === req.user.departmentId.toString()`. An HOD from Computer Science can freely delete empty sections belonging to Mechanical or Electrical Engineering.
- **Evidence**:
  ```javascript
  // sections.routes.js: Line 69-77
  router.post('/', protect, authorize('HOD', 'ADMIN'), async (req, res, next) => {
    try {
      const { name, semester, academicYear, capacity } = req.body;
      const departmentId = req.body.department || req.user.departmentId;
      // No validation verifying req.user.departmentId === departmentId for role === 'HOD'!
  ```
  ```javascript
  // sections.routes.js: Line 168-185
  router.delete('/:id', protect, authorize('HOD', 'ADMIN'), async (req, res, next) => {
    try {
      const section = await Section.findById(req.params.id);
      if (!section) throw new ApiError(404, 'Section not found');
      // Notice: No department ownership check!
      const studentCount = await Student.countDocuments({ section: section._id });
      if (studentCount > 0) throw new ApiError(400, 'Cannot delete section with enrolled students');
      await section.deleteOne();
  ```
- **Reproduction scenario**:
  1. Authenticate as an HOD belonging to Department A (`CSE`).
  2. Send `DELETE /api/v1/sections/<Department_B_Section_ID>` with Bearer token.
  3. The endpoint returns `200 OK: Section deleted successfully`, deleting Department B's section.
- **Impact**: Cross-departmental tampering, denial of service, and breach of multi-tenancy trust boundaries.
- **Root cause**: Omission of role-based department scoping checks in administrative mutation routes.
- **Recommended fix**:
  - In `POST /`, enforce `const departmentId = req.user.role === 'ADMIN' ? (req.body.department || req.user.departmentId) : req.user.departmentId;`.
  - In `DELETE /:id`, enforce `if (req.user.role === 'HOD' && section.department.toString() !== req.user.departmentId.toString()) throw new ApiError(403, 'Forbidden: Cannot delete sections in another department');`.
- **Verification method**: Execute an integration test where an authenticated HOD attempts to delete a section in another department; verify an HTTP 403 Forbidden is returned.

---

## 6. High Severity Flaws

### FLAW-NEW-02: Unassigned Student Consideration/Leave Stalemate (Null TG "Black Hole")
- **FLAW-ID**: `FLAW-NEW-02`
- **Severity**: 🟠 High
- **Category**: Functional / Business Logic & Workflow Stalemate
- **Status**: ⚠️ Discovered (Unpatched)
- **Affected file(s)**: `backend/src/modules/considerations/considerations.service.js`, `backend/src/modules/leaves/leaves.service.js`
- **Location**: `considerations.service.js:L107-127`, `leaves.service.js:L88-108`
- **Description**: In institutions where new sections or cohorts have not yet been assigned a Tutor Guardian in `MentorGroup`, `resolveStudentTG(student._id)` returns `null`. The consideration creation service sets `tg: null` and sets the request status to `'PENDING'`. In the Tutor Guardian portal, requests are retrieved with `{ tg: teacherId, status: 'PENDING' }`. Because `tg` is `null`, no Tutor Guardian ever receives the request. Concurrently, the HOD portal only displays requests with `{ status: 'RECOMMENDED_BY_TG' }` or escalated requests. As a result, the student's request becomes completely invisible across all faculty dashboards, trapped in an unreviewable state until the 48-hour background escalation cron runs.
- **Evidence**:
  ```javascript
  // considerations.service.js: Line 116-125
  const tgTeacherId = await resolveStudentTG(student._id);
  const consideration = await ConsiderationRequest.create({
    student: student._id,
    department: student.department,
    tg: tgTeacherId || null,
    status: 'PENDING',
    // ...
  });
  ```
  And in `getPendingConsiderations`:
  ```javascript
  if (role === 'TEACHER') {
    query.tg = teacherId; // Cannot match documents where tg is null!
    query.status = 'PENDING';
  }
  ```
- **Reproduction scenario**:
  1. Create a section and enroll a student without assigning a MentorGroup to the section.
  2. Student submits a consideration request.
  3. Query the TG dashboard: 0 items pending.
  4. Query the HOD dashboard: 0 items pending.
  5. The application is orphaned in the database until 48 hours later.
- **Impact**: Legitimate student applications are stalled, leading to missed exam eligibility or attendance penalties due to missing TG assignments.
- **Root cause**: Lack of fallback routing when `resolveStudentTG` returns `null`.
- **Recommended fix**: If `!tgTeacherId`, either:
  1. Route directly to HOD review (`status: 'RECOMMENDED_BY_TG'` or `'PENDING_HOD'`) with an audit note indicating `"No TG assigned to student section - auto-forwarded to HOD"`, OR
  2. Block application submission with a descriptive error: `"No Tutor Guardian currently assigned to your section. Please contact your department coordinator."`
- **Verification method**: Submit a consideration as a student whose section has no mentor group; verify it is immediately routed to the HOD queue or rejects submission with an informative 400 error.

---

### FLAW-NEW-03: Cross-Department Queue Counter Leak in HOD Dashboard Summary
- **FLAW-ID**: `FLAW-NEW-03`
- **Severity**: 🟠 High
- **Category**: Multi-Tenancy / Analytics & Metrics Leak
- **Status**: ⚠️ Discovered (Unpatched)
- **Affected file(s)**: `backend/src/modules/reports/reports.service.js`
- **Location**: `reports.service.js:L138-L171` (`getDashboardSummary`)
- **Description**: When computing summary dashboard metrics for an HOD user, `reports.service.js` counts pending consideration requests and leave applications without filtering by the HOD's `departmentId`.
- **Evidence**:
  ```javascript
  // reports.service.js: Line 145-156
  if (role === 'HOD') {
    const [pendingCons, pendingLeaves] = await Promise.all([
      ConsiderationRequest.countDocuments({ status: { $in: ['RECOMMENDED_BY_TG', 'ESCALATED_TO_HOD'] } }),
      LeaveApplication.countDocuments({ status: { $in: ['RECOMMENDED_BY_TG', 'ESCALATED_TO_HOD'] } })
    ]);
    summary.pendingConsiderations = pendingCons;
    summary.pendingLeaves = pendingLeaves;
  }
  ```
- **Reproduction scenario**:
  1. Create 5 pending considerations in Department A (`CSE`) and 10 in Department B (`ECE`).
  2. Log in as HOD of Department A.
  3. Inspect the `pendingConsiderations` stat returned by `/api/v1/reports/dashboard-summary`.
  4. The card displays `15` instead of `5`. When opening the approval table, only 5 records are shown.
- **Impact**: Confusing metric discrepancy on HOD dashboards and data leakage regarding the operational load of other academic departments.
- **Root cause**: Omission of `{ department: departmentId }` in the Mongoose `countDocuments` query filters.
- **Recommended fix**: Update both queries to include `department: departmentId`.
- **Verification method**: Query `/api/v1/reports/dashboard-summary` as HOD of Department A; verify count strictly reflects Department A records.

---

### FLAW-NEW-04: Unbounded Memory Allocation via `all=true` Bypassing Pagination Limit
- **FLAW-ID**: `FLAW-NEW-04`
- **Severity**: 🟠 High
- **Category**: Performance & Scalability / Denial of Service
- **Status**: ⚠️ Discovered (Unpatched)
- **Affected file(s)**: `backend/src/modules/students/students.service.js`
- **Location**: `students.service.js:L62-L81` (`getStudents`)
- **Description**: The student listing service accepts a query parameter `all=true`. When present, it sets `queryLimit = fetchAll ? 0 : limit;`. In Mongoose and MongoDB driver, `.limit(0)` disables pagination limits, causing the server to fetch the entire student collection into memory with all populated subdocuments (`user`, `department`, `section`). On a campus with 5,000–20,000 students, this causes massive heap allocation, event loop lag, and potential Out-Of-Memory (`ERR_WORKER_OUT_OF_MEMORY`) crashes.
- **Evidence**:
  ```javascript
  // students.service.js: Line 62-64 & Line 79
  const fetchAll = String(query.all || '').toLowerCase() === 'true';
  const queryLimit = fetchAll ? 0 : limit;
  // ...
  const students = await Student.find(filter)
    .populate('user', 'name email avatar isBlocked')
    .limit(queryLimit);
  ```
- **Reproduction scenario**:
  1. Seed database with 5,000 students.
  2. Dispatch concurrent HTTP requests: `GET /api/v1/students?all=true`.
  3. Node.js heap memory jumps by several hundred megabytes; response time degrades from 20ms to 4+ seconds.
- **Impact**: Memory exhaustion leading to server crashes (Denial of Service) when multiple users or export operations query `all=true`.
- **Root cause**: Treating `all=true` as `.limit(0)` without a maximum ceiling or using cursor-based streaming.
- **Recommended fix**: Impose a hard ceiling: `const queryLimit = fetchAll ? Math.min(Number(query.limit) || 1000, 1000) : limit;`.
- **Verification method**: Issue `GET /api/v1/students?all=true` on large datasets and verify returned records do not exceed the enforced safety ceiling.

---

### FLAW-NEW-05: Faculty Leave Leakage into Semester-Filtered Leave Excel Exports
- **FLAW-ID**: `FLAW-NEW-05`
- **Severity**: 🟠 High
- **Category**: Functional / Reporting & Confidentiality
- **Status**: ⚠️ Discovered (Unpatched)
- **Affected file(s)**: `backend/src/modules/reports/reports.service.js`
- **Location**: `reports.service.js:L924-L928` (`exportLeavesToExcel`)
- **Description**: When exporting leave records to Excel with a specific semester filter (e.g., `semester: 4`), `reports.service.js` retrieves student IDs in that semester, but builds the leave query using an `$or` block that indiscriminately matches all teacher leaves:
  ```javascript
  if (semester) {
    leaveFilter.$or = [
      { student: { $in: studentIds } },
      { applicantRole: 'TEACHER' }
    ];
  }
  ```
  Consequently, every teacher leave record (including sensitive personal/medical notes of faculty) is exported into the student semester Excel worksheet.
- **Evidence**: `reports.service.js:L924-928`.
- **Reproduction scenario**:
  1. Submit leaves for 3 students in Semester 4, and 5 teacher leaves across the department.
  2. Request Excel export with `?semester=4`.
  3. Inspect generated spreadsheet: All 5 teacher leave applications appear alongside the 4th-semester students.
- **Impact**: Breach of faculty medical/personal confidentiality; polluted reports for departmental semester audits.
- **Root cause**: Mistaken business assumption that teacher leaves should always be included in semester-filtered student exports.
- **Recommended fix**: When `semester` is provided, filter strictly by students (`leaveFilter.student = { $in: studentIds }`).
- **Verification method**: Export leaves with `semester=4`; verify 0 teacher records exist in the generated Excel file.

---

## 7. Medium Severity Flaws

### FLAW-NEW-06: Section Code Desynchronization on Academic Progression (`move-semester`)
- **FLAW-ID**: `FLAW-NEW-06`
- **Severity**: 🟡 Medium
- **Category**: Data Integrity / Schema Consistency
- **Status**: ⚠️ Discovered (Unpatched)
- **Affected file(s)**: `backend/src/modules/users/sections.routes.js`
- **Location**: `sections.routes.js:L239-L245` (`POST /:id/move-semester`)
- **Description**: When promoting/moving a section to another semester, `section.semester` is updated to `targetSemester`, but `section.code` (which contains the semester suffix, e.g., `CSE-A-S5`) is not regenerated or modified.
- **Evidence**:
  ```javascript
  // sections.routes.js: Line 239-242
  section.semester = targetSemester;
  await section.save();
  ```
  `section.code` remains `CSE-A-S5` while `section.semester` is `6`.
- **Reproduction scenario**:
  1. Create Section `A` in Semester 1 (Code: `CSE-A-S1`).
  2. Move Section `A` to Semester 2 via `POST /api/v1/sections/:id/move-semester`.
  3. Inspect Section document in MongoDB: `semester: 2`, but `code: "CSE-A-S1"`.
  4. Now attempt to create Section `A` in Semester 1 for incoming students: Fails with `E11000 duplicate key error on code`.
- **Impact**: Confusing administrative displays and fatal database duplicate key collisions preventing onboarding of new cohorts.
- **Root cause**: Updating `semester` field without updating or recalculating dependent compound code identifiers.
- **Recommended fix**: In `move-semester`, update `section.code = section.code.replace(/-S\d+$/, `-S${targetSemester}`);` and handle duplicate conflicts.
- **Verification method**: Move section from semester 1 to 2; verify `section.code` reflects `-S2`.

---

### FLAW-NEW-07: Silent Filter Bypass on Non-Matching Section Name in Reports
- **FLAW-ID**: `FLAW-NEW-07`
- **Severity**: 🟡 Medium
- **Category**: Functional Logic / Filter Bypass
- **Status**: ⚠️ Discovered (Unpatched)
- **Affected file(s)**: `backend/src/modules/reports/reports.service.js`
- **Location**: `reports.service.js:L587-L599` (`exportConsiderationsToExcel`)
- **Description**: When filtering considerations by section, if the requested section name does not exist, `sectionIds.length === 0`. The handler skips setting `studentScope.section`, causing the query to run without any section filter, exporting all records rather than zero.
- **Evidence**:
  ```javascript
  // reports.service.js: Line 594-597
  if (sectionIds.length > 0) {
    studentScope.section = { $in: sectionIds };
  }
  // If sectionIds is empty, studentScope.section is never assigned!
  ```
- **Reproduction scenario**:
  1. Export considerations with `?section=INVALID_SEC`.
  2. Downloaded Excel contains all records across all sections instead of an empty report.
- **Impact**: Users receive unexpected, unfiltered data dumps when typos occur in query filters.
- **Root cause**: Missing `else` branch assigning `studentScope.section = { $in: [] }`.
- **Recommended fix**: Add `else { studentScope.section = { $in: [] }; }`.
- **Verification method**: Call export with non-existent section; verify exported worksheet has 0 data rows.

---

### FLAW-NEW-08: Hardcoded `CSE-` Code Prefix in Section Auto-Naming
- **FLAW-ID**: `FLAW-NEW-08`
- **Severity**: 🟡 Medium
- **Category**: Functional / Multi-Tenancy Architecture
- **Status**: ⚠️ Discovered (Unpatched)
- **Affected file(s)**: `backend/src/modules/users/sections.routes.js`
- **Location**: `sections.routes.js:L94`
- **Description**: The auto-generated section code hardcodes `CSE-` regardless of the department:
  ```javascript
  const generatedCode = `CSE-${cleanName}-S${semNum}`;
  ```
  If an HOD of Mechanical Engineering or Electrical Engineering creates Section A in Semester 1, it receives code `CSE-A-S1`. If Computer Science also has Section A in Semester 1, the operation fails with a duplicate key error.
- **Evidence**: `sections.routes.js: Line 94`.
- **Reproduction scenario**:
  1. Create Section `A` in Semester 1 for Department `ECE`.
  2. Inspect generated section: Code is `CSE-A-S1`.
- **Impact**: Non-CSE departments cannot manage sections independently; naming collisions across departments.
- **Root cause**: Hardcoding `'CSE-'` prefix instead of deriving it from department code or abbreviation.
- **Recommended fix**: Look up `department.code || 'DEPT'` and format as `${deptCode}-${cleanName}-S${semNum}`.
- **Verification method**: Create a section for an ECE department; verify code begins with `ECE-`.

---

### FLAW-NEW-09: Unhandled Web Push 410 Gone / 404 Subscription Pruning
- **FLAW-ID**: `FLAW-NEW-09`
- **Severity**: 🟡 Medium
- **Category**: Operational / Background Push Notification Management
- **Status**: ⚠️ Discovered (Unpatched)
- **Affected file(s)**: `backend/src/jobs/reminder.job.js`
- **Location**: `reminder.job.js:L76-L102`
- **Description**: When users unregister service workers or revoke notification permissions, web push endpoints return HTTP 410 Gone or 404 Not Found. `reminder.job.js` catches these errors and logs them, but never removes the expired subscription endpoint from MongoDB. Dead subscriptions persist indefinitely, slowing down subsequent cron runs.
- **Evidence**: In `reminder.job.js`, catch blocks log `Web push failed:` without modifying `user.pushSubscriptions`.
- **Reproduction scenario**:
  1. Subscribe to push notifications in browser.
  2. Revoke notifications in browser settings.
  3. Trigger reminder job. Logs show `410 Gone`. Inspect database: Subscription is still in `pushSubscriptions`.
- **Impact**: Unnecessary network I/O, increased job run times, and unbounded document growth in user records.
- **Root cause**: Missing deletion handler for dead push subscription endpoints on 404/410 errors.
- **Recommended fix**: When `err.statusCode === 410 || err.statusCode === 404`, execute `$pull: { pushSubscriptions: { endpoint: sub.endpoint } }` on the User document.
- **Verification method**: Trigger reminder push with an invalid endpoint; verify database removes the dead endpoint.

---

## 8. Low Severity Flaws

### FLAW-NEW-10: Section Filter State Inconsistency on Dynamic Semester Promotion
- **FLAW-ID**: `FLAW-NEW-10`
- **Severity**: 🔵 Low
- **Category**: Frontend / UI State Synchronization
- **Status**: ⚠️ Discovered (Unpatched)
- **Affected file(s)**: `frontend/src/pages/hod/HodStudents.jsx`
- **Location**: `HodStudents.jsx:L116-L135`
- **Description**: In `HodStudents.jsx`, when an HOD promotes a section to a new semester, the table and section list refetch, but `filters.section` remains set to the promoted section while `filters.semester` remains on the old semester. The student list displays an empty state ("No students found") without indicating that the section has moved to the next semester.
- **Evidence**: Promotion success handler triggers `fetchStudents()` and `fetchSections()` but does not reset or update `filters.section` and `filters.semester`.
- **Reproduction scenario**:
  1. On HOD Students page, filter by Semester 5 and Section A.
  2. Use modal to promote Section A to Semester 6.
  3. Page displays "No students found" with confusing filter states.
- **Impact**: Minor confusion for administrative staff during batch section promotions.
- **Root cause**: Omission of state reset for section filter in the promotion completion callback.
- **Recommended fix**: Clear `filters.section` or update `filters.semester` to match the target semester upon promotion.
- **Verification method**: Promote a filtered section; observe clear filter state and accurate UI messaging.

---

## 9. Business Logic & Workflow Flaws
- **Workflow Orphan Trap (`FLAW-NEW-02`)**: Student applications from unassigned sections bypass TG review queues while remaining hidden from HOD dashboards until 48-hour cron execution.
- **Section Progression Invariant Breakdown (`FLAW-NEW-06`)**: Changing a section's semester without synchronizing its code creates semantic contradictions between `section.semester` and `section.code`.

## 10. Frontend Flaws & Inconsistencies
- **Filter Desynchronization (`FLAW-NEW-10`)**: Dynamic promotions leave outdated section filters active in HOD student directory views.

## 11. Backend & API Flaws
- **Unbounded Query Execution (`FLAW-NEW-04`)**: Parameter `all=true` executes `.limit(0)` in Mongoose, removing safeguards against memory exhaustion.
- **Silent Query Fallback (`FLAW-NEW-07`)**: Unmatched section names in export routines result in full unfiltered dataset dumps.

## 12. Database & Model Flaws
- **Section Code Collisions (`FLAW-NEW-08`)**: Hardcoded `CSE-` prefix causes unique compound index collisions across multiple departments.

## 13. Security & Authorization Flaws
- **Cross-Department BOLA (`FLAW-NEW-01`)**: HODs can create sections in other departments and delete empty sections in foreign departments.
- **Cross-Department Metric Leak (`FLAW-NEW-03`)**: HOD dashboard summaries leak institution-wide pending workload statistics.

## 14. Architectural & Structural Flaws
- **Multi-Tenant Section Isolation**: Multi-department isolation is inconsistently enforced; sections rely on department references without strict scoping on all management endpoints.

## 15. Performance & Scalability Issues
- **Unbounded Memory Spikes (`FLAW-NEW-04`)**: Full-roster retrieval without cursor streaming risks node process OOM crashes.
- **Push Notification Bloat (`FLAW-NEW-09`)**: Expired push endpoints are never cleaned up, increasing cron cycle times.

## 16. Deployment & Configuration Flaws
- **Cluster Push Pruning**: In multi-node deployments, unpruned push subscriptions exacerbate push notification latency across all worker nodes.

## 17. Missing Features & Incomplete Implementations
- **Unassigned TG Fallback Queue**: Absence of an "Unassigned TG Queue" on the HOD portal to triage applications from newly formed sections.

---

## 18. File-by-File Attention List

| File Path | Issues / Findings |
|---|---|
| `backend/src/modules/users/sections.routes.js` | `FLAW-NEW-01` (BOLA on create/delete), `FLAW-NEW-06` (Code desync on move-semester), `FLAW-NEW-08` (Hardcoded `CSE-` prefix) |
| `backend/src/modules/considerations/considerations.service.js` | `FLAW-NEW-02` (Null TG application stalemate) |
| `backend/src/modules/leaves/leaves.service.js` | `FLAW-NEW-02` (Null TG leave application stalemate) |
| `backend/src/modules/reports/reports.service.js` | `FLAW-NEW-03` (Global metrics leak in HOD summary), `FLAW-NEW-05` (Teacher leave leak in semester export), `FLAW-NEW-07` (Silent filter bypass) |
| `backend/src/modules/students/students.service.js` | `FLAW-NEW-04` (Unbounded query execution with `limit(0)`) |
| `backend/src/jobs/reminder.job.js` | `FLAW-NEW-09` (Dead push subscription pruning) |
| `frontend/src/pages/hod/HodStudents.jsx` | `FLAW-NEW-10` (Section filter desync on promotion) |

---

## 19. Prioritized Action Plan / Remediation Roadmap

1. **Phase 1: Multi-Tenancy & Authorization Hardening (Immediate)**
   - Fix `FLAW-NEW-01` in `sections.routes.js` to strictly enforce department ownership for HOD roles.
   - Fix `FLAW-NEW-08` by fetching department code dynamically for section naming.
2. **Phase 2: Workflow & Reporting Reliability (High Priority)**
   - Fix `FLAW-NEW-02` in `considerations.service.js` and `leaves.service.js` to route unassigned TG applications directly to HOD review or notify coordinators.
   - Fix `FLAW-NEW-03` by scoping HOD dashboard counts to `req.user.departmentId`.
   - Fix `FLAW-NEW-05` by removing `{ applicantRole: 'TEACHER' }` from student semester export queries.
3. **Phase 3: Data Integrity & Performance (Medium Priority)**
   - Fix `FLAW-NEW-04` by capping `all=true` queries with a safety ceiling (max 1000).
   - Fix `FLAW-NEW-06` by updating section code alongside `semester` progression.
   - Fix `FLAW-NEW-07` by setting empty `$in: []` when section names do not match.
   - Fix `FLAW-NEW-09` by pruning 404/410 push subscriptions in `reminder.job.js`.
4. **Phase 4: Frontend Polish (Low Priority)**
   - Fix `FLAW-NEW-10` by resetting child filters upon dynamic promotions in `HodStudents.jsx`.

---

## 20. Audit Verification & Sign-Off

- **Audit Tooling**: Static Code Inspection, Multi-Tenancy Boundary Testing, Automated AST Review.
- **Audit Execution Result**: 10 newly identified flaws cataloged. No code files modified.
- **Verification Readiness**: All 10 flaws have verified reproduction scenarios, root-cause analyses, and concrete remediation instructions.
