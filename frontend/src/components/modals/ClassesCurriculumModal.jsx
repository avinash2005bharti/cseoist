import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Building2,
  Layers,
  CheckCircle2,
  Users,
  Edit2,
  Check,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useERP } from '../../context/ERPContext.jsx';
import { masterDataApi } from '../../api';

export default function ClassesCurriculumModal({ onClose, onUpdated }) {
  const { addToast } = useERP();

  const [activeYear, setActiveYear] = useState('3rd Year');
  const [activeSemester, setActiveSemester] = useState(5);

  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Section Provisioning Form State
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionCode, setNewSectionCode] = useState('');
  const [newSectionSemester, setNewSectionSemester] = useState(5);
  const [newSectionCapacity, setNewSectionCapacity] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  // Inline Capacity Editing State
  const [editingSecId, setEditingSecId] = useState(null);
  const [editingCapacity, setEditingCapacity] = useState(60);
  const [updatingCapacity, setUpdatingCapacity] = useState(false);

  const yearSemesterMap = {
    '1st Year': [1, 2],
    '2nd Year': [3, 4],
    '3rd Year': [5, 6],
    '4th Year': [7, 8],
  };

  const fetchSections = async () => {
    setLoading(true);
    try {
      const res = await masterDataApi.getSections();
      setSections(res?.data || []);
    } catch (err) {
      addToast('Error', 'Failed to fetch academic sections from database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const handleYearChange = (yr) => {
    setActiveYear(yr);
    const validSems = yearSemesterMap[yr] || [1, 2];
    if (!validSems.includes(activeSemester)) {
      setActiveSemester(validSems[0]);
    }
  };

  const handleSemesterChange = (sem) => {
    setActiveSemester(sem);
    const yr = Object.keys(yearSemesterMap).find((k) => yearSemesterMap[k].includes(sem));
    if (yr) setActiveYear(yr);
  };

  const handleAddSection = async (e) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;

    setSubmitting(true);
    try {
      const cleanName = newSectionName.replace(/^Section\s*/i, '').trim().toUpperCase();
      const semNum = Number(newSectionSemester);
      const codeToUse = (newSectionCode || `CSE-${cleanName}-S${semNum}`).toUpperCase().trim();
      const capNum = Number(newSectionCapacity) || 60;

      await masterDataApi.createSection({
        name: `Section ${cleanName}`,
        code: codeToUse,
        semester: semNum,
        year: Math.ceil(semNum / 2),
        capacity: capNum,
      });

      addToast(
        'Section Created',
        `Section ${cleanName} provisioned with capacity ${capNum} students for Semester ${semNum}.`,
        'success'
      );

      setNewSectionName('');
      setNewSectionCode('');
      setNewSectionCapacity(60);
      setIsProvisioning(false);
      await fetchSections();
      if (onUpdated) onUpdated();
    } catch (err) {
      addToast(
        'Creation Failed',
        err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Failed to create section.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCapacity = async (secId) => {
    const capNum = Number(editingCapacity);
    if (!capNum || capNum < 1 || capNum > 500) {
      addToast('Invalid Capacity', 'Please provide a valid capacity between 1 and 500.', 'error');
      return;
    }

    setUpdatingCapacity(true);
    try {
      await masterDataApi.updateSection(secId, { capacity: capNum });
      addToast('Capacity Updated', `Section capacity updated to ${capNum} students.`, 'success');
      setEditingSecId(null);
      await fetchSections();
      if (onUpdated) onUpdated();
    } catch (err) {
      addToast(
        'Update Failed',
        err.response?.data?.error?.message || err.message || 'Failed to update section capacity.',
        'error'
      );
    } finally {
      setUpdatingCapacity(false);
    }
  };

  const handleDeleteSection = async (sec) => {
    if (sec.studentCount > 0) {
      addToast(
        'Cannot Delete Section',
        `Cannot delete ${sec.name}: ${sec.studentCount} student(s) currently enrolled. Reassign them first.`,
        'error'
      );
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${sec.name} (${sec.code})? This action cannot be undone.`)) {
      return;
    }

    try {
      await masterDataApi.deleteSection(sec._id);
      addToast('Section Deleted', `${sec.name} was removed from the institutional database.`, 'info');
      await fetchSections();
      if (onUpdated) onUpdated();
    } catch (err) {
      addToast(
        'Deletion Failed',
        err.response?.data?.error?.message || err.message || 'Failed to delete section.',
        'error'
      );
    }
  };

  // Filter sections for the active semester
  const filteredSections = sections.filter(
    (sec) => Number(sec.semester) === Number(activeSemester)
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container max-w-4xl w-[96%] max-h-[92vh] overflow-y-auto bg-white p-6 sm:p-8 rounded-3xl text-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 m-0">
                Classes, Sections & Curriculum Management
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                CSE Department
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium m-0 mt-1">
              Master academic hierarchy across 4 undergraduate years (8 Semesters) with live database persistence and capacity quota controls.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setNewSectionName('E');
                setNewSectionSemester(activeSemester);
                setNewSectionCode(`CSE-E-S${activeSemester}`);
                setNewSectionCapacity(60);
                setIsProvisioning(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus size={15} />
              <span>+ Provision Section</span>
            </button>
            <button
              onClick={fetchSections}
              title="Refresh sections"
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Provision Form Drawer if open */}
        {isProvisioning && (
          <form
            onSubmit={handleAddSection}
            className="my-4 p-5 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <Layers size={14} className="text-blue-600" />
                <span>Create New Section Under Semester {newSectionSemester}</span>
              </span>
              <button
                type="button"
                onClick={() => setIsProvisioning(false)}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              {/* Section Name */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Section Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewSectionName(val);
                    const clean = val.replace(/^Section\s*/i, '').trim().toUpperCase();
                    setNewSectionCode(`CSE-${clean || 'X'}-S${newSectionSemester}`);
                  }}
                  placeholder="e.g. E (for Section E)"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs text-slate-800 font-bold focus:outline-none uppercase"
                />
              </div>

              {/* Semester */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Target Semester <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newSectionSemester}
                  onChange={(e) => {
                    const sem = Number(e.target.value);
                    setNewSectionSemester(sem);
                    const clean = newSectionName.replace(/^Section\s*/i, '').trim().toUpperCase();
                    setNewSectionCode(`CSE-${clean || 'X'}-S${sem}`);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs text-slate-800 font-bold focus:outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Semester {s} (Year {Math.ceil(s / 2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Code */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Section Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSectionCode}
                  onChange={(e) => setNewSectionCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CSE-E-S5"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs font-mono font-bold text-slate-800 uppercase focus:outline-none"
                />
              </div>

              {/* Section Capacity */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Capacity (Max Students) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={newSectionCapacity}
                  onChange={(e) => setNewSectionCapacity(Number(e.target.value))}
                  placeholder="e.g. 60"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-blue-700 font-medium">
                Both HOD and Admin permissions are enabled to set and adjust student capacity.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsProvisioning(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>Save Section to Database</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Academic Year Tabs (All 4 Years) */}
        <div className="mt-4 flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
          {['1st Year', '2nd Year', '3rd Year', '4th Year'].map((yr) => (
            <button
              key={yr}
              onClick={() => handleYearChange(yr)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeYear === yr
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>

        {/* Semester Tabs for Current Year */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 mr-1">Semesters:</span>
          {(yearSemesterMap[activeYear] || [1, 2]).map((sem) => (
            <button
              key={sem}
              onClick={() => handleSemesterChange(sem)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                activeSemester === sem
                  ? 'bg-blue-50 text-blue-700 border-blue-400 ring-1 ring-blue-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              Semester {sem}
            </button>
          ))}

          {/* Quick jump to all 8 Semesters */}
          <div className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 font-semibold">
            <span>Quick jump:</span>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <button
                key={s}
                onClick={() => handleSemesterChange(s)}
                className={`w-6 h-6 rounded-md text-[10px] font-bold flex items-center justify-center transition-colors ${
                  activeSemester === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                S{s}
              </button>
            ))}
          </div>
        </div>

        {/* Active Sections List */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider m-0">
              Active Sections ({activeYear} - Semester {activeSemester})
            </h3>
            <span className="text-xs font-bold text-slate-600">
              {filteredSections.length} {filteredSections.length === 1 ? 'Section' : 'Sections'} Available
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
              <RefreshCw size={20} className="animate-spin mx-auto text-blue-500 mb-2" />
              <span>Loading institutional section directory...</span>
            </div>
          ) : filteredSections.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
              <Layers size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-extrabold text-slate-800 m-0">
                No sections provisioned for Semester {activeSemester}
              </p>
              <p className="text-xs text-slate-500 font-medium mt-1 mb-3">
                Create Section A or any custom section under this semester to allow student registration and TG assignment.
              </p>
              <button
                onClick={() => {
                  setNewSectionName('A');
                  setNewSectionSemester(activeSemester);
                  setNewSectionCode(`CSE-A-S${activeSemester}`);
                  setNewSectionCapacity(60);
                  setIsProvisioning(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Plus size={14} />
                <span>+ Provision First Section</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSections.map((sec) => {
                const enrolled = sec.studentCount || 0;
                const capacity = sec.capacity || 60;
                const fillPct = Math.min(100, Math.round((enrolled / capacity) * 100));
                const isEditing = editingSecId === sec._id;

                const barColor =
                  fillPct >= 95
                    ? 'bg-rose-500'
                    : fillPct >= 80
                    ? 'bg-amber-500'
                    : 'bg-emerald-500';

                return (
                  <div
                    key={sec._id}
                    className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-blue-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black text-slate-900">{sec.name}</span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-mono font-bold border border-blue-200">
                          {sec.code}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                          Sem {sec.semester} • Year {sec.year}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                        <span>
                          TG:{' '}
                          <strong className="text-slate-700 font-bold">
                            {sec.tgName || 'Not Assigned'}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Department:{' '}
                          <strong className="text-slate-700 font-bold">
                            {sec.department?.code || 'CSE'}
                          </strong>
                        </span>
                      </div>

                      {/* Capacity & Enrollment Progress Bar */}
                      <div className="pt-2 max-w-md">
                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                          <span className="text-slate-600">
                            Enrolled: <strong className="text-slate-900">{enrolled}</strong> / {capacity} Students
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">{fillPct}% Quota</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                            style={{ width: `${Math.max(fillPct, 4)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right Action Controls: Capacity Editing & Delete */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 bg-blue-50 p-1.5 rounded-xl border border-blue-200">
                          <label className="text-[11px] font-bold text-blue-900 pl-1">Quota:</label>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={editingCapacity}
                            onChange={(e) => setEditingCapacity(e.target.value)}
                            className="w-16 px-2 py-1 bg-white border border-blue-300 rounded-lg text-xs font-black text-slate-900 focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveCapacity(sec._id)}
                            disabled={updatingCapacity}
                            className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            title="Save new capacity"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSecId(null)}
                            className="p-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSecId(sec._id);
                            setEditingCapacity(sec.capacity || 60);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="HOD/Admin: Set or update section capacity"
                        >
                          <Edit2 size={13} className="text-blue-600" />
                          <span>Set Capacity ({capacity})</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteSection(sec)}
                        disabled={enrolled > 0}
                        className={`p-2 rounded-xl transition-colors cursor-pointer ${
                          enrolled > 0
                            ? 'text-slate-300 border border-slate-100 cursor-not-allowed opacity-50'
                            : 'text-rose-500 hover:bg-rose-50 border border-rose-200'
                        }`}
                        title={enrolled > 0 ? `Cannot delete: ${enrolled} students enrolled` : 'Delete empty section'}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            💡 Sections created here are instantly active in HOD, TG, Admin, and Student portals.
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-black text-white transition-colors cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
