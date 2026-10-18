import React, { useEffect, useState } from 'react';
import { useERP } from '../../context/ERPContext.jsx';
import { masterDataApi, mentorshipApi } from '../../api/modulesApi.js';
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
  Users,
  UserPlus,
  Search,
  Key,
  Shield,
  CheckCircle2,
  XCircle,
  Copy,
  Lock,
  Mail,
  Phone,
  X,
  Award,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
  Building2,
  RefreshCw,
  Layers,
  ShieldCheck,
  AlertCircle,
  Trash2,
  ArrowRight,
  Sparkles,
  Calendar,
  Check,
  Hash,
} from 'lucide-react';

export default function AdminUsers() {
  const { addToast } = useERP();

  // Tab navigation
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'students' | 'teachers' | 'hod' | 'sections'

  // Accounts Data
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Sections Data
  const [sections, setSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);

  // Create Section Modal State
  const [showCreateSectionModal, setShowCreateSectionModal] = useState(false);
  const [newSecName, setNewSecName] = useState('Section E');
  const [newSecSemester, setNewSecSemester] = useState(5);
  const [newSecCode, setNewSecCode] = useState('');
  const [newSecCapacity, setNewSecCapacity] = useState(60);
  const [editingSecCapacityId, setEditingSecCapacityId] = useState(null);
  const [editCapacityVal, setEditCapacityVal] = useState(60);
  const [creatingSection, setCreatingSection] = useState(false);

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createAccountType, setCreateAccountType] = useState('STUDENT'); // 'STUDENT' | 'TG' | 'TEACHER' | 'HOD' | 'ADMIN'
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('Password@123');

  // Student-specific creation fields
  const [newRollNumber, setNewRollNumber] = useState('');
  const [newEnrollmentNo, setNewEnrollmentNo] = useState('');
  const [newStudentSemester, setNewStudentSemester] = useState(5);
  const [newStudentSection, setNewStudentSection] = useState('Section B');
  const [newEnrollmentYear, setNewEnrollmentYear] = useState(2022);

  // Teacher / TG creation fields
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newDesignation, setNewDesignation] = useState('Assistant Professor');
  const [newSpecialization, setNewSpecialization] = useState('Computer Science & Engineering');
  const [newTgSemester, setNewTgSemester] = useState(5);
  const [newTgSection, setNewTgSection] = useState('Section B');
  const [newAcademicYear, setNewAcademicYear] = useState('2025-26');

  const [creating, setCreating] = useState(false);
  const [createdInfo, setCreatedInfo] = useState(null);

  // Reset Password Modal State
  const [resetModalData, setResetModalData] = useState(null);

  // Action Confirmation Modals
  const [hodActionTarget, setHodActionTarget] = useState(null); // { user, type: 'appoint' | 'remove' }
  const [tgActionTarget, setTgActionTarget] = useState(null); // { user, type: 'appoint' | 'remove', cohort }
  const [tgModalSemester, setTgModalSemester] = useState(5);
  const [tgModalSection, setTgModalSection] = useState('Section B');
  const [tgModalSession, setTgModalSession] = useState('2025-26');
  const [actionProcessing, setActionProcessing] = useState(false);

  // Move Semester Modal State
  const [semesterModalData, setSemesterModalData] = useState(null); // { section, direction: 'next' | 'prev', newSemester, newYear }

  // Fetch Users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      let roleParam = roleFilter || undefined;
      if (activeTab === 'students') roleParam = 'STUDENT';
      if (activeTab === 'teachers') roleParam = 'TEACHER';
      if (activeTab === 'hod') roleParam = 'HOD';

      const res = await masterDataApi.getUsers({
        page,
        limit: 30,
        role: roleParam,
        search: search || undefined,
      });

      const userList = Array.isArray(res?.data)
        ? res.data
        : (res?.data?.users || res?.users || []);
      const totalCount =
        res?.meta?.total ??
        res?.data?.meta?.total ??
        res?.data?.total ??
        userList.length;

      setUsers(userList);
      setTotal(totalCount);
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Sections with student count & active TG
  const fetchSections = async () => {
    setLoadingSections(true);
    try {
      const res = await masterDataApi.getSections();
      const secList = Array.isArray(res?.data) ? res.data : (res?.sections || []);
      setSections(secList);
    } catch (err) {
      console.error('Failed to load sections:', err);
      setSections([]);
    } finally {
      setLoadingSections(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  useEffect(() => {
    if (activeTab === 'sections') {
      fetchSections();
    } else {
      fetchUsers();
    }
  }, [page, roleFilter, search, activeTab]);

  // Handle Section Creation
  const handleCreateSection = async (e) => {
    e.preventDefault();
    setCreatingSection(true);
    try {
      const cleanName = newSecName.replace(/^Section\s*/i, '').trim();
      const semNum = Number(newSecSemester);
      const codeToUse = (newSecCode || `CSE-${cleanName}-S${semNum}`).toUpperCase().trim();
      await masterDataApi.createSection({
        name: `Section ${cleanName}`,
        code: codeToUse,
        semester: semNum,
        year: Math.ceil(semNum / 2),
        capacity: Number(newSecCapacity) || 60,
      });
      addToast({
        type: 'success',
        title: 'Section Created',
        message: `Section ${cleanName} created with capacity ${Number(newSecCapacity) || 60} for Semester ${semNum}.`,
      });
      setShowCreateSectionModal(false);
      setNewSecName('');
      setNewSecCode('');
      setNewSecCapacity(60);
      fetchSections();
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Section Creation Failed',
        message: err.response?.data?.message || err.message,
      });
    } finally {
      setCreatingSection(false);
    }
  };

  // Handle Section Capacity Update (Admin permission)
  const handleUpdateSectionCapacity = async (secId, capNum) => {
    const num = Number(capNum);
    if (!num || num < 1 || num > 500) {
      addToast({
        type: 'danger',
        title: 'Invalid Capacity',
        message: 'Section capacity must be a number between 1 and 500.',
      });
      return;
    }
    try {
      await masterDataApi.updateSection(secId, { capacity: num });
      addToast({
        type: 'success',
        title: 'Capacity Updated',
        message: `Section capacity updated to ${num} students.`,
      });
      setEditingSecCapacityId(null);
      fetchSections();
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Update Failed',
        message: err.response?.data?.message || err.message,
      });
    }
  };

  // Handle Status Toggle
  const handleToggleStatus = async (user) => {
    const nextStatus = !user.isActive;
    try {
      await masterDataApi.updateUserStatus(user._id, nextStatus);
      addToast({
        type: 'success',
        title: 'Status Updated',
        message: `Account for ${user.name} is now ${nextStatus ? 'active' : 'suspended'}.`,
      });
      fetchUsers();
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Error',
        message: err.message,
      });
    }
  };

  // Handle Password Reset
  const handleResetPassword = async (user) => {
    try {
      const res = await masterDataApi.resetPassword(user._id);
      setResetModalData({
        user,
        tempPassword: res?.data?.tempPassword || res?.tempPassword || 'Reset successful',
      });
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Reset Failed',
        message: err.message,
      });
    }
  };

  // Handle Create User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        phone: newPhone.trim() || undefined,
        password: newPassword,
      };

      if (createAccountType === 'STUDENT') {
        payload.role = 'STUDENT';
        payload.rollNumber = (newRollNumber || `0176CS${Date.now().toString().slice(-6)}`).trim().toUpperCase();
        payload.enrollmentNumber = (newEnrollmentNo || payload.rollNumber).trim().toUpperCase();
        payload.semester = Number(newStudentSemester);
        payload.section = newStudentSection;
        payload.enrollmentYear = Number(newEnrollmentYear);
      } else if (createAccountType === 'TG') {
        payload.role = 'TG';
        payload.isTG = true;
        payload.employeeId = (newEmployeeId || `EMP_TG_${Date.now().toString().slice(-4)}`).trim().toUpperCase();
        payload.designation = 'Assistant Professor (TG)';
        payload.specialization = newSpecialization;
        payload.semester = Number(newTgSemester);
        payload.section = newTgSection;
        payload.academicYear = newAcademicYear;
      } else if (createAccountType === 'TEACHER') {
        payload.role = 'TEACHER';
        payload.employeeId = (newEmployeeId || `EMP_${Date.now().toString().slice(-4)}`).trim().toUpperCase();
        payload.designation = newDesignation;
        payload.specialization = newSpecialization;
      } else if (createAccountType === 'HOD') {
        payload.role = 'HOD';
        payload.employeeId = (newEmployeeId || `EMP_HOD_${Date.now().toString().slice(-4)}`).trim().toUpperCase();
        payload.designation = 'Head of Department';
        payload.specialization = newSpecialization;
      } else if (createAccountType === 'ADMIN') {
        payload.role = 'ADMIN';
      }

      const res = await masterDataApi.createUser(payload);

      setCreatedInfo({
        user: res?.data?.user || res?.user || res?.data,
        tempPassword: res?.data?.tempPassword || res?.tempPassword || newPassword,
        role: createAccountType,
      });

      addToast({
        type: 'success',
        title: 'Account Provisioned',
        message: `Account for ${newName} created as ${createAccountType}.`,
      });

      fetchUsers();
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Provisioning Failed',
        message: err.response?.data?.message || err.message,
      });
    } finally {
      setCreating(false);
    }
  };

  // Execute Appoint / Remove HOD
  const executeHodAction = async () => {
    if (!hodActionTarget) return;
    setActionProcessing(true);
    try {
      if (hodActionTarget.type === 'appoint') {
        await masterDataApi.appointHOD(hodActionTarget.user._id);
        addToast({
          type: 'success',
          title: 'HOD Appointed',
          message: `${hodActionTarget.user.name} has been appointed as Head of Department (HOD).`,
        });
      } else {
        await masterDataApi.removeHOD(hodActionTarget.user._id);
        addToast({
          type: 'success',
          title: 'HOD Role Revoked',
          message: `HOD status revoked for ${hodActionTarget.user.name}; restored to standard faculty.`,
        });
      }
      setHodActionTarget(null);
      fetchUsers();
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Action Failed',
        message: err.response?.data?.message || err.message,
      });
    } finally {
      setActionProcessing(false);
    }
  };

  // Execute Appoint / Remove TG
  const executeTgAction = async () => {
    if (!tgActionTarget) return;
    setActionProcessing(true);
    try {
      if (tgActionTarget.type === 'appoint') {
        await masterDataApi.appointTG(tgActionTarget.user._id, {
          semester: Number(tgModalSemester),
          section: tgModalSection,
          academicYear: tgModalSession,
        });
        addToast({
          type: 'success',
          title: 'TG Appointed',
          message: `${tgActionTarget.user.name} is now appointed as Tutor Guardian for Semester ${tgModalSemester}, ${tgModalSection}.`,
        });
      } else {
        await masterDataApi.removeTG(tgActionTarget.user._id);
        addToast({
          type: 'success',
          title: 'TG Appointment Revoked',
          message: `Tutor Guardian role concluded for ${tgActionTarget.user.name}.`,
        });
      }
      setTgActionTarget(null);
      fetchUsers();
      if (activeTab === 'sections') fetchSections();
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Action Failed',
        message: err.response?.data?.message || err.message,
      });
    } finally {
      setActionProcessing(false);
    }
  };

  // Execute Move Semester for a Section
  const executeMoveSemester = async () => {
    if (!semesterModalData) return;
    setActionProcessing(true);
    try {
      const res = await masterDataApi.moveSectionSemester(
        semesterModalData.section._id,
        semesterModalData.direction
      );
      addToast({
        type: 'success',
        title: 'Semester Updated',
        message:
          res?.data?.message ||
          `Section ${semesterModalData.section.code} moved to Semester ${semesterModalData.newSemester}.`,
      });
      setSemesterModalData(null);
      fetchSections();
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Move Semester Failed',
        message: err.response?.data?.message || err.message,
      });
    } finally {
      setActionProcessing(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    addToast({
      type: 'success',
      title: 'Copied',
      message: 'Password copied to clipboard.',
    });
  };

  // Quick stats
  const studentCount = users.filter((u) => u.role === 'STUDENT').length;
  const teacherCount = users.filter((u) => u.role === 'TEACHER' || u.role === 'HOD').length;
  const tgCount = users.filter((u) => u.teacherProfile?.isTG).length;
  const hodCount = users.filter((u) => u.role === 'HOD').length;

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      {/* Header */}
      <PageHeader
        title="Admin User & Academic Governance"
        description="Provision student & TG accounts, appoint leadership (HOD & TGs), and manage semester progression for student cohorts."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="primary"
              onClick={() => {
                setCreatedInfo(null);
                setCreateAccountType('STUDENT');
                setShowCreateModal(true);
              }}
              className="text-xs font-black shadow-xs cursor-pointer bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5"
            >
              <UserPlus size={14} />
              <span>+ New Student ID</span>
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setCreatedInfo(null);
                setCreateAccountType('TEACHER');
                setShowCreateModal(true);
              }}
              style={{ backgroundColor: '#059669', borderColor: '#059669' }}
              className="text-xs font-black shadow-xs cursor-pointer hover:bg-emerald-700 text-white flex items-center gap-1.5"
            >
              <UserPlus size={14} />
              <span>+ New Faculty ID</span>
            </Button>
          </div>
        }
      />

      {/* Modern Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => {
            setActiveTab('all');
            setRoleFilter('');
            setPage(1);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users size={15} />
          <span>All Accounts ({total})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('students');
            setRoleFilter('STUDENT');
            setPage(1);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'students'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <GraduationCap size={15} />
          <span>Students</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('teachers');
            setRoleFilter('TEACHER');
            setPage(1);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'teachers'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 size={15} />
          <span>Faculty & TGs</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('hod');
            setRoleFilter('HOD');
            setPage(1);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'hod'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Award size={15} />
          <span>HOD & Leadership</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('sections');
            fetchSections();
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ml-auto ${
            activeTab === 'sections'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
          }`}
        >
          <Layers size={15} />
          <span>Sections & Semester Progression</span>
          {sections.length > 0 && (
            <span className="bg-white/20 text-xs px-1.5 py-0.2 rounded-full font-bold">
              {sections.length}
            </span>
          )}
        </button>
      </div>

      {/* Search and Filters Bar (Accounts View) */}
      {activeTab !== 'sections' && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 flex-1 sm:max-w-md shadow-2xs">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by name, email, roll number, or employee ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="text-xs border-none p-0 focus:outline-none w-full font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={fetchUsers}
              className="text-xs cursor-pointer"
              title="Refresh users"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>

            <span className="badge badge-slate text-xs font-bold py-1.5 px-3">
              {total} Matching Records
            </span>
          </div>
        </div>
      )}

      {/* VIEW 1: SECTIONS & SEMESTER PROGRESSION */}
      {activeTab === 'sections' ? (
        <div className="flex flex-col gap-5">
          {/* Section Management Header Info Box */}
          <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Layers size={22} />
              </div>
              <div>
                <h3 className="text-sm font-black text-indigo-950">
                  Section Cohort & Semester Progression Control
                </h3>
                <p className="text-xs text-indigo-800 mt-0.5">
                  Promote or revert sections across semesters. All enrolled students and active TG cohorts synchronize automatically.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setNewSecName('Section E');
                  setNewSecSemester(5);
                  setNewSecCode('CSE-E-S5');
                  setShowCreateSectionModal(true);
                }}
                className="text-xs font-bold cursor-pointer"
              >
                <Layers size={13} />
                Create Section
              </Button>

              <Button
                variant="secondary"
                onClick={fetchSections}
                className="text-xs cursor-pointer bg-white"
              >
                <RefreshCw size={13} className={loadingSections ? 'animate-spin' : ''} />
                Refresh Sections
              </Button>
            </div>
          </div>

          {/* Section Cards Grid */}
          {loadingSections ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              Loading section directory and student counts...
            </div>
          ) : sections.length === 0 ? (
            <EmptyState
              title="No Sections Found"
              description="No academic sections exist yet. Create a section or import students."
              icon={Layers}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sections.map((sec) => {
                const currentSem = sec.semester || 5;
                const currentYear = sec.year || Math.ceil(currentSem / 2);
                const progressPct = Math.round((currentSem / 8) * 100);

                return (
                  <div
                    key={sec._id}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar: Section Name & Code */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                            {sec.department?.code || 'CSE'} DEPARTMENT
                          </span>
                          <h4 className="text-base font-black text-slate-900 mt-0.5">
                            {sec.name}
                          </h4>
                          <span className="text-xs font-mono font-bold text-blue-600">
                            {sec.code}
                          </span>
                        </div>

                        <div className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 text-xs font-black shrink-0">
                          Sem {currentSem}
                        </div>
                      </div>

                      {/* Degree Year & Progress Bar */}
                      <div className="my-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1.5">
                          <span>Year {currentYear} of 4</span>
                          <span className="text-slate-400 text-[11px] font-mono">
                            {progressPct}% Completed
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Enrolled Students & TG Status Box */}
                      <div className="space-y-2 my-3">
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                          <span className="text-slate-500 font-bold">Enrolled Students:</span>
                          <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                            {sec.studentCount} / {sec.capacity || 60} Students
                          </span>
                        </div>

                        {editingSecCapacityId === sec._id ? (
                          <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                            <span className="font-bold text-blue-900 text-[11px] shrink-0">Capacity:</span>
                            <input
                              type="number"
                              min="1"
                              max="500"
                              value={editCapacityVal}
                              onChange={(e) => setEditCapacityVal(e.target.value)}
                              className="w-16 px-1.5 py-0.5 rounded border border-blue-300 bg-white text-xs font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateSectionCapacity(sec._id, editCapacityVal)}
                              className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-[10px] cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSecCapacityId(null)}
                              className="px-1.5 py-0.5 rounded bg-white text-slate-500 font-bold text-[10px] border border-slate-200 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between px-1 text-[11px]">
                            <span className="text-slate-500 font-medium">
                              Capacity Quota: <strong className="text-slate-800">{sec.capacity || 60}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSecCapacityId(sec._id);
                                setEditCapacityVal(sec.capacity || 60);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                            >
                              Edit Quota
                            </button>
                          </div>
                        )}

                        <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs">
                          <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                            <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                            <span className="truncate">
                              {sec.tgName ? `TG: ${sec.tgName}` : 'No Tutor Guardian Assigned'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Semester Movement Actions */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col gap-2 mt-auto">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={currentSem <= 1}
                          onClick={() => {
                            setSemesterModalData({
                              section: sec,
                              direction: 'prev',
                              newSemester: currentSem - 1,
                              newYear: Math.ceil((currentSem - 1) / 2),
                            });
                          }}
                          className={`py-1.5 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 border transition-all ${
                            currentSem <= 1
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 cursor-pointer shadow-2xs'
                          }`}
                          title={
                            currentSem <= 1
                              ? 'Already in Semester 1'
                              : `Move section back to Semester ${currentSem - 1}`
                          }
                        >
                          <ChevronLeft size={14} />
                          <span>Prev Sem ({currentSem - 1})</span>
                        </button>

                        <button
                          type="button"
                          disabled={currentSem >= 8}
                          onClick={() => {
                            setSemesterModalData({
                              section: sec,
                              direction: 'next',
                              newSemester: currentSem + 1,
                              newYear: Math.ceil((currentSem + 1) / 2),
                            });
                          }}
                          className={`py-1.5 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 border transition-all ${
                            currentSem >= 8
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                              : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700 cursor-pointer shadow-xs'
                          }`}
                          title={
                            currentSem >= 8
                              ? 'Already in Final Semester 8'
                              : `Advance section to Semester ${currentSem + 1}`
                          }
                        >
                          <span>Next Sem ({currentSem + 1})</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setTgActionTarget({
                            user: sec.tg?.user || { name: 'Faculty Member' },
                            type: 'appoint',
                            isDirectSection: true,
                            sectionDoc: sec,
                          });
                          setTgModalSemester(currentSem);
                          setTgModalSection(sec.name || 'Section B');
                        }}
                        className="w-full py-1.5 px-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ShieldCheck size={13} />
                        <span>{sec.tgName ? 'Reassign Section TG' : 'Appoint TG for Section'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: USER ACCOUNTS TABLE */
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading user accounts...</div>
          ) : users.length === 0 ? (
            <EmptyState
              title="No Accounts Found"
              description="No user accounts match your active search and filter criteria."
              icon={Users}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Account</TableHead>
                  <TableHead>System Role</TableHead>
                  <TableHead>Academic / Faculty Scope</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Account State</TableHead>
                  <TableHead className="text-right">Administrative Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isStudent = u.role === 'STUDENT';
                  const isTeacher = u.role === 'TEACHER';
                  const isHod = u.role === 'HOD';
                  const isTg = Boolean(u.teacherProfile?.isTG);
                  const activeCohort = u.teacherProfile?.activeCohort;
                  const studentProf = u.studentProfile;

                  return (
                    <TableRow key={u._id}>
                      {/* Name & Email */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 border ${
                              isHod
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : isTg
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : isTeacher
                                ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                : isStudent
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : 'bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            {(u.name || 'U').charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-heading font-black text-xs text-slate-900 block truncate">
                              {u.name}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono truncate block">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* System Role Badges */}
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`badge text-[10px] font-extrabold ${
                              u.role === 'ADMIN'
                                ? 'badge-danger'
                                : isHod
                                ? 'badge-amber'
                                : isTg
                                ? 'badge-emerald'
                                : isTeacher
                                ? 'badge-indigo'
                                : 'badge-primary'
                            }`}
                          >
                            {u.role}
                          </span>

                          {isTg && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                              Tutor Guardian
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Academic / Faculty Scope */}
                      <TableCell>
                        {isStudent && (
                          <div className="space-y-0.5 text-xs">
                            <span className="font-mono font-bold text-slate-800 block">
                              {studentProf?.rollNumber || studentProf?.enrollmentNumber || '-'}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium block">
                              Sem {studentProf?.semester || 5} • {studentProf?.section?.name || 'Section B'}
                            </span>
                          </div>
                        )}

                        {(isTeacher || isHod) && (
                          <div className="space-y-0.5 text-xs">
                            <span className="font-mono text-slate-700 block text-[11px]">
                              {u.teacherProfile?.employeeId || 'ID: -'}
                            </span>
                            <span className="font-bold text-slate-900 block truncate max-w-[180px]">
                              {u.teacherProfile?.designation || (isHod ? 'Head of Department' : 'Faculty')}
                            </span>
                            {isTg && (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                                {u.teacherProfile?.mentoredSection || 'Cohort Assigned'}
                              </span>
                            )}
                          </div>
                        )}

                        {u.role === 'ADMIN' && (
                          <span className="text-xs text-slate-500 font-medium">System Superuser</span>
                        )}
                      </TableCell>

                      {/* Contact */}
                      <TableCell>
                        <span className="text-xs text-slate-600 font-mono">
                          {u.phone || '-'}
                        </span>
                      </TableCell>

                      {/* Account State Toggle */}
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          className={`badge cursor-pointer text-[10px] font-bold transition-transform active:scale-95 ${
                            u.isActive ? 'badge-emerald' : 'badge-danger'
                          }`}
                          title="Click to toggle status"
                        >
                          {u.isActive ? 'Active' : 'Suspended'}
                        </button>
                      </TableCell>

                      {/* Administrative Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* HOD Appointment Controls */}
                          {(isTeacher || isHod) && (
                            <>
                              {!isHod ? (
                                <button
                                  type="button"
                                  onClick={() => setHodActionTarget({ user: u, type: 'appoint' })}
                                  className="btn-sm text-[11px] font-bold py-1 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors cursor-pointer"
                                  title="Appoint as Head of Department"
                                >
                                  Appoint HOD
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setHodActionTarget({ user: u, type: 'remove' })}
                                  className="btn-sm text-[11px] font-bold py-1 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                                  title="Remove HOD role and return to faculty"
                                >
                                  Remove HOD
                                </button>
                              )}
                            </>
                          )}

                          {/* TG Appointment Controls */}
                          {(isTeacher || isHod) && (
                            <>
                              {!isTg ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTgActionTarget({ user: u, type: 'appoint' });
                                    setTgModalSemester(5);
                                    setTgModalSection('Section B');
                                  }}
                                  className="btn-sm text-[11px] font-bold py-1 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
                                  title="Appoint as Tutor Guardian"
                                >
                                  Appoint TG
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setTgActionTarget({ user: u, type: 'remove' })}
                                  className="btn-sm text-[11px] font-bold py-1 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                                  title="Revoke Tutor Guardian appointment"
                                >
                                  Remove TG
                                </button>
                              )}
                            </>
                          )}

                          {/* Reset Password */}
                          <Button
                            variant="secondary"
                            onClick={() => handleResetPassword(u)}
                            className="btn-sm text-[11px] font-bold py-1 px-2"
                            title="Reset password"
                          >
                            <Key size={12} />
                            Reset Pwd
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* MODAL 1: CREATE USER ACCOUNT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-heading font-black text-slate-900 text-sm">
                    Provision Academic Account
                  </h3>
                  <p className="text-[11px] text-slate-500 m-0">
                    Create new student, TG, faculty, or leadership credentials
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {createdInfo ? (
              <div className="p-6 space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                  <div className="flex items-center gap-2 font-black text-sm text-emerald-800">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    Account Provisioned Successfully!
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    {createdInfo.user?.name} ({createdInfo.user?.email}) is now active in the system as{' '}
                    <strong>{createdInfo.role}</strong>.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Temporary Login Password
                  </span>
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 font-mono text-xs">
                    <span className="font-bold text-slate-900">{createdInfo.tempPassword}</span>
                    <button
                      onClick={() => copyToClipboard(createdInfo.tempPassword)}
                      className="text-blue-600 hover:text-blue-800 p-1 flex items-center gap-1 font-sans text-xs font-bold"
                    >
                      <Copy size={13} />
                      <span>Copy</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreatedInfo(null);
                    }}
                    className="text-xs font-bold"
                  >
                    Done & Return
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
                {/* Account Type Selector Tabs */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">
                    Account Classification <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setCreateAccountType('STUDENT')}
                      className={`py-2 px-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer text-center ${
                        createAccountType === 'STUDENT'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateAccountType('TG')}
                      className={`py-2 px-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer text-center ${
                        createAccountType === 'TG'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      TG
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateAccountType('TEACHER')}
                      className={`py-2 px-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer text-center ${
                        createAccountType === 'TEACHER'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Faculty
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateAccountType('HOD')}
                      className={`py-2 px-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer text-center ${
                        createAccountType === 'HOD'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      HOD
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateAccountType('ADMIN')}
                      className={`py-2 px-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer text-center ${
                        createAccountType === 'ADMIN'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Admin
                    </button>
                  </div>
                </div>

                {/* Common Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                      placeholder={createAccountType === 'STUDENT' ? 'e.g. Ayush Sharma' : 'e.g. Prof. Rohit Sharma'}
                      className="input-field w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Official Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                      placeholder="user@campusflow.edu"
                      className="input-field w-full text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+91..."
                      className="input-field w-full text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Initial Password</label>
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-field w-full text-xs font-mono"
                    />
                  </div>
                </div>

                {/* STUDENT SPECIFIC FIELDS */}
                {createAccountType === 'STUDENT' && (
                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-3">
                    <span className="font-black text-blue-900 text-[11px] uppercase tracking-wider block">
                      Student Enrollment & Cohort Details
                    </span>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          Roll / Enrollment No
                        </label>
                        <input
                          type="text"
                          value={newRollNumber}
                          onChange={(e) => setNewRollNumber(e.target.value)}
                          placeholder="0176CS221001"
                          className="input-field w-full text-xs font-mono uppercase bg-white"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Admission Year</label>
                        <select
                          value={newEnrollmentYear}
                          onChange={(e) => setNewEnrollmentYear(Number(e.target.value))}
                          className="form-select w-full bg-white border-slate-200 rounded-xl py-2 px-3 text-xs"
                        >
                          {[2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
                            <option key={y} value={y}>
                              Batch {y} ({y + 4})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Semester</label>
                        <select
                          value={newStudentSemester}
                          onChange={(e) => setNewStudentSemester(Number(e.target.value))}
                          className="form-select w-full bg-white border-slate-200 rounded-xl py-2 px-3 text-xs"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                            <option key={s} value={s}>
                              Semester {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Section</label>
                        <select
                          value={newStudentSection}
                          onChange={(e) => setNewStudentSection(e.target.value)}
                          className="form-select w-full bg-white border-slate-200 rounded-xl py-2 px-3 text-xs"
                        >
                          {(() => {
                            const semSecs = sections.filter((s) => Number(s.semester) === Number(newStudentSemester));
                            const listToRender = semSecs.length > 0 ? semSecs : sections;
                            if (listToRender.length === 0) {
                              return (
                                <>
                                  <option value="Section A">Section A (CSE-A)</option>
                                  <option value="Section B">Section B (CSE-B)</option>
                                  <option value="Section C">Section C (CSE-C)</option>
                                  <option value="Section D">Section D (CSE-D)</option>
                                </>
                              );
                            }
                            return listToRender.map((s) => (
                              <option key={s._id} value={s.name}>
                                {s.name} ({s.code} - Sem {s.semester})
                              </option>
                            ));
                          })()}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* TG SPECIFIC FIELDS */}
                {createAccountType === 'TG' && (
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                    <span className="font-black text-emerald-900 text-[11px] uppercase tracking-wider block">
                      Tutor Guardian (TG) Mentorship Appointment
                    </span>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Employee ID</label>
                        <input
                          type="text"
                          value={newEmployeeId}
                          onChange={(e) => setNewEmployeeId(e.target.value)}
                          placeholder="EMP_CSE_105"
                          className="input-field w-full text-xs font-mono uppercase bg-white"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Specialization</label>
                        <input
                          type="text"
                          value={newSpecialization}
                          onChange={(e) => setNewSpecialization(e.target.value)}
                          className="input-field w-full text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Mentored Semester</label>
                        <select
                          value={newTgSemester}
                          onChange={(e) => setNewTgSemester(Number(e.target.value))}
                          className="form-select w-full bg-white border-slate-200 rounded-xl py-2 px-3 text-xs"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                            <option key={s} value={s}>
                              Semester {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Mentored Section</label>
                        <select
                          value={newTgSection}
                          onChange={(e) => setNewTgSection(e.target.value)}
                          className="form-select w-full bg-white border-slate-200 rounded-xl py-2 px-3 text-xs"
                        >
                          {(() => {
                            const semSecs = sections.filter((s) => Number(s.semester) === Number(newTgSemester));
                            const listToRender = semSecs.length > 0 ? semSecs : sections;
                            if (listToRender.length === 0) {
                              return (
                                <>
                                  <option value="Section A">Section A (CSE-A)</option>
                                  <option value="Section B">Section B (CSE-B)</option>
                                  <option value="Section C">Section C (CSE-C)</option>
                                  <option value="Section D">Section D (CSE-D)</option>
                                </>
                              );
                            }
                            return listToRender.map((s) => (
                              <option key={s._id} value={s.name}>
                                {s.name} ({s.code} - Sem {s.semester})
                              </option>
                            ));
                          })()}
                        </select>
                      </div>
                    </div>

                    <p className="text-[11px] text-emerald-800 m-0">
                      All active students in Semester {newTgSemester}, {newTgSection} will be appointed directly to this TG.
                    </p>
                  </div>
                )}

                {/* TEACHER / HOD FIELDS */}
                {(createAccountType === 'TEACHER' || createAccountType === 'HOD') && (
                  <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                    <span className="font-black text-indigo-900 text-[11px] uppercase tracking-wider block">
                      {createAccountType === 'HOD' ? 'Department Leadership Details' : 'Faculty Record Details'}
                    </span>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Employee ID</label>
                        <input
                          type="text"
                          value={newEmployeeId}
                          onChange={(e) => setNewEmployeeId(e.target.value)}
                          placeholder="EMP_102"
                          className="input-field w-full text-xs font-mono uppercase bg-white"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Designation</label>
                        <input
                          type="text"
                          value={createAccountType === 'HOD' ? 'Head of Department' : newDesignation}
                          onChange={(e) => setNewDesignation(e.target.value)}
                          disabled={createAccountType === 'HOD'}
                          className="input-field w-full text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Specialization</label>
                      <input
                        type="text"
                        value={newSpecialization}
                        onChange={(e) => setNewSpecialization(e.target.value)}
                        className="input-field w-full text-xs bg-white"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={creating} className="cursor-pointer">
                    {creating ? 'Provisioning...' : `Provision ${createAccountType} Account`}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: MOVE SEMESTER CONFIRMATION MODAL */}
      {semesterModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-slate-900">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  semesterModalData.direction === 'next'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                <Layers size={20} />
              </div>
              <div>
                <h3 className="font-heading font-black text-sm text-slate-900">
                  {semesterModalData.direction === 'next' ? 'Promote Section Semester' : 'Revert Section Semester'}
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {semesterModalData.section.name} ({semesterModalData.section.code})
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-500">Current Semester:</span>
                <span className="font-black text-slate-900">
                  Semester {semesterModalData.section.semester}
                </span>
              </div>
              <div className="flex items-center justify-between font-bold text-blue-700">
                <span>New Target Semester:</span>
                <span className="font-black text-sm">
                  Semester {semesterModalData.newSemester} (Year {semesterModalData.newYear})
                </span>
              </div>
              <div className="flex items-center justify-between font-bold text-slate-700 pt-2 border-t border-slate-200">
                <span>Affected Enrolled Students:</span>
                <span className="font-black px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  {semesterModalData.section.studentCount} Students
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              This action will update the semester on the section record, move all enrolled students forward/backward, and adjust active TG cohort records.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                disabled={actionProcessing}
                onClick={() => setSemesterModalData(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={actionProcessing}
                onClick={executeMoveSemester}
                className="cursor-pointer"
              >
                {actionProcessing ? 'Updating Cohort...' : 'Confirm Semester Move'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: APPOINT / REMOVE HOD CONFIRMATION */}
      {hodActionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Award size={20} />
              </div>
              <div>
                <h3 className="font-heading font-black text-sm text-slate-900">
                  {hodActionTarget.type === 'appoint' ? 'Appoint Head of Department (HOD)' : 'Remove HOD Appointment'}
                </h3>
                <span className="text-xs text-slate-500 font-medium">{hodActionTarget.user.name}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              {hodActionTarget.type === 'appoint'
                ? `Are you sure you want to appoint ${hodActionTarget.user.name} as Head of Department? Any currently active HOD for this department will be transitioned back to regular faculty status.`
                : `Are you sure you want to conclude the HOD tenure for ${hodActionTarget.user.name}? Their account will return to standard faculty privileges.`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                disabled={actionProcessing}
                onClick={() => setHodActionTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant={hodActionTarget.type === 'appoint' ? 'primary' : 'danger'}
                disabled={actionProcessing}
                onClick={executeHodAction}
                className="cursor-pointer"
              >
                {actionProcessing
                  ? 'Processing...'
                  : hodActionTarget.type === 'appoint'
                  ? 'Confirm Appointment'
                  : 'Remove HOD Status'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: APPOINT / REMOVE TG MODAL */}
      {tgActionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="font-heading font-black text-sm text-slate-900">
                  {tgActionTarget.type === 'appoint' ? 'Appoint Tutor Guardian (TG)' : 'Revoke TG Appointment'}
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {tgActionTarget.user.name || 'Faculty Member'}
                </span>
              </div>
            </div>

            {tgActionTarget.type === 'appoint' ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Semester</label>
                  <select
                    value={tgModalSemester}
                    onChange={(e) => setTgModalSemester(Number(e.target.value))}
                    className="form-select w-full bg-slate-50 border-slate-200 rounded-xl py-2 px-3 text-xs font-bold"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Section</label>
                  <select
                    value={tgModalSection}
                    onChange={(e) => setTgModalSection(e.target.value)}
                    className="form-select w-full bg-slate-50 border-slate-200 rounded-xl py-2 px-3 text-xs font-bold"
                  >
                    {(() => {
                      const semSecs = sections.filter((s) => Number(s.semester) === Number(tgModalSemester));
                      const listToRender = semSecs.length > 0 ? semSecs : sections;
                      if (listToRender.length === 0) {
                        return (
                          <>
                            <option value="Section A">Section A (CSE-A)</option>
                            <option value="Section B">Section B (CSE-B)</option>
                            <option value="Section C">Section C (CSE-C)</option>
                            <option value="Section D">Section D (CSE-D)</option>
                          </>
                        );
                      }
                      return listToRender.map((s) => (
                        <option key={s._id} value={s.name}>
                          {s.name} ({s.code} - Sem {s.semester})
                        </option>
                      ));
                    })()}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Academic Session</label>
                  <input
                    type="text"
                    value={tgModalSession}
                    onChange={(e) => setTgModalSession(e.target.value)}
                    className="input-field w-full text-xs font-mono"
                  />
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px]">
                  All students enrolled in {tgModalSection} will be appointed directly to this Tutor Guardian.
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Are you sure you want to conclude the Tutor Guardian appointment for{' '}
                <strong>{tgActionTarget.user.name}</strong>? Their active cohort will be deactivated and students unlinked.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                disabled={actionProcessing}
                onClick={() => setTgActionTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant={tgActionTarget.type === 'appoint' ? 'primary' : 'danger'}
                disabled={actionProcessing}
                onClick={executeTgAction}
                className="cursor-pointer"
              >
                {actionProcessing
                  ? 'Processing...'
                  : tgActionTarget.type === 'appoint'
                  ? 'Appoint TG & Assign Cohort'
                  : 'Revoke TG Appointment'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: RESET PASSWORD NOTICE */}
      {resetModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 p-6 space-y-4 text-xs animate-in fade-in">
            <div className="flex items-center gap-2 text-slate-900 font-heading font-black text-sm">
              <Key size={18} className="text-amber-600" />
              Credentials Reset Complete
            </div>

            <p className="text-slate-600">
              The login credentials for <strong>{resetModalData.user?.name}</strong> have been updated.
            </p>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Temporary Password
              </span>
              <div className="flex items-center justify-between font-mono font-bold text-slate-900">
                <span>{resetModalData.tempPassword}</span>
                <button
                  onClick={() => copyToClipboard(resetModalData.tempPassword)}
                  className="text-blue-600 hover:text-blue-800 p-1 flex items-center gap-1 font-sans text-xs"
                >
                  <Copy size={13} />
                  <span>Copy</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={() => setResetModalData(null)} className="text-xs">
                Acknowledge
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: CREATE SECTION MODAL */}
      {showCreateSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="font-heading font-black text-slate-900 text-sm">
                    Create Academic Section
                  </h3>
                  <p className="text-[11px] text-slate-500 m-0">
                    Provision a new section cohort for students & TG allocation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateSectionModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSection} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Section Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newSecName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewSecName(val);
                    const clean = val.replace(/^Section\s*/i, '').trim();
                    setNewSecCode(`CSE-${clean || 'X'}-S${newSecSemester}`);
                  }}
                  placeholder="e.g. Section E"
                  className="input-field w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Semester <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newSecSemester}
                    onChange={(e) => {
                      const sem = Number(e.target.value);
                      setNewSecSemester(sem);
                      const clean = newSecName.replace(/^Section\s*/i, '').trim();
                      setNewSecCode(`CSE-${clean || 'X'}-S${sem}`);
                    }}
                    className="form-select w-full bg-slate-50 border-slate-200 rounded-xl py-2 px-3 text-xs font-bold"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s} (Year {Math.ceil(s / 2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Section Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newSecCode}
                    onChange={(e) => setNewSecCode(e.target.value.toUpperCase())}
                    placeholder="CSE-E-S5"
                    className="input-field w-full text-xs font-mono uppercase bg-slate-50"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Capacity (Quota) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    required
                    value={newSecCapacity}
                    onChange={(e) => setNewSecCapacity(e.target.value)}
                    placeholder="60"
                    className="input-field w-full text-xs font-bold bg-slate-50"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px]">
                Newly created sections will be saved in the database and become immediately available for student registration, TG appointments, and HOD dashboards.
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={creatingSection}
                  onClick={() => setShowCreateSectionModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={creatingSection}
                  className="cursor-pointer"
                >
                  {creatingSection ? 'Creating...' : 'Create Section'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
