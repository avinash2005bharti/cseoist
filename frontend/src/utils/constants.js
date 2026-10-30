/**
 * CampusFlow Lite - Centralized Constants, Status Mappings & Formatters
 * Established for Indian Engineering College Conventions (OIST CSE)
 */

export const DEFAULT_ACADEMIC_SESSION = '2026-27';
export const FULL_ACADEMIC_SESSION = '2026-2027';

export const STATUS_LABELS = {
  PENDING: 'Pending',
  RECOMMENDED_BY_TG: 'Recommended by TG',
  APPROVED_BY_HOD: 'Approved by HOD',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REJECTED_BY_HOD: 'Rejected by HOD',
  REJECTED_BY_TG: 'Rejected by TG',
  CANCELLED: 'Cancelled',
};

export const ACTION_LABELS = {
  CREATE_CONSIDERATION: 'Created Attendance Consideration',
  TG_RECOMMEND_CONSIDERATION: 'TG Recommended Consideration',
  TG_REJECT_CONSIDERATION: 'TG Rejected Consideration',
  HOD_APPROVE_CONSIDERATION: 'Approved Consideration',
  HOD_REJECT_CONSIDERATION: 'Rejected Consideration',
  CANCEL_CONSIDERATION: 'Cancelled Attendance Consideration',

  CREATE_LEAVE: 'Submitted Leave Application',
  TG_RECOMMEND_LEAVE: 'TG Recommended Leave',
  TG_REJECT_LEAVE: 'TG Rejected Leave',
  FINAL_APPROVE_LEAVE: 'Approved Leave Application',
  FINAL_REJECT_LEAVE: 'Rejected Leave Application',
  CANCEL_LEAVE: 'Cancelled Leave Application',

  APPOINT_TG: 'Appointed Tutor Guardian (TG)',
  REVOKE_TG: 'Revoked Tutor Guardian (TG)',
  UPDATE_MENTOR_GROUP: 'Updated Mentored Students',
  ESCALATE: 'Escalated to HOD',
  RESET_PASSWORD: 'Reset User Password',
  UPDATE: 'Updated Record',
  CREATE: 'Created Record',
};

export const REQUEST_TYPE_LABELS = {
  HACKATHON: 'Hackathon / Competition',
  SPORTS: 'Sports Activity',
  CULTURAL: 'Cultural Activity',
  COLLEGE_DUTY: 'College Duty / Official Activity',
  OD: 'Official Activity',
  MEDICAL: 'Medical Leave',
  CASUAL: 'Casual Leave',
  SICK: 'Sick Leave',
  ACADEMIC: 'Academic Activity',
  EMERGENCY: 'Emergency Leave',
  DUTY: 'Official Duty',
  OTHER: 'Special Activity',
};

/**
 * Remove underscores and format any internal identifier into clean Title Case
 */
export function cleanLabel(text) {
  if (!text) return '';
  if (typeof text !== 'string') return String(text);
  return text
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

/**
 * Human-readable event category for Indian colleges
 */
export function getEventTypeLabel(type) {
  if (!type) return 'College Activity';
  const upper = String(type).toUpperCase();
  const map = {
    HACKATHON: 'Hackathon / Technical Competition',
    SPORTS: 'Sports Meet / Tournament',
    CULTURAL: 'Cultural Event / Fest',
    COLLEGE_DUTY: 'College Duty / Official Activity',
    OTHER: 'Other Academic Activity',
  };
  return map[upper] || cleanLabel(type);
}

/**
 * Human-readable leave category
 */
export function getLeaveTypeLabel(type) {
  if (!type) return 'Leave Application';
  const upper = String(type).toUpperCase();
  const map = {
    CASUAL: 'Casual Leave',
    MEDICAL: 'Medical Leave',
    EMERGENCY: 'Emergency Leave',
    DUTY: 'Duty Leave',
    OTHER: 'Special Leave',
  };
  return map[upper] || `${cleanLabel(type)} Leave`;
}

/**
 * Human-readable request status in Indian college conventions
 */
export function getStatusLabel(status) {
  if (!status) return 'Pending Review';
  const upper = String(status).toUpperCase();
  const map = {
    PENDING: 'Pending Review',
    RECOMMENDED_BY_TG: 'Recommended by TG',
    APPROVED_BY_HOD: 'Approved by HOD',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    REJECTED_BY_HOD: 'Rejected by HOD',
    REJECTED_BY_TG: 'Rejected by TG',
    CANCELLED: 'Cancelled',
  };
  return map[upper] || cleanLabel(status);
}

/**
 * Format lecture count with proper singular / plural
 */
export function formatLectures(count) {
  if (count === undefined || count === null) return '0 Lectures';
  const num = Number(count);
  return `${num} ${num === 1 ? 'Lecture' : 'Lectures'}`;
}

/**
 * Format date string into standard Indian format (e.g. "14 Oct 2026")
 * Avoids UTC timezone day-shift by parsing year-month-day components.
 */
export function formatDateIST(dateStr) {
  if (!dateStr) return 'Not available';
  try {
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
}

/**
 * Format timestamp into standard Indian format with time (e.g. "14 Oct 2026, 03:45 PM")
 */
export function formatDateTimeIST(dateStr) {
  if (!dateStr) return 'Not available';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(dateStr);
  }
}

/**
 * Format periods count
 */
export function formatPeriods(periods) {
  if (periods === undefined || periods === null) return '0 periods';
  const num = Number(periods);
  return `${num} ${num === 1 ? 'period' : 'periods'}`;
}

/**
 * Resolve display name without inventing mock names
 */
export function getFacultyDisplayName(user, designation) {
  if (user?.name && user.name.trim()) return user.name.trim();
  if (designation && designation.trim()) return designation.trim();
  return 'Faculty Member';
}

export function getStudentDisplayName(user, rollNumber) {
  if (user?.name && user.name.trim()) return user.name.trim();
  if (rollNumber && rollNumber.trim()) return `Student (${rollNumber.trim()})`;
  return 'Student';
}

/**
 * Extract clean single section letter (A, B, C, D) from section name, code, or object
 * Prevents overlapping (e.g. CSE-B being treated as C due to string includes('C'))
 */
export function getSectionLetter(sectionObjOrStr) {
  if (!sectionObjOrStr) return '';
  const str = (
    typeof sectionObjOrStr === 'string'
      ? sectionObjOrStr
      : (sectionObjOrStr.code || sectionObjOrStr.name || '')
  ).trim().toUpperCase();

  const cseMatch = str.match(/CSE[\s\-_]*(?:SEM\s*\d+[\s\-_]*|\d+[\s\-_]*)?([A-Z0-9]+)/i);
  if (cseMatch) return cseMatch[1].toUpperCase();

  const secMatch = str.match(/SEC(?:TION)?[\s\-_]*([A-Z0-9]+)/i);
  if (secMatch) return secMatch[1].toUpperCase();

  const endMatch = str.match(/(?:^|[\s\-_])([A-Z0-9]+)$/i);
  if (endMatch) return endMatch[1].toUpperCase();

  return str;
}

export default {
  DEFAULT_ACADEMIC_SESSION,
  FULL_ACADEMIC_SESSION,
  STATUS_LABELS,
  ACTION_LABELS,
  REQUEST_TYPE_LABELS,
  cleanLabel,
  getEventTypeLabel,
  getLeaveTypeLabel,
  getStatusLabel,
  formatLectures,
  formatDateIST,
  formatDateTimeIST,
  formatPeriods,
  getFacultyDisplayName,
  getStudentDisplayName,
  getSectionLetter,
};
