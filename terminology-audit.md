# Attendance Consideration Management System: Professional Terminology & Language Audit Report

**Institution:** Department of Computer Science & Engineering, Oriental Institute of Science & Technology (OIST), Bhopal  
**Audit Scope:** End-to-End Codebase (Frontend Views, Shared Components, Modals, Backend Services, Notifications, Reports, and Role Interfaces)  
**Roles Evaluated:** Students, Tutor Guardians (TGs), Head of Department (HOD), System Administrators  
**Audit Date:** October 2026  
**Auditors:** Senior UI/UX Engineer, Technical Writer, and Quality Assurance Engineer

---

## 1. Executive Summary

This audit evaluates all user-facing language, labels, headers, empty states, system feedback, and report documents across the Attendance Consideration Management System. The application is deployed in an autonomous Indian engineering college environment where institutional rigor, role clarity, and professional administrative decorum are paramount.

The audit identifies and remedies:
- **Casual / Prototype Language:** Lowercase action buttons (e.g., `view consideration list`, `google live sheet`, `export excel`), informal abbreviations, and inconsistent capitalization.
- **Unsuitable Enterprise / Developer Jargon:** Inappropriate terms such as `cohort`, `roster`, `ledger`, `queue`, `credits`, `provisioning`, `bypass`, and `data payload` that obscure institutional purpose.
- **AI-generated Phrasing & Sci-Fi Hyperbole:** Unnatural formulations such as *"AUTONOMOUS ACADEMIC NEXUS"*, *"Direct Bypass Queue"*, and *"Consideration Items in Queue"*.
- **Grammatical Inconsistencies & Tense Errors:** Mixed tenses in feedback notifications, incomplete sentences, and confusing action confirmations.

Internal database models, schema identifiers, API endpoints, and permission routines have been strictly preserved to maintain full backward compatibility and system stability.

---

## 2. Institutional Terminology Standardization Matrix

The table below defines the official institutional lexicon adopted across all screens and user touchpoints:

| Category | Flagged / Disallowed Term | Institutional Standard Term | Rationale & Context |
|---|---|---|---|
| **Academic Grouping** | `Cohort` / `Academic Cohort` | `Semester and Section` / `Class Section` | Indian colleges organize students strictly by semester and section (e.g., Semester 5, Section B), not corporate or US-style "cohorts". |
| **Student Directory** | `Roster` / `Roaster` | `Student List` / `Student Directory` | "Roster" is military/sports terminology. Institutional academic systems maintain Class Lists and Student Directories. |
| **Official Records** | `Consideration Ledger` / `Request Ledger` | `Attendance Consideration Records` / `Attendance Clearances` | "Ledger" is accounting terminology. Academic sanctions represent attendance clearances and consideration records. |
| **Student Mentoring** | `Mentees` | `Students` / `Assigned Students` | In Indian engineering colleges, Tutor Guardians (TGs) guide assigned students in their class section. |
| **Role Portals** | `Teacher Dashboard` / `Faculty Portal` | `TG Dashboard` / `Faculty Dashboard` | Distinguishes between general teaching faculty and appointed Tutor Guardians (TGs) with administrative review powers. |
| **Workload Units** | `Attendance Credits` / `Credits` / `Slots` | `Lectures` / `Number of Lectures` / `Periods` | Colleges track attendance per lecture/period, not arbitrary academic credit units or server time slots. |
| **Processing State** | `Workflow Engine` / `Pipeline` | `Application Process` / `Review Process` | Internal engineering constructs should not be exposed to faculty and students. |
| **Pending Lists** | `Pending Queue` / `Items in Queue` | `Pending Applications` / `Awaiting Review` | Applications submitted by students are administrative requests, not items on a message queue. |
| **Application State** | `Requests` (when referring to submissions) | `Applications` (e.g., `Application History`, `Apply for Consideration`) | Students make formal applications for academic consideration and leave. |
| **Account Creation** | `Provision` / `Provisioning` | `Create Account` / `Account Setup` | "Provisioning" is cloud infrastructure jargon; academic administrators create and register accounts. |
| **Action Execution** | `Execute Action` / `Mutation` | `Submit Application` / `Approve` / `Reject` / `Update Record` | Standard institutional actions must be unambiguous and human-readable. |
| **Direct Review** | `Bypass Queue` / `Direct Bypass` | `Direct Review` / `Direct HOD Approval` | "Bypass" suggests circumventing college rules; direct review reflects designated HOD emergency/executive authority. |
| **Empty States** | `No Data Found` / `No Items Found` | `No Records Found` / `No Applications Available` | Clear, polite, and grammatically complete status feedback. |

