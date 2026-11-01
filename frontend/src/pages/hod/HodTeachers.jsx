import React, { useEffect, useState } from 'react';
import { masterDataApi, mentorshipApi, reportApi } from '../../api';
import { useERP } from '../../context/ERPContext.jsx';
import {
  UserCheck,
  Search,
  ShieldCheck,
  Mail,
  Phone,
  Briefcase,
  Users,
  GraduationCap,
  FileSpreadsheet,
  RefreshCw,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { formatSectionLabel } from '../../utils/constants.js';

export default function HodTeachers() {
  const { addToast } = useERP();
  const [teachers, setTeachers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL'); // 'ALL' | 'TG' | 'FACULTY'

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teachersRes, groupsRes] = await Promise.allSettled([
        masterDataApi.getTeachers(),
        mentorshipApi.listGroups(),
      ]);

      if (teachersRes.status === 'fulfilled') setTeachers(teachersRes.value?.data || []);
      if (groupsRes.status === 'fulfilled') setGroups(groupsRes.value?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map of active mentor groups keyed by teacher ID
  const activeCohorts = groups.filter((g) => g.isActive !== false);
  const teacherCohortMap = new Map();
  activeCohorts.forEach((g) => {
    const tid = (g.tg?._id || g.tg?.user?._id || g.tg)?.toString();
    if (tid) {
      const sem = g.semester || g.section?.semester || 5;
      const sec = formatSectionLabel(g.section || 'Section B', sem);
      teacherCohortMap.set(tid, `Semester ${sem} • ${sec}`);
    }
  });

  const isTeacherTg = (t) => {
    const tId = t._id?.toString();
    const uId = t.user?._id?.toString();
    return Boolean(t.isTG || (tId && teacherCohortMap.has(tId)) || (uId && teacherCohortMap.has(uId)));
  };

  const getTeacherCohortLabel = (t) => {
    const tId = t._id?.toString();
    const uId = t.user?._id?.toString();
    return teacherCohortMap.get(tId) || teacherCohortMap.get(uId) || (isTeacherTg(t) ? 'Active TG' : null);
  };

  const filteredTeachers = teachers.filter((t) => {
    const name = (t.user?.name || '').toLowerCase();
    const emp = (t.employeeId || '').toLowerCase();
    const email = (t.user?.email || '').toLowerCase();
    const des = (t.designation || '').toLowerCase();
    const q = search.toLowerCase().trim();

    const matchesSearch = !q || name.includes(q) || emp.includes(q) || email.includes(q) || des.includes(q);
    const isTg = isTeacherTg(t);

    if (roleFilter === 'TG' && !isTg) return false;
    if (roleFilter === 'FACULTY' && isTg) return false;

    return matchesSearch;
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      if (reportApi.downloadFacultyExcel) {
        await reportApi.downloadFacultyExcel();
        addToast('Directory Exported', 'Faculty directory downloaded as Excel spreadsheet (.xlsx).', 'success');
        return;
      }
      throw new Error('API download not available');
    } catch {
      // Robust client-side CSV/Excel export fallback with UTF-8 BOM
      try {
        const headers = [
          'Faculty Name',
          'Employee ID',
          'Designation',
          'Department',
          'Institutional Role',
          'Mentored Cohort',
          'Email Address',
          'Phone Number',
          'Account Status',
        ];

        const rows = filteredTeachers.map((t) => {
          const facultyName = t.user?.name || t.designation || 'Faculty Member';
          const isHod = t.user?.role === 'HOD' || t.designation?.toLowerCase().includes('head');
          const isTg = isTeacherTg(t);
          const cohort = getTeacherCohortLabel(t) || 'N/A';
          const role = isHod ? 'Head of Department' : isTg ? 'Tutor Guardian (TG)' : 'Faculty Member';

          return [
            `"${facultyName.replace(/"/g, '""')}"`,
            `"${(t.employeeId || 'N/A').replace(/"/g, '""')}"`,
            `"${(t.designation || 'Assistant Professor').replace(/"/g, '""')}"`,
            `"${(t.department?.name || 'Computer Science and Engineering').replace(/"/g, '""')}"`,
            `"${role}"`,
            `"${cohort}"`,
            `"${(t.user?.email || 'N/A').replace(/"/g, '""')}"`,
            `"${(t.user?.phone || 'N/A').replace(/"/g, '""')}"`,
            `"${t.user?.isActive !== false ? 'Active' : 'Inactive'}"`,
          ].join(',');
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `faculty_directory_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        addToast('Directory Exported', 'Faculty directory exported successfully.', 'success');
      } catch (clientErr) {
        addToast('Export Error', clientErr.message || 'Failed to export directory.', 'danger');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full min-w-0 font-sans">
      {/* Header with Title and Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight m-0">
              Department Faculty Directory
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black">
              {filteredTeachers.length} Members
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium m-0">
            Faculty roster, academic designations, contact channels, and Tutor Guardian (TG) appointment allocations.
          </p>
        </div>

        {/* Toolbar Buttons: Export & Refresh */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={fetchData}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer min-h-[42px]"
            title="Refresh directory"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : 'text-slate-500'} />
            <span>Refresh</span>
          </button>

          {/* Professional Export Button as requested in Image 2 */}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            style={{ backgroundColor: '#059669', color: '#ffffff' }}
            className="px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-bold shadow-xs hover:bg-emerald-700 active:bg-emerald-800 transition-colors flex items-center gap-2 cursor-pointer min-h-[42px] border border-emerald-700"
            title="Export full directory in official spreadsheet format"
          >
            <FileSpreadsheet size={16} className="text-white" />
            <span className="text-white">{exporting ? 'Generating XLSX...' : 'Export Directory (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Search and Role Filter Bar */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search faculty by name, employee ID, email, or designation..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none transition-all font-medium min-h-[42px]"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer min-h-[42px] transition-all shadow-2xs"
          >
            <option value="ALL">All Roles ({teachers.length})</option>
            <option value="TG">Tutor Guardians</option>
            <option value="FACULTY">Standard Faculty</option>
          </select>

          {(roleFilter !== 'ALL' || search) && (
            <button
              type="button"
              onClick={() => {
                setRoleFilter('ALL');
                setSearch('');
              }}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Enhanced Table: Clean, Spacious, No Text Overlap or Hidden Details */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <span className="font-bold">Loading faculty directory...</span>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="p-14 text-center">
            <Users size={36} className="mx-auto text-slate-300 mb-2" />
            <h3 className="text-base font-black text-slate-800">No Faculty Members Found</h3>
            <p className="text-xs text-slate-400 mt-1">
              No faculty records match your search or role filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    Faculty Name
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    Employee ID
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    Designation
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    Institutional Role & Cohort
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-black text-slate-500 uppercase tracking-wider min-w-[240px]">
                    Contact Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.map((t) => {
                  const facultyName = t.user?.name || t.designation || 'Faculty Member';
                  const isHod = t.user?.role === 'HOD' || t.designation?.toLowerCase().includes('head');
                  const isTg = isTeacherTg(t);
                  const cohortLabel = getTeacherCohortLabel(t);
                  const email = t.user?.email || 'Not provided';
                  const phone = t.user?.phone || 'Not provided';
                  const initial = facultyName.charAt(0).toUpperCase();

                  return (
                    <tr key={t._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Faculty Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {initial}
                          </div>
                          <div>
                            <span className="font-heading font-black text-sm text-slate-900 block leading-tight">
                              {facultyName}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">
                              Academic Faculty
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200 inline-block">
                          {t.employeeId || 'EMP_CSE_01'}
                        </span>
                      </td>

                      {/* Designation */}
                      <td className="px-5 py-4">
                        <span className="text-xs font-bold text-slate-800">
                          {t.designation || 'Assistant Professor'}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="px-5 py-4">
                        <span className="text-xs text-slate-600 font-medium">
                          {t.department?.name || 'Computer Science and Engineering'}
                        </span>
                      </td>

                      {/* Institutional Role & Mentored Cohort */}
                      <td className="px-5 py-4">
                        {isHod ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <Briefcase size={12} />
                              Head of Department
                            </span>
                          </div>
                        ) : isTg ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                              <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                              Tutor Guardian (TG)
                            </span>
                            {cohortLabel && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                <GraduationCap size={11} className="text-slate-500" />
                                {cohortLabel}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Faculty
                          </span>
                        )}
                      </td>

                      {/* Contact Details (Clean, Visible, Not Squished or Truncated) */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <a
                            href={`mailto:${email}`}
                            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                            title={`Send email to ${email}`}
                          >
                            <Mail size={13} className="text-blue-500 shrink-0" />
                            <span className="break-all">{email}</span>
                          </a>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                            <Phone size={13} className="text-slate-400 shrink-0" />
                            <span className="font-mono">{phone}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
