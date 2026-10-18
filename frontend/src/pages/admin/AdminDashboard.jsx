import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useERP } from '../../context/ERPContext.jsx';
import { dashboardApi, leaveApi, masterDataApi } from '../../api';
import {
  StatCard,
  Card,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/common';
import {
  Shield,
  Users,
  GraduationCap,
  Briefcase,
  Database,
  Calendar,
  Layers,
  ArrowRight,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  Lock,
  Activity,
  FileSpreadsheet,
  Search,
  ExternalLink,
  Mail,
  Phone,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import CreateUserModal from '../../components/modals/CreateUserModal.jsx';

export default function AdminDashboard() {
  const { openModal, addToast } = useERP();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [hodLeaves, setHodLeaves] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [studentsCount, setStudentsCount] = useState(0);
  const [teachersCount, setTeachersCount] = useState(0);
  const [sections, setSections] = useState([]);

  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [users, setUsers] = useState([]);

  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'teachers' | 'users' | 'sections'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Create User ID Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalRole, setCreateModalRole] = useState('STUDENT');

  const handleOpenCreateModal = (role = 'STUDENT') => {
    setCreateModalRole(role);
    setShowCreateModal(true);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, leavesRes, usersRes, studentsRes, teachersRes, sectionsRes] = await Promise.all([
        dashboardApi.getSummary().catch(() => ({ data: {} })),
        leaveApi.getAdminQueue().catch(() => ({ data: [] })),
        masterDataApi.getUsers({ limit: 10, page: 1 }).catch(() => ({ data: [] })),
        masterDataApi.getStudents({ limit: 10, page: 1 }).catch(() => ({ data: [] })),
        masterDataApi.getTeachers({ limit: 10, page: 1 }).catch(() => ({ data: [] })),
        masterDataApi.getSections().catch(() => ({ data: [] })),
      ]);

      const sumData = sumRes?.data || {};
      setSummary(sumData);
      setHodLeaves(leavesRes?.data || []);
      setSections(Array.isArray(sectionsRes?.data) ? sectionsRes.data : []);

      // Unpack users
      const userList = Array.isArray(usersRes?.data)
        ? usersRes.data
        : (usersRes?.data?.users || usersRes?.users || []);

      const totalUsers =
        sumData?.totalUsers ??
        usersRes?.meta?.total ??
        usersRes?.data?.meta?.total ??
        userList.length;
      setUsers(userList);
      setUsersCount(totalUsers);

      // Unpack students
      const studentList = Array.isArray(studentsRes?.data)
        ? studentsRes.data
        : (studentsRes?.data?.students || studentsRes?.students || []);
      const totalStudents =
        sumData?.totalStudents ??
        studentsRes?.meta?.total ??
        studentsRes?.data?.meta?.total ??
        studentList.length;
      setStudents(studentList);
      setStudentsCount(totalStudents);

      // Unpack teachers
      const teacherList = Array.isArray(teachersRes?.data)
        ? teachersRes.data
        : (teachersRes?.data?.teachers || teachersRes?.teachers || []);
      const totalTeachers =
        sumData?.totalTeachers ??
        teachersRes?.meta?.total ??
        teachersRes?.data?.meta?.total ??
        teacherList.length;
      setTeachers(teacherList);
      setTeachersCount(totalTeachers);
    } catch (err) {
      console.error('Error fetching admin dashboard data:', err);
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

  // Filtered accounts for preview directory
  const filteredStudents = students.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = s.user?.name || '';
    const email = s.user?.email || '';
    const roll = s.rollNumber || '';
    const enroll = s.enrollmentNumber || '';
    return (
      name.toLowerCase().includes(q) ||
      email.toLowerCase().includes(q) ||
      roll.toLowerCase().includes(q) ||
      enroll.toLowerCase().includes(q)
    );
  });

  const filteredTeachers = teachers.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = t.user?.name || '';
    const email = t.user?.email || '';
    const emp = t.employeeId || '';
    const des = t.designation || '';
    return (
      name.toLowerCase().includes(q) ||
      email.toLowerCase().includes(q) ||
      emp.toLowerCase().includes(q) ||
      des.toLowerCase().includes(q)
    );
  });

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = u.name || '';
    const email = u.email || '';
    const role = u.role || '';
    return (
      name.toLowerCase().includes(q) ||
      email.toLowerCase().includes(q) ||
      role.toLowerCase().includes(q)
    );
  });

  const handleQuickMoveSemester = async (sec, direction) => {
    try {
      const res = await masterDataApi.moveSectionSemester(sec._id, direction);
      addToast({
        type: 'success',
        title: 'Section Semester Updated',
        message: res?.data?.message || `Section ${sec.code} moved successfully.`,
      });
      fetchData();
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Move Semester Failed',
        message: err.response?.data?.message || err.message,
      });
    }
  };

  return (

    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Shield className="text-blue-600" size={26} />
            Institutional Administration
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            System Control Panel • Student & Faculty Account Directory, User Management & Executive Approvals
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="primary"
            onClick={() => handleOpenCreateModal('STUDENT')}
            className="text-xs font-bold cursor-pointer shadow-xs bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5"
          >
            <UserPlus size={14} />
            <span>+ New Student ID</span>
          </Button>

          <Button
            variant="primary"
            onClick={() => handleOpenCreateModal('TEACHER')}
            style={{ backgroundColor: '#059669', borderColor: '#059669' }}
            className="text-xs font-bold cursor-pointer shadow-xs hover:bg-emerald-700 text-white flex items-center gap-1.5"
          >
            <UserPlus size={14} />
            <span>+ New Faculty ID</span>
          </Button>

          <Button
            variant="secondary"
            onClick={fetchData}
            className="text-xs cursor-pointer"
            title="Refresh dashboard data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/audit')}
            className="text-xs cursor-pointer"
          >
            <Activity size={14} />
            Audit Trail
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/admin/import')}
            className="text-xs cursor-pointer shadow-xs"
          >
            <Database size={14} />
            Bulk Import
          </Button>
        </div>
      </div>

      {/* Stats Cards - Displaying Students, Faculty, and Total User Accounts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div
          onClick={() => {
            setActiveTab('users');
            navigate('/admin/users');
          }}
          className="cursor-pointer transition-transform hover:-translate-y-0.5"
          title="Click to manage all accounts"
        >
          <StatCard
            title="Total Accounts"
            value={usersCount}
            icon={Users}
            variant="primary"
            trend="Active in Directory"
            trendDirection="up"
          />
        </div>

        <div
          onClick={() => setActiveTab('students')}
          className="cursor-pointer transition-transform hover:-translate-y-0.5"
          title="Click to view student accounts"
        >
          <StatCard
            title="Student Accounts"
            value={studentsCount}
            icon={GraduationCap}
            variant="success"
            trend="Enrolled (Sem 1-8)"
            trendDirection="up"
          />
        </div>

        <div
          onClick={() => setActiveTab('teachers')}
          className="cursor-pointer transition-transform hover:-translate-y-0.5"
          title="Click to view faculty accounts"
        >
          <StatCard
            title="Faculty Accounts"
            value={teachersCount}
            icon={Briefcase}
            variant="default"
            trend="Faculty & Mentors"
            trendDirection="neutral"
          />
        </div>

        <div
          onClick={() => navigate('/admin/hod-leaves')}
          className="cursor-pointer transition-transform hover:-translate-y-0.5"
          title="Click to review HOD leaves"
        >
          <StatCard
            title="Pending HOD Leaves"
            value={hodLeaves.filter((l) => l.status === 'PENDING').length}
            icon={Calendar}
            variant="warning"
            trend="Director Review"
            trendDirection="neutral"
          />
        </div>

        <StatCard
          title="Active Escalations"
          value={(summary?.escalatedConsiderations || 0) + (summary?.escalatedLeaves || 0)}
          icon={AlertTriangle}
          variant="danger"
          trend="48h Auto-Escalation"
          trendDirection="down"
        />

        <StatCard
          title="Faculty on Leave"
          value={summary?.facultyOnLeaveToday ?? 0}
          icon={UserCheck}
          variant="default"
          trend="Active today"
          trendDirection="neutral"
        />
      </div>

      {/* Quick Action Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          onClick={() => navigate('/admin/users')}
          className="card p-4 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Users size={19} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800">User Management</h4>
              <p className="text-[11px] text-slate-400">Passwords, roles & security</p>
            </div>
          </div>
          <ArrowRight size={15} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
        </div>

        <div
          onClick={() => navigate('/admin/import')}
          className="card p-4 cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Database size={19} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800">Excel Bulk Import</h4>
              <p className="text-[11px] text-slate-400">Import student & faculty records</p>
            </div>
          </div>
          <ArrowRight size={15} className="text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
        </div>

        <div
          onClick={() => navigate('/admin/hod-leaves')}
          className="card p-4 cursor-pointer hover:border-amber-400 hover:shadow-md transition-all group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Calendar size={19} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800">HOD Leave Requests</h4>
              <p className="text-[11px] text-slate-400">Director approval desk</p>
            </div>
          </div>
          <ArrowRight size={15} className="text-slate-300 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
        </div>

        <div
          onClick={() => navigate('/audit')}
          className="card p-4 cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Shield size={19} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800">Audit Logs & Trail</h4>
              <p className="text-[11px] text-slate-400">Tamper-evident system logs</p>
            </div>
          </div>
          <ArrowRight size={15} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
        </div>
      </div>

      {/* Main Account Directory Section on Admin Dashboard */}
      <Card className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-heading font-black text-sm text-slate-900 flex items-center gap-2">
              <Users className="text-blue-600" size={18} />
              Institutional Accounts Directory
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live view of active students, faculty, and administrative credentials in the institutional database.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'students' && (
              <Button
                variant="primary"
                onClick={() => handleOpenCreateModal('STUDENT')}
                className="text-xs font-bold flex items-center gap-1.5 shadow-xs bg-blue-600 hover:bg-blue-700"
              >
                <UserPlus size={13} />
                <span>+ Create Student User ID</span>
              </Button>
            )}
            {activeTab === 'teachers' && (
              <Button
                variant="primary"
                onClick={() => handleOpenCreateModal('TEACHER')}
                style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                className="text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-emerald-700 text-white"
              >
                <UserPlus size={13} />
                <span>+ Create Faculty User ID</span>
              </Button>
            )}
            {activeTab === 'users' && (
              <Button
                variant="primary"
                onClick={() => handleOpenCreateModal('STUDENT')}
                className="text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <UserPlus size={13} />
                <span>+ Create User ID</span>
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => navigate('/admin/users')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
            >
              <span>Manage in User Directory</span>
              <ExternalLink size={13} />
            </Button>
          </div>
        </div>

        {/* Directory Tabs and Search Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('students')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'students'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap size={15} />
              <span>Student Accounts</span>
              <span className="badge badge-primary text-[10px] py-0 px-1.5 rounded-full font-black">
                {studentsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('teachers')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'teachers'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Briefcase size={15} />
              <span>Faculty Accounts</span>
              <span className="badge badge-emerald text-[10px] py-0 px-1.5 rounded-full font-black">
                {teachersCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={15} />
              <span>All Users</span>
              <span className="badge badge-slate text-[10px] py-0 px-1.5 rounded-full font-black">
                {usersCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sections')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'sections'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={15} />
              <span>Class Sections</span>
              <span className="badge badge-indigo text-[10px] py-0 px-1.5 rounded-full font-black">
                {sections.length}
              </span>
            </button>
          </div>


          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-64">
              <Search size={15} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder={
                  activeTab === 'students'
                    ? 'Search student, roll, email...'
                    : activeTab === 'teachers'
                    ? 'Search faculty, emp ID, dept...'
                    : 'Search user name, email, role...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs border-none p-0 focus:outline-none w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Directory Tab 1: Student Accounts */}
        {activeTab === 'students' && (
          <div>
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading student accounts...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                No student accounts found matching your query.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Enrollment No</TableHead>
                    <TableHead>Semester & Section</TableHead>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Account Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((s) => (
                    <TableRow key={s._id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center shrink-0">
                            {(s.user?.name || 'S').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-heading font-black text-xs text-slate-900 block truncate">
                              {s.user?.name || 'Enrolled Student'}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              ID: {s._id?.toString().slice(-6)}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {s.rollNumber || '—'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-xs text-slate-600">
                          {s.enrollmentNumber || '—'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="badge badge-primary text-[10px] font-bold">
                            Sem {s.semester || '5'}
                          </span>
                          <span className="text-xs font-medium text-slate-700">
                            {s.section?.name || 'CSE'}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[160px]">{s.user?.email || '—'}</span>
                        </span>
                      </TableCell>

                      <TableCell>
                        <span
                          className={`badge text-[10px] font-bold ${
                            s.user?.isActive !== false ? 'badge-emerald' : 'badge-danger'
                          }`}
                        >
                          {s.user?.isActive !== false ? 'Active Account' : 'Suspended'}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          onClick={() => navigate('/admin/users?role=STUDENT')}
                          className="btn-sm text-[11px] font-bold py-1 px-2.5 cursor-pointer"
                        >
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
              <span>Showing {filteredStudents.length} of {studentsCount} total enrolled students</span>
              <button
                onClick={() => navigate('/admin/users?role=STUDENT')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <span>View all {studentsCount} students in User Directory</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Directory Tab 2: Faculty Accounts */}
        {activeTab === 'teachers' && (
          <div>
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading faculty accounts...</div>
            ) : filteredTeachers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                No faculty accounts found matching your query.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faculty Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Designation & Department</TableHead>
                    <TableHead>Email Contact</TableHead>
                    <TableHead>Mentorship (TG)</TableHead>
                    <TableHead>Account Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeachers.map((t) => (
                    <TableRow key={t._id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                            {(t.user?.name || 'F').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-heading font-black text-xs text-slate-900 block truncate">
                              {t.user?.name || 'Faculty Member'}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              ID: {t._id?.toString().slice(-6)}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {t.employeeId || '—'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            {t.designation || 'Assistant Professor'}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {t.department?.name || t.specialization || 'Computer Science & Engineering'}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[170px]">{t.user?.email || '—'}</span>
                        </span>
                      </TableCell>

                      <TableCell>
                        {t.activeMentorGroup ? (
                          <span className="badge badge-amber text-[10px] font-bold">
                            TG: {t.activeMentorGroup.section?.name || 'Active Group'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Regular Faculty</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <span
                          className={`badge text-[10px] font-bold ${
                            t.user?.isActive !== false ? 'badge-emerald' : 'badge-danger'
                          }`}
                        >
                          {t.user?.isActive !== false ? 'Active Account' : 'Suspended'}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          onClick={() => navigate('/admin/users?role=TEACHER')}
                          className="btn-sm text-[11px] font-bold py-1 px-2.5 cursor-pointer"
                        >
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
              <span>Showing {filteredTeachers.length} of {teachersCount} faculty accounts</span>
              <button
                onClick={() => navigate('/admin/users?role=TEACHER')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <span>View all faculty in User Directory</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Directory Tab 3: All System Users */}
        {activeTab === 'users' && (
          <div>
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading user accounts...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                No user credentials found matching your query.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Account</TableHead>
                    <TableHead>Institutional Role</TableHead>
                    <TableHead>Email Contact</TableHead>
                    <TableHead>Contact Phone</TableHead>
                    <TableHead>Account Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u._id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 font-black text-xs flex items-center justify-center shrink-0">
                            {(u.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-heading font-black text-xs text-slate-900 block truncate">
                              {u.name}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              ID: {u._id?.toString().slice(-6)}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span
                          className={`badge text-[10px] font-bold ${
                            u.role === 'ADMIN'
                              ? 'badge-rose'
                              : u.role === 'HOD'
                              ? 'badge-amber'
                              : u.role === 'TEACHER'
                              ? 'badge-emerald'
                              : 'badge-primary'
                          }`}
                        >
                          {u.role}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[170px]">{u.email}</span>
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs text-slate-600">
                          {u.phone || '—'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span
                          className={`badge text-[10px] font-bold ${
                            u.isActive !== false ? 'badge-emerald' : 'badge-danger'
                          }`}
                        >
                          {u.isActive !== false ? 'Active' : 'Suspended'}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          onClick={() => navigate('/admin/users')}
                          className="btn-sm text-[11px] font-bold py-1 px-2.5 cursor-pointer"
                        >
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
              <span>Showing {filteredUsers.length} of {usersCount} system user accounts</span>
              <button
                onClick={() => navigate('/admin/users')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Open User Account Management</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Directory Tab 4: Class Sections & Semester Progression */}
        {activeTab === 'sections' && (
          <div>
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading class sections...</div>
            ) : sections.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                No section records found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {sections.map((sec) => {
                  const currentSem = sec.semester || 5;
                  const currentYear = sec.year || Math.ceil(currentSem / 2);
                  return (
                    <div
                      key={sec._id}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              {sec.code}
                            </span>
                            <span className="font-heading font-black text-sm text-slate-900 block">
                              {sec.name}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 text-[11px] font-black">
                            Sem {currentSem}
                          </span>
                        </div>

                        <div className="text-xs space-y-1 my-2">
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Year {currentYear} of 4</span>
                            <span className="font-bold text-slate-800">{sec.studentCount} Students</span>
                          </div>
                          <div className="text-[11px] font-bold text-emerald-700 truncate">
                            {sec.tgName ? `TG: ${sec.tgName}` : 'No TG Appointed'}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-200 mt-2">
                        <button
                          type="button"
                          disabled={currentSem <= 1}
                          onClick={() => handleQuickMoveSemester(sec, 'prev')}
                          className={`py-1 px-2 rounded-lg text-[11px] font-bold border flex items-center justify-center gap-1 transition-all ${
                            currentSem <= 1
                              ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 cursor-pointer shadow-2xs'
                          }`}
                          title={`Move to Semester ${currentSem - 1}`}
                        >
                          ◀ Sem {currentSem - 1}
                        </button>

                        <button
                          type="button"
                          disabled={currentSem >= 8}
                          onClick={() => handleQuickMoveSemester(sec, 'next')}
                          className={`py-1 px-2 rounded-lg text-[11px] font-bold border flex items-center justify-center gap-1 transition-all ${
                            currentSem >= 8
                              ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700 cursor-pointer shadow-xs'
                          }`}
                          title={`Move to Semester ${currentSem + 1}`}
                        >
                          Sem {currentSem + 1} ▶
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
              <span>Showing {sections.length} active department sections</span>
              <button
                onClick={() => navigate('/admin/users')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Open Sections & Semester Progression</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}
      </Card>


      {/* Urgent HOD Leave Applications Queue */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-amber-600" />
            <h3 className="font-heading font-black text-sm text-slate-900">
              Department Head (HOD) Leave Applications
            </h3>
          </div>
          <button
            onClick={() => navigate('/admin/hod-leaves')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
          >
            Manage all <ArrowRight size={13} />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading HOD leaves...</div>
        ) : hodLeaves.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
            No HOD leave requests currently pending executive review.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>HOD Name</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>Dates & Duration</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hodLeaves.slice(0, 5).map((item) => (
                <TableRow key={item._id}>
                  <TableCell>
                    <span className="font-heading font-black text-xs text-slate-900">
                      {item.applicant?.name || 'Department Head'}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="badge badge-amber text-[10px] font-bold">
                      {item.leaveType}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="text-xs font-medium text-slate-700">
                      {item.startDate === item.endDate
                        ? item.startDate
                        : `${item.startDate} to ${item.endDate}`}{' '}
                      ({item.totalDays} days)
                    </span>
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
                        className="btn-sm text-[11px] font-bold py-1 px-3 cursor-pointer"
                      >
                        Review
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* CREATE USER MODAL (Student & Faculty ID Provisioning) */}
      {showCreateModal && (
        <CreateUserModal
          initialRole={createModalRole}
          availableSections={sections}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}
    </div>
  );
}
