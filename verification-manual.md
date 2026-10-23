# CampusFlow Lite — Manual QA Verification Guide (`verification-manual.md`)

> **Target Version**: CampusFlow Lite v1.0.0-hardened  
> **Audience**: QA Engineers, Security Reviewers, System Administrators  
> **Environment**: Local Development or Staging Server  

---

## 1. Prerequisites & Test Accounts

Start the application services:
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Test Credential Matrix
| Role | Email | Default Password | Assigned Department / Scope |
|---|---|---|---|
| **Admin** | `admin@college.edu` | `Admin@123` | Institutional Administrator (All Departments) |
| **HOD (CSE)** | `hod.cse@college.edu` | `Hod@123` | Head of Computer Science & Engineering |
| **HOD (ECE)** | `hod.ece@college.edu` | `Hod@123` | Head of Electronics & Communication |
| **Tutor Guardian (TG 1)** | `tg1@college.edu` | `Tg@123` | Assigned to CSE Section A (Semester 5) |
| **Student 1 (Mentee of TG 1)** | `student1@college.edu` | `Student@123` | CSE, Semester 5, Section A |
| **Student 2 (Different Section)** | `student2@college.edu` | `Student@123` | CSE, Semester 5, Section B |
| **Student 3 (Different Department)** | `student3@college.edu` | `Student@123` | ECE, Semester 3, Section A |

---

## 2. Manual Test Procedures

### Test 1: Frontend RoleRouteGuard Redirection (FLAW-AUTH-01)
- **Objective**: Verify that students cannot access HOD, TG, or Admin portals by typing URLs in the browser address bar.
- **Steps**:
  1. Open browser and navigate to `http://localhost:5173/login`.
  2. Log in using Student credentials (`student1@college.edu` / `Student@123`).
  3. Observe successful navigation to the Student Portal (`/student`).
  4. In the browser address bar, manually change the URL to `http://localhost:5173/hod` and press Enter.
  5. In the address bar, change the URL to `http://localhost:5173/admin` and press Enter.
- **Expected Result**:
  - The browser displays the styled **403 Access Denied** screen stating "You do not have permission to access this portal".
  - No HOD or Admin components, student data, or action buttons are rendered.
  - Clicking "Return to Portal" returns the user to `/student`.

---

### Test 2: TG Password Reset Scoping (FLAW-AUTH-02)
- **Objective**: Verify Tutor Guardians can only reset passwords for students in their assigned mentor group.
- **Steps**:
  1. Log in as Tutor Guardian (`tg1@college.edu` / `Tg@123`).
  2. Navigate to **My Mentees** (`/tg/students`).
  3. Locate `Student 1` (assigned mentee) and click **Reset Password**.
  4. Observe confirmation toast and temporary password generation.
  5. Open browser developer console or Postman.
  6. Attempt to trigger a password reset for `Student 2` (who is in Section B, not assigned to TG 1):
     ```bash
     curl -X POST http://localhost:5000/api/v1/users/<STUDENT_2_ID>/reset-password \
       -H "Authorization: Bearer <TG_ACCESS_TOKEN>" \
       -H "Content-Type: application/json"
     ```
- **Expected Result**:
  - The API returns HTTP **403 Forbidden**:
    `"You can only reset passwords for students in your assigned mentor groups or sections"`.
  - The unassigned student's password remains unchanged.

---

### Test 3: Student Directory Privacy & Peer Search (FLAW-AUTH-03)
- **Objective**: Verify students cannot view private directories or scrape peer phone numbers.
- **Steps**:
  1. Log in as Student (`student1@college.edu` / `Student@123`).
  2. Send a request to the full directory:
     ```bash
     curl -X GET http://localhost:5000/api/v1/students \
       -H "Authorization: Bearer <STUDENT_ACCESS_TOKEN>"
     ```
  3. Send a request to the peer discovery endpoint:
     ```bash
     curl -X GET "http://localhost:5000/api/v1/students/search-peers?search=student" \
       -H "Authorization: Bearer <STUDENT_ACCESS_TOKEN>"
     ```