---

## 3. Comprehensive Terminology Audit & Correction Log

### 3.1 Navigation & Global Shell (`Sidebar.jsx`, `Header.jsx`)

| Location in Codebase | Original Wording | Corrected Professional Wording | Rationale |
|---|---|---|---|
| `frontend/src/components/Sidebar.jsx` (L36, L63) | `Review Queue` | `Review Applications` | Academic faculty review student applications, not generic system queues. |
| `frontend/src/components/Sidebar.jsx` (L54) | `Considerations` | `Attendance Considerations` | Clarifies the full academic scope of the module in the navigation menu. |
| `frontend/src/components/Sidebar.jsx` (L56) | `TG Mentorship` | `Teacher Guardian Allocation` | Formal institutional term for the administrative assignment of TGs to sections. |
| `frontend/src/components/Sidebar.jsx` (L57) | `Students Roster` | `Student Directory` | Replaces informal term "roster" with the college's official Student Directory. |
| `frontend/src/components/Sidebar.jsx` (L72) | `My Profile & Mentor` | `Profile & Teacher Guardian` | Formal title matching institutional Tutor Guardian terminology. |
| `frontend/src/components/Header.jsx` (L18) | `Faculty Portal` | `Faculty Dashboard` | Standardizes role dashboard branding across the institution. |
| `frontend/src/components/Header.jsx` (L19) | `Mentor / TG Desk` | `TG Dashboard` | Clear, professional dashboard naming without casual "Desk" suffix. |
| `frontend/src/components/Header.jsx` (L20) | `HOD Administration` | `HOD Dashboard` | Uniform portal naming convention. |
| `frontend/src/components/Header.jsx` (L21) | `System Administrator` | `Administrator Portal` | Professional institutional title. |

---

### 3.2 Tutor Guardian Workflow (`TgDashboard.jsx`, `TgRequests.jsx`, `TgMyStudents.jsx`)

