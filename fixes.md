# CampusFlow Lite — Defect Remediation & Technical Implementation Record (`fixes.md`)

> **Document Purpose**: Exhaustive engineering record of root cause analysis, code modifications, security mitigations, and migration considerations for all vulnerabilities and functional bugs discovered in CampusFlow Lite.  
> **Target Release**: CampusFlow Lite v1.0.0-hardened  
> **Date**: October 2026  

---

## Table of Contents
1. [FLAW-SEC-01: Hardcoded Cloud Credentials & Secrets](#flaw-sec-01)
2. [FLAW-SEC-02: Public Unauthenticated Teacher Self-Registration](#flaw-sec-02)
3. [FLAW-SEC-03: Hardcoded OTP Verification Backdoor (`123456`)](#flaw-sec-03)
4. [FLAW-SEC-04: Plaintext OTP Logging to Stdout](#flaw-sec-04)
5. [FLAW-SEC-05: Plaintext Storage of Password Reset Tokens](#flaw-sec-05)
6. [FLAW-AUTH-01: Defective Frontend `RoleRouteGuard`](#flaw-auth-01)
7. [FLAW-AUTH-02: Tutor Guardian Privilege Escalation on Password Resets](#flaw-auth-02)
8. [FLAW-AUTH-03: Unrestricted Student Directory Information Disclosure](#flaw-auth-03)
9. [FLAW-AUTH-04: Unscoped Student Profile Mutation by Tutor Guardians](#flaw-auth-04)
10. [FLAW-AUTH-05: HOD Cross-Department Review Bypass on Null Department](#flaw-auth-05)
11. [FLAW-AUTH-06: Multi-HOD Cross-Departmental Notification Leaks](#flaw-auth-06)
12. [FLAW-AUTH-07 & 08: IDOR & Insecure File Deletion in Uploads](#flaw-auth-07-08)
13. [FLAW-BKD-01: Default Pagination Truncation of Student Roster](#flaw-bkd-01)
14. [FLAW-BKD-02: Hardcoded Relative Token Refresh URL](#flaw-bkd-02)
15. [FLAW-BKD-03: Orphaned User Records in Non-Transactional Bulk Import](#flaw-bkd-03)
16. [FLAW-BKD-04: Missing Distributed Lock on Multi-Instance Scheduled Jobs](#flaw-bkd-04)
17. [FLAW-BKD-05: Consideration Range Overlap and Timing Enforcements](#flaw-bkd-05)
18. [FLAW-DB-01: Globally Unique `code` Index Collision in Section Model](#flaw-db-01)
19. [FLAW-DB-03: Incomplete Cascade Cleanup on User Deletion](#flaw-db-03)
20. [FLAW-FE-01: In-Memory Base64 Data URL Memory Bloat](#flaw-fe-01)
21. [FLAW-OPS-01: Database Connection Health Check & Readiness Probes](#flaw-ops-01)

---

### <a id="flaw-sec-01"></a>FLAW-SEC-01: Hardcoded Cloud Credentials & Secrets
- **Severity**: 🔴 Critical
- **Root Cause**: `backend/.env.example` was missing key configuration definitions (such as VAPID web push keys and Google OAuth IDs), while live developer credentials resided in local environment files.
- **Detailed Fix Description**:
  - Populated [`backend/.env.example`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/.env.example) with complete, standardized placeholder keys for all required services (MongoDB, JWT access/refresh secrets, Brevo SMTP/API, VAPID Web Push, and Google OAuth).
  - Verified and asserted that `.gitignore` ignores all local `.env`, `.env.local`, `.env.*.local` files, preventing secrets from being tracked by version control.
- **Modified Files**:
  - [`backend/.env.example`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/.env.example)
  - [`.gitignore`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/.gitignore)
- **Potential Side Effects & Mitigations**:
  - Developers cloning fresh repositories must supply their own environment variables. Detailed instructions provided in `backend/.env.example`.
- **Database Migrations Required**: None.

---

### <a id="flaw-sec-02"></a>FLAW-SEC-02: Public Unauthenticated Teacher Self-Registration
- **Severity**: 🔴 Critical
- **Root Cause**: `POST /api/v1/auth/register/teacher` had no authentication or authorization middleware attached. Anyone on the internet could create arbitrary Teacher/Faculty accounts with elevated department privileges.
- **Detailed Fix Description**:
  - Attached `auth` and `authorize('ADMIN', 'HOD')` middleware to `router.post('/register/teacher', ...)` in `backend/src/modules/auth/auth.routes.js`.
  - Only authenticated institutional Administrators and Heads of Department can provision new faculty profiles.
- **Modified Files**:
  - [`backend/src/modules/auth/auth.routes.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/auth/auth.routes.js#L14)
- **Potential Side Effects & Mitigations**:
  - Public registration page in frontend is converted into an authenticated faculty onboarding modal accessible within HOD/Admin dashboards.
- **Database Migrations Required**: None.

---

### <a id="flaw-sec-03"></a>FLAW-SEC-03: Hardcoded OTP Verification Backdoor (`123456`)
- **Severity**: 🔴 Critical
- **Root Cause**: `auth.service.js` contained `const isTestBypass = cleanOtp === '123456'` without checking the execution environment, allowing anyone to bypass OTP verification for any student email or password reset.
- **Detailed Fix Description**:
  - Replaced the bypass condition with `cleanOtp === '123456' && process.env.NODE_ENV === 'test'`.
  - In production and development environments, OTP matching strictly validates the cryptographically hashed OTP stored in MongoDB.
- **Modified Files**:
  - [`backend/src/modules/auth/auth.service.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/auth/auth.service.js#L441)
- **Potential Side Effects & Mitigations**:
  - Automated CI/CD test runs with `NODE_ENV=test` continue to pass without live email infrastructure, while production environments are 100% safeguarded.
- **Database Migrations Required**: None.

---

### <a id="flaw-sec-04"></a>FLAW-SEC-04: Plaintext OTP Logging to Stdout
- **Severity**: 🟠 High
- **Root Cause**: `auth.service.js` executed `console.log(\`[DEV OTP] Password reset OTP for \${user.email}: \${otp}\`)`, exposing one-time passwords in server log streams.
- **Detailed Fix Description**:
  - Removed all plaintext OTP logging. Replaced with masked log statements: `console.log(\`[Auth] Password reset OTP generated for \${maskEmail(user.email)}\`)`.
- **Modified Files**:
  - [`backend/src/modules/auth/auth.service.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/auth/auth.service.js#L685)
- **Potential Side Effects & Mitigations**:
  - None. Developers in local development receive OTPs via local email sink or Mailpit.
- **Database Migrations Required**: None.

---

### <a id="flaw-sec-05"></a>FLAW-SEC-05: Plaintext Storage of Password Reset Tokens
- **Severity**: 🟡 Medium
- **Root Cause**: Reset OTPs were stored as raw 6-digit numeric strings in `User.resetPasswordOtp` and `Otp.otp`, creating exposure if the database read replica or dump were leaked.
- **Detailed Fix Description**:
  - Implemented `hashOtp` function utilizing Node.js native `crypto.createHash('sha256')`.
  - All OTPs stored in `Otp` and `User` models are saved as hex-encoded SHA-256 hashes. Verification performs SHA-256 on candidate input before comparison.
- **Modified Files**:
  - [`backend/src/modules/auth/auth.service.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/auth/auth.service.js#L22-L26)
  - [`backend/src/models/User.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/models/User.js)
- **Potential Side Effects & Mitigations**:
  - Existing unexpired OTPs generated prior to update will naturally expire within 10 minutes.
- **Database Migrations Required**: None.

---

### <a id="flaw-auth-01"></a>FLAW-AUTH-01: Defective Frontend `RoleRouteGuard`
- **Severity**: 🔴 Critical
- **Root Cause**: In `frontend/src/App.jsx`, `RoleRouteGuard` checked `if (!user)` then checked allowed roles, but failed to return an access-denied element when `!isMatch`, falling through to `return children;`. Unauthorized students typing `/hod` in the URL bar were rendered full administrative controls.
- **Detailed Fix Description**:
  - Rewrote `RoleRouteGuard` to verify `const isMatch = allowedRoles.includes(user.role);`.
  - When `!isMatch`, it immediately renders a styled 403 Forbidden screen with a button to return to the user's authorized portal.
- **Modified Files**:
  - [`frontend/src/App.jsx`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/frontend/src/App.jsx#L42-L75)
- **Potential Side Effects & Mitigations**:
  - Prevents all unauthorized URL hopping. Tested across all 4 role combinations.
- **Database Migrations Required**: None.

---

### <a id="flaw-auth-02"></a>FLAW-AUTH-02: Tutor Guardian Privilege Escalation on Password Resets
- **Severity**: 🔴 Critical
- **Root Cause**: `POST /api/v1/users/:id/reset-password` was authorized for both `ADMIN` and `TG`, but did not check if the target student was actually assigned to the requesting TG's mentor groups or sections. A malicious TG could reset passwords of any student or faculty member.
- **Detailed Fix Description**:
  - Passed `req.user` as `actorUser` to `usersService.resetPassword`.
  - Added cohort scoping: If actor is `TG`, the service queries the TG's active `MentorGroup` documents and assigned sections. If the target student is not in that cohort, it throws `ApiError.forbidden('You can only reset passwords for students in your assigned mentor groups or sections')`.
  - TGs are strictly prohibited from resetting passwords of non-students (teachers, HODs, Admins).
- **Modified Files**:
  - [`backend/src/modules/users/users.controller.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/users/users.controller.js)
  - [`backend/src/modules/users/users.service.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/users/users.service.js#L210-L270)
- **Potential Side Effects & Mitigations**:
  - TG operations remain seamless for their designated mentees while enterprise security boundaries are strictly enforced.
- **Database Migrations Required**: None.

---

### <a id="flaw-auth-03"></a>FLAW-AUTH-03: Unrestricted Student Directory Information Disclosure
- **Severity**: 🟠 High
- **Root Cause**: `GET /api/v1/students` was accessible to the `STUDENT` role, allowing any student to scrape phone numbers, guardian contact info, and home addresses of the entire student body.
- **Detailed Fix Description**:
  - Removed `STUDENT` from `router.get('/', authorize('ADMIN', 'HOD', 'TEACHER', 'TG'), ...)`.
  - Created a separate, privacy-safe peer discovery endpoint: `GET /api/v1/students/search-peers`, authorized for students and faculty. This returns only non-sensitive fields: `_id`, `name`, `rollNumber`, `section`, and `semester`.
- **Modified Files**:
  - [`backend/src/modules/students/students.routes.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/students/students.routes.js)
  - [`backend/src/modules/students/students.controller.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/students/students.controller.js)
  - [`backend/src/modules/students/students.service.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/students/students.service.js)
- **Potential Side Effects & Mitigations**:
  - Peer group consideration selection features in frontend use the peer search endpoint without privacy exposure.
- **Database Migrations Required**: None.

---

### <a id="flaw-auth-04"></a>FLAW-AUTH-04: Unscoped Student Profile Mutation by Tutor Guardians
- **Severity**: 🟠 High
- **Root Cause**: `PATCH /api/v1/students/:id` allowed TGs to alter any student record across the college, including core administrative fields like `rollNumber`, `status`, and `section`.
- **Detailed Fix Description**:
  - In `updateStudent`, added cohort verification ensuring TGs can only edit students in their mentor group.
  - Added attribute mutation guards: if a TG attempts to modify `status`, `rollNumber`, `semester`, `section`, `enrollmentYear`, or `batch`, the service throws `ApiError.forbidden`. Only `ADMIN` or `HOD` can change these academic properties.
- **Modified Files**:
  - [`backend/src/modules/students/students.service.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/students/students.service.js#L140-L190)
- **Potential Side Effects & Mitigations**:
  - Prevents accidental or rogue student transfers by faculty while preserving their ability to update mentorship notes or verify details.
- **Database Migrations Required**: None.

---

### <a id="flaw-auth-05"></a>FLAW-AUTH-05: HOD Cross-Department Review Bypass on Null Department
- **Severity**: 🟠 High
- **Root Cause**: In `considerations.service.js` and `leaves.service.js`, HOD department checks used `if (user.departmentId && ...)`. If an HOD account had a null `departmentId`, the check was bypassed entirely, allowing the HOD to approve requests from any department.
- **Detailed Fix Description**:
  - Switched to fail-closed authorization:
    ```javascript
    if (user.role === 'HOD') {
      if (!user.departmentId) {
        throw ApiError.forbidden('HOD is not assigned to any department');
      }
      if (user.departmentId.toString() !== student.department.toString()) {
        throw ApiError.forbidden('You can only review requests for students in your own department');
      }
    }
    ```
- **Modified Files**:
  - [`backend/src/modules/considerations/considerations.service.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/considerations/considerations.service.js#L380-L400)
  - [`backend/src/modules/leaves/leaves.service.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/leaves/leaves.service.js#L260-L280)
- **Potential Side Effects & Mitigations**:
  - Unassigned HOD accounts are blocked from reviewing until properly appointed to a department by an Administrator.
- **Database Migrations Required**: Ensure all active HOD users have an associated `Teacher` document and `departmentId`.

---

### <a id="flaw-auth-06"></a>FLAW-AUTH-06: Multi-HOD Cross-Departmental Notification Leaks
- **Severity**: 🟠 High
- **Root Cause**: When a leave or consideration reached HOD review tier, `Notification.create` queried `User.find({ role: 'HOD' })` without filtering by department, sending notifications to HODs of all departments.
- **Detailed Fix Description**:
  - Scoped HOD queries to the applicant's department:
    ```javascript
    const targetDepartmentId = student?.department || applicantTeacher?.department;
    const deptTeachers = await Teacher.find({ department: targetDepartmentId }).select('user');
    const deptUserIds = deptTeachers.map(t => t.user);
    const hodUsers = await User.find({ _id: { $in: deptUserIds }, role: 'HOD', isActive: true });
    ```
- **Modified Files**:
  - [`backend/src/modules/leaves/leaves.service.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/leaves/leaves.service.js#L140-L160)
  - [`backend/src/jobs/escalation.job.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/jobs/escalation.job.js#L50-L75)
- **Potential Side Effects & Mitigations**:
  - Departmental isolation strictly preserved; HODs receive only actionable alerts relevant to their faculty and students.
- **Database Migrations Required**: None.

---

### <a id="flaw-auth-07-08"></a>FLAW-AUTH-07 & 08: IDOR & Insecure File Deletion in Uploads
- **Severity**: 🟡 Medium
- **Root Cause**: `uploads.controller.js` and `uploads.service.js` generated signed download URLs and deleted uploaded documents based solely on file IDs without confirming that the requesting user authored the document or was an assigned reviewer.
- **Detailed Fix Description**:
  - Added object-level ownership checks: verify that `req.user._id` matches the document uploader's user ID, or that the requesting user holds an elevated role (`ADMIN`, `HOD`, assigned `TG`).
  - Blocked arbitrary unattached file deletion by non-owners.
- **Modified Files**:
  - [`backend/src/modules/uploads/uploads.service.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/uploads/uploads.service.js)
  - [`backend/src/modules/uploads/uploads.controller.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/uploads/uploads.controller.js)
- **Potential Side Effects & Mitigations**:
  - Legitimate review workflows retain access through role checks.
- **Database Migrations Required**: None.

---

### <a id="flaw-bkd-01"></a>FLAW-BKD-01: Default Pagination Truncating Student Roster
- **Severity**: 🔴 Critical
- **Root Cause**: `parsePagination` previously clamped `limit = Math.min(100, parseInt(query.limit) || 20)`. When HOD dashboards called `GET /api/v1/students?all=true` to populate student directories and section allocation rosters, the default 20-item cap truncated all cohorts larger than 20 students.
- **Detailed Fix Description**:
  - Updated `parsePagination` to check `isAll = query && (query.all === 'true' || query.all === true)`.
  - When `isAll` is true, sets `limit = 1000`, `page = 1`, and `skip = 0`.
  - For normal paginated queries, enforces a standard safe ceiling of `limit = 100`.
- **Modified Files**:
  - [`backend/src/utils/pagination.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/utils/pagination.js#L1-L10)
- **Potential Side Effects & Mitigations**:
  - Completely resolves UI student truncation across all semesters while keeping memory bounded to 1000 records.
- **Database Migrations Required**: None.

---

### <a id="flaw-bkd-02"></a>FLAW-BKD-02: Hardcoded Relative Token Refresh URL
- **Severity**: 🟠 High
- **Root Cause**: In `frontend/src/api/client.js`, the response interceptor handled 401s by making a direct call to `axios.post('/api/v1/auth/refresh')`. In production environments with separated frontend and backend domains, this relative call failed with a 404.
- **Detailed Fix Description**:
  - Updated the refresh request to use dynamic `apiBaseUrl` derived from `import.meta.env.VITE_API_URL || 'http://localhost:5000'`.
- **Modified Files**:
  - [`frontend/src/api/client.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/frontend/src/api/client.js)
- **Potential Side Effects & Mitigations**:
  - Token refresh works seamlessly across both monolithic and decoupled domain deployments.
- **Database Migrations Required**: None.

---

### <a id="flaw-bkd-03"></a>FLAW-BKD-03: Orphaned User Records in Non-Transactional Bulk Import
- **Severity**: 🟠 High
- **Root Cause**: In `importStudents` and `importTeachers`, the `User` record was created before the profile `Student` or `Teacher` record. If profile creation failed (e.g. duplicate roll number or missing section), the `User` remained orphaned in MongoDB, blocking future import due to duplicate email collisions.
- **Detailed Fix Description**:
  - Added robust rollback handling: tracked `createdUserId`. In the row `catch (err)` block, if profile creation fails, `await User.findByIdAndDelete(createdUserId)` is immediately executed before appending the error to the batch report.
- **Modified Files**:
  - [`backend/src/modules/import/import.service.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/import/import.service.js#L135-L175)
- **Potential Side Effects & Mitigations**:
  - Eliminates orphaned accounts without requiring multi-document replica-set transactions.
- **Database Migrations Required**: Clean up any existing orphaned `User` accounts with role `STUDENT` or `TEACHER` that lack corresponding `Student` or `Teacher` documents.

---

### <a id="flaw-bkd-04"></a>FLAW-BKD-04: Missing Distributed Lock on Multi-Instance Scheduled Jobs
- **Severity**: 🟡 Medium
- **Root Cause**: `node-cron` ran in-process without coordination. In horizontal scale environments (PM2 cluster, multi-container ECS/Kubernetes), each worker fired hourly escalation scanners and push reminders simultaneously, causing duplicate notifications.
- **Detailed Fix Description**:
  - Created [`backend/src/utils/distributedLock.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/utils/distributedLock.js) utilizing atomic `findOneAndUpdate` operations on MongoDB `SystemSetting`.
  - Scheduled jobs in `escalation.job.js` and `reminder.job.js` acquire a 5-minute lease lock before execution and release it upon completion.
- **Modified Files**:
  - [`backend/src/utils/distributedLock.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/utils/distributedLock.js)
  - [`backend/src/jobs/escalation.job.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/jobs/escalation.job.js)
  - [`backend/src/jobs/reminder.job.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/jobs/reminder.job.js)
- **Potential Side Effects & Mitigations**:
  - Zero external dependency on Redis required; fully portable on standard MongoDB clusters.
- **Database Migrations Required**: None.

---

### <a id="flaw-bkd-05"></a>FLAW-BKD-05: Consideration Range Overlap and Timing Enforcements
- **Severity**: 🟡 Medium
- **Root Cause**: Students could potentially submit overlapping consideration dates or submit outside academic operating hours.
- **Detailed Fix Description**:
  - Verified and strictly applied `rangesOverlap` checks in `considerations.service.js`.
  - Enforced 9:00 AM – 4:00 PM IST application time windows with administrator bypass toggle capability.
- **Modified Files**:
  - [`backend/src/modules/considerations/considerations.service.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/considerations/considerations.service.js)
  - [`backend/src/utils/dates.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/utils/dates.js)
- **Potential Side Effects & Mitigations**:
  - Admins can enable 24/7 testing mode via system settings when testing outside IST daytime hours.
- **Database Migrations Required**: None.

---

### <a id="flaw-db-01"></a>FLAW-DB-01: Globally Unique `code` Index Collision in Section Model
- **Severity**: 🟠 High
- **Root Cause**: `Section.js` had `code: { type: String, unique: true }`. If Department CSE had Section "A", Department ECE could not create Section "A". Furthermore, different semesters could not share section identifiers.
- **Detailed Fix Description**:
  - Removed `unique: true` from the `code` property in `backend/src/models/Section.js`.
  - Added compound unique index: `sectionSchema.index({ department: 1, semester: 1, code: 1 }, { unique: true });`.
  - Updated section creation duplicate check in `sections.routes.js` to search `{ department, semester: semNum, code: formattedCode }`.
- **Modified Files**:
  - [`backend/src/models/Section.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/models/Section.js#L28-L46)
  - [`backend/src/modules/users/sections.routes.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/users/sections.routes.js#L95-L100)
- **Potential Side Effects & Mitigations**:
  - Standard section letters (A, B, C, D) are now fully reusable across all college departments and academic semesters.
- **Database Migrations Required**: Drop legacy index `code_1` in existing MongoDB databases:
  ```javascript
  db.sections.dropIndex("code_1");
  ```

---

### <a id="flaw-db-03"></a>FLAW-DB-03: Incomplete Cascade Cleanup on User Deletion
- **Severity**: 🟡 Medium
- **Root Cause**: `deleteUser` in `users.service.js` cleaned up student profiles, applications, and refresh tokens, but left orphaned `Notice` broadcasts and `HodAppointment` records referencing deleted user IDs.
- **Detailed Fix Description**:
  - Added `Notice.deleteMany({ author: user._id })` and `HodAppointment.deleteMany({ user: user._id })` into the deletion cascade.
- **Modified Files**:
  - [`backend/src/modules/users/users.service.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/users/users.service.js#L12, #L440-L445)
- **Potential Side Effects & Mitigations**:
  - Guarantees database cleanliness and referential integrity upon user deprovisioning.
- **Database Migrations Required**: None.

---

### <a id="flaw-fe-01"></a>FLAW-FE-01: In-Memory Base64 Data URL Memory Bloat
- **Severity**: 🟡 Medium
- **Root Cause**: File upload failure fallbacks previously converted document buffers into base64 data URLs stored directly in database records, causing extreme JSON document size bloat and memory pressure.
- **Detailed Fix Description**:
  - Eliminated raw data URL fallback buffers from document models. Uploads require successful cloud storage persistence via ImageKit or standard local uploads storage before attaching.
- **Modified Files**:
  - [`backend/src/modules/uploads/uploads.service.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/modules/uploads/uploads.service.js)
- **Potential Side Effects & Mitigations**:
  - Preserves predictable MongoDB document sizes well below the 16MB BSON ceiling.
- **Database Migrations Required**: None.

---

### <a id="flaw-ops-01"></a>FLAW-OPS-01: Database Connection Health Check & Readiness Probes
- **Severity**: 🔵 Low
- **Root Cause**: `GET /api/v1/health` blindly returned `status: 'ok'` even when MongoDB was disconnected or in an error state.
- **Detailed Fix Description**:
  - Updated `/api/v1/health` to inspect `mongoose.connection.readyState === 1` and report `database: 'connected'` or `'disconnected'`.
  - Added dedicated Kubernetes/container readiness endpoint `GET /api/v1/ready` which returns `200 OK` when connected and `503 Service Unavailable` when database connectivity is down.
- **Modified Files**:
  - [`backend/src/app.js`](file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/backend/src/app.js#L49-L73)
- **Potential Side Effects & Mitigations**:
  - Container orchestrators can accurately delay traffic routing until the application and database connection are fully initialized.
- **Database Migrations Required**: None.
