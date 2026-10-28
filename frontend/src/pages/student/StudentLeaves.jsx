import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import { leaveApi } from '../../api';
import {
  PageHeader,
  Button,
  Card,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
} from '../../components/common';
import { Calendar, Plus, Eye, Ban, FileText } from 'lucide-react';
import WorkflowTimeline from '../../components/WorkflowTimeline.jsx';

export default function StudentLeaves() {
  const { openModal, viewAttachment, addToast } = useERP();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status');

  const normalizeStatus = (val) => {
    if (!val) return '';
    const upper = val.toUpperCase();
    if (upper === 'APPROVED' || upper === 'APPROVED_BY_HOD') return 'APPROVED_BY_HOD';
    return upper;
  };

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(() => normalizeStatus(urlStatus));
  const [selectedLeave, setSelectedLeave] = useState(null);

  useEffect(() => {
    if (urlStatus !== null) {
      setStatusFilter(normalizeStatus(urlStatus));
    }
  }, [urlStatus]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await leaveApi.getMine(params);
      const data = res?.data || [];
      setLeaves(data);
      if (data.length > 0) {
        setSelectedLeave((prev) => {
          if (!prev) return data[0];
          const found = data.find((l) => l._id === prev._id);
          return found || data[0];
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();

    const handleRefresh = () => fetchLeaves();
    window.addEventListener('campusflow_refresh_leaves', handleRefresh);
    return () => {
      window.removeEventListener('campusflow_refresh_leaves', handleRefresh);
    };
  }, [statusFilter]);

  const [cancellingId, setCancellingId] = useState(null);

  const handleCancel = async (id) => {
    if (!id) return;
    setCancellingId(id);
    try {
      await leaveApi.cancel(id);
      addToast('Application Cancelled', 'Your leave application has been cancelled.', 'info');
      await fetchLeaves();
      if (selectedLeave?._id === id) {
        setSelectedLeave((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
      }
      window.dispatchEvent(new CustomEvent('campusflow_refresh_leaves'));
    } catch (err) {
      addToast('Error', err.message || 'Unable to cancel the leave application.', 'danger');
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED_BY_HOD':
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'RECOMMENDED_BY_TG':
        return <Badge variant="warning">Recommended by TG</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      case 'CANCELLED':
        return <Badge variant="neutral">Cancelled</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="primary">Pending Review</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Student Leave Applications"
        description="Apply for and track medical, emergency, and casual leaves."
        actions={
          <Button
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => openModal('APPLY_LEAVE')}
          >
            Apply for Leave
          </Button>
        }
      />

      {/* Filter Tabs - occupy full width */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 w-full">
        {[
          { label: 'All Applications', value: '' },
          { label: 'Pending', value: 'PENDING' },
          { label: 'Recommended', value: 'RECOMMENDED_BY_TG' },
          { label: 'Approved', value: 'APPROVED_BY_HOD' },
          { label: 'Rejected', value: 'REJECTED' },
          { label: 'Cancelled', value: 'CANCELLED' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setSearchParams(tab.value ? { status: tab.value } : {});
            }}
            className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold text-center transition-all cursor-pointer shadow-2xs ${
              statusFilter === tab.value
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card text-muted-foreground border border-border hover:bg-muted/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={selectedLeave ? 'grid grid-cols-1 lg:grid-cols-3 gap-6 w-full' : 'w-full'}>
        <div className={selectedLeave ? 'lg:col-span-2 w-full' : 'w-full'}>
          <Card className="w-full">
            {leaves.length === 0 ? (
              <EmptyState
                title="No Leave Records Found"
                description="Apply for sanctioned leave clearance through your assigned Tutor Guardian."
                actionLabel="Apply for Leave"
                onAction={() => openModal('APPLY_LEAVE')}
              />
            ) : (
              <>
                {/* Mobile Cards View (< md) */}
                <div className="block md:hidden space-y-3 p-1">
                  {leaves.map((l) => (
                    <div
                      key={l._id}
                      className={`p-4 rounded-2xl bg-white border transition-all space-y-3 ${
                        selectedLeave?._id === l._id
                          ? 'border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                          : 'border-slate-200 shadow-2xs hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-slate-900 truncate">
                            {l.leaveType ? `${l.leaveType.replace(/_/g, ' ')} Leave` : 'Leave'}
                          </h4>
                          <span className="text-[11px] text-slate-500 font-medium block mt-0.5 truncate">
                            {l.reason || 'Personal Leave'}
                          </span>
                        </div>
                        <div className="shrink-0">{getStatusBadge(l.status)}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Dates</span>
                          <span className="font-semibold text-slate-800">
                            {l.startDate} {l.endDate !== l.startDate ? `to ${l.endDate}` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Duration</span>
                          <span className="font-bold text-slate-900">
                            {l.totalDays} Day{l.totalDays !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSelectedLeave(l)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Eye size={13} />
                          <span>Details</span>
                        </button>
                        {l.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => handleCancel(l._id)}
                            disabled={cancellingId === l._id}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                          >
                            <Ban size={13} className={cancellingId === l._id ? 'animate-spin' : ''} />
                            <span>Cancel</span>
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
                        <TableHead>Type & Reason</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.map((l) => (
                        <TableRow
                          key={l._id}
                          isSelected={selectedLeave?._id === l._id}
                          onClick={() => setSelectedLeave(l)}
                          className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                        >
                          <TableCell>
                            <div className="font-extrabold text-slate-900">
                              {l.leaveType ? `${l.leaveType.replace(/_/g, ' ')} Leave` : 'Leave'}
                            </div>
                            <div className="text-[11px] text-slate-500 max-w-[200px] truncate">
                              {l.reason}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {l.startDate} {l.endDate !== l.startDate ? `to ${l.endDate}` : ''}
                          </TableCell>
                          <TableCell className="font-bold text-slate-800">
                            {l.totalDays} Day{l.totalDays !== 1 ? 's' : ''}
                          </TableCell>
                          <TableCell>{getStatusBadge(l.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLeave(l);
                                }}
                                className="btn btn-outline btn-xs p-1 cursor-pointer"
                                title="View Details"
                              >
                                <Eye size={13} />
                              </button>
                              {l.status === 'PENDING' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancel(l._id);
                                  }}
                                  disabled={cancellingId === l._id}
                                  className="btn btn-danger btn-xs p-1 cursor-pointer disabled:opacity-50"
                                  title="Cancel Application"
                                >
                                  <Ban size={13} className={cancellingId === l._id ? 'animate-spin' : ''} />
                                </button>
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

        {/* Selected Leave Detail Drawer */}
        {selectedLeave && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm lg:static lg:inset-auto lg:z-auto lg:block lg:bg-transparent lg:p-0 lg:backdrop-blur-none lg:col-span-1">
            <Card className="w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-y-auto border-blue-200 shadow-md lg:max-w-none lg:max-h-none lg:overflow-visible">
              <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                <div>
                  <div className="text-xs font-bold text-blue-600 uppercase">
                    Leave Details
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 m-0 mt-0.5">
                    {selectedLeave.leaveType} Leave ({selectedLeave.totalDays}d)
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedLeave(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-3.5 my-4 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold">Status:</span>{' '}
                  {getStatusBadge(selectedLeave.status)}
                </div>

                <div>
                  <span className="text-slate-500 font-semibold">Date Range:</span>{' '}
                  <span className="text-slate-900 font-bold">
                    {selectedLeave.startDate} to {selectedLeave.endDate}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">Reason:</span>
                  <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 m-0">
                    {selectedLeave.reason}
                  </p>
                </div>

                {selectedLeave.attachments?.length > 0 && (
                  <div>
                    <span className="text-slate-500 font-semibold block mb-1">Medical Proof:</span>
                    <div className="flex flex-col gap-1.5">
                      {selectedLeave.attachments.map((att, i) => (
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
                  history={selectedLeave.history}
                  currentStatus={selectedLeave.status}
                />
              </div>

              {selectedLeave.status === 'PENDING' && (
                <Button
                  variant="danger"
                  size="sm"
                  fullWidth
                  loading={cancellingId === selectedLeave._id}
                  disabled={Boolean(cancellingId)}
                  icon={<Ban size={15} />}
                  onClick={() => handleCancel(selectedLeave._id)}
                  className="cursor-pointer"
                >
                  Cancel Leave
                </Button>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