| Location in Codebase | Original Wording | Corrected Professional Wording | Rationale |
|---|---|---|---|
| `frontend/src/pages/tg/TgDashboard.jsx` (L142) | `PENDING REQUESTS` | `PENDING APPLICATIONS` | Form submissions are applications under the college attendance policy. |
| `frontend/src/pages/tg/TgDashboard.jsx` (L153) | `Forward to HOD` | `Review Applications` | The TG's duty is first to evaluate and recommend/reject applications before forwarding. |
| `frontend/src/pages/tg/TgDashboard.jsx` (L179) | `View Student Roster` | `View Student List` | Removes "roster" in favor of standard institutional student list. |
| `frontend/src/pages/tg/TgDashboard.jsx` (L194) | `view consideration list` (all lowercase) | `Attendance Consideration Records` | Eliminates casual lowercase button text and establishes formal Title Case. |
| `frontend/src/pages/tg/TgDashboard.jsx` (L197) | `Approved clearances & sanctioned OD ledger` | `Approved attendance clearances and official records` | Replaces financial "ledger" with official academic records. |
| `frontend/src/pages/tg/TgDashboard.jsx` (L203, L225) | `Open Ledger` | `View Records` | Clear, direct action label. |
| `frontend/src/pages/tg/TgDashboard.jsx` (L217) | `view leave lists` (all lowercase) | `Leave Application Records` | Establishes proper Title Case and professional terminology. |
| `frontend/src/pages/tg/TgRequests.jsx` (L75) | `TG Review Queue` | `Review Applications` | Academic review workspace, avoiding technical queue jargon. |
| `frontend/src/pages/tg/TgRequests.jsx` (L76) | `Tier-1 evaluation of attendance considerations...` | `Review and recommend attendance consideration and leave applications for your assigned students.` | Clear, grammatically complete active explanation. |
| `frontend/src/pages/tg/TgRequests.jsx` (L117) | `All Requests` | `All Applications` | Consistent application terminology. |
| `frontend/src/pages/tg/TgRequests.jsx` (L151) | `No Consideration Items in Queue` | `No Pending Attendance Consideration Applications` | Full sentence empty state with accurate academic context. |
| `frontend/src/pages/tg/TgRequests.jsx` (L152) | `All student consideration requests have been evaluated.` | `All attendance consideration applications for this section have been reviewed.` | Grammatically complete and accurate. |
| `frontend/src/pages/tg/TgRequests.jsx` (L194) | `${r.requestedPeriods} Requested` | `${r.requestedPeriods} Lectures` | Accurately denotes class lectures. |
| `frontend/src/pages/tg/TgRequests.jsx` (L302) | `No Leave Applications in Queue` | `No Pending Leave Applications` | Removes "in Queue" phrasing. |
| `frontend/src/pages/tg/TgRequests.jsx` (L303) | `No student leave requests currently awaiting TG review.` | `There are currently no leave applications awaiting review.` | Professional, neutral institutional English. |
| `frontend/src/pages/tg/TgMyStudents.jsx` (L87) | `Assigned Cohort:` | `Assigned Section:` | College classes are divided by sections, not cohorts. |
| `frontend/src/pages/tg/TgMyStudents.jsx` (L103) | `No Students Found` | `No Students Found` | Clean, polite header. |
| `frontend/src/pages/tg/TgMyStudents.jsx` (L105) | `No students enrolled matching current search criteria.` | `No students found matching your search criteria.` | Standard grammatically correct English. |

---

### 3.3 Clearances & Export Records Modal (`OfficialClearancesLedgerModal.jsx`)

| Location in Codebase | Original Wording | Corrected Professional Wording | Rationale |
|---|---|---|---|
| `frontend/src/components/modals/OfficialClearancesLedgerModal.jsx` (L512-519) | `student name`, `enrollment`, `section`, `periods`, `time (from - to)`, `date (from - to)`, `number of days`, `status` (all lowercase) | `Student Name`, `Enrollment No.`, `Section`, `Lectures / Periods`, `Time (From - To)`, `Date (From - To)`, `Number of Days`, `Status` | Institutional print reports and audit documents must use Title Case. |
| `frontend/src/components/modals/OfficialClearancesLedgerModal.jsx` (L530) | `OIST Bhopal • Academic Ledger Desk` | `OIST Bhopal • Department Academic Office` | Professional institutional office designation. |
| `frontend/src/components/modals/OfficialClearancesLedgerModal.jsx` (L605) | `Department of Computer Science & Engineering • Official Clearances Ledger` | `Department of Computer Science & Engineering • Approved Attendance Clearances` | Clear, official heading. |
| `frontend/src/components/modals/OfficialClearancesLedgerModal.jsx` (L617) | `google live sheet` (lowercase) | `Google Live Sheet` | Title Case standardization. |
| `frontend/src/components/modals/OfficialClearancesLedgerModal.jsx` (L626) | `export excel` (lowercase) | `Export Excel` | Title Case standardization. |
| `frontend/src/components/modals/OfficialClearancesLedgerModal.jsx` (L634) | `csv` (lowercase) | `Export CSV` | Action-oriented button label. |
| `frontend/src/components/modals/OfficialClearancesLedgerModal.jsx` (L643) | `print report` (lowercase) | `Print Report` | Title Case standardization. |
| `frontend/src/components/modals/OfficialClearancesLedgerModal.jsx` (L664) | `attendance consideration list` (lowercase) | `Attendance Consideration Records` | Formal Title Case. |
| `frontend/src/components/modals/OfficialClearancesLedgerModal.jsx` (L678) | `leave list` (lowercase) | `Leave Application Records` | Formal Title Case. |
| `frontend/src/components/modals/OfficialClearancesLedgerModal.jsx` (L759, L775) | `semester:`, `section:` (lowercase) | `Semester:`, `Section:` | Consistent capitalization. |
| `frontend/src/components/modals/OfficialClearancesLedgerModal.jsx` (L833) | `LEDGER VIEW:` | `APPROVED CLEARANCES:` | Clarifies sanction status. |
| `frontend/src/components/modals/OfficialClearancesLedgerModal.jsx` (L858-878) | Table headers in modal body (lowercase) | `Student Name`, `Enrollment No.`, `Section`, `Category`, `Lectures / Periods`, `Time`, `From`, `To`, `Date`, `Number of Days` | Standard Title Case across all modal tables. |
| `frontend/src/components/modals/OfficialClearancesLedgerModal.jsx` (L951) | `Sanctioned attendance credit` | `Approved attendance consideration` | Eliminates the inappropriate word "credit". |
| `frontend/src/components/modals/OfficialClearancesLedgerModal.jsx` (L1002) | `Close Ledger` | `Close Window` | Standard modal exit terminology. |

