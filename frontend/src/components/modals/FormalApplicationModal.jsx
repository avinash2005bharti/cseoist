import React from 'react';
import { Printer, X, CheckCircle2 } from 'lucide-react';

function formatDateSlash(dateStr) {
  if (!dateStr) return '10/12/2026';
  try {
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number);
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '10/12/2026';
  }
}

function formatSanctionDate(dateVal) {
  if (!dateVal) return '12 Oct 2026';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '12 Oct 2026';
    const day = d.getDate();
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return '12 Oct 2026';
  }
}

function formatPeriodSlots(periods) {
  const periodSchedule = {
    1: '10:00 AM – 10:50 AM',
    2: '10:50 AM – 11:40 AM',
    3: '11:40 AM – 12:30 PM',
    4: '12:30 PM – 01:20 PM',
    5: '02:00 PM – 02:50 PM',
    6: '02:50 PM – 03:40 PM',
    7: '03:40 PM – 04:30 PM',
  };

  const pList = Array.isArray(periods) && periods.length > 0 ? periods : [2, 3, 4];
  return pList
    .map((p) => {
      const num = typeof p === 'string' ? parseInt(p.replace(/\D/g, ''), 10) || 1 : p;
      const time = periodSchedule[num] || '10:50 AM – 11:40 AM';
      return `P${num} (${time})`;
    })
    .join(', ');
}

