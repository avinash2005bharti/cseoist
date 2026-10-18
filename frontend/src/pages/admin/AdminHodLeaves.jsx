import React, { useEffect, useState } from 'react';
import { useERP } from '../../context/ERPContext.jsx';
import { leaveApi } from '../../api';
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
  Eye,
  CheckCircle2,
  XCircle,
  Building2,
  Clock,
} from 'lucide-react';
import WorkflowTimeline from '../../components/WorkflowTimeline.jsx';

export default function AdminHodLeaves() {
  const { openModal, viewAttachment } = useERP();

  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await leaveApi.getAdminQueue();
      setItems(res?.data || []);
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

  const filteredItems = items.filter((item) => {
    if (statusFilter === 'ALL') return true;
    return item.status === statusFilter;
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Department Head (HOD) Leave Authorizations"
        description="Executive administration queue for reviewing and approving leave requests submitted by Department Heads."
      />

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'PENDING', label: 'Pending Review' },
          { id: 'APPROVED', label: 'Approved' },
          { id: 'REJECTED', label: 'Rejected' },
          { id: 'ALL', label: 'All Requests' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`btn btn-sm text-xs font-bold px-3.5 py-1.5 ${
              statusFilter === tab.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Table and Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`flex flex-col gap-4 ${selectedItem ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400">Loading HOD leaves...</div>
            ) : filteredItems.length === 0 ? (
              <EmptyState
                title="No HOD Leave Applications"
                description="No leave applications match the selected status filter."
                icon={Calendar}
              />
            ) : (
              <>
                {/* Mobile Cards View (< md) */}
                <div className="block md:hidden space-y-3 p-1">
                  {filteredItems.map((item) => (
                    <div
                      key={item._id}
                      className={`p-4 rounded-2xl bg-white border transition-all space-y-3 ${
                        selectedItem?._id === item._id
                          ? 'border-amber-500 shadow-sm ring-1 ring-amber-500/20'
                          : 'border-slate-200 shadow-2xs hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-slate-900 truncate">
                            {item.applicant?.name || 'Department Head'}
                          </h4>
                          <span className="text-[11px] text-slate-500 font-mono block mt-0.5 truncate">
                            {item.applicant?.email}
                          </span>
                        </div>
                        <span
                          className={`badge text-[10px] font-bold shrink-0 ${
                            item.status === 'APPROVED'
                              ? 'badge-emerald'
                              : item.status === 'REJECTED'
                              ? 'badge-danger'
                              : 'badge-primary'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Type & Reason</span>
                          <span className="font-bold text-slate-900 block truncate">{item.leaveType}</span>
                          <span className="text-[11px] text-slate-500 block truncate">{item.reason}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Dates & Duration</span>
                          <span className="font-semibold text-slate-800 block">
                            {item.startDate === item.endDate ? item.startDate : `${item.startDate} to ${item.endDate}`}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {item.totalDays} day{item.totalDays > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSelectedItem(item)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Eye size={13} />
                          <span>Details</span>
                        </button>
                        {item.documentFileId && (
                          <button
                            type="button"
                            onClick={() =>
                              viewAttachment({
                                fileId: item.documentFileId,
                                fileName: item.documentOriginalName || 'Document.pdf',
                              })
                            }
                            className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-blue-600 border border-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <span>View Proof</span>
                          </button>
                        )}
                        {item.status === 'PENDING' && (
                          <Button
                            size="xs"
                            variant="warning"
                            onClick={() =>
                              openModal('REVIEW_ACTION', {
                                type: 'LEAVE',
                                role: 'ADMIN',
                                item,
                              })
                            }
                            className="text-xs font-bold"
                          >
                            Review
                          </Button>
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
                        <TableHead>Department Head</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Dates & Duration</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => (
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
                                {item.applicant?.name || 'Department Head'}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {item.applicant?.email}
                              </span>
                            </div>
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
                                  ? item.startDate
                                  : `${item.startDate} to ${item.endDate}`}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {item.totalDays} day{item.totalDays > 1 ? 's' : ''}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs text-slate-600 truncate max-w-[200px] block" title={item.reason}>
                              {item.reason}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span
                              className={`badge text-[10px] font-bold ${
                                item.status === 'APPROVED'
                                  ? 'badge-emerald'
                                  : item.status === 'REJECTED'
                                  ? 'badge-danger'
                                  : 'badge-primary'
                              }`}
                            >
                              {item.status}
                            </span>
                          </TableCell>

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
                                  className="btn btn-sm btn-ghost p-1.5 text-slate-500 hover:text-blue-600"
                                  title="View Proof"
                                >
                                  <Eye size={14} />
                                </button>
                              )}

                              {item.status === 'PENDING' && (
                                <Button
                                  variant="warning"
                                  onClick={() =>
                                    openModal('REVIEW_ACTION', {
                                      type: 'LEAVE',
                                      role: 'ADMIN',
                                      item,
                                    })
                                  }
                                  className="btn-sm text-[11px] font-bold py-1 px-3"
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

        {/* Selected Drawer */}
        {selectedItem && (
          <div className="lg:col-span-1">
            <Card className="p-5 flex flex-col gap-4 border-amber-200 shadow-md sticky top-20">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-heading font-black text-sm text-slate-900">
                  HOD Leave Details
                </h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Close
                </button>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Department Head
                </span>
                <div className="text-sm font-black text-slate-900 mt-0.5">
                  {selectedItem.applicant?.name}
                </div>
                <div className="text-xs text-slate-500">
                  {selectedItem.applicant?.email}
                </div>
              </div>

              <div className="text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Reason for Absence
                </span>
                <p className="p-3 bg-slate-50 rounded-xl text-slate-700 border border-slate-100 italic leading-relaxed">
                  "{selectedItem.reason}"
                </p>
              </div>

              {selectedItem.documentFileId && (
                <button
                  onClick={() =>
                    viewAttachment({
                      fileId: selectedItem.documentFileId,
                      fileName: selectedItem.documentOriginalName || 'Document.pdf',
                    })
                  }
                  className="w-full btn btn-sm bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold flex items-center justify-center gap-2 py-2"
                >
                  <Eye size={14} />
                  View Supporting Document
                </button>
              )}

              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                  Workflow Record
                </span>
                <WorkflowTimeline item={selectedItem} type="LEAVE" />
              </div>

              {selectedItem.status === 'PENDING' && (
                <div className="pt-3 border-t border-slate-100">
                  <Button
                    variant="warning"
                    onClick={() =>
                      openModal('REVIEW_ACTION', {
                        type: 'LEAVE',
                        role: 'ADMIN',
                        item: selectedItem,
                      })
                    }
                    className="w-full text-xs font-bold py-2.5 shadow-sm"
                  >
                    Executive Approval / Decision
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