---

### 3.4 Student Portal Workflows (`StudentDashboard.jsx`, `StudentConsiderations.jsx`, `StudentLeaves.jsx`, `StudentProfile.jsx`)

| Location in Codebase | Original Wording | Corrected Professional Wording | Rationale |
|---|---|---|---|
| `frontend/src/pages/student/StudentDashboard.jsx` (L199) | `Request Consideration` | `Apply for Consideration` | Action-oriented and consistent with "Apply for Leave". |
| `frontend/src/pages/student/StudentDashboard.jsx` (L231) | `My Requests` | `Application History` | Professional record of submitted applications. |
| `frontend/src/pages/student/StudentDashboard.jsx` (L327) | `Request Under Review` | `Applications Under Review` | Grammatically plural and consistent with academic applications. |
| `frontend/src/pages/student/StudentDashboard.jsx` (L328) | `No Pending Requests` | `No Pending Applications` | Professional status message. |
| `frontend/src/pages/student/StudentDashboard.jsx` (L363) | `attendance consideration requests and leave applications` | `attendance consideration applications and leave applications` | Unified terminology. |
| `frontend/src/pages/student/StudentDashboard.jsx` (L373) | `Recent Attendance Consideration Requests` | `Recent Attendance Consideration Applications` | Formal section heading. |
| `frontend/src/pages/student/StudentDashboard.jsx` (L380, L448) | `+ New` | `+ Apply` | Clear, action-oriented button label. |
| `frontend/src/pages/student/StudentDashboard.jsx` (L390) | `No Consideration Requests` | `No Attendance Consideration Applications Found` | Clear, polite empty state. |
| `frontend/src/pages/student/StudentDashboard.jsx` (L393) | `Submit attendance consideration requests for hackathons, sports tournaments, or college activities.` | `Submit attendance consideration applications for approved events, competitions, or official college activities.` | Institutionally accurate and complete. |
| `frontend/src/pages/student/StudentConsiderations.jsx` (L75) | `Consideration request has been cancelled.` | `Attendance consideration application has been cancelled.` | Full, grammatically correct notification. |
| `frontend/src/pages/student/StudentConsiderations.jsx` (L107) | `Attendance Consideration Requests` | `Attendance Consideration Applications` | Official title. |
| `frontend/src/pages/student/StudentConsiderations.jsx` (L120, L161) | `New Request` | `Apply for Consideration` | Action-oriented institutional label. |
| `frontend/src/pages/student/StudentConsiderations.jsx` (L129) | `All Requests` | `All Applications` | Unified status tab naming. |
| `frontend/src/pages/student/StudentConsiderations.jsx` (L159) | `No Consideration Requests Found` | `No Attendance Consideration Applications Found` | Consistent empty state. |
| `frontend/src/pages/student/StudentLeaves.jsx` (L73) | `Leave application cancelled.` | `Your leave application has been cancelled.` | Polite, grammatically complete user feedback. |
| `frontend/src/pages/student/StudentLeaves.jsx` (L80) | `Cannot cancel leave.` | `Unable to cancel the leave application.` | Professional error handling text. |
| `frontend/src/pages/student/StudentLeaves.jsx` (L122) | `All Leaves` | `All Applications` | Consistent tab terminology. |
| `frontend/src/pages/student/StudentProfile.jsx` (L19) | `My Profile & Mentor` | `Profile & Tutor Guardian` | Standardized institutional TG designation. |

