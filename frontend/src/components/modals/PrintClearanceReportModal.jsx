import React, { useState, useMemo, useEffect } from 'react';
import { X, Printer, Calendar, Users, Layers, Filter, CheckCircle2 } from 'lucide-react';
import { masterDataApi } from '../../api';

export default function PrintClearanceReportModal({
  items = [],
  sections: initialSections = [],
  defaultSemester = 'ALL',
  onClose,
}) {
  const [selectedSemester, setSelectedSemester] = useState(defaultSemester);
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [reportType, setReportType] = useState('ALL'); // 'ALL' | 'CONSIDERATION' | 'LEAVE' | 'APPROVED_ONLY'
  const [sections, setSections] = useState(initialSections);

  // Fetch sections from master data if not provided or empty
  useEffect(() => {
    if (initialSections && initialSections.length > 0) {
      setSections(initialSections);
    } else {
      masterDataApi.getSections()
        .then((res) => {
          const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
          if (list.length > 0) {
            setSections(list);
          }
        })
        .catch((err) => {
          console.warn('Error fetching sections in PrintClearanceReportModal:', err);
        });
    }
  }, [initialSections]);

  // Dynamic available sections based on chosen semester
  const sectionOptions = useMemo(() => {
    if (selectedSemester === 'ALL') {
      const allUniqueLetters = new Set();

      // From fetched sections in master data
      sections.forEach((s) => {
        const clean = (s.name || '').replace(/^Section\s*/i, '').trim() || (s.code || '').replace(/^CSE-/i, '').trim();
        if (clean) allUniqueLetters.add(clean.toUpperCase());
      });

      // From active items
      items.forEach((item) => {
        const sec = (item.student?.section?.name || item.student?.section?.code || item.section?.name || item.section || '')
          .replace(/^Section\s*/i, '')
          .replace(/^CSE-/i, '')
          .trim();
        if (sec) allUniqueLetters.add(sec.toUpperCase());
      });

      // Standard department fallback if empty
      if (allUniqueLetters.size === 0) {
        ['A', 'B', 'C', 'D'].forEach((l) => allUniqueLetters.add(l));
      }

      const sorted = Array.from(allUniqueLetters).sort();
      return [
        { id: 'ALL', label: 'All Sections (Department-wide)' },
        ...sorted.map((letter) => ({
          id: `Section ${letter}`,
          label: `Section ${letter}`,
        })),
      ];
    }

    // Specific semester chosen (e.g. Semester 5)
    const semLetters = new Set();

    // Match sections from database by semester
    sections
      .filter((s) => Number(s.semester) === Number(selectedSemester))
      .forEach((s) => {
        const clean = (s.name || '').replace(/^Section\s*/i, '').trim() || (s.code || '').replace(/^CSE-/i, '').trim();
        if (clean) semLetters.add(clean.toUpperCase());
      });

    // Match sections from items for this semester
    items.forEach((item) => {
      const itemSem = item.student?.semester || item.student?.section?.semester || item.semester || 5;
      if (Number(itemSem) === Number(selectedSemester)) {
        const sec = (item.student?.section?.name || item.student?.section?.code || item.section?.name || item.section || '')
          .replace(/^Section\s*/i, '')
          .replace(/^CSE-/i, '')
          .trim();
        if (sec) semLetters.add(sec.toUpperCase());
      }
    });

    // Fallback if no specific sections found for this semester
    if (semLetters.size === 0) {
      ['A', 'B', 'C', 'D'].forEach((l) => semLetters.add(l));
    }

    const sortedSem = Array.from(semLetters).sort();
    return [
      { id: 'ALL', label: `All Sections (Semester ${selectedSemester})` },
      ...sortedSem.map((letter) => ({
        id: `Section ${letter}`,
        label: `Semester ${selectedSemester} — Section ${letter}`,
      })),
    ];
  }, [selectedSemester, sections, items]);

  const handlePrint = () => {
    // 1. Filter items based on selections
    let filtered = items.filter((item) => {
      const itemSem =
        item.student?.semester ||
        item.student?.section?.semester ||
        item.semester ||
        5;

      const matchesSem =
        selectedSemester === 'ALL' || Number(itemSem) === Number(selectedSemester);

      const secName = (
        item.student?.section?.name ||
        item.student?.section?.code ||
        item.section?.name ||
        item.section ||
        ''
      ).trim();
      const secCode = (item.student?.section?.code || '').trim();
      const secId = item.student?.section?._id ? String(item.student?.section?._id) : '';

      const cleanItemSec = secName.replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim().toUpperCase();
      const cleanTargetSec = selectedSection.replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim().toUpperCase();

      const matchesSec =
        selectedSection === 'ALL' ||
        secId === selectedSection ||
        secName.toLowerCase() === selectedSection.toLowerCase() ||
        secCode.toLowerCase() === selectedSection.toLowerCase() ||
        (cleanItemSec && cleanTargetSec && cleanItemSec === cleanTargetSec) ||
        secName.toLowerCase().includes(cleanTargetSec.toLowerCase());

      const isApproved =
        item.status === 'APPROVED' ||
        item.status === 'APPROVED_BY_HOD' ||
        item.tier2Reviewer?.status === 'APPROVED';
      if (!isApproved) return false;

      let matchesType = true;
      if (reportType === 'CONSIDERATION') {
        matchesType = item.requestKind === 'CONSIDERATION' || !item.leaveType;
      } else if (reportType === 'LEAVE') {
        matchesType = item.requestKind === 'LEAVE' || Boolean(item.leaveType);
      }

      return matchesSem && matchesSec && matchesType;
    });

    const semLabel =
      selectedSemester === 'ALL' ? 'All Semesters' : `Semester ${selectedSemester}`;
    const secLabel =
      selectedSection === 'ALL' ? 'All Sections' : selectedSection;
    const targetScope = `${semLabel} — ${secLabel}`;
    const formattedDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const rowsHtml = filtered.length === 0
      ? `<tr><td colspan="10" style="padding: 24px; text-align: center; color: #64748B; font-weight: 600;">No approved clearances found for ${targetScope}.</td></tr>`
      : filtered
          .map((item, idx) => {
            const studentName =
              item.student?.user?.name ||
              item.student?.name ||
              item.applicant?.name ||
              'Student';
            const enrollNo =
              item.student?.enrollmentNumber ||
              item.student?.rollNumber ||
              item.applicant?.rollNumber ||
              'N/A';
            const sec = (
              item.student?.section?.name ||
              item.student?.section?.code ||
              item.section?.name ||
              item.section ||
              '—'
            ).replace(/^Section\s*/i, '').replace(/^CSE-/i, '').trim() || '—';
            const nature =
              item.category ||
              item.eventType ||
              item.leaveType ||
              item.type ||
              (item.requestKind === 'LEAVE' ? 'Student Leave' : 'OD Consideration');
            const periods =
              Array.isArray(item.selectedPeriods) && item.selectedPeriods.length > 0
                ? item.selectedPeriods.join(', ')
                : Array.isArray(item.requestedPeriods)
                ? item.requestedPeriods.map((p) => `P${p}`).join(', ')
                : '—';
            const timeStr = item.timeFrom && item.timeTo ? `${item.timeFrom} - ${item.timeTo}` : '—';
            const dateStr = item.startDate ? `${item.startDate}${item.endDate && item.endDate !== item.startDate ? ` - ${item.endDate}` : ''}` : '—';
            const days = item.totalDays || 1;
            const status = item.status || 'APPROVED_BY_HOD';
            const isApp = status.includes('APPROV');

        return `
          <tr style="border-bottom: 1px solid #E2E8F0; font-size: 11px;">
            <td style="padding: 7px 6px; text-align: center; font-weight: 700; color: #64748B;">${idx + 1}</td>
            <td style="padding: 7px 8px; font-weight: 800; color: #0F172A;">${studentName}</td>
            <td style="padding: 7px 8px; font-family: monospace; color: #334155;">${enrollNo}</td>
            <td style="padding: 7px 6px; text-align: center; font-weight: 800; color: #1E3A8A;">Sec ${sec}</td>
            <td style="padding: 7px 8px; color: #1E293B; font-weight: 600;">${nature}</td>
            <td style="padding: 7px 8px; font-weight: 700; color: #2563EB;">${periods}</td>
            <td style="padding: 7px 8px; text-align: center; color: #475569;">${timeStr}</td>
            <td style="padding: 7px 8px; text-align: center; color: #475569; white-space: nowrap;">${dateStr}</td>
            <td style="padding: 7px 6px; text-align: center; font-weight: 800; color: #0F172A;">${days}</td>
            <td style="padding: 7px 8px; text-align: center;">
              <span style="font-weight: 800; font-size: 10px; color: ${isApp ? '#059669' : '#D97706'}; text-transform: uppercase;">
                ${isApp ? 'APPROVED' : status}
              </span>
            </td>
          </tr>
        `;
      })
      .join('');

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>OIST CSE - Official Approved Clearances</title>
          <style>
            @page {
              size: landscape;
              margin: 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0F172A;
              margin: 0;
              padding: 10px;
              background: #FFF;
            }
            .header-bar {
              border-top: 3px solid #B45309;
              padding-top: 14px;
              text-align: center;
              margin-bottom: 16px;
            }
            .title-main {
              font-size: 18px;
              font-weight: 900;
              color: #1E3A8A;
              margin: 0;
              letter-spacing: 0.5px;
            }
            .title-sub {
              font-size: 11px;
              font-weight: 700;
              color: #475569;
              margin: 3px 0 0 0;
            }
            .title-ledger {
              font-size: 13px;
              font-weight: 800;
              color: #0F172A;
              margin: 6px 0 0 0;
            }
            .meta-bar {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              font-weight: 700;
              color: #334155;
              border-top: 1px solid #CBD5E1;
              border-bottom: 1px solid #CBD5E1;
              padding: 6px 4px;
              margin-bottom: 12px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              border: 1px solid #CBD5E1;
            }
            th {
              background-color: #F8FAFC;
              color: #475569;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              padding: 8px 6px;
              border: 1px solid #CBD5E1;
            }
            td {
              border: 1px solid #E2E8F0;
            }
            .signatures {
              display: flex;
              justify-content: space-between;
              margin-top: 36px;
              padding: 0 30px;
            }
            .sig-box {
              text-align: center;
            }
            .sig-title {
              font-size: 11px;
              font-weight: 800;
              color: #0F172A;
              margin: 0;
            }
            .sig-sub {
              font-size: 9.5px;
              color: #64748B;
              margin: 2px 0 0 0;
            }
            .seal-box {
              width: 58px;
              height: 58px;
              border: 2px dashed #059669;
              border-radius: 50%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              color: #059669;
              font-size: 7.5px;
              font-weight: 900;
              text-transform: uppercase;
              transform: rotate(-10deg);
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <h1 class="title-main">ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY (OIST)</h1>
            <p class="title-sub">Department of Computer Science & Engineering • CampusFlow ERP</p>
            <h2 class="title-ledger">Official Approved Clearances</h2>
          </div>

          <div class="meta-bar">
            <span><strong>Date Generated:</strong> ${formattedDate}</span>
            <span><strong>Academic Scope:</strong> ${targetScope}</span>
            <span><strong>Authorized by:</strong> Head of Department (HOD CSE)</span>
            <span><strong>Total Records:</strong> ${filtered.length} Cleared</span>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 28px;">#</th>
                <th style="text-align: left;">Student Name</th>
                <th style="text-align: left;">Enrollment No.</th>
                <th style="text-align: center;">Section</th>
                <th style="text-align: left;">Nature of Clearance</th>
                <th style="text-align: left;">Periods</th>
                <th style="text-align: center;">Time Slots</th>
                <th style="text-align: center;">Sanctioned Dates</th>
                <th style="text-align: center;">Days</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="signatures">
            <div class="sig-box">
              <div style="height: 35px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 10px; font-weight: 800; color: #2563EB;">[DIGITALLY VERIFIED]</span>
              </div>
              <p class="sig-title">Teacher Guardian (TG)</p>
              <p class="sig-sub">Department of CSE • Verification Desk</p>
            </div>

            <div class="seal-box">
              <span>OIST CSE</span>
              <span>SANCTIONED</span>
              <span>OFFICIAL</span>
            </div>

            <div class="sig-box">
              <div style="height: 35px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 10px; font-weight: 800; color: #059669;">[DIGITALLY CERTIFIED]</span>
              </div>
              <p class="sig-title">Head of Department (HOD)</p>
              <p class="sig-sub">Computer Science & Engineering • OIST</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printHtml);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 300);
    } else {
      // Fallback: If popup is blocked, write to hidden iframe and print
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(printHtml);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => iframe.remove(), 2000);
        }, 400);
      }
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative text-slate-900 font-sans max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200 shadow-2xs">
              <Printer size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 m-0">
                Print Official Clearance Report
              </h3>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Generate official institutional attendance & leave ledger
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Configuration Body */}
        <div className="space-y-4 mt-4">
          {/* Step 1: Select Semester */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} className="text-blue-600" />
              <span>1. Choose Semester:</span>
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => {
                setSelectedSemester(e.target.value);
                setSelectedSection('ALL'); // reset section when semester changes
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none transition-all cursor-pointer"
            >
              <option value="ALL">All Semesters (Comprehensive Ledger)</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={String(sem)}>
                  Semester {sem}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Select Section (Reactive based on semester) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Users size={13} className="text-blue-600" />
              <span>2. Choose Section:</span>
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none transition-all cursor-pointer"
            >
              {sectionOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Step 3: Report Scope */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Layers size={13} className="text-blue-600" />
              <span>3. Report Clearance Category:</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'ALL', label: 'All Clearances' },
                { id: 'CONSIDERATION', label: 'OD Considerations' },
                { id: 'LEAVE', label: 'Student Leaves' },
                { id: 'APPROVED_ONLY', label: 'Approved Only' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setReportType(tab.id)}
                  style={
                    reportType === tab.id
                      ? { backgroundColor: '#2563EB', color: '#FFFFFF', borderColor: '#1D4ED8' }
                      : { backgroundColor: '#F8FAFC', color: '#334155', borderColor: '#CBD5E1' }
                  }
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                    reportType === tab.id ? 'shadow-2xs' : 'hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview Note */}
          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-blue-900 flex items-start gap-2">
            <CheckCircle2 size={15} className="text-blue-600 shrink-0 mt-0.5" />
            <span>
              The report will be formatted into an official OIST CSE departmental document
              in landscape layout with digital authorization stamps ready for institutional printing.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: '#F1F5F9',
                color: '#334155',
                border: '1px solid #CBD5E1',
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                border: '1px solid #1D4ED8',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center gap-2 cursor-pointer transition-all"
            >
              <Printer size={15} style={{ color: '#FFFFFF' }} />
              <span style={{ color: '#FFFFFF' }}>Generate & Print Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
