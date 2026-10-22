import React, { useEffect, useState } from 'react';
import { useERP } from '../../context/ERPContext.jsx';
import { considerationApi, leaveApi } from '../../api';
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
import { CheckSquare, Calendar, FileText, Eye, CheckCircle2, AlertTriangle, UserCheck } from 'lucide-react';
import WorkflowTimeline from '../../components/WorkflowTimeline.jsx';

export default function TgRequests() {
  const { openModal, viewAttachment } = useERP();

  const [activeTab, setActiveTab] = useState('considerations'); // 'considerations' | 'leaves'
  const [statusFilter, setStatusFilter] = useState('PENDING');

  const [considerations, setConsiderations] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  // Message-style pending counts over tabs
  const [pendingConsCount, setPendingConsCount] = useState(0);
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0);

  const fetchPendingCounts = async () => {
    try {
      const [consRes, leavesRes] = await Promise.allSettled([
        considerationApi.getTGQueue({ status: 'PENDING' }),
        leaveApi.getTGQueue({ status: 'PENDING' }),
      ]);
      if (consRes.status === 'fulfilled') {
        const val = consRes.value?.data || consRes.value?.requests || consRes.value || [];
        setPendingConsCount(Array.isArray(val) ? val.length : 0);
      }
      if (leavesRes.status === 'fulfilled') {
        const val = leavesRes.value?.data || leavesRes.value?.leaves || leavesRes.value || [];
        setPendingLeavesCount(Array.isArray(val) ? val.length : 0);
      }
    } catch (e) {
      console.error('Error fetching pending counts:', e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { status: statusFilter };
      if (activeTab === 'considerations') {
        const res = await considerationApi.getTGQueue(params);
        const data = res?.data || [];
        setConsiderations(data);
        if (statusFilter === 'PENDING') {
          setPendingConsCount(data.length);
        }
      } else {
        const res = await leaveApi.getTGQueue(params);
        const data = res?.data || [];
        setLeaves(data);
        if (statusFilter === 'PENDING') {
          setPendingLeavesCount(data.length);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchPendingCounts();

    const handleQueueChange = () => {
      fetchData();
      fetchPendingCounts();
    };
    window.addEventListener('campusflow_queue_changed', handleQueueChange);
    return () => {
      window.removeEventListener('campusflow_queue_changed', handleQueueChange);
    };
  }, [activeTab, statusFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED_BY_HOD':
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'RECOMMENDED_BY_TG':
        return <Badge variant="warning">Recommended by TG</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="primary">Pending Review</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Review Applications"
        description="Review and recommend attendance consideration and leave applications for your assigned students."
      />

      {/* Main Mode Tabs & Status Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 flex-wrap">
          {/* Attendance Consideration Tab with Notification Badge */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('considerations');
              setSelectedItem(null);
            }}
            className={`relative px-4 py-2.5 ${pendingConsCount > 0 ? 'pr-8' : ''} rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'considerations'
                ? 'bg-blue-600 text-white shadow-xs border border-blue-700'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-2xs'
            }`}
          >
            <FileText size={15} className="shrink-0" />
            <span>Attendance Consideration</span>
            {pendingConsCount > 0 && (
              <span
                title={`${pendingConsCount} Pending Considerations`}
                className="absolute top-1.5 right-2 min-w-[19px] h-[19px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs border border-white/80"
              >
                {pendingConsCount > 99 ? '99+' : pendingConsCount}
              </span>
            )}
          </button>

          {/* Leave Applications Tab with Notification Badge */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('leaves');
              setSelectedItem(null);
            }}
            className={`relative px-4 py-2.5 ${pendingLeavesCount > 0 ? 'pr-8' : ''} rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'leaves'
                ? 'bg-blue-600 text-white shadow-xs border border-blue-700'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-2xs'
            }`}
          >
            <Calendar size={15} className="shrink-0" />
            <span>Leave Applications</span>
            {pendingLeavesCount > 0 && (
              <span
                title={`${pendingLeavesCount} Pending Leave Applications`}
                className="absolute top-1.5 right-2 min-w-[19px] h-[19px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs border border-white/80"
              >
                {pendingLeavesCount > 99 ? '99+' : pendingLeavesCount}
              </span>
            )}
          </button>
        </div>

        {/* Status Filters with High-Contrast Solid Active Styling */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'PENDING', label: 'Pending Review' },
            { id: 'RECOMMENDED_BY_TG', label: 'Recommended by TG' },
            { id: 'REJECTED', label: 'Rejected' },
            { id: 'ALL', label: 'All Applications' },
          ].map((st) => {
            const isSelected = statusFilter === (st.id === 'ALL' ? '' : st.id);
            let activeColor = 'bg-slate-900 text-white font-bold border-slate-900 shadow-xs';
            if (isSelected) {
              if (st.id === 'RECOMMENDED_BY_TG') activeColor = 'bg-amber-600 text-white border-amber-600 font-extrabold shadow-xs';
              else if (st.id === 'REJECTED') activeColor = 'bg-rose-600 text-white border-rose-600 font-extrabold shadow-xs';
              else if (st.id === 'PENDING') activeColor = 'bg-blue-600 text-white border-blue-600 font-extrabold shadow-xs';
            }
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id === 'ALL' ? '' : st.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs transition-all border cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? `${activeColor} border-2`
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-semibold'
                }`}
              >
                <span>{st.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* List & Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={selectedItem ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <Card>
            {activeTab === 'considerations' ? (
              considerations.length === 0 ? (
                <EmptyState
                  title={
                    statusFilter === 'RECOMMENDED_BY_TG'
                      ? 'No Recommended Applications'
                      : statusFilter === 'REJECTED'
                      ? 'No Rejected Applications'
                      : statusFilter === 'PENDING'
                      ? 'No Pending Applications'
                      : 'No Applications Found'
                  }
                  description={
                    statusFilter === 'PENDING'
                      ? 'All attendance consideration applications for this section have been reviewed.'
                      : 'There are no attendance consideration applications matching the current filter.'
                  }
                />
              ) : (
                <>
                  {/* Mobile Cards View (< md) */}
                  <div className="block md:hidden space-y-3 p-1">
                    {considerations.map((r) => (
                      <div
                        key={r._id}
                        className={`p-4 rounded-2xl bg-white border transition-all space-y-3 ${
                          selectedItem?._id === r._id
                            ? 'border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                            : 'border-slate-200 shadow-2xs hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-sm text-slate-900 truncate">
                              {r.student?.user?.name || 'Student'}
                            </h4>
                            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                              Roll: {r.student?.rollNumber || '-'} • {r.student?.section?.code || r.student?.section?.name || 'Section'}
                            </span>
                          </div>
                          <div className="shrink-0">{getStatusBadge(r.status)}</div>
                        </div>

                        {Boolean(r.isGroup || (r.sectionStudents && r.sectionStudents.length > 0)) && (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Group ({r.sectionStudents?.length || 'Section'})
                          </span>
                        )}

                        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Event</span>
                            <span className="font-bold text-slate-900 block truncate">{r.eventTitle}</span>
                            <span className="text-[11px] text-slate-500 block">{r.startDate}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Lectures</span>
                            <span className="font-bold text-slate-900 block">
                              {r.requestedPeriods} Lectures
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setSelectedItem(r)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Eye size={13} />
                            <span>Details</span>
                          </button>
                          {r.isGroup && (
                            <button
                              type="button"
                              onClick={() => openModal('AUDIT_GROUP_STUDENTS', { request: r, userRole: 'TG' })}
                              className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title="Audit Students"
                            >
                              <UserCheck size={13} />
                              <span>Audit</span>
                            </button>
                          )}
                          {r.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() =>
                                openModal('REVIEW_ACTION', {
                                  type: 'CONSIDERATION',
                                  role: 'TG',
                                  item: r,
                                })
                              }
                              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                            >
                              <CheckSquare size={13} />
                              <span>Review</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (>= md) */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Event & Category</TableHead>
                          <TableHead>Lectures</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {considerations.map((r) => (
                          <TableRow key={r._id} isSelected={selectedItem?._id === r._id}>
                            <TableCell>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-slate-900">{r.student?.user?.name}</span>
                                {Boolean(r.isGroup || (r.sectionStudents && r.sectionStudents.length > 0)) && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    Group ({r.sectionStudents?.length || 'Section'})
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Roll: {r.student?.rollNumber} • {r.student?.section?.code || r.student?.section?.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-bold text-slate-900">{r.eventTitle}</div>
                              <div className="text-[11px] text-slate-500">
                                {r.eventType} • {r.startDate}
                              </div>
                            </TableCell>
                            <TableCell className="font-extrabold text-slate-900">
                              {r.requestedPeriods}
                            </TableCell>
                            <TableCell>{getStatusBadge(r.status)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setSelectedItem(r)}
                                  className="btn btn-outline btn-xs p-1 cursor-pointer"
                                  title="Details"
                                >
                                  <Eye size={13} />
                                </button>
                                {r.isGroup && (
                                  <button
                                    onClick={() => openModal('AUDIT_GROUP_STUDENTS', { request: r, userRole: 'TG' })}
                                    className="btn btn-outline btn-xs px-2 text-indigo-700 hover:bg-indigo-50 cursor-pointer flex items-center gap-1 font-bold"
                                    title="Audit Group Students"
                                  >
                                    <UserCheck size={12} />
                                    <span>Audit</span>
                                  </button>
                                )}
                                {r.status === 'PENDING' && (
                                  <Button
                                    size="xs"
                                    variant="primary"
                                    onClick={() =>
                                      openModal('REVIEW_ACTION', {
                                        type: 'CONSIDERATION',
                                        role: 'TG',
                                        item: r,
                                      })
                                    }
                                  >
                                    Review
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )
            ) : leaves.length === 0 ? (
              <EmptyState
                title={
                  statusFilter === 'RECOMMENDED_BY_TG'
                    ? 'No Recommended Leave Applications'
                    : statusFilter === 'REJECTED'
                    ? 'No Rejected Leave Applications'
                    : statusFilter === 'PENDING'
                    ? 'No Pending Leave Applications'
                    : 'No Leave Applications Found'
                }
                description={
                  statusFilter === 'PENDING'
                    ? 'There are currently no leave applications awaiting review.'
                    : 'There are no leave applications matching the current filter.'
                }
              />
            ) : (
              <>
                {/* Mobile Cards View (< md) */}
                <div className="block md:hidden space-y-3 p-1">
                  {leaves.map((l) => (
                    <div
                      key={l._id}
                      className={`p-4 rounded-2xl bg-white border transition-all space-y-3 ${
                        selectedItem?._id === l._id
                          ? 'border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                          : 'border-slate-200 shadow-2xs hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-slate-900 truncate">
                            {l.student?.user?.name || 'Student'}
                          </h4>
                          <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                            Roll: {l.student?.rollNumber || '-'}
                          </span>
                        </div>
                        <div className="shrink-0">{getStatusBadge(l.status)}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Category</span>
                          <span className="font-bold text-slate-900 block truncate">
                            {l.leaveType} ({l.totalDays}d)
                          </span>
                          <span className="text-[11px] text-slate-500 block truncate">{l.reason}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Dates</span>
                          <span className="font-semibold text-slate-800 block">
                            {l.startDate} to {l.endDate}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSelectedItem(l)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Eye size={13} />
                          <span>Details</span>
                        </button>
                        {l.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() =>
                              openModal('REVIEW_ACTION', {
                                type: 'LEAVE',
                                role: 'TG',
                                item: l,
                              })
                            }
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                          >
                            <CheckSquare size={13} />
                            <span>Review</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (>= md) */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Category & Reason</TableHead>
                        <TableHead>Range</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.map((l) => (
                        <TableRow key={l._id} isSelected={selectedItem?._id === l._id}>
                          <TableCell>
                            <div className="font-extrabold text-slate-900">{l.student?.user?.name}</div>
                            <div className="text-[11px] text-slate-500">
                              Roll: {l.student?.rollNumber}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-bold text-slate-900">{l.leaveType} ({l.totalDays}d)</div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[160px]">{l.reason}</div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {l.startDate} to {l.endDate}
                          </TableCell>
                          <TableCell>{getStatusBadge(l.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setSelectedItem(l)}
                                className="btn btn-outline btn-xs p-1 cursor-pointer"
                                title="Details"
                              >
                                <Eye size={13} />
                              </button>
                              {l.status === 'PENDING' && (
                                <Button
                                  size="xs"
                                  variant="primary"
                                  onClick={() =>
                                    openModal('REVIEW_ACTION', {
                                      type: 'LEAVE',
                                      role: 'TG',
                                      item: l,
                                    })
                                  }
                                >
                                  Review
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
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
            <Card className="border-amber-200 shadow-md">
              <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                <div>
                  <div className="text-xs font-bold text-amber-700 uppercase">
                    Student Application
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 m-0 mt-0.5">
                    {selectedItem.eventTitle || `${selectedItem.leaveType} Leave`}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-3 my-4 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold">Student:</span>{' '}
                  <span className="text-slate-900 font-extrabold">
                    {selectedItem.student?.user?.name} (Roll: {selectedItem.student?.rollNumber})
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 font-semibold">Status:</span>{' '}
                  {getStatusBadge(selectedItem.status)}
                </div>

                {Boolean(selectedItem.isGroup && selectedItem.sectionStudents && selectedItem.sectionStudents.length > 0) && (() => {
                  const activeSectionStudents = selectedItem.sectionStudents.filter((m) => {
                    const isExcluded = (selectedItem.studentAudits || []).some(
                      (a) => (a.student?._id || a.student)?.toString() === (m._id || m)?.toString() && a.status === 'EXCLUDED'
                    );
                    return !isExcluded;
                  });

                  if (activeSectionStudents.length === 0) return null;

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-slate-500 font-semibold">
                          Students from your Section ({activeSectionStudents.length}):
                        </span>
                        <button
                          type="button"
                          onClick={() => openModal('AUDIT_GROUP_STUDENTS', { request: selectedItem, userRole: 'TG' })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer"
                          title="Audit Section Students"
                        >
                          <UserCheck size={11} />
                          <span>Audit Students</span>
                        </button>
                      </div>
                      <div className="flex flex-col gap-1 p-2 rounded-xl bg-indigo-50/60 border border-indigo-200 text-[11px]">
                        {activeSectionStudents.map((m, idx) => {
                          const mName = m.user?.name || m.name || 'Student';
                          const mRoll = m.enrollmentNumber || m.rollNumber || '';
                          return (
                            <div
                              key={m._id || idx}
                              className="flex items-center justify-between py-1 px-1.5 rounded-lg border-b border-indigo-100 last:border-0"
                            >
                              <span className="font-bold text-slate-800 truncate">{mName}</span>
                              <span className="text-slate-500 font-mono text-[10px]">{mRoll}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {selectedItem.description && (
                  <div>
                    <span className="text-slate-500 font-semibold block mb-0.5">Justification:</span>
                    <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 m-0">
                      {selectedItem.description}
                    </p>
                  </div>
                )}

                {selectedItem.reason && (
                  <div>
                    <span className="text-slate-500 font-semibold block mb-0.5">Reason:</span>
                    <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 m-0">
                      {selectedItem.reason}
                    </p>
                  </div>
                )}

                {selectedItem.attachments?.length > 0 && (
                  <div>
                    <span className="text-slate-500 font-semibold block mb-1">Attached Proof:</span>
                    <div className="flex flex-col gap-1.5">
                      {selectedItem.attachments.map((att, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => viewAttachment(att.fileId, att.name)}
                          className="flex items-center justify-between p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText size={14} className="shrink-0" />
                            <span className="truncate">{att.name}</span>
                          </div>
                          <Eye size={14} className="shrink-0 text-blue-600" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <WorkflowTimeline
                  history={selectedItem.history}
                  currentStatus={selectedItem.status}
                />
              </div>

              {selectedItem.status === 'PENDING' && (
                <Button
                  size="sm"
                  fullWidth
                  variant="primary"
                  onClick={() =>
                    openModal('REVIEW_ACTION', {
                      type: activeTab === 'considerations' ? 'CONSIDERATION' : 'LEAVE',
                      role: 'TG',
                      item: selectedItem,
                    })
                  }
                >
                  Conduct TG Review
                </Button>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