---

### 3.5 Head of Department (HOD) Portal (`HodDashboard.jsx`, `HodConsiderations.jsx`, `HodMentorship.jsx`, `HodStudents.jsx`)

| Location in Codebase | Original Wording | Corrected Professional Wording | Rationale |
|---|---|---|---|
| `frontend/src/pages/hod/HodDashboard.jsx` (L342) | `View Consideration` | `Attendance Clearances` | Descriptive button indicating official attendance clearances. |
| `frontend/src/pages/hod/HodDashboard.jsx` (L442) | `Leave Requests` | `Leave Applications` | Standard application term. |
| `frontend/src/pages/hod/HodDashboard.jsx` (L456) | `${pendingLeavesCount} in queue` | `${pendingLeavesCount} pending` | Eliminates technical queue phrasing. |
| `frontend/src/pages/hod/HodDashboard.jsx` (L477) | `Onboard faculty member` | `Add faculty member` | Replaces corporate buzzword "onboard" with simple, clear English. |
| `frontend/src/pages/hod/HodDashboard.jsx` (L519) | `Mentorship allocations` | `Teacher Guardian allocations` | Official role title. |
| `frontend/src/pages/hod/HodConsiderations.jsx` (L444) | `Department Requests & Approvals Central` | `Department Applications & Attendance Clearances` | Formal departmental office header. |
| `frontend/src/pages/hod/HodConsiderations.jsx` (L448) | `Central repository of attendance considerations... with direct TG bypass authority.` | `Departmental records of attendance consideration applications, student leave applications, and official clearances.` | Dignified institutional description without internal bypass jargon. |
| `frontend/src/pages/hod/HodConsiderations.jsx` (L455) | `All Requests` | `All Applications` | Unified status tab naming. |
| `frontend/src/pages/hod/HodConsiderations.jsx` (L457) | `Direct Bypass Queue` | `Direct Review Applications` | Professional description of direct HOD evaluation. |
| `frontend/src/pages/hod/HodConsiderations.jsx` (L459) | `Considerations` | `Attendance Considerations` | Explicit, professional label. |
| `frontend/src/pages/hod/HodConsiderations.jsx` (L460) | `Cleared & Synced` | `Approved Applications` | Clear institutional outcome. |
| `frontend/src/pages/hod/HodConsiderations.jsx` (L538) | `Clearances Ledger` | `Approved Clearances` | Replaces accounting ledger terminology. |
| `frontend/src/pages/hod/HodConsiderations.jsx` (L704) | `Roster (${item.groupMembers.length}):` | `Group Members (${item.groupMembers.length}):` | Eliminates "Roster". |
| `frontend/src/pages/hod/HodConsiderations.jsx` (L808-810) | `from`, `to`, `nos of days` (lowercase) | `From`, `To`, `Number of Days` | Standard Title Case. |
| `frontend/src/pages/hod/HodConsiderations.jsx` (L824) | `REQUESTED PERIODS` | `REQUESTED LECTURES` | Standard Indian college academic term. |
| `frontend/src/pages/hod/HodConsiderations.jsx` (L835) | `sanctioned period` (lowercase) | `Sanctioned Lectures` | Standard Title Case and lecture terminology. |
| `frontend/src/pages/hod/HodConsiderations.jsx` (L899) | `Bypass & Approve` | `Direct Approve` | Formal, appropriate institutional authorization label. |
| `frontend/src/pages/hod/HodMentorship.jsx` (L177) | `MENTORED SECTION` | `ASSIGNED SECTIONS` | Formal departmental administrative assignment. |
| `frontend/src/pages/hod/HodMentorship.jsx` (L196) | `PEER CLEARANCE SETTINGS` | `CLEARANCE WORKFLOW` | Replaces confusing "peer clearance" with standard workflow name. |
| `frontend/src/pages/hod/HodMentorship.jsx` (L243) | `Standard Faculty` | `Faculty Members` | Dignified title for faculty members not currently serving as TGs. |
| `frontend/src/pages/hod/HodStudents.jsx` (L113) | `Official enrolled roster and section allocation ledger with supervision.` | `Official student directory and section allocation records.` | Removes "roster" and "ledger". |
| `frontend/src/pages/hod/HodStudents.jsx` (L123) | `title="Refresh student roster"` | `title="Refresh student directory"` | Standard directory terminology. |
| `frontend/src/pages/hod/HodStudents.jsx` (L135) | `Enroll New Student` | `Add Student` | Clear action label. |

