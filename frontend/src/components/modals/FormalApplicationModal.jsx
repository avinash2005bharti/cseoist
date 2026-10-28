import React from 'react';
import { Printer, X, CheckCircle2 } from 'lucide-react';

function formatDateSlash(dateStr) {
  if (!dateStr) return '26/10/2026';
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
    return '26/10/2026';
  }
}

function formatSanctionDate(dateVal) {
  if (!dateVal) return '26 Oct 2026';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '26 Oct 2026';
    const day = d.getDate();
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return '26 Oct 2026';
  }
}

function formatPeriodSlots(periods, count = 3) {
  const periodSchedule = {
    1: '10:00 AM – 10:50 AM',
    2: '10:50 AM – 11:40 AM',
    3: '11:40 AM – 12:30 PM',
    4: '12:30 PM – 01:20 PM',
    5: '02:00 PM – 02:50 PM',
    6: '02:50 PM – 03:40 PM',
    7: '03:40 PM – 04:30 PM',
  };

  let pList = [];
  if (Array.isArray(periods) && periods.length > 0) {
    pList = periods;
  } else if (typeof count === 'number' && count > 0) {
    pList = Array.from({ length: Math.min(count, 7) }, (_, i) => i + 2);
  } else {
    pList = [2, 3, 4];
  }

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
    const printable = document.getElementById('formal-sanction-printable');
    if (!printable) {
      window.print();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.name = 'campusflow_print_frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    // Collect Google Fonts
    const fontLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .filter((el) => el.href && el.href.includes('fonts.googleapis.com'))
      .map((el) => el.outerHTML)
      .join('\n');

    const cloned = printable.cloneNode(true);
    const noPrintElements = cloned.querySelectorAll('.no-print');
    noPrintElements.forEach((el) => el.remove());

    // Clean IDs and classes so modal popup styles with drop shadows never leak into print
    cloned.id = 'official-sanction-letter-doc';
    cloned.className = 'official-sanction-letter-doc';
    cloned.removeAttribute('style');

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Official Sanction Order - CampusFlow Lite</title>
          ${fontLinks}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            *, *::before, *::after {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-shadow: none !important;
              -webkit-box-shadow: none !important;
              text-shadow: none !important;
              filter: none !important;
              -webkit-filter: none !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
              width: 100% !important;
              height: 100% !important;
            }
            .official-sanction-letter-doc {
              position: relative !important;
              border: 1.5px solid #0f172a !important;
              border-radius: 6px !important;
              padding: 24px 28px !important;
              margin: 0 !important;
              background: #ffffff !important;
              width: 100% !important;
              max-width: 100% !important;
              min-height: 260mm !important;
              box-shadow: none !important;
              -webkit-box-shadow: none !important;
              filter: none !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              gap: 12px !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .formal-letterhead {
              text-align: center !important;
              width: 100% !important;
              margin: 0 auto !important;
            }
            .formal-letterhead p {
              margin: 0 !important;
            }
            .formal-letterhead h2 {
              font-size: 20px !important;
              font-weight: 800 !important;
              color: #0f172a !important;
              margin: 4px 0 !important;
              letter-spacing: -0.01em !important;
            }
            .border-b {
              border-bottom: 1.5px solid #cbd5e1 !important;
            }
            .grid {
              display: grid !important;
            }
            .grid-cols-2 {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 16px !important;
            }
            .rounded-xl {
              border-radius: 8px !important;
            }
            .border {
              border-width: 1px !important;
              border-style: solid !important;
            }
            .border-slate-200 {
              border-color: #cbd5e1 !important;
            }
            .border-blue-100 {
              border-color: #dbeafe !important;
            }
            .bg-blue-50\\/20 {
              background-color: #f8fafc !important;
            }
            .bg-white {
              background-color: #ffffff !important;
            }
            .text-emerald-700 {
              color: #047857 !important;
            }
            .text-emerald-600 {
              color: #059669 !important;
            }
            .text-blue-700 {
              color: #1d4ed8 !important;
            }
            .bg-emerald-50 {
              background-color: #ecfdf5 !important;
            }
            .border-emerald-200 {
              border-color: #a7f3d0 !important;
            }
            .bg-blue-50 {
              background-color: #eff6ff !important;
            }
            .border-blue-200 {
              border-color: #bfdbfe !important;
            }
            .text-xs {
              font-size: 12px !important;
              line-height: 16px !important;
            }
            .text-sm {
              font-size: 14px !important;
              line-height: 20px !important;
            }
            .font-bold {
              font-weight: 700 !important;
            }
            .font-semibold {
              font-weight: 600 !important;
            }
            .font-medium {
              font-weight: 500 !important;
            }
            .font-mono {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
            }
            .uppercase {
              text-transform: uppercase !important;
            }
            .tracking-wider {
              letter-spacing: 0.05em !important;
            }
            .tracking-wide {
              letter-spacing: 0.025em !important;
            }
            .leading-relaxed {
              line-height: 1.625 !important;
            }
            .flex {
              display: flex !important;
            }
            .items-center {
              align-items: center !important;
            }
            .justify-between {
              justify-content: space-between !important;
            }
            .justify-center {
              justify-content: center !important;
            }
            .gap-1\\.5 {
              gap: 6px !important;
            }
            .gap-4 {
              gap: 16px !important;
            }
            .p-2\\.5 {
              padding: 10px !important;
            }
            .p-3 {
              padding: 12px !important;
            }
            .p-3\\.5 {
              padding: 14px !important;
            }
            .px-1 {
              padding-left: 4px !important;
              padding-right: 4px !important;
            }
            .px-2\\.5 {
              padding-left: 10px !important;
              padding-right: 10px !important;
            }
            .py-0\\.5 {
              padding-top: 2px !important;
              padding-bottom: 2px !important;
            }
            .pt-1 {
              padding-top: 4px !important;
            }
            .pt-2 {
              padding-top: 8px !important;
            }
            .pt-3 {
              padding-top: 12px !important;
            }
            .pb-1 {
              padding-bottom: 4px !important;
            }
            .mt-0\\.5 {
              margin-top: 2px !important;
            }
            .mt-1 {
              margin-top: 4px !important;
            }
            .mt-1\\.5 {
              margin-top: 6px !important;
            }
            .mt-3 {
              margin-top: 12px !important;
            }
            .mt-4 {
              margin-top: 16px !important;
            }
            .mt-auto {
              margin-top: auto !important;
            }
            .mr-2 {
              margin-right: 8px !important;
            }
            .ml-1 {
              margin-left: 4px !important;
            }
            .ml-2 {
              margin-left: 8px !important;
            }
            .mx-1 {
              margin-left: 4px !important;
              margin-right: 4px !important;
            }
            .mb-1 {
              margin-bottom: 4px !important;
            }
            .my-2\\.5 {
              margin-top: 10px !important;
              margin-bottom: 10px !important;
            }
            .my-3 {
              margin-top: 12px !important;
              margin-bottom: 12px !important;
            }
            .space-y-1\\.5 > :not([hidden]) ~ :not([hidden]) {
              margin-top: 6px !important;
            }
            .shrink-0 {
              flex-shrink: 0 !important;
            }
            .block {
              display: block !important;
            }
            .inline-flex {
              display: inline-flex !important;
            }
            .rounded-full {
              border-radius: 9999px !important;
            }
            .text-center {
              text-align: center !important;
            }
            .text-slate-900 {
              color: #0f172a !important;
            }
            .text-slate-700 {
              color: #334155 !important;
            }
            .text-slate-600 {
              color: #475569 !important;
            }
            .text-slate-500 {
              color: #64748b !important;
            }
            .text-slate-400 {
              color: #94a3b8 !important;
            }
            .no-print {
              display: none !important;
            }
          </style>
        </head>
        <body style="background: white; padding: 0;">
          ${cloned.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 2000);
    }, 300);
  };

  const isLeave =
    item.requestKind === 'LEAVE' ||
    Boolean(item.leaveType) ||
    Boolean(item.totalDays && !item.requestedPeriods);

  const studentName =
    item.student?.user?.name ||
    item.student?.name ||
    item.applicant?.name ||
    item.studentName ||
    'Avinash Bharti';

  const enrollmentNo =
    item.student?.enrollmentNumber ||
    item.student?.rollNumber ||
    item.applicant?.rollNumber ||
    item.enrollmentNo ||
    '0105CS241101';

  const semVal =
    item.student?.semester ||
    item.student?.section?.semester ||
    item.semester ||
    '5';

  const secVal =
    item.student?.section?.name ||
    item.student?.section?.code ||
    item.section ||
    'Section B';

  const classAndSection = semVal && secVal ? `Semester ${semVal} — ${secVal}` : (semVal ? `Semester ${semVal}` : (secVal || 'Section B'));

  const clearanceNature =
    item.category ||
    item.eventType ||
    item.leaveType ||
    item.type ||
    (isLeave ? 'MEDICAL' : 'SPORTS');

  const rawId = item._id ? String(item._id) : (item.id ? String(item.id) : '3fcc65');
  const cleanId = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const refSuffix = cleanId.length >= 6 ? cleanId.slice(-6) : (cleanId || '3fcc65');
  const refNo = `OIST/CSE/2026/SANCTION-${refSuffix}`;

  const sanctionDate = formatSanctionDate(item.hodReview?.reviewedAt || item.updatedAt || item.sanctionedAt || item.createdAt || Date.now());

  const orderTitle = isLeave
    ? 'OFFICIAL STUDENT LEAVE SANCTION ORDER'
    : 'OFFICIAL ATTENDANCE ON-DUTY (OD) SANCTION ORDER';

  const sanctionBoxHeader = isLeave
    ? 'Sanctioned Student Leave Duration & Clearance:'
    : 'Sanctioned Attendance Consideration & Timings:';

  const fromDateStr = formatDateSlash(item.startDate);
  const toDateStr = formatDateSlash(item.endDate || item.startDate);

  const approvedPeriodsCount =
    item.approvedPeriods ||
    item.hodReview?.approvedPeriods ||
    (Array.isArray(item.requestedPeriods) ? item.requestedPeriods.length : 3);

  const justificationText =
    item.description ||
    item.reason ||
    'testing purpose';

  return (
    <>
      <div
        className="modal-backdrop formal-modal-backdrop fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        onClick={onClose}
      >
        <div
          id="formal-sanction-printable"
          className="modal-container formal-sanction-container bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-slate-200 relative my-auto font-sans text-slate-900"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Header Bar matching Image 2 */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 no-print formal-modal-header">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">
                Formal Sanctioned Application Document
              </span>
              <span className="text-xs font-bold text-emerald-600 tracking-wider uppercase ml-1">
                OFFICIALLY SANCTIONED
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="formal-print-btn rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-emerald-700 px-3.5 py-1 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
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

          {/* Institutional Letterhead Section */}
          <div className="formal-letterhead text-center pt-2 pb-1">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-700 m-0">
              ACADEMIC OFFICE • DEPARTMENTAL ADMINISTRATION
            </p>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight m-0 mt-1">
              ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY (OIST)
            </h2>
            <p className="text-xs sm:text-sm font-bold text-[#2563EB] tracking-wide m-0 mt-0.5 uppercase">
              DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING
            </p>
            <p className="text-xs font-medium text-slate-500 m-0 mt-0.5">
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
          <div className="rounded-xl border border-blue-100 bg-blue-50/20 p-2.5 sm:p-3 my-3 text-center">
            <div className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">
              {orderTitle}
            </div>
            <div className="text-xs font-semibold text-emerald-600 flex items-center justify-center gap-1.5 mt-0.5">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span>Formally Authorized & Digitally Certified in CampusFlow ERP</span>
            </div>
          </div>

          {/* Student Particulars Card (4-grid matching Image 2) */}
          <div className="rounded-xl border border-slate-200 p-3.5 sm:p-4 my-3 text-xs bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">
                  STUDENT NAME
                </span>
                <span className="text-sm font-bold text-emerald-700 block mt-0.5">
                  {studentName}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">
                  ENROLLMENT / ROLL NO.
                </span>
                <span className="text-sm font-bold text-emerald-700 font-mono block mt-0.5">
                  {enrollmentNo}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">
                  CLASS & SECTION
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {classAndSection}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">
                  CLEARANCE NATURE
                </span>
                <span className="text-sm font-bold text-slate-900 uppercase block mt-0.5">
                  {clearanceNature}
                </span>
              </div>
            </div>
          </div>

          {/* Formal Certification Paragraph */}
          <p className="text-xs text-slate-700 leading-relaxed my-3 font-normal">
            This is to formally certify that the academic clearance application submitted by{' '}
            <strong className="text-slate-900 font-bold">{studentName}</strong> (Roll No:{' '}
            <strong className="text-slate-900 font-bold font-mono">{enrollmentNo}</strong>) has been verified
            and evaluated in accordance with the institution's autonomous academic regulations. The
            application has been scrutinized by the appointed Teacher Guardian (TG) and formally
            sanctioned by the Head of the Department (HOD CSE).
          </p>

          {/* Sanctioned Timing / Duration Box */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/20 p-3 my-3 text-xs">
            <span className="text-xs font-bold text-slate-900 block mb-1">
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
                <span>Periods Approved: </span>
                <strong className="font-bold text-blue-700 mr-2">
                  {approvedPeriodsCount} {approvedPeriodsCount === 1 ? 'Lecture' : 'Lectures'}
                </strong>
                <span>Time Duration: </span>
                <strong className="text-slate-900">
                  {formatPeriodSlots(item.selectedPeriods || item.requestedPeriods, approvedPeriodsCount)}
                </strong>
              </p>
            )}
          </div>

          {/* Schedule & Justification Lines */}
          <div className="text-xs text-slate-700 space-y-1.5 my-3">
            <div>
              <strong className="text-slate-900 font-bold">Sanctioned Schedule / Dates: </strong>
              <span>
                {fromDateStr} - {toDateStr}
              </span>
            </div>
            <div>
              <strong className="text-slate-900 font-bold">Activity Justification & Particulars: </strong>
              <span>{justificationText}</span>
            </div>
          </div>

          {/* Dual Digital Signatures Section */}
          <div className="border-t border-slate-200 pt-3 mt-4" />
          <div className="grid grid-cols-2 gap-4 text-xs pt-1">
            {/* Left Column: Teacher Guardian */}
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 inline-flex items-center gap-1">
                ✓ VERIFIED & RECOMMENDED
              </span>
              <strong className="text-xs font-bold text-slate-900 mt-1.5 block">
                Teacher Guardian (TG)
              </strong>
              <span className="text-xs text-slate-600 block">
                Tutor Guardian, {secVal || 'Section B'} • Dept. of CSE
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                CampusFlow Digital ID Verification
              </span>
            </div>

            {/* Right Column: Head of Department */}
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 inline-flex items-center gap-1">
                ✓ DIGITALLY SIGNED & SANCTIONED
              </span>
              <strong className="text-xs font-bold text-slate-900 mt-1.5 block">
                Head of Department (HOD)
              </strong>
              <span className="text-xs text-slate-600 block">
                Computer Science & Engineering • OIST
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Synchronized into Departmental Live Master Register
              </span>
            </div>
          </div>

          {/* Official Academic Seal & Verification Notice (Printed Official Letter Footer) */}
          <div className="official-letter-footer text-center pt-3 mt-auto border-t border-slate-200 text-[10px] text-slate-500 font-medium">
            Official Academic Clearance Document • Oriental Institute of Science &amp; Technology (OIST) • Verified via CampusFlow ERP System
          </div>
        </div>
      </div>
    </>
  );
}
