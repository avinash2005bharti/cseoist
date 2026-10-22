import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.jsx';
import { considerationApi } from '../../api';
import {
  X,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  CheckCheck,
  UserX,
  UserCheck,
  FileText,
  Calendar,
} from 'lucide-react';

import { getSectionLetter } from '../../utils/constants.js';

export default function GroupStudentAuditModal({
  request,
  userRole = 'HOD',
  onClose,
  onSuccess,
}) {
  const { addToast } = useERP();
  const [currentRequest, setCurrentRequest] = useState(request);
  const [loadingStudentId, setLoadingStudentId] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [excludingStudentId, setExcludingStudentId] = useState(null);
  const [excludeReason, setExcludeReason] = useState('');

  if (!currentRequest) return null;

  // Determine all members to audit:
  // For TG: strictly scope to students belonging to the TG's assigned section
  // For HOD / Admin: full group members roster across all sections
  const isTG = userRole === 'TG';
  const memberMap = new Map();

  const addMember = (m) => {
    if (!m) return;
    const id = (m._id || m).toString();
    if (!memberMap.has(id)) {
      memberMap.set(id, m);
    }
  };

  const reqSection =
    currentRequest.sectionStudents?.[0]?.section ||
    currentRequest.student?.section;
  const targetSectionLetter = getSectionLetter(reqSection);
  const targetSectionId = (reqSection?._id || reqSection)?.toString();

  const belongsToThisSection = (student) => {
    if (!student) return false;
    const sId = (student._id || student).toString();
    if (Array.isArray(currentRequest.sectionStudents)) {
      const inSec = currentRequest.sectionStudents.some(
        (s) => (s?._id || s)?.toString() === sId
      );
      if (inSec) return true;
    }
    const sSec = student.section;
    const sSecId = (sSec?._id || sSec)?.toString();
    if (targetSectionId && sSecId && sSecId === targetSectionId) return true;
    if (targetSectionLetter) {
      const sLetter = getSectionLetter(sSec);
      if (sLetter && sLetter === targetSectionLetter) return true;
    }
    return false;
  };

  if (isTG) {
    // Strictly isolate to students in this TG's assigned section
    if (Array.isArray(currentRequest.sectionStudents) && currentRequest.sectionStudents.length > 0) {
      currentRequest.sectionStudents.forEach(addMember);
    } else if (Array.isArray(currentRequest.groupMembers) && currentRequest.groupMembers.length > 0) {
      currentRequest.groupMembers.filter(belongsToThisSection).forEach(addMember);
    } else if (currentRequest.student && belongsToThisSection(currentRequest.student)) {
      addMember(currentRequest.student);
    }

    // Only include previously audited/excluded students if they belong to this section
    (currentRequest.studentAudits || []).forEach((a) => {
      if (a.student && typeof a.student === 'object' && a.student._id && belongsToThisSection(a.student)) {
        addMember(a.student);
      }
    });
  } else {
    // For HOD / Admin: review all members across all sections
    if (currentRequest.student) addMember(currentRequest.student);
    if (Array.isArray(currentRequest.groupMembers)) {
      currentRequest.groupMembers.forEach(addMember);
    }
    if (Array.isArray(currentRequest.sectionStudents)) {
      currentRequest.sectionStudents.forEach(addMember);
    }
    (currentRequest.studentAudits || []).forEach((a) => {
      if (a.student && typeof a.student === 'object' && a.student._id) {
        addMember(a.student);
      }
    });
  }

  const memberList = Array.from(memberMap.values());

  // Helper to get audit record for a student
  const getAuditRecord = (studentId) => {
    const sIdStr = studentId?.toString();
    const audits = currentRequest.studentAudits || [];
    return audits.find((a) => (a.student?._id || a.student)?.toString() === sIdStr);
  };

  const getStudentStatus = (studentId) => {
    const record = getAuditRecord(studentId);
    return record?.status || 'VERIFIED';
  };

  // Counts
  const totalCount = memberList.length;
  const excludedCount = memberList.filter(
    (m) => getStudentStatus(m._id || m) === 'EXCLUDED'
  ).length;
  const verifiedCount = totalCount - excludedCount;

  const handleAuditToggle = async (student, newStatus, remarks = '') => {
    const studentId = student._id || student;
    setLoadingStudentId(studentId);
    try {
      const res = await considerationApi.auditStudent(currentRequest._id, {
        studentId: studentId.toString(),
        status: newStatus,
        remarks: remarks || (newStatus === 'EXCLUDED' ? 'Excluded during group audit' : 'Verified during audit'),
      });
      const updatedReq = res?.data || res;
      setCurrentRequest(updatedReq);
      setExcludingStudentId(null);
      setExcludeReason('');
      addToast(
        newStatus === 'EXCLUDED' ? 'Student Excluded' : 'Student Verified',
        `${student.user?.name || student.name || 'Student'} marked as ${newStatus} for this group consideration.`,
        newStatus === 'EXCLUDED' ? 'warning' : 'success'
      );
      if (onSuccess) onSuccess(updatedReq);
    } catch (err) {
      addToast('Audit Action Failed', err.message || 'Could not update student audit status', 'danger');
    } finally {
      setLoadingStudentId(null);
    }
  };

  const handleAuditAll = async (status) => {
    setBatchLoading(true);
    try {
      const res = await considerationApi.auditAllStudents(currentRequest._id, {
        status,
        remarks: status === 'VERIFIED' ? 'All students verified by reviewer' : 'All students excluded',
      });
      const updatedReq = res?.data || res;
      setCurrentRequest(updatedReq);
      addToast(
        'Batch Audit Updated',
        `All group members have been marked as ${status}.`,
        status === 'VERIFIED' ? 'success' : 'warning'
      );
      if (onSuccess) onSuccess(updatedReq);
    } catch (err) {
      addToast('Batch Action Failed', err.message || 'Could not update group members', 'danger');
    } finally {
      setBatchLoading(false);
    }
  };

  const commonReasons = [
    'Did not attend the competition',
    'No valid participation proof submitted',
    'Attendance criteria not met',
    'Requested removal by student',
    'Not eligible for department OD',
  ];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm"
      style={{ zIndex: 100050 }}
      onClick={onClose}
    >
      <div
        className="flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden max-w-2xl w-full max-h-[92vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0 shadow-2xs">
              <UserCheck size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 truncate m-0">
                  Audit Group Students
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 border border-indigo-200 shrink-0">
                  {isTG && targetSectionLetter ? `Section ${targetSectionLetter} TG` : `${userRole} Management`}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate m-0 mt-0.5">
                {currentRequest.eventTitle || 'Group Consideration'} • {isTG && targetSectionLetter ? `Section ${targetSectionLetter} Roster` : 'Sanction control per applicant'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stats & Quick Actions Bar */}
        <div className="px-5 sm:px-6 py-3 bg-indigo-50/40 border-b border-indigo-100/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Users size={14} className="text-indigo-600 shrink-0" />
              <span>Total: <strong className="text-slate-900">{totalCount}</strong></span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1.5 font-bold text-emerald-700">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>Verified: <strong className="text-emerald-900">{verifiedCount}</strong></span>
            </div>
            {excludedCount > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <div className="flex items-center gap-1.5 font-bold text-rose-700">
                  <XCircle size={14} className="text-rose-600 shrink-0" />
                  <span>Excluded: <strong className="text-rose-900">{excludedCount}</strong></span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={batchLoading || excludedCount === 0}
              onClick={() => handleAuditAll('VERIFIED')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
              title="Verify all group members"
            >
              <CheckCheck size={13} />
              <span>Verify All</span>
            </button>
          </div>
        </div>

        {/* Informative Note */}
        <div className="px-5 sm:px-6 py-2.5 bg-amber-50/60 border-b border-amber-200/60 text-[11px] text-amber-900 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Auditing Rule:</strong> Only students marked as <strong>Verified</strong> will be included in the official attendance sanction order. Excluded students will receive an exclusion notice and no attendance waiver.
          </span>
        </div>

        {/* Students Roster List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {memberList.map((m, idx) => {
            const mId = (m._id || m).toString();
            const mName = m.user?.name || m.name || 'Student';
            const mRoll = m.enrollmentNumber || m.rollNumber || '-';
            const mSec = m.section?.name || m.section?.code || m.section || 'General';
            const mSem = m.section?.semester || m.semester || 5;
            const leadId = (
              currentRequest.groupLeader?._id ||
              currentRequest.groupLeader ||
              currentRequest.student?._id ||
              currentRequest.student
            )?.toString();
            const isLead = (leadId && mId === leadId) || (idx === 0 && !currentRequest.groupLeader);
            const audit = getAuditRecord(mId);
            const isExcluded = audit?.status === 'EXCLUDED';
            const isLoading = loadingStudentId === mId;
            const isExcludingThis = excludingStudentId === mId;

            return (
              <div
                key={mId || idx}
                className={`p-4 rounded-2xl border transition-all ${
                  isExcluded
                    ? 'bg-rose-50/40 border-rose-200 shadow-2xs'
                    : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Student Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                        isExcluded
                          ? 'bg-rose-100 text-rose-700 border border-rose-300'
                          : isLead
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {isLead ? '★' : mName.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-black text-sm tracking-tight ${
                            isExcluded ? 'text-rose-950 line-through opacity-80' : 'text-slate-900'
                          }`}
                        >
                          {mName}
                        </span>

                        {isLead && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                            ★ Team Lead
                          </span>
                        )}

                        {isExcluded ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                            <XCircle size={11} />
                            <span>Excluded from Sanction</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 size={11} />
                            <span>Verified Eligible</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1 flex-wrap">
                        <span className="font-mono text-slate-700 font-bold">{mRoll}</span>
                        <span className="text-slate-300">•</span>
                        <span>Sem {mSem}</span>
                        <span className="text-slate-300">•</span>
                        <span>Sec {mSec}</span>
                      </div>

                      {/* Exclusion details if any */}
                      {isExcluded && audit && (
                        <div className="mt-2 p-2 rounded-xl bg-rose-100/70 border border-rose-200 text-xs text-rose-900">
                          <span className="font-bold">Reason:</span> {audit.remarks || 'Excluded by reviewer'}
                          {audit.auditedByRole && (
                            <span className="text-[11px] text-rose-700 block mt-0.5">
                              Audited by {audit.auditedByRole} on{' '}
                              {new Date(audit.auditedAt || Date.now()).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isExcluded ? (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleAuditToggle(m, 'VERIFIED')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw size={13} />
                        <span>{isLoading ? 'Updating...' : 'Reinstate / Verify'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => {
                          if (isExcludingThis) {
                            setExcludingStudentId(null);
                          } else {
                            setExcludingStudentId(mId);
                            setExcludeReason('');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <UserX size={13} />
                        <span>Exclude</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Exclusion Form when Exclude button clicked */}
                {isExcludingThis && !isExcluded && (
                  <div className="mt-3 pt-3 border-t border-slate-200/90 animate-in fade-in duration-150 bg-rose-50/20 p-3 rounded-2xl border border-rose-200/60">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                        <AlertTriangle size={14} className="text-rose-600" />
                        <span>Specify Reason to Exclude {mName}:</span>
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Click a reason option or type custom
                      </span>
                    </div>

                    {/* Selectable Reason Option Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                      {commonReasons.map((r, i) => {
                        const isSelected = excludeReason === r;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setExcludeReason(r)}
                            className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center gap-2.5 cursor-pointer ${
                              isSelected
                                ? 'bg-rose-50 border-rose-500 text-rose-950 shadow-xs ring-2 ring-rose-400/40'
                                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-2xs hover:border-slate-400'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                                isSelected
                                  ? 'border-rose-600 bg-rose-600 text-white shadow-2xs'
                                  : 'border-slate-400 bg-white'
                              }`}
                            >
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <span className="leading-snug flex-1">{r}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom reason input + actions */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={excludeReason}
                        onChange={(e) => setExcludeReason(e.target.value)}
                        placeholder="Selected option or custom reason..."
                        className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 focus:outline-none shadow-2xs"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() =>
                            handleAuditToggle(m, 'EXCLUDED', excludeReason || 'Excluded by reviewer')
                          }
                          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <UserX size={14} />
                          <span>{isLoading ? 'Excluding...' : 'Confirm Exclusion'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExcludingStudentId(null);
                            setExcludeReason('');
                          }}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer border border-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-700">{verifiedCount} of {totalCount}</span> {isTG && targetSectionLetter ? `Section ${targetSectionLetter} students` : 'students'} currently verified for attendance sanction.
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            Done Auditing
          </button>
        </div>
      </div>
    </div>
  );
}