---

### 3.6 Administration & Modals (`AdminUsers.jsx`, `AdminBulkImport.jsx`, `AdminDashboard.jsx`, Modals)

| Location in Codebase | Original Wording | Corrected Professional Wording | Rationale |
|---|---|---|---|
| `frontend/src/pages/admin/AdminUsers.jsx` (L332, L1130) | `Account Provisioned` / `Account Provisioned Successfully!` | `Account Created Successfully` | Eliminates technical "provisioning". |
| `frontend/src/pages/admin/AdminUsers.jsx` (L340) | `Provisioning Failed` | `Account Creation Failed` | Clear, plain English error header. |
| `frontend/src/pages/admin/AdminUsers.jsx` (L468) | `Provision student & TG accounts... cohorts.` | `Manage student and faculty accounts, appoint leadership (HOD & TGs), and manage semester progression for class sections.` | Institutionally accurate administrative summary. |
| `frontend/src/pages/admin/AdminUsers.jsx` (L638) | `Section Cohort & Semester Progression Control` | `Section & Semester Progression Management` | Standard academic section terminology. |
| `frontend/src/pages/admin/AdminUsers.jsx` (L988) | `Cohort Assigned` | `Section Assigned` | Section assignment terminology. |
| `frontend/src/pages/admin/AdminUsers.jsx` (L1110) | `Provision Academic Account` | `Create Academic Account` | Direct action button. |
| `frontend/src/pages/admin/AdminUsers.jsx` (L1291) | `Student Enrollment & Cohort Details` | `Student Enrollment & Section Details` | Replaces cohort with section. |
| `frontend/src/pages/admin/AdminUsers.jsx` (L1506) | `Provisioning...` / `Provision ${createAccountType} Account` | `Creating Account...` / `Create ${createAccountType} Account` | Plain, clear button states. |
| `frontend/src/pages/admin/AdminUsers.jsx` (L1578) | `Updating Cohort...` | `Updating Section...` | Accurate progress indicator. |
| `frontend/src/pages/admin/AdminUsers.jsx` (L1734) | `Appoint TG & Assign Cohort` | `Appoint TG & Assign Section` | Standard section allocation label. |
| `frontend/src/pages/admin/AdminBulkImport.jsx` (L106) | `Master Roster Bulk Import` | `Student & Faculty Bulk Import` | Clear description of file import feature. |
| `frontend/src/pages/admin/AdminBulkImport.jsx` (L107) | `Ingest entire student batches and faculty rosters...` | `Import student batches and faculty members using validated Excel spreadsheets.` | Removes harsh technical term "ingest" and "rosters". |
| `frontend/src/pages/admin/AdminDashboard.jsx` (L376) | `Import students & faculty rosters` | `Import student & faculty records` | Institutional records terminology. |
| `frontend/src/pages/admin/AdminDashboard.jsx` (L532, L901) | `Section Cohorts` / `Loading section cohorts...` | `Class Sections` / `Loading class sections...` | Academic class section terminology. |
| `frontend/src/pages/admin/AdminDashboard.jsx` (L998) | `Department Head (HOD) Leave Requests Queue` | `Department Head (HOD) Leave Applications` | Removes "Queue". |
| `frontend/src/components/modals/ReviewModal.jsx` (L63) | `Action ${decision.toLowerCase()} applied successfully.` | Contextual confirmation: `Application has been recommended to the HOD.` / `Application has been approved.` / `Application has been rejected.` | Grammatically correct, natural English instead of raw string interpolation. |
| `frontend/src/components/modals/ReviewModal.jsx` (L88) | `TG Tier-1 Review` | `Tutor Guardian Review` | Eliminates informal "Tier-1" designation. |
| `frontend/src/components/modals/ReviewModal.jsx` (L266) | `Confirm ${decision}` (e.g. `Confirm RECOMMEND`) | `Confirm Recommendation` / `Confirm Approval` / `Confirm Rejection` | Natural English action labels. |
| `frontend/src/components/modals/RequestConsiderationModal.jsx` (L247-248) | `Request Submitted` / `Attendance consideration request submitted for ${numLectures} lecture(s)...` | `Application Submitted Successfully` / `Your attendance consideration application for ${numLectures} lecture(s) has been submitted successfully...` | Formal, courteous acknowledgment. |
| `frontend/src/components/modals/RequestConsiderationModal.jsx` (L254) | `Failed to submit attendance consideration request.` | `Unable to submit your attendance consideration application at this time. Please try again later.` | Polite, institutional error notification. |
| `frontend/src/components/modals/RequestConsiderationModal.jsx` (L274) | `New Attendance Consideration Request` | `Apply for Attendance Consideration` | Action-oriented form heading. |
| `frontend/src/components/modals/RequestConsiderationModal.jsx` (L277) | `Apply for official attendance credit...` | `Apply for official attendance consideration for lectures missed during approved events and activities.` | Eliminates "attendance credit". |
| `frontend/src/components/modals/ApplyLeaveModal.jsx` (L72) | `Apply for Student Leave` | `Apply for Leave` | Clean modal title. |
| `frontend/src/components/modals/ApplyLeaveModal.jsx` (L75) | `Apply for medical, personal, or college duty leave clearance` | `Submit a leave application for medical, college duty, or personal reasons.` | Grammatically complete instructions. |
| `frontend/src/components/modals/ApplyLeaveModal.jsx` (L163) | `Reason / Justification` | `Reason for Leave` | Concise, professional form label. |
| `frontend/src/components/modals/FormalApplicationModal.jsx` (L269) | `AUTONOMOUS ACADEMIC NEXUS • DEPARTMENTAL ADMINISTRATION` | `ACADEMIC OFFICE • DEPARTMENTAL ADMINISTRATION` | Replaces science-fiction jargon with authentic institutional office title. |
| `frontend/src/components/modals/FormalApplicationModal.jsx` (L314, L330) | `Group Consideration Roster` / `Group Roster Table` | `Group Consideration Student List` / `Group Student List Table` | Standard student list terminology. |
| `frontend/src/components/modals/AttendanceLeaveReportsModal.jsx` (L83) | `Downloaded section-wise considerations ledger...` | `Downloaded section-wise attendance consideration records...` | Replaces "ledger" with official records. |