export default function FormalApplicationModal({ item, onClose }) {
  if (!item) return null;

  const handlePrint = () => {
    window.print();
  };

  const isLeave =
    item.requestKind === 'LEAVE' ||
    Boolean(item.leaveType) ||
    Boolean(item.totalDays && !item.requestedPeriods);

  const studentName =
    item.student?.user?.name ||
    item.student?.name ||
    item.applicant?.name ||
    item.student?.designation ||
    'Student';

  const enrollmentNo =
    item.student?.enrollmentNumber ||
    item.student?.rollNumber ||
    item.applicant?.rollNumber ||
    'N/A';

  const semVal =
    item.student?.semester ||
    item.student?.section?.semester ||
    item.semester ||
    '';

  const secVal =
    item.student?.section?.name ||
    item.student?.section?.code ||
    '';

  const classAndSection = semVal && secVal ? `Semester ${semVal} — ${secVal}` : (semVal ? `Semester ${semVal}` : (secVal || '—'));

  const clearanceNature =
    item.category ||
    item.eventType ||
    item.leaveType ||
    item.type ||
    (isLeave ? 'Medical / Sickness Leave' : 'Hackathon / Technical Competition');

  const rawId = item._id ? String(item._id) : '3d4314f5-70d8-45d7-8cfa-5718fd6fec5d';
  const cleanId = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const refSuffix = cleanId.length >= 6 ? cleanId.slice(-6) : '6fec5d';
  const refNo = `OIST/CSE/2026/SANCTION-${refSuffix}`;

  const sanctionDate = formatSanctionDate(item.updatedAt || item.sanctionedAt || Date.now());

  const isGroup = Boolean(
    item.isGroup ||
    (Array.isArray(item.groupMembers) && item.groupMembers.length > 0)
  );

  // Build the roster of all group students
  const groupRoster = (() => {
    if (!isGroup) return [];

    let members = Array.isArray(item.groupMembers) && item.groupMembers.length > 0
      ? item.groupMembers
      : Array.isArray(item.sectionStudents) && item.sectionStudents.length > 0
      ? item.sectionStudents
      : [item.student];

    const leaderId =
      item.groupLeader?._id?.toString() ||
      item.groupLeader?.toString() ||
      item.student?._id?.toString() ||
      item.student?.toString();

    const seen = new Set();
    const result = [];

    for (const m of members) {
      if (!m) continue;
      const mId = m._id?.toString() || m.id?.toString() || m.rollNumber || m.name;
      if (seen.has(mId)) continue;
      seen.add(mId);

      const isLeader = Boolean(
        (m._id && m._id.toString() === leaderId) ||
        (m.id && m.id.toString() === leaderId) ||
        (m.user?._id && m.user._id.toString() === leaderId)
      );

      const name = m.user?.name || m.name || (isLeader ? studentName : 'Student');
      const roll = m.enrollmentNumber || m.rollNumber || enrollmentNo;
      const sec = m.section?.name || m.section?.code || secVal;
      const sem = m.semester || m.section?.semester || semVal;

      result.push({
        _id: mId,
        name,
        enrollmentNumber: roll,
        section: sec,
        semester: sem,
        isLeader,
      });
    }

    result.sort((a, b) => (b.isLeader ? 1 : 0) - (a.isLeader ? 1 : 0));
    return result;
  })();

  const orderTitle = isLeave
    ? 'OFFICIAL STUDENT LEAVE SANCTION ORDER'
    : isGroup
    ? 'OFFICIAL GROUP ATTENDANCE ON-DUTY (OD) SANCTION ORDER'
    : 'OFFICIAL ATTENDANCE ON-DUTY (OD) SANCTION ORDER';

  const sanctionBoxHeader = isLeave
    ? 'Sanctioned Student Leave Duration & Clearance:'
    : 'Sanctioned Attendance Consideration & Timings:';

  const fromDateStr = formatDateSlash(item.startDate);
  const toDateStr = formatDateSlash(item.endDate || item.startDate);

  const approvedPeriodsCount =
    item.approvedPeriods ||
    (Array.isArray(item.requestedPeriods) ? item.requestedPeriods.length : 3);

  const justificationText =
    item.description ||
    item.reason ||
    (isLeave ? '[Leave Exemption] Medical recuperation' : '[Hackathon / Technical Competition] hacthon');

  return (
    <>
      {/* Scoped CSS ensuring exact print styling matching Image 3 */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #formal-sanction-printable,
          #formal-sanction-printable * {
            visibility: visible !important;
          }
          #formal-sanction-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 20px !important;
            box-shadow: none !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .formal-modal-backdrop {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            overflow: visible !important;
          }
        }
      `}</style>

      <div
        className="formal-modal-backdrop fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        onClick={onClose}
      >
        <div
          id="formal-sanction-printable"
          className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative my-auto font-sans text-slate-900"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Header Bar matching Image 2 & Image 3 */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-bold text-slate-800 text-sm">
                Formal Sanctioned Application Document
              </span>
              <span className="text-[10px] font-bold text-emerald-600 tracking-wider uppercase ml-1">
                OFFICIALLY SANCTIONED
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="rounded-full border border-emerald-500 bg-white hover:bg-emerald-50 active:bg-emerald-100 text-emerald-600 px-3.5 py-1 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Printer size={13} className="text-emerald-600" />
                <span>Print / Save PDF</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition-colors"
                aria-label="Close modal"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Letterhead Header Section */}
          <div className="text-center pt-3 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 m-0">
              AUTONOMOUS ACADEMIC NEXUS • DEPARTMENTAL ADMINISTRATION
            </p>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight m-0 mt-1">
              ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY (OIST)
            </h2>
            <p className="text-xs sm:text-sm font-black text-blue-700 tracking-wide m-0 mt-0.5">
              DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING
            </p>
            <p className="text-[10px] font-medium text-slate-500 m-0 mt-0.5">
              Approved by AICTE, New Delhi & Affiliated to RGPV, Bhopal (M.P.)
            </p>
          </div>

          {/* Thin Divider Line */}
          <div className="border-b border-slate-200 my-2.5" />

          {/* Reference No & Date of Sanction Row */}
          <div className="flex items-center justify-between text-xs text-slate-700 font-medium px-1">
            <div>
              <span>Ref. No: </span>
              <strong className="text-slate-900 font-bold font-mono">{refNo}</strong>
            </div>
            <div>
              <span>Date of Sanction: </span>
              <strong className="text-slate-900 font-bold">{sanctionDate}</strong>
            </div>
          </div>

          {/* Order Title Box */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-2.5 sm:p-3 my-3 text-center">
            <div className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
              {orderTitle}
            </div>
            <div className="text-[10px] font-bold text-emerald-600 flex items-center justify-center gap-1.5 mt-0.5">
              <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
              <span>Formally Authorized & Digitally Certified in CampusFlow ERP</span>
            </div>
          </div>

          {/* Student Info Box (Individual vs Group Roster Table) */}
          {isGroup ? (
            <div className="rounded-xl border border-indigo-200/90 bg-indigo-50/20 p-3 sm:p-4 my-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-indigo-100">
                <div>
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                    Group Consideration Roster
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    Team Lead: <span className="text-indigo-900">{studentName}</span> ({enrollmentNo})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    {groupRoster.length} Participating Student{groupRoster.length !== 1 ? 's' : ''}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {clearanceNature}
                  </span>
                </div>
              </div>

              {/* Official Group Roster Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      <th className="py-2 px-2.5 text-center w-10">S.No</th>
                      <th className="py-2 px-3">Student Name</th>
                      <th className="py-2 px-2.5 text-center">Role</th>
                      <th className="py-2 px-3">Enrollment / Roll No.</th>
                      <th className="py-2 px-3">Semester & Section</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupRoster.map((st, idx) => (
                      <tr key={st._id || idx} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="py-2 px-2.5 text-center font-bold text-slate-400 text-[11px]">
                          #{idx + 1}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {st.name}
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          {st.isLeader ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-100 text-indigo-700 border border-indigo-200">
                              Team Lead
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Member
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] font-semibold text-slate-700">
                          {st.enrollmentNumber}
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-medium text-[11px]">
                          Sem {st.semester} • {st.section}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/20 p-3 sm:p-4 my-3 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                    Student Name
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-800 block mt-0.5">
                    {studentName}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                    Enrollment / Roll No.
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-800 block mt-0.5">
                    {enrollmentNo}
                  </span>
                </div>

                <div className="mt-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                    Class & Section
                  </span>
                  <span className="text-xs font-bold text-slate-800 block mt-0.5">
                    {classAndSection}
                  </span>
                </div>

                <div className="mt-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                    Clearance Nature
                  </span>
                  <span className="text-xs font-bold text-slate-800 block mt-0.5">
                    {clearanceNature}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Formal Certification Paragraph */}
          {isGroup ? (
            <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed my-3 font-normal">
              This is to formally certify that the group academic attendance clearance application submitted by
              Team Lead <strong className="text-slate-900 font-bold">{studentName}</strong> (Roll No:{' '}
              <strong className="text-slate-900 font-bold">{enrollmentNo}</strong>) on behalf of{' '}
              <strong className="text-slate-900 font-bold">{groupRoster.length} participating students</strong> across
              designated academic sections has been verified and evaluated in accordance with the institution's
              autonomous academic regulations. The application has been scrutinized by the respective Teacher
              Guardians (TGs) and formally sanctioned by the Head of the Department (HOD CSE).
            </p>
          ) : (
            <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed my-3 font-normal">
              This is to formally certify that the academic clearance application submitted by{' '}
              <strong className="text-slate-900 font-bold">{studentName}</strong> (Roll No:{' '}
              <strong className="text-slate-900 font-bold">{enrollmentNo}</strong>) has been verified
              and evaluated in accordance with the institution's autonomous academic regulations. The
              application has been scrutinized by the appointed Teacher Guardian (TG) and formally
              sanctioned by the Head of the Department (HOD CSE).
            </p>
          )}

          {/* Sanctioned Timing / Duration Box */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-2.5 sm:p-3 my-3 text-xs">
            <span className="text-xs font-bold text-blue-900 block mb-1">
              {sanctionBoxHeader}
            </span>
            {isLeave ? (
              <p className="text-xs text-slate-700 m-0 leading-relaxed">
                <span className="text-slate-600 font-medium">Days Approved:</span>{' '}
                <strong className="font-bold text-blue-700 mx-1">
                  {item.totalDays || 1} Academic Day(s)
                </strong>{' '}
                <span className="text-slate-600 font-medium ml-2">Effective Period:</span>{' '}
                <strong className="text-slate-800 ml-1">
                  {fromDateStr} – {toDateStr} (Full Day Academic Exemption)
                </strong>
              </p>
            ) : (
              <p className="text-xs text-slate-700 m-0 leading-relaxed">
                <span className="text-slate-600 font-medium">Periods Approved:</span>{' '}
                <strong className="font-bold text-blue-700 mx-1">
                  {approvedPeriodsCount} Lecture
                </strong>{' '}
                <span className="text-slate-600 font-medium ml-2">Time Slots Covered:</span>{' '}
                <strong className="text-slate-800 ml-1">
                  {formatPeriodSlots(item.requestedPeriods)}
                </strong>
              </p>
            )}
          </div>

          {/* Schedule & Justification Lines */}
          <div className="text-[11px] sm:text-xs text-slate-700 space-y-1.5 my-3">
            <div>
              <span className="font-bold text-slate-800">Sanctioned Schedule / Dates: </span>
              <span>
                {fromDateStr} - {toDateStr}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-800">Activity Justification & Particulars: </span>
              <span>{justificationText}</span>
            </div>
          </div>

          {/* Divider Line */}
          <div className="border-t border-slate-200 pt-3 mt-4" />

          {/* Dual Digital Signatures Section */}
          <div className="grid grid-cols-2 gap-4 text-xs pt-1">
            {/* Left Column: Teacher Guardian */}
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 inline-flex items-center gap-1">
                ✓ VERIFIED & RECOMMENDED
              </span>
              <strong className="text-xs font-bold text-slate-800 mt-1.5 block">
                Teacher Guardian (TG)
              </strong>
              <span className="text-[10px] text-slate-500 block">
                Mentor, {secVal} • Dept. of CSE
              </span>
              <span className="text-[9px] text-slate-400 block mt-0.5">
                CampusFlow Digital ID Verification
              </span>
            </div>

            {/* Right Column: Head of Department */}
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 inline-flex items-center gap-1">
                ✓ DIGITALLY SIGNED & SANCTIONED
              </span>
              <strong className="text-xs font-bold text-slate-800 mt-1.5 block">
                Head of Department (HOD)
              </strong>
              <span className="text-[10px] text-slate-500 block">
                Computer Science & Engineering • OIST
              </span>
              <span className="text-[9px] text-slate-400 block mt-0.5">
                Synchronized into Departmental Live Master Register
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
