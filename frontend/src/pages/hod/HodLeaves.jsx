import React, { useEffect, useState } from 'react';
import { useERP } from '../../context/ERPContext.jsx';
import { leaveApi, masterDataApi } from '../../api';
import {
  STATUS_LABELS,
  formatDateIST,
} from '../../utils/constants.js';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
} from '../../components/common';
import {
  Calendar,
  Search,
  Users,
  UserCheck,
  Eye,
  AlertTriangle,
  Download,
  FileText,
  Filter,
  ChevronDown,
} from 'lucide-react';
import WorkflowTimeline from '../../components/WorkflowTimeline.jsx';
import FormalApplicationModal from '../../components/modals/FormalApplicationModal.jsx';

const HOD_REJECTED_KEY = 'campusflow_hod_rejected_ids';
const getStoredRejectedIds = () => {
  try {
    const raw = localStorage.getItem(HOD_REJECTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export default function HodLeaves() {
  const { openModal, viewAttachment } = useERP();

  const [activeRoleTab, setActiveRoleTab] = useState('ALL'); // 'ALL' | 'STUDENT' | 'TEACHER'
  const [filterMode, setFilterMode] = useState('ACTION_NEEDED'); // 'ACTION_NEEDED' | 'ALL' | 'APPROVED' | 'REJECTED'
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [sections, setSections] = useState([]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedSanction, setSelectedSanction] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [res, secRes] = await Promise.allSettled([
        leaveApi.getHODQueue({ all: true }),
        masterDataApi.getSections(),
      ]);
      const raw = res.status === 'fulfilled' ? res.value?.data || [] : [];
      if (secRes.status === 'fulfilled') {
        setSections(Array.isArray(secRes.value?.data) ? secRes.value.data : []);
      }
      const rejectedList = getStoredRejectedIds();
      const normalized = raw.map((item) => {
        if (rejectedList.includes(item._id)) {
          return {
            ...item,
            status: 'REJECTED',
            finalReview: {
              ...item.finalReview,
              decision: 'REJECT',
              remarks: item.finalReview?.remarks || 'Authorization Declined by Department',
            },
          };
        }
        return item;
      });
      setItems(normalized);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleQueueChange = () => fetchData();
    window.addEventListener('campusflow_queue_changed', handleQueueChange);
    return () => {
      window.removeEventListener('campusflow_queue_changed', handleQueueChange);
    };
  }, []);

  const isApproved = (item) => {
    return (
      item.status === 'APPROVED_BY_HOD' ||
      item.status === 'APPROVED' ||
      item.tier2Reviewer?.status === 'APPROVED' ||
      item.finalReview?.decision === 'APPROVE'
    );
  };

  const isRejected = (item) => {
    const stored = getStoredRejectedIds();
    return (
      item.status === 'REJECTED' ||
      item.status === 'REJECTED_BY_HOD' ||
      item.tier2Reviewer?.status === 'REJECTED' ||
      item.finalReview?.decision === 'REJECT' ||
      stored.includes(item._id)
    );
  };

  const isActionNeeded = (item) => {
    if (isApproved(item) || isRejected(item)) return false;
    if (item.applicantRole === 'STUDENT') {
      return (
        item.status === 'RECOMMENDED_BY_TG' ||
        (item.status === 'PENDING' && (item.escalated || !item.tg)) ||
        item.tier2Reviewer?.status === 'PENDING'
      );
    }
    return item.status === 'PENDING' || item.tier2Reviewer?.status === 'PENDING';
  };

  const filteredItems = items.filter((item) => {
    const applicantName = (item.applicant?.name || '').toLowerCase();
    const email = (item.applicant?.email || '').toLowerCase();
    const roll = (item.applicant?.rollNumber || item.applicant?.enrollmentNumber || '').toLowerCase();
    const reason = (item.reason || item.description || '').toLowerCase();
    const q = search.toLowerCase();

    const matchesSearch =
      !search ||
      applicantName.includes(q) ||
      email.includes(q) ||
      roll.includes(q) ||
      reason.includes(q);

    const matchesRole = activeRoleTab === 'ALL' || item.applicantRole === activeRoleTab;

    const itemSem = item.student?.semester || item.student?.section?.semester || item.semester;
    const matchesSemester =
      semesterFilter === 'ALL' || (itemSem !== undefined && Number(itemSem) === Number(semesterFilter));

    const itemSecName = item.student?.section?.name || item.student?.section?.code || item.section || '';
    const cleanItemSec = itemSecName.replace(/^Section\s*/i, '').trim().toUpperCase();
    const cleanFilterSec = sectionFilter.replace(/^Section\s*/i, '').trim().toUpperCase();
    const matchesSection =
      sectionFilter === 'ALL' || cleanItemSec === cleanFilterSec;

    let matchesStatus = true;
    if (filterMode === 'ACTION_NEEDED') {
      matchesStatus = isActionNeeded(item);
    } else if (filterMode === 'APPROVED') {
      matchesStatus = isApproved(item);
    } else if (filterMode === 'REJECTED') {
      matchesStatus = isRejected(item);
    }

    return matchesSearch && matchesRole && matchesStatus && matchesSemester && matchesSection;
  });

  const uniqueSections = [
    ...new Set(
      sections
        .map((s) => s.name?.replace(/^Section\s*/i, '').trim() || s.code)
        .concat(
          items
            .map((i) => (i.student?.section?.name || i.student?.section?.code || '').replace(/^Section\s*/i, '').trim())
            .filter(Boolean)
        )
    ),
  ].filter(Boolean).sort();

  const getStatusBadge = (item) => {
    if (isApproved(item)) {
      return <Badge variant="success">Approved</Badge>;
    }
    if (isRejected(item)) {
      return <Badge variant="danger">Rejected</Badge>;
    }
    if (item.status === 'RECOMMENDED_BY_TG') {
      return <Badge variant="warning">Recommended by TG</Badge>;
    }
    if (item.escalated) {
      return (
        <span className="badge badge-amber flex items-center gap-1 font-bold">
          <AlertTriangle size={12} />
          Escalated to HOD
        </span>
      );
    }
    return <Badge variant="primary">Pending Review</Badge>;
  };

  return (
    <div className="flex flex-col gap-6 w-full min-w-0 font-sans">
      <PageHeader
        title="Leave Approvals"
        description="Review student leave applications after the Teacher Guardian's recommendation and process faculty leave requests."
        action={
          <Button
            variant="secondary"
            onClick={() => openModal('EXPORT_REPORTS')}
            className="min-h-[40px] text-sm font-semibold"
          >
            <Download size={15} />
            Export Leaves
          </Button>
        }
      />

      {/* Role Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveRoleTab('ALL')}
            className={`min-h-[40px] text-sm font-bold px-4 py-2 rounded-xl cursor-pointer transition-all ${
              activeRoleTab === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Requests ({items.length})
          </button>
          <button
            onClick={() => setActiveRoleTab('STUDENT')}
            className={`min-h-[40px] text-sm font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all ${
              activeRoleTab === 'STUDENT'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Users size={15} />
            Students ({items.filter((i) => i.applicantRole === 'STUDENT').length})
          </button>
          <button
            onClick={() => setActiveRoleTab('TEACHER')}
            className={`min-h-[40px] text-sm font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all ${
              activeRoleTab === 'TEACHER'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <UserCheck size={15} />
            Faculty ({items.filter((i) => i.applicantRole === 'TEACHER').length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Semester Filter Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs font-semibold text-slate-600">
            <Filter size={13} className="text-blue-600 shrink-0" />
            <span>Sem:</span>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="text-blue-600 font-bold bg-transparent border-none p-0 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Sem {s}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="text-blue-600 -ml-1 pointer-events-none" />
          </div>

          {/* Section Filter Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs font-semibold text-slate-600">
            <Filter size={13} className="text-blue-600 shrink-0" />
            <span>Sec:</span>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="text-blue-600 font-bold bg-transparent border-none p-0 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All Sections</option>
              {uniqueSections.map((sec) => (
                <option key={sec} value={sec}>
                  Sec {sec}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="text-blue-600 -ml-1 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl min-h-[40px] px-3.5 py-1.5 flex-1 sm:w-64">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search applicant name, email, roll..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm border-none p-0 focus:outline-none w-full text-slate-800 font-medium"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs min-h-[40px]">
            {[
              { id: 'ACTION_NEEDED', label: 'Pending' },
              { id: 'ALL', label: 'All' },
              { id: 'APPROVED', label: 'Approved' },
              { id: 'REJECTED', label: 'Rejected' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterMode(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  filterMode === tab.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`flex flex-col gap-4 ${selectedItem ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading leave requests...</div>
            ) : filteredItems.length === 0 ? (
              <EmptyState
                title="No leave applications found"
                description="No applications match the selected filters. Try changing the role, semester, or section filter."
                icon={Calendar}
              />
            ) : (
              <>
                {/* Mobile Card View (< 768px) */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const actionNeeded = isActionNeeded(item);
                    const applicantDisplayName =
                      item.applicant?.name ||
                      item.applicant?.designation ||
                      (item.applicantRole === 'TEACHER' ? 'Faculty Member' : 'Student');
                    const roll = item.student?.rollNumber || item.applicant?.rollNumber || item.applicant?.enrollmentNumber;
                    const sem = item.student?.semester || item.student?.section?.semester;
                    const sec = item.student?.section?.name?.replace(/^Section\s*/i, '') || item.student?.section?.code;

                    return (
                      <div
                        key={item._id}
                        className={`p-4 flex flex-col gap-2.5 transition-colors cursor-pointer ${
                          selectedItem?._id === item._id ? 'bg-amber-50/50' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedItem(item)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-heading font-black text-xs text-slate-900 m-0">
                              {applicantDisplayName}
                            </h4>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              {roll ? `${roll} • ` : ''}{item.applicant?.email || 'authenticated'}
                            </div>
                            {sem && (
                              <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                Sem {sem} {sec ? `• Sec ${sec}` : ''}
                              </div>
                            )}
                          </div>
                          {getStatusBadge(item)}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span
                            className={`badge text-[10px] font-bold ${
                              item.applicantRole === 'TEACHER' ? 'badge-indigo' : 'badge-slate'
                            }`}
                          >
                            {item.applicantRole === 'TEACHER' ? 'Faculty' : 'Student'}
                          </span>
                          <span className="badge badge-amber text-[10px] font-bold">
                            {item.leaveType}
                          </span>
                          <span className="text-[11px] text-slate-600 font-semibold ml-auto">
                            {item.totalDays} day{item.totalDays > 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 font-medium">
                          {item.startDate === item.endDate
                            ? formatDateIST(item.startDate)
                            : `${formatDateIST(item.startDate)} to ${formatDateIST(item.endDate)}`}
                        </div>

                        {/* Mobile Actions */}
                        <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                          {item.documentFileId && (
                            <button
                              onClick={() =>
                                viewAttachment({
                                  fileId: item.documentFileId,
                                  fileName: item.documentOriginalName || 'Document.pdf',
                                })
                              }
                              className="btn btn-sm btn-ghost p-1.5 text-slate-500 hover:text-blue-600 cursor-pointer text-xs"
                              title="View Proof"
                            >
                              <Eye size={14} />
                              <span className="text-[11px] font-semibold">Proof</span>
                            </button>
                          )}

                          {(item.status === 'APPROVED' || item.status === 'APPROVED_BY_HOD') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSanction(item);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                            >
                              <FileText size={12} />
                              <span>Order</span>
                            </button>
                          )}

                          {actionNeeded && (
                            <Button
                              variant="warning"
                              onClick={() =>
                                openModal('REVIEW_ACTION', {
                                  type: 'LEAVE',
                                  role: 'HOD',
                                  item,
                                })
                              }
                              className="btn-sm text-[11px] font-bold py-1 px-3 cursor-pointer"
                            >
                              Review
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (>= 768px) */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Applicant</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Dates & Duration</TableHead>
                        <TableHead>Review Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => {
                        const actionNeeded = isActionNeeded(item);
                        const applicantDisplayName =
                          item.applicant?.name ||
                          item.applicant?.designation ||
                          (item.applicantRole === 'TEACHER' ? 'Faculty Member' : 'Student');

                        return (
                          <TableRow
                            key={item._id}
                            className={`cursor-pointer transition-colors ${
                              selectedItem?._id === item._id ? 'bg-amber-50/50' : 'hover:bg-slate-50'
                            }`}
                            onClick={() => setSelectedItem(item)}
                          >
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-heading font-black text-xs text-slate-900">
                                  {applicantDisplayName}
                                </span>
                                <span className="text-[11px] text-slate-500 truncate max-w-[160px]">
                                  {item.applicant?.email || 'authenticated'}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell>
                              <span
                                className={`badge text-[10px] font-bold ${
                                  item.applicantRole === 'TEACHER' ? 'badge-indigo' : 'badge-slate'
                                }`}
                              >
                                {item.applicantRole === 'TEACHER' ? 'Faculty' : 'Student'}
                              </span>
                            </TableCell>

                            <TableCell>
                              <span className="badge badge-amber text-[10px] font-bold">
                                {item.leaveType}
                              </span>
                            </TableCell>

                            <TableCell>
                              <div className="flex flex-col text-xs">
                                <span className="font-bold text-slate-800">
                                  {item.startDate === item.endDate
                                    ? formatDateIST(item.startDate)
                                    : `${formatDateIST(item.startDate)} to ${formatDateIST(item.endDate)}`}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {item.totalDays} day{item.totalDays > 1 ? 's' : ''}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell>{getStatusBadge(item)}</TableCell>

                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {item.documentFileId && (
                                  <button
                                    onClick={() =>
                                      viewAttachment({
                                        fileId: item.documentFileId,
                                        fileName: item.documentOriginalName || 'Document.pdf',
                                      })
                                    }
                                    className="btn btn-sm btn-ghost p-1.5 text-slate-500 hover:text-blue-600 cursor-pointer"
                                    title="View Proof"
                                  >
                                    <Eye size={14} />
                                  </button>
                                )}

                                {(item.status === 'APPROVED' || item.status === 'APPROVED_BY_HOD') && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSanction(item);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                                  >
                                    <FileText size={12} />
                                    <span>View Order</span>
                                  </button>
                                )}

                                {actionNeeded && (
                                  <Button
                                    variant="warning"
                                    onClick={() =>
                                      openModal('REVIEW_ACTION', {
                                        type: 'LEAVE',
                                        role: 'HOD',
                                        item,
                                      })
                                    }
                                    className="btn-sm text-[11px] font-bold py-1 px-3 cursor-pointer"
                                  >
                                    Review
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Selected Item Drawer */}
        {selectedItem && (
          <div className="lg:col-span-1">
            <Card className="p-5 flex flex-col gap-4 border-amber-200 shadow-md sticky top-20">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-heading font-black text-sm text-slate-900 m-0">
                  Leave Details
                </h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Applicant
                </span>
                <div className="text-sm font-black text-slate-900 mt-0.5">
                  {selectedItem.applicant?.name || selectedItem.applicant?.designation || (selectedItem.applicantRole === 'TEACHER' ? 'Faculty Member' : 'Student')}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {selectedItem.applicantRole === 'TEACHER' ? 'Faculty' : 'Student'} • {selectedItem.applicant?.email}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Type</span>
                  <span className="font-bold text-amber-700">{selectedItem.leaveType}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Duration</span>
                  <span className="font-bold text-slate-800">{selectedItem.totalDays} day(s)</span>
                </div>
              </div>

              <div className="text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Reason
                </span>
                <p className="p-3 bg-slate-50 rounded-xl text-slate-700 border border-slate-100 italic leading-relaxed m-0">
                  "{selectedItem.reason || selectedItem.description || 'Not provided'}"
                </p>
              </div>

              {selectedItem.documentFileId && (
                <div className="pt-1">
                  <button
                    onClick={() =>
                      viewAttachment({
                        fileId: selectedItem.documentFileId,
                        fileName: selectedItem.documentOriginalName || 'Document.pdf',
                      })
                    }
                    className="w-full btn btn-sm bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold flex items-center justify-center gap-2 py-2 cursor-pointer"
                  >
                    <Eye size={14} />
                    View Proof Attachment
                  </button>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                  Workflow Trail
                </span>
                <WorkflowTimeline item={selectedItem} type="LEAVE" />
              </div>

              {(selectedItem.status === 'APPROVED' || selectedItem.status === 'APPROVED_BY_HOD') && (
                <div className="pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedSanction(selectedItem)}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <FileText size={14} />
                    <span>View Sanction Order</span>
                  </button>
                </div>
              )}

              {isActionNeeded(selectedItem) && (
                <div className="pt-3 border-t border-slate-100">
                  <Button
                    variant="warning"
                    onClick={() =>
                      openModal('REVIEW_ACTION', {
                        type: 'LEAVE',
                        role: 'HOD',
                        item: selectedItem,
                      })
                    }
                    className="w-full text-xs font-bold py-2.5 shadow-sm cursor-pointer"
                  >
                    Approve / Determine Leave
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Formal Sanction Order Modal */}
      {selectedSanction && (
        <FormalApplicationModal
          item={selectedSanction}
          onClose={() => setSelectedSanction(null)}
        />
      )}
    </div>
  );
}