---

### 3.7 Backend Notifications & Email Services (`considerations.service.js`, `leaves.service.js`, `users.service.js`, `reports.service.js`)

| Location in Codebase | Original Wording | Corrected Professional Wording | Rationale |
|---|---|---|---|
| `backend/src/modules/considerations/considerations.service.js` (L148-149) | `New Consideration Request` / `${user.name} submitted an attendance consideration request...` | `New Attendance Consideration Application` / `${user.name} submitted an attendance consideration application...` | Professional notification wording. |
| `backend/src/modules/considerations/considerations.service.js` (L162-163) | `New Consideration Request (No TG Assigned)` | `New Consideration Application (Direct Review)` | Clarifies that application requires direct HOD review. |
| `backend/src/modules/considerations/considerations.service.js` (L766-767) | `Consideration Recommended` / `Your consideration request was...` | `Consideration Application Recommended` / `Your attendance consideration application for "${request.eventTitle}" has been recommended to the HOD.` | Complete, professional past-tense sentence. |
| `backend/src/modules/considerations/considerations.service.js` (L819-820) | `Consideration Awaiting HOD Approval` / `TG recommended attendance consideration...` | `Consideration Application Awaiting HOD Decision` / `Tutor Guardian has recommended attendance consideration for "${request.eventTitle}".` | Formal departmental English. |
| `backend/src/modules/considerations/considerations.service.js` (L938) | `Consideration Approved by HOD!` | `Attendance Consideration Approved by HOD` | Removes informal exclamation mark. |
| `backend/src/modules/considerations/considerations.service.js` (L939) | `(${approvedPeriods} periods credited)` | `(${approvedPeriods} lecture${approvedPeriods !== 1 ? 's' : ''} sanctioned)` | Institutional academic sanction phrasing, eliminating "credit". |
| `backend/src/modules/considerations/considerations.service.js` (L978-979) | `HOD Decision: Consideration ${decision}` / `HOD completed final review...` | `HOD Decision: Consideration ${decision === 'APPROVE' ? 'Approved' : 'Rejected'}` / `Head of Department has ${decision === 'APPROVE' ? 'approved' : 'rejected'} the attendance consideration application for "${request.eventTitle}".` | Natural English, grammatically complete sentence. |
| `backend/src/modules/leaves/leaves.service.js` (L537) | `Your leave application was ${newStatus...}` | `Your leave application has been ${decision === 'RECOMMEND' ? 'recommended to the HOD by your Tutor Guardian' : 'rejected by your Tutor Guardian'}.` | Accurate attribution to the TG's specific action. |
| `backend/src/modules/leaves/leaves.service.js` (L566) | `TG recommended a student leave application.` | `Tutor Guardian has recommended a student leave application for HOD review.` | Complete professional notification. |
| `backend/src/modules/leaves/leaves.service.js` (L682) | `Your leave application was ${newStatus...}` | `Your leave application has been ${decision === 'APPROVE' ? 'approved by the Head of Department' : 'rejected by the Head of Department'}.` | Dignified institutional approval confirmation. |
| `backend/src/modules/leaves/leaves.service.js` (L711) | `Student leave application was ${newStatus}.` | `The student leave application has been ${decision === 'APPROVE' ? 'approved' : 'rejected'} by the Head of Department.` | Active past-tense notification to TG. |
| `backend/src/modules/users/users.service.js` (L755, L766) | `...Assigned Cohort.` / `...appointed as Tutor Guardian for cohort.` | `...Assigned Section.` / `...appointed as Tutor Guardian for the section.` | Standard section allocation terminology. |
| `backend/src/modules/reports/reports.service.js` (L568, L572, L576) | `Request Type`, `Approved Periods`, `Final Approver` (Excel headers) | `Application Type`, `Approved Lectures / Periods`, `Approving Authority` | Formal column headings in generated institutional Excel files. |

---

## 4. Verification & Quality Assurance Strategy

1. **Syntax & Static Verification:** Run `npm run build` in the `frontend` directory to ensure zero JSX syntax errors, import mismatches, or bundling failures.
2. **Backend Syntax Verification:** Run Node static syntax checks (`node --check`) across all modified backend controller and service files.
3. **Role Permission & Workflow Preservations:** Verify that all role permissions, database schema enums (e.g., `PENDING`, `RECOMMENDED_BY_TG`, `APPROVED_BY_HOD`), Socket.IO event payloads, and REST API contracts remain unmodified.
4. **End-to-End Regression Check:** Validate all Student, TG, HOD, and Admin dashboards and modals to confirm responsive layout integrity and flawless visual presentation.