- **Expected Result**:
  - Step 2 returns HTTP **403 Forbidden** (`"Access denied: insufficient permissions"`).
  - Step 3 returns HTTP **200 OK** containing only `_id`, `name`, `rollNumber`, `section`, and `semester`.
  - Sensitive fields (`phone`, `guardianPhone`, `guardianName`, `address`) are completely absent from the response.

---

### Test 4: HOD Departmental Isolation on Approvals (FLAW-AUTH-05)
- **Objective**: Verify an HOD cannot review or approve requests submitted by students of a different department.
- **Steps**:
  1. Submit a consideration request as `Student 3` (Department: ECE).
  2. Log in as HOD of CSE (`hod.cse@college.edu` / `Hod@123`).
  3. Verify that `Student 3`'s request does NOT appear in the CSE HOD consideration review table.
  4. Attempt to approve `Student 3`'s request via direct API call using the CSE HOD token:
     ```bash
     curl -X PATCH http://localhost:5000/api/v1/considerations/<ECE_REQUEST_ID>/hod-review \
       -H "Authorization: Bearer <CSE_HOD_TOKEN>" \
       -H "Content-Type: application/json" \
       -d '{"action": "APPROVE", "approvedPeriods": 3, "remarks": "Approved by CSE HOD"}'
     ```
- **Expected Result**:
  - The API returns HTTP **403 Forbidden**:
    `"You can only review requests for students in your own department"`.
  - The request status remains pending for the legitimate ECE HOD.

---

### Test 5: Production OTP Bypass Rejection (FLAW-SEC-03)
- **Objective**: Verify `'123456'` bypass is strictly rejected in non-test environments.
- **Steps**:
  1. Ensure backend is running in development or production mode (`NODE_ENV=development` or `NODE_ENV=production`).
  2. Trigger a forgot password request for `student1@college.edu`:
     ```bash
     curl -X POST http://localhost:5000/api/v1/auth/forgot-password \
       -H "Content-Type: application/json" \
       -d '{"email": "student1@college.edu"}'
     ```
  3. Attempt to reset the password using the hardcoded code `123456`:
     ```bash
     curl -X POST http://localhost:5000/api/v1/auth/reset-password \
       -H "Content-Type: application/json" \
       -d '{"email": "student1@college.edu", "otp": "123456", "newPassword": "NewPassword@123"}'
     ```
- **Expected Result**:
  - The API returns HTTP **400 Bad Request**:
    `"Invalid or expired verification code"`.
  - The password is not changed without providing the genuine hashed OTP sent to the student's email.

---

### Test 6: Cross-Department Section Code Creation (FLAW-DB-01)
- **Objective**: Verify different departments can create sections with the same letter code (e.g. Section A).
- **Steps**:
  1. Log in as Admin (`admin@college.edu` / `Admin@123`).
  2. Navigate to **Manage Sections** (`/admin/sections`).
  3. Create Section "A" in Department **Computer Science & Engineering** for Semester 5.
  4. Create Section "A" in Department **Electronics & Communication** for Semester 5.
- **Expected Result**:
  - Both sections are created successfully with HTTP 201 Created.
  - No MongoDB duplicate key error (`E11000 duplicate key error collection: sections`) occurs.

---

### Test 7: System Health & Database Readiness Probe (FLAW-OPS-01)
- **Objective**: Verify the health check reports database connectivity accurately.
- **Steps**:
  1. With MongoDB connected, execute:
     ```bash
     curl -X GET http://localhost:5000/api/v1/health
     curl -X GET http://localhost:5000/api/v1/ready
     ```
  2. Inspect response bodies.
- **Expected Result**:
  - `/api/v1/health` returns HTTP 200 with `{"status": "ok", "database": "connected"}`.
  - `/api/v1/ready` returns HTTP 200 with `{"status": "ready", "database": "connected"}`.
