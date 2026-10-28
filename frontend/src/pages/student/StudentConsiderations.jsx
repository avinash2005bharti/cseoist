import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import { considerationApi, notificationApi } from '../../api';
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
import { FileText, Plus, Eye, Ban, Calendar, Clock, AlertCircle, Users, CheckCircle2, Sparkles } from 'lucide-react';
import WorkflowTimeline from '../../components/WorkflowTimeline.jsx';
import FormalApplicationModal from '../../components/modals/FormalApplicationModal.jsx';

export default function StudentConsiderations() {
  const { openModal, viewAttachment, addToast } = useERP();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status');

  const normalizeStatus = (val) => {
    if (!val) return '';
    const upper = val.toUpperCase();
    if (upper === 'APPROVED' || upper === 'APPROVED_BY_HOD') return 'APPROVED_BY_HOD';
    return upper;
  };

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(() => normalizeStatus(urlStatus));
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [formalModalItem, setFormalModalItem] = useState(null);
  const [windowStatus, setWindowStatus] = useState(null);

  useEffect(() => {
    notificationApi
      .getConsiderationWindow()
      .then((res) => {
        const data = res?.data || res;
        setWindowStatus(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (urlStatus !== null) {
      setStatusFilter(normalizeStatus(urlStatus));
    }
  }, [urlStatus]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await considerationApi.getMine(params);
      const data = res?.data || [];
      setRequests(data);
      if (data.length > 0) {
        setSelectedRequest((prev) => {
          if (!prev) return data[0];
          const found = data.find((r) => r._id === prev._id);
          return found || data[0];
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    const handleRefresh = () => fetchRequests();
    window.addEventListener('campusflow_refresh_considerations', handleRefresh);
    return () => {
      window.removeEventListener('campusflow_refresh_considerations', handleRefresh);
    };
  }, [statusFilter]);

  const [cancellingId, setCancellingId] = useState(null);

  const handleCancel = async (id) => {
    if (!id) return;
    setCancellingId(id);
    try {
      await considerationApi.cancel(id);
      addToast('Application Cancelled', 'Your attendance consideration application has been cancelled.', 'info');
      await fetchRequests();
      if (selectedRequest?._id === id) {
        setSelectedRequest((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
      }
      window.dispatchEvent(new CustomEvent('campusflow_refresh_considerations'));
    } catch (err) {
      addToast('Error', err.message || 'Cannot cancel request.', 'danger');
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED_BY_HOD':
        return <Badge variant="success">Approved by HOD</Badge>;
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
        title="Attendance Consideration Applications"
        description="Submit and track attendance consideration applications for hackathons, sports, and official college activities."
        actions={
          <div className="flex items-center gap-2.5">
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold ${
                windowStatus?.isTimeLimitEnabled === false
                  ? 'bg-purple-50 border-purple-200 text-purple-800'
                  : windowStatus?.isOpen
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              {windowStatus?.isTimeLimitEnabled === false ? (
                <Sparkles size={13} className="text-purple-600 animate-pulse" />
              ) : (
                <Clock size={13} className={windowStatus?.isOpen ? "text-emerald-600" : "text-amber-600"} />
              )}
              <span>
                {windowStatus?.isTimeLimitEnabled === false
                  ? '24/7 Open (Testing Mode)'
                  : windowStatus?.isOpen
                  ? 'Window Open (9:00 AM – 4:00 PM IST)'
                  : 'Window Closed (9:00 AM – 4:00 PM IST)'}
              </span>
            </span>
            <Button
              size="sm"
              icon={<Plus size={16} />}
              onClick={() => openModal('REQUEST_CONSIDERATION')}
            >
              Apply for Consideration
            </Button>
          </div>
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

      <div className={selectedRequest ? 'grid grid-cols-1 lg:grid-cols-3 gap-6 w-full' : 'w-full'}>
        {/* Table / List View */}
        <div className={selectedRequest ? 'lg:col-span-2 w-full' : 'w-full'}>
          <Card className="w-full">
            {requests.length === 0 ? (
              <EmptyState
                title="No Attendance Consideration Applications Found"
                description="Submit an attendance consideration application when participating in approved events."
                actionLabel="Apply for Consideration"
                onAction={() => openModal('REQUEST_CONSIDERATION')}
              />
            ) : (
              <>
                {/* Mobile Cards View (< md) */}
                <div className="block md:hidden space-y-3 p-1">
                  {requests.map((r) => (
                    <div
                      key={r._id}
                      className={`p-4 rounded-2xl bg-white border transition-all space-y-3 ${
                        selectedRequest?._id === r._id
                          ? 'border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                          : 'border-slate-200 shadow-2xs hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-slate-900 truncate">{r.eventTitle}</h4>
                          <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                            {r.eventType ? r.eventType.replace(/_/g, ' ') : 'Activity'} • {r.organizer || 'Official'}
                          </span>
                        </div>
                        <div className="shrink-0">{getStatusBadge(r.status)}</div>
                      </div>

                      {Boolean(r.isGroup || (r.groupMembers && r.groupMembers.length > 0)) && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Group ({r.groupMembers?.length || 'Team'})
                        </span>
                      )}

                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Dates</span>
                          <span className="font-semibold text-slate-800">
                            {r.startDate} {r.endDate !== r.startDate ? `to ${r.endDate}` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Lectures</span>
                          <span className="font-bold text-slate-900">
                            {r.requestedPeriods} {r.requestedPeriods === 1 ? 'Lecture' : 'Lectures'}
                            {r.hodReview?.approvedPeriods && (
                              <span className="text-emerald-700 font-bold block text-[11px]">
                                Approved: {r.hodReview.approvedPeriods}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(r)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Eye size={13} />
                          <span>Details</span>
                        </button>
                        {r.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => handleCancel(r._id)}
                            disabled={cancellingId === r._id}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                          >
                            <Ban size={13} className={cancellingId === r._id ? 'animate-spin' : ''} />
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
                        <TableHead>Event & Category</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Lectures</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((r) => (
                        <TableRow
                          key={r._id}
                          isSelected={selectedRequest?._id === r._id}
                          onClick={() => setSelectedRequest(r)}
                          className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                        >
                          <TableCell>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-slate-900">{r.eventTitle}</span>
                              {Boolean(r.isGroup || (r.groupMembers && r.groupMembers.length > 0)) && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Group ({r.groupMembers?.length || 'Team'})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {r.eventType ? r.eventType.replace(/_/g, ' ') : 'Activity'} • {r.organizer || 'Official'}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {r.startDate} {r.endDate !== r.startDate ? `to ${r.endDate}` : ''}
                          </TableCell>
                          <TableCell className="font-bold text-slate-800">
                            {r.requestedPeriods} {r.requestedPeriods === 1 ? 'Lecture' : 'Lectures'}
                            {r.hodReview?.approvedPeriods && (
                              <span className="text-emerald-700 block text-[11px]">
                                Approved: {r.hodReview.approvedPeriods}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(r.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRequest(r);
                                }}
                                className="btn btn-outline btn-xs p-1 cursor-pointer"
                                title="View Application Details"
                              >
                                <Eye size={13} />
                              </button>
                              {r.status === 'PENDING' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancel(r._id);
                                  }}
                                  disabled={cancellingId === r._id}
                                  className="btn btn-danger btn-xs p-1 cursor-pointer disabled:opacity-50"
                                  title="Cancel Request"
                                >
                                  <Ban size={13} className={cancellingId === r._id ? 'animate-spin' : ''} />
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

        {/* Selected Request Detail Drawer */}
        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm lg:static lg:inset-auto lg:z-auto lg:block lg:bg-transparent lg:p-0 lg:backdrop-blur-none lg:col-span-1">
            <Card className="w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-y-auto border-blue-200 shadow-md lg:max-w-none lg:max-h-none lg:overflow-visible">
              <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                <div>
                  <div className="text-xs font-bold text-blue-600 uppercase">
                    Request Details
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 m-0 mt-0.5">
                    {selectedRequest.eventTitle}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-3.5 my-4 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold">Status:</span>{' '}
                  {getStatusBadge(selectedRequest.status)}
                </div>

                <div>
                  <span className="text-slate-500 font-semibold">Duration:</span>{' '}
                  <span className="text-slate-900 font-bold">
                    {selectedRequest.startDate} to {selectedRequest.endDate}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 font-semibold">Lectures Requested:</span>{' '}
                  <span className="text-slate-900 font-bold">
                    {selectedRequest.requestedPeriods} {selectedRequest.requestedPeriods === 1 ? 'Lecture' : 'Lectures'}
                  </span>
                </div>

                {selectedRequest.hodReview?.approvedPeriods && (
                  <div>
                    <span className="text-slate-500 font-semibold">Lectures Approved:</span>{' '}
                    <span className="text-emerald-700 font-bold">
                      {selectedRequest.hodReview.approvedPeriods} Lectures
                    </span>
                  </div>
                )}

                {/* Group Roster in Drawer */}
                {Boolean(selectedRequest.isGroup || (selectedRequest.groupMembers && selectedRequest.groupMembers.length > 0)) && (
                  <div>
                    <span className="text-slate-500 font-semibold block mb-1">
                      Group Members ({selectedRequest.groupMembers?.length || 'Team'}):
                    </span>
                    <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200 text-[11px]">
                      {(selectedRequest.groupMembers || []).map((m, idx) => {
                        const mName = m.user?.name || m.name || 'Student';
                        const mRoll = m.enrollmentNumber || m.rollNumber || '';
                        const mSec = m.section?.name || m.section?.code || '';
                        const isLead = (m._id && selectedRequest.groupLeader && String(m._id) === String(selectedRequest.groupLeader._id || selectedRequest.groupLeader)) || (idx === 0 && !selectedRequest.groupLeader);
                        return (
                          <div key={m._id || idx} className="flex items-center justify-between py-0.5 border-b border-indigo-100 last:border-0">
                            <span className="font-bold text-slate-800">
                              {isLead ? '★ (Lead) ' : ''}{mName}
                            </span>
                            <span className="text-slate-500 font-mono text-[10px]">
                              {mRoll} {mSec ? `• ${mSec}` : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedRequest.description && (
                  <div>
                    <span className="text-slate-500 font-semibold block mb-0.5">Reason / Description:</span>
                    <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 m-0">
                      {selectedRequest.description}
                    </p>
                  </div>
                )}

                {/* Attachments */}
                {selectedRequest.attachments?.length > 0 && (
                  <div>
                    <span className="text-slate-500 font-semibold block mb-1">Attached Documents:</span>
                    <div className="flex flex-col gap-1.5">
                      {selectedRequest.attachments.map((att, i) => (
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

                {/* Workflow Stepper */}
                <WorkflowTimeline
                  history={selectedRequest.history}
                  currentStatus={selectedRequest.status}
                />
              </div>

              {/* Sanctioned Certificate Button if Approved */}
              {selectedRequest.status === 'APPROVED_BY_HOD' && (
                <div className="mb-2">
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    icon={<FileText size={14} />}
                    onClick={() => setFormalModalItem(selectedRequest)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs"
                  >
                    View Sanctioned Certificate
                  </Button>
                </div>
              )}

              {selectedRequest.status === 'PENDING' && (
                <Button
                  variant="danger"
                  size="sm"
                  fullWidth
                  loading={cancellingId === selectedRequest._id}
                  disabled={Boolean(cancellingId)}
                  icon={<Ban size={15} />}
                  onClick={() => handleCancel(selectedRequest._id)}
                  className="cursor-pointer"
                >
                  Cancel Request
                </Button>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Formal Sanctioned Application Document Modal */}
      {formalModalItem && (
        <FormalApplicationModal
          item={formalModalItem}
          onClose={() => setFormalModalItem(null)}
        />
      )}
    </div>
  );
}
