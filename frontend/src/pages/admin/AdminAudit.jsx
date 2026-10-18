import React, { useEffect, useState } from 'react';
import { reportApi } from '../../api';
import {
  ACTION_LABELS,
  formatDateTimeIST,
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
  Shield,
  Activity,
  Search,
  Filter,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Eye,
} from 'lucide-react';

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 25,
      };
      if (entityType) params.entityType = entityType;
      if (actionFilter) params.action = actionFilter;

      const res = await reportApi.getAudit(params);
      setLogs(res?.data?.logs || res?.data || []);
      setTotal(res?.data?.meta?.total || (res?.data?.logs ? res.data.logs.length : (res?.data?.length || 0)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, entityType, actionFilter]);

  const getActionBadge = (action) => {
    const label = ACTION_LABELS[action] || action;
    if (action.includes('APPROVE') || action === 'CREATE' || action.includes('APPOINT')) {
      return <span className="badge badge-emerald text-[10px] font-bold">{label}</span>;
    }
    if (action.includes('REJECT') || action.includes('CANCEL') || action.includes('REVOKE')) {
      return <span className="badge badge-danger text-[10px] font-bold">{label}</span>;
    }
    if (action.includes('ESCALATE') || action.includes('RECOMMEND')) {
      return <span className="badge badge-amber text-[10px] font-bold">{label}</span>;
    }
    return <span className="badge badge-indigo text-[10px] font-bold">{label}</span>;
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 font-sans">
      <PageHeader
        title="Immutable System Audit Trail"
        description="Comprehensive audit-grade logs of departmental authorizations, TG appointments, status determinations, and institutional events."
        action={
          <Button variant="secondary" onClick={fetchLogs} className="text-xs font-bold cursor-pointer">
            <RefreshCw size={13} /> Refresh Trail
          </Button>
        }
      />

      {/* Filters Bar */}
      <Card className="p-4 bg-slate-50/60 border-slate-200">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
          <div className="flex-1">
            <label className="font-bold text-slate-600 block mb-1">Entity Scope</label>
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className="form-select w-full bg-white border-slate-200 rounded-xl py-1.5 text-xs font-medium cursor-pointer"
            >
              <option value="">All Entities</option>
              <option value="CONSIDERATION">Attendance Considerations</option>
              <option value="LEAVE">Leave Applications</option>
              <option value="USER">User Accounts</option>
              <option value="MENTOR_GROUP">TG Mentor Groups</option>
              <option value="SECTION">Sections</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="font-bold text-slate-600 block mb-1">Action Type</label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="form-select w-full bg-white border-slate-200 rounded-xl py-1.5 text-xs font-medium cursor-pointer"
            >
              <option value="">All Actions</option>
              <option value="CREATE">Created Record</option>
              <option value="UPDATE">Updated Record</option>
              <option value="TG_RECOMMEND">TG Recommended</option>
              <option value="TG_REJECT">TG Rejected</option>
              <option value="HOD_APPROVE">HOD Approved</option>
              <option value="HOD_REJECT">HOD Rejected</option>
              <option value="APPOINT_TG">Appointed TG</option>
              <option value="REVOKE_TG">Revoked TG</option>
              <option value="CANCEL">Cancelled</option>
            </select>
          </div>

          <div className="flex items-end">
            <span className="badge badge-slate text-xs font-bold py-2 px-3">
              {total} Log Entries
            </span>
          </div>
        </div>
      </Card>

      {/* Audit Logs Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading audit records...</div>
        ) : logs.length === 0 ? (
          <EmptyState
            title="No Audit Records Found"
            description="No system operations match the selected filters."
            icon={Shield}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp (IST)</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log._id;
                  const payload = log.after || log.details || log.before;
                  const actorName = log.actor?.name || log.actor?.designation || (log.actorRole === 'SYSTEM' ? 'System / Automated' : 'User');

                  return (
                    <React.Fragment key={log._id}>
                      <TableRow className="hover:bg-slate-50 transition-colors">
                        <TableCell>
                          <span className="font-mono text-xs text-slate-600 font-medium">
                            {formatDateTimeIST(log.createdAt)}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-heading font-black text-xs text-slate-900">
                              {actorName}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {log.actorRole || 'SYSTEM'}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>{getActionBadge(log.action)}</TableCell>

                        <TableCell>
                          <div className="flex flex-col text-xs font-mono">
                            <span className="font-bold text-slate-800">{log.entityType}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                              {log.entityId}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-[11px] text-slate-500">
                            {log.ip || log.ipAddress || 'Not recorded'}
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          {payload ? (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log._id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-blue-600 text-xs font-bold transition-colors cursor-pointer"
                            >
                              <span>{isExpanded ? 'Hide' : 'View Details'}</span>
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs italic">No additional details</span>
                          )}
                        </TableCell>
                      </TableRow>

                      {isExpanded && payload && (
                        <TableRow className="bg-slate-50/80">
                          <TableCell colSpan={6} className="p-3">
                            <div className="rounded-xl bg-slate-900 p-3.5 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-56 leading-relaxed shadow-inner">
                              <div className="text-[10px] text-slate-400 uppercase font-sans font-bold mb-2">
                                Audit State & Change Payload:
                              </div>
                              <pre className="m-0 whitespace-pre-wrap">
                                {JSON.stringify(payload, null, 2)}
                              </pre>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
