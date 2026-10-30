# CampusFlow Lite — Consideration & Leave Management System (Backend)

CampusFlow Lite is a high-performance MERN-stack backend API for managing academic attendance considerations (OD / Duty) and leave applications with a robust multi-tier approval chain:

```
Student → Tutor Guardian (TG, Tier-1 recommend) → HOD (Tier-2 final decision)
```

Derived from the CampusFlow CSE ERP v2.0.0 architecture specification.

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (v20+ / v24)
- **Framework**: Express.js (ES Modules `"type": "module"`)
- **Database**: MongoDB 7+ via Mongoose 8+
- **Authentication**: JWT access token (15m) + httpOnly refresh token cookie (7d) with rotation & reuse detection
- **Validation**: Zod schema validation on requests & environment configuration
- **Security**: Helmet, CORS, express-rate-limit, cookie-parser
- **Real-Time**: Socket.IO 4 with JWT authenticated handshake
- **Automated Jobs**: node-cron for 48-hour TG inactivity escalation
- **Document Management**: ImageKit SDK integration (private files + signed URLs)
- **Reporting & Bulk Import**: ExcelJS

---

## 📂 Repository Structure

```
backend/
├── .env.example
├── .env
├── package.json
├── docs/
│   └── API.md                  # Complete API specifications
├── tests/
│   ├── workflow.test.js        # Unit test suite for state machines & date logic
│   └── health.test.js          # Health endpoint & error response test suite
└── src/
    ├── app.js                  # Express application setup & middleware chain
    ├── server.js               # HTTP server, Socket.IO & cron jobs entrypoint
    ├── config/
    │   ├── env.js              # Zod environment variable validator
    │   ├── db.js               # MongoDB connection handler
    │   ├── cors.js             # CORS configuration
    │   └── imagekit.js         # ImageKit SDK client
    ├── models/
    │   ├── User.js             # User accounts (STUDENT, TEACHER, HOD, ADMIN)
    │   ├── Department.js       # Academic departments
    │   ├── Section.js          # Academic class sections
    │   ├── Student.js          # Student profile & mentor group reference
    │   ├── Teacher.js          # Faculty profile & employee ID
    │   ├── MentorGroup.js      # TG mentee cohorts
    │   ├── HodAppointment.js   # Active HOD appointment per department
    │   ├── ConsiderationRequest.js # Attendance consideration lifecycle
    │   ├── LeaveApplication.js # Leave application lifecycle
    │   ├── Notification.js     # User notification store
    │   ├── AuditLog.js         # Immutable state change audit log
    │   └── RefreshToken.js     # Refresh token store with TTL index
    ├── middleware/
    │   ├── auth.js             # JWT verification & profile/TG resolution
    │   ├── authorize.js        # Role-based authorization & TG checks
    │   ├── validate.js         # Zod request validation middleware
    │   ├── rateLimit.js        # Rate limiting policies
    │   └── errorHandler.js     # Standardized JSON error response handler
    ├── modules/
    │   ├── auth/               # Login, refresh, logout, change-password, me
    │   ├── users/              # Admin user management & sections CRUD
    │   ├── students/           # Student queries & directory
    │   ├── teachers/           # Teacher directory & TG listing
    │   ├── mentorship/         # Mentor groups, mentee cohorts, TG assignments
    │   ├── considerations/     # Pure state machine & review flows
    │   ├── leaves/             # Multi-tier leave resolver & review flows
    │   ├── uploads/            # ImageKit auth, verification & signed URLs
    │   ├── notifications/      # In-app notifications
    │   ├── reports/            # Dashboards, reports, and Excel export
    │   ├── import/             # Admin bulk import via Excel
    │   └── audit/              # Audit log viewer
    ├── sockets/
    │   ├── index.js            # Socket.IO initialization & rooms
    │   └── emitters.js         # Event emission helpers
    ├── jobs/
    │   └── escalation.job.js   # 48-hour TG inactivity hourly cron job
    ├── utils/
    │   ├── ApiError.js         # Standard error class
    │   ├── asyncHandler.js     # Async controller wrapper
    │   ├── dates.js            # IST date utilities & overlap computations
    │   ├── pagination.js       # Pagination & metadata helpers
    │   └── response.js         # Standard response wrappers
    └── seed/
        └── seed.js             # Database seeding script
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure `MONGODB_URI` (or `MONGO_URI`) points to your MongoDB instance (local or MongoDB Atlas).

### 3. Seed Database
```bash
npm run seed
```

To provision Tutor Guardian accounts for every CSE section from Year 1 through
Year 4 (sections A-H), run:

```bash
npm run seed:tg-accounts
```

This command is safe to run repeatedly. It creates or updates the 32 accounts,
matching sections, and active mentor-group assignments without clearing existing
data. The default academic session is `2026-27`; override it with
`TG_ACADEMIC_YEAR` when needed.

All provisioned accounts use the following credentials:

- **Email**: `tgcse<year><section>@oist.in` (for example, `tgcse1a@oist.in`)
- **Password**: `Tgoist@123`

If the active term changes from even to odd semester, update the provisioned
assignments with:

```bash
npm run update:tg-semesters
```

For the configured `2026-27` session, this changes semesters `2, 4, 6, 8` to
`1, 3, 5, 7` and preserves the existing student rosters.

Section capacity defaults to **90 students**. Existing sections can be
normalized to this capacity with:

```bash
npm run update:section-capacity
```

Duplicate section cleanup for empty duplicate records in Semesters 5 and 7:

```bash
npm run cleanup:duplicate-sections
```

Section creation now treats the section identity (for example, Section A) as
unique within a department and semester, even when different code formats are
submitted.

The HOD TG appointment form uses a controlled academic-session dropdown and
automatically selects the provisioned account matching the semester year and
section, such as `tgcse3a@oist.in` for a Year 3 Section A assignment. Mentor
group APIs accept only the `YYYY-YY` academic-session format.

When a section is promoted through the HOD section controls, same-year
promotions update the current section and TG semester. A promotion that crosses
an academic year moves students to the matching section in the next year,
assigns them to that year's TG, uses the destination year's odd TG semester,
and advances the academic session (`2026-27` to `2027-28`, for example).

Default credentials seeded:
- **Admin**: `admin@campusflow.edu` / `Password@123`
- **HOD**: `hod@campusflow.edu` / `Password@123`
- **TG 1**: `ananya.tg@campusflow.edu` / `Password@123`
- **TG 2**: `vikram.tg@campusflow.edu` / `Password@123`
- **Student 1**: `aarav@campusflow.edu` / `Password@123`
- **Student 2**: `sneha@campusflow.edu` / `Password@123`

### 4. Run Development Server
```bash
npm run dev
```

### 5. Run Test Suite
```bash
npm test
```

---
