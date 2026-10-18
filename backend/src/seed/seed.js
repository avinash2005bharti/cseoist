import mongoose from 'mongoose';
import env from '../config/env.js';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Section from '../models/Section.js';
import Teacher from '../models/Teacher.js';
import Student from '../models/Student.js';
import MentorGroup from '../models/MentorGroup.js';
import HodAppointment from '../models/HodAppointment.js';
import ConsiderationRequest from '../models/ConsiderationRequest.js';
import LeaveApplication from '../models/LeaveApplication.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import RefreshToken from '../models/RefreshToken.js';
import { getTodayIST } from '../utils/dates.js';

export const runSeed = async () => {
  try {
    const mongoUri = env.MONGODB_URI;
    if (!mongoUri || mongoUri.includes('<username>') || mongoUri.includes('<password>')) {
      console.error('❌ Please set a valid MONGODB_URI/MONGO_URI before running seed.');
      process.exit(1);
    }

    console.log('🔄 Connecting to MongoDB for seeding...');
    await connectDB();

    console.log('🧹 Clearing existing collections...');
    await Promise.all([
      User.deleteMany(),
      Department.deleteMany(),
      Section.deleteMany(),
      Teacher.deleteMany(),
      Student.deleteMany(),
      MentorGroup.deleteMany(),
      HodAppointment.deleteMany(),
      ConsiderationRequest.deleteMany(),
      LeaveApplication.deleteMany(),
      Notification.deleteMany(),
      AuditLog.deleteMany(),
      RefreshToken.deleteMany(),
    ]);

    // 1. Department
    const cseDept = await Department.create({
      name: 'Computer Science and Engineering',
      code: 'CSE',
    });
    console.log('🏛️ Created Department: CSE');

    // 2. Sections (Semester 5: CSE-A, CSE-B, CSE-C, CSE-D matching screenshots)
    const secA = await Section.create({
      department: cseDept._id,
      year: 3,
      semester: 5,
      name: 'Section A',
      code: 'CSE-A',
    });

    const secB = await Section.create({
      department: cseDept._id,
      year: 3,
      semester: 5,
      name: 'Section B',
      code: 'CSE-B',
    });

    const secC = await Section.create({
      department: cseDept._id,
      year: 3,
      semester: 5,
      name: 'Section C',
      code: 'CSE-C',
    });

    const secD = await Section.create({
      department: cseDept._id,
      year: 3,
      semester: 5,
      name: 'Section D',
      code: 'CSE-D',
    });
    console.log('📚 Created Sections: CSE-A, CSE-B, CSE-C, CSE-D (Semester 5)');

    // Default password hash
    const defaultPasswordHash = await User.hashPassword('Password@123');

    // 3. Admin
    const adminUser = await User.create({
      name: 'System Administrator',
      email: 'admin@campusflow.edu',
      passwordHash: defaultPasswordHash,
      role: 'ADMIN',
      phone: '9876543210',
      mustChangePassword: false,
      isActive: true,
    });

    // 4. HOD
    const hodUser = await User.create({
      name: 'Dr. Rajesh Sharma (HOD)',
      email: 'hod@campusflow.edu',
      passwordHash: defaultPasswordHash,
      role: 'HOD',
      phone: '9876543211',
      mustChangePassword: false,
      isActive: true,
    });

    const hodTeacher = await Teacher.create({
      user: hodUser._id,
      department: cseDept._id,
      designation: 'Professor & Head of Department',
      employeeId: 'EMP_HOD_01',
    });

    await HodAppointment.create({
      department: cseDept._id,
      teacher: hodTeacher._id,
      startDate: new Date('2024-01-01'),
      isActive: true,
    });
    console.log('👨‍🏫 Created Admin & HOD (Dr. Rajesh Sharma)');

    // 5. Teachers & Tutor Guardians
    // TG for Section B: Test Teacher
    const tgTestUser = await User.create({
      name: 'Test Teacher',
      email: 'test_teacher@mail.in',
      passwordHash: defaultPasswordHash,
      role: 'TEACHER',
      phone: '9876543212',
      mustChangePassword: false,
      isActive: true,
    });
    const tgTestTeacher = await Teacher.create({
      user: tgTestUser._id,
      department: cseDept._id,
      designation: 'Assistant Professor (TG)',
      employeeId: 'EMP_TG_01',
    });

    // TG for Section A: Prof. Ananya Verma
    const tgAnanyaUser = await User.create({
      name: 'Prof. Ananya Verma',
      email: 'ananya.tg@campusflow.edu',
      passwordHash: defaultPasswordHash,
      role: 'TEACHER',
      phone: '9876543213',
      mustChangePassword: false,
      isActive: true,
    });
    const tgAnanyaTeacher = await Teacher.create({
      user: tgAnanyaUser._id,
      department: cseDept._id,
      designation: 'Associate Professor',
      employeeId: 'EMP_CSE_101',
    });

    const teacher3User = await User.create({
      name: 'Prof. Kavita Sen',
      email: 'kavita.teacher@campusflow.edu',
      passwordHash: defaultPasswordHash,
      role: 'TEACHER',
      phone: '9876543214',
      mustChangePassword: false,
      isActive: true,
    });
    const teacher3 = await Teacher.create({
      user: teacher3User._id,
      department: cseDept._id,
      designation: 'Assistant Professor',
      employeeId: 'EMP_CSE_103',
    });
    console.log('👩‍🏫 Created Teachers: Test Teacher (Section B TG), Prof. Ananya (Section A TG), Prof. Kavita Sen');

    // 6. Mentor Groups (Academic Session 2025-2026)
    const groupB = await MentorGroup.create({
      department: cseDept._id,
      tg: tgTestTeacher._id,
      academicYear: '2025-2026',
      semester: 5,
      section: secB._id,
      students: [],
      isActive: true,
    });

    const groupA = await MentorGroup.create({
      department: cseDept._id,
      tg: tgAnanyaTeacher._id,
      academicYear: '2025-2026',
      semester: 5,
      section: secA._id,
      students: [],
      isActive: true,
    });

    // Audit logs for initial appointments
    await AuditLog.create({
      actor: hodUser._id,
      action: 'APPOINT_TG',
      entityType: 'MentorGroup',
      entityId: groupB._id,
      before: null,
      after: {
        tgName: 'Test Teacher',
        section: 'CSE-B',
        semester: 5,
        academicYear: '2025-2026',
      },
    });

    await AuditLog.create({
      actor: hodUser._id,
      action: 'APPOINT_TG',
      entityType: 'MentorGroup',
      entityId: groupA._id,
      before: null,
      after: {
        tgName: 'Prof. Ananya Verma',
        section: 'CSE-A',
        semester: 5,
        academicYear: '2025-2026',
      },
    });

    // 7. Students
    const secBStudentsData = [
      {
        name: 'Avinash Bharti',
        email: 'avinash@college.edu',
        roll: '0105CS241101',
        phone: '+916200072434',
        sec: secB,
        group: groupB,
      },
      {
        name: 'Ayush Mishra',
        email: 'ayushmishra2372005@gmail.com',
        roll: '0105CS241110',
        phone: '+919302378451',
        sec: secB,
        group: groupB,
      },
      {
        name: 'Ayushi Sahu',
        email: 'sahuayushi535@gmail.com',
        roll: '0105CS241113',
        phone: '7222961376',
        sec: secB,
        group: groupB,
      },
      {
        name: 'Deepak Sharma',
        email: 'deepak12@gmail.com',
        roll: '0105CS24127',
        phone: '9876543210',
        sec: secB,
        group: groupB,
      },
    ];

    const secAStudentsData = [
      {
        name: 'teststudent1',
        email: 'teststd@mail.in',
        roll: '0105CS241001',
        phone: '9876543210',
        sec: secA,
        group: groupA,
        isActive: true,
      },
    ];

    const groupBStudentIds = [];
    const groupAStudentIds = [];
    let avinashStudentDoc = null;
    let avinashUserDoc = null;
    let ayushiStudentDoc = null;
    let ayushiUserDoc = null;

    for (const s of secBStudentsData) {
      const u = await User.create({
        name: s.name,
        email: s.email,
        passwordHash: defaultPasswordHash,
        role: 'STUDENT',
        phone: s.phone,
        mustChangePassword: false,
        isActive: true,
      });

      const st = await Student.create({
        user: u._id,
        department: cseDept._id,
        section: s.sec._id,
        rollNumber: s.roll,
        enrollmentNumber: s.roll,
        enrollmentYear: 2023,
        guardianName: `Guardian of ${s.name}`,
        guardianPhone: s.phone,
        mentorGroup: s.group._id,
        status: 'ACTIVE',
      });

      groupBStudentIds.push(st._id);

      if (s.roll === '0105CS241101') {
        avinashStudentDoc = st;
        avinashUserDoc = u;
      }
      if (s.roll === '0105CS241113') {
        ayushiStudentDoc = st;
        ayushiUserDoc = u;
      }
    }

    for (const s of secAStudentsData) {
      const u = await User.create({
        name: s.name,
        email: s.email,
        passwordHash: defaultPasswordHash,
        role: 'STUDENT',
        phone: s.phone,
        mustChangePassword: false,
        isActive: true,
      });

      const st = await Student.create({
        user: u._id,
        department: cseDept._id,
        section: s.sec._id,
        rollNumber: s.roll,
        enrollmentNumber: s.roll,
        enrollmentYear: 2023,
        guardianName: `Guardian of ${s.name}`,
        guardianPhone: s.phone,
        mentorGroup: s.group._id,
        status: 'ACTIVE',
      });

      groupAStudentIds.push(st._id);
    }

    groupB.students = groupBStudentIds;
    await groupB.save();

    groupA.students = groupAStudentIds;
    await groupA.save();

    console.log('🎓 Created Real Students: Section B & Section A (Semester 5)');

    // 8. Consideration Requests
    if (avinashStudentDoc && avinashUserDoc) {
      // Record 1: RECOMMENDED_BY_TG (Awaiting HOD Decision - Action Required!)
      const cReq1 = await ConsiderationRequest.create({
        student: avinashStudentDoc._id,
        tg: tgTestTeacher._id,
        eventTitle: 'Hackathon / Technical Competition',
        eventType: 'HACKATHON',
        organizer: 'National Technical Board',
        venue: 'Campus Tech Hub',
        startDate: '2026-10-12',
        endDate: '2026-10-12',
        requestedPeriods: 3,
        selectedPeriods: ['P2', 'P3', 'P4'],
        description: 'Participated in Regional Round of National Technical Hackathon.',
        attachments: [],
        status: 'RECOMMENDED_BY_TG',
        tgReview: {
          remarks: 'Verified student participation certificate and attendance criteria. Recommended for attendance credit.',
          reviewedAt: new Date('2026-10-12T10:00:00Z'),
          reviewedBy: tgTestUser._id,
        },
        history: [
          {
            status: 'PENDING',
            actor: avinashUserDoc._id,
            actorRole: 'STUDENT',
            remarks: 'Submitted consideration request for Hackathon',
            at: new Date('2026-10-12T08:30:00Z'),
            via: 'MANUAL',
          },
          {
            status: 'RECOMMENDED_BY_TG',
            actor: tgTestUser._id,
            actorRole: 'TEACHER',
            remarks: 'Recommended by TG for HOD final authorization',
            at: new Date('2026-10-12T10:00:00Z'),
            via: 'MANUAL',
          },
        ],
      });

      await AuditLog.create({
        actor: avinashUserDoc._id,
        action: 'CREATE_CONSIDERATION',
        entityType: 'ConsiderationRequest',
        entityId: cReq1._id,
        before: null,
        after: { eventTitle: cReq1.eventTitle, status: 'PENDING', requestedPeriods: 3 },
      });

      await AuditLog.create({
        actor: tgTestUser._id,
        action: 'TG_RECOMMEND_CONSIDERATION',
        entityType: 'ConsiderationRequest',
        entityId: cReq1._id,
        before: { status: 'PENDING' },
        after: { status: 'RECOMMENDED_BY_TG', remarks: 'Recommended for HOD authorization' },
      });

      // Record 2: APPROVED_BY_HOD
      const cReq2 = await ConsiderationRequest.create({
        student: avinashStudentDoc._id,
        tg: tgTestTeacher._id,
        eventTitle: 'Hackathon / Technical Competition',
        eventType: 'HACKATHON',
        organizer: 'State Level Innovation Sprint',
        venue: 'Main Auditorium',
        startDate: '2026-10-12',
        endDate: '2026-10-12',
        requestedPeriods: 3,
        selectedPeriods: ['P2', 'P3', 'P4'],
        description: 'Selected for State Level Innovation Sprint finals.',
        attachments: [],
        status: 'APPROVED_BY_HOD',
        approvedPeriods: 3,
        hodReview: {
          remarks: 'Officially sanctioned attendance waiver',
          reviewedAt: new Date('2026-10-12T12:00:00Z'),
          reviewedBy: hodUser._id,
          approvedPeriods: 3,
        },
        history: [
          {
            status: 'PENDING',
            actor: avinashUserDoc._id,
            actorRole: 'STUDENT',
            remarks: 'Submitted request',
            at: new Date('2026-10-11T09:00:00Z'),
            via: 'MANUAL',
          },
          {
            status: 'RECOMMENDED_BY_TG',
            actor: tgTestUser._id,
            actorRole: 'TEACHER',
            remarks: 'Recommended and forwarded to HOD',
            at: new Date('2026-10-11T14:00:00Z'),
            via: 'MANUAL',
          },
          {
            status: 'APPROVED_BY_HOD',
            actor: hodUser._id,
            actorRole: 'HOD',
            remarks: 'Officially sanctioned attendance waiver',
            at: new Date('2026-10-12T12:00:00Z'),
            via: 'MANUAL',
          },
        ],
      });

      await AuditLog.create({
        actor: hodUser._id,
        action: 'HOD_APPROVE_CONSIDERATION',
        entityType: 'ConsiderationRequest',
        entityId: cReq2._id,
        before: { status: 'RECOMMENDED_BY_TG' },
        after: { status: 'APPROVED_BY_HOD', approvedPeriods: 3 },
      });

      // Record 3: APPROVED_BY_HOD
      const cReq3 = await ConsiderationRequest.create({
        student: avinashStudentDoc._id,
        tg: tgTestTeacher._id,
        eventTitle: 'Academic On-Duty (OD)',
        eventType: 'COLLEGE_DUTY',
        organizer: 'CSE Department Research Lab',
        venue: 'Seminar Hall',
        startDate: '2026-10-11',
        endDate: '2026-10-11',
        requestedPeriods: 3,
        selectedPeriods: ['P5', 'P6', 'P7'],
        description: 'Assisting in setup of Department Research Showcase.',
        attachments: [],
        status: 'APPROVED_BY_HOD',
        approvedPeriods: 3,
        hodReview: {
          remarks: 'Verified departmental service duty.',
          reviewedAt: new Date('2026-10-11T15:00:00Z'),
          reviewedBy: hodUser._id,
          approvedPeriods: 3,
        },
        history: [
          {
            status: 'APPROVED_BY_HOD',
            actor: hodUser._id,
            actorRole: 'HOD',
            remarks: 'Sanctioned departmental duty waiver',
            at: new Date('2026-10-11T15:00:00Z'),
            via: 'MANUAL',
          },
        ],
      });

      await AuditLog.create({
        actor: hodUser._id,
        action: 'HOD_APPROVE_CONSIDERATION',
        entityType: 'ConsiderationRequest',
        entityId: cReq3._id,
        before: { status: 'RECOMMENDED_BY_TG' },
        after: { status: 'APPROVED_BY_HOD', approvedPeriods: 3 },
      });

      // Record 4: REJECTED (Avinash Bharti)
      const cReq4 = await ConsiderationRequest.create({
        student: avinashStudentDoc._id,
        tg: tgTestTeacher._id,
        eventTitle: 'External Workshop Session',
        eventType: 'OTHER',
        organizer: 'Private Institute',
        venue: 'City Center',
        startDate: '2026-10-09',
        endDate: '2026-10-09',
        requestedPeriods: 2,
        selectedPeriods: ['P1', 'P2'],
        description: 'Attended private weekend coaching workshop.',
        attachments: [],
        status: 'REJECTED',
        hodReview: {
          remarks: 'Non-accredited external coaching is ineligible for academic on-duty attendance.',
          reviewedAt: new Date('2026-10-10T16:00:00Z'),
          reviewedBy: hodUser._id,
        },
        history: [
          {
            status: 'REJECTED',
            actor: hodUser._id,
            actorRole: 'HOD',
            remarks: 'Rejected - ineligible activity.',
            at: new Date('2026-10-10T16:00:00Z'),
            via: 'MANUAL',
          },
        ],
      });

      await AuditLog.create({
        actor: hodUser._id,
        action: 'HOD_REJECT_CONSIDERATION',
        entityType: 'ConsiderationRequest',
        entityId: cReq4._id,
        before: { status: 'RECOMMENDED_BY_TG' },
        after: { status: 'REJECTED', remarks: 'Ineligible activity' },
      });

      // 9. Leave Applications
      // Leave 1: Student Leave RECOMMENDED_BY_TG (Awaiting HOD Decision!)
      const leave1 = await LeaveApplication.create({
        applicant: avinashUserDoc._id,
        applicantRole: 'STUDENT',
        student: avinashStudentDoc._id,
        tg: tgTestTeacher._id,
        leaveType: 'MEDICAL',
        startDate: '2026-10-12',
        endDate: '2026-10-14',
        totalDays: 3,
        reason: 'Prescribed medical rest due to acute viral fever.',
        attachments: [],
        status: 'RECOMMENDED_BY_TG',
        tgReview: {
          remarks: 'Reviewed doctor prescription and medical certificate. Recommended for approval.',
          reviewedAt: new Date('2026-10-12T11:00:00Z'),
          reviewedBy: tgTestUser._id,
        },
        history: [
          {
            status: 'PENDING',
            actor: avinashUserDoc._id,
            actorRole: 'STUDENT',
            remarks: 'Submitted medical leave application',
            at: new Date('2026-10-12T09:00:00Z'),
            via: 'MANUAL',
          },
          {
            status: 'RECOMMENDED_BY_TG',
            actor: tgTestUser._id,
            actorRole: 'TEACHER',
            remarks: 'Recommended by TG to HOD',
            at: new Date('2026-10-12T11:00:00Z'),
            via: 'MANUAL',
          },
        ],
      });

      await AuditLog.create({
        actor: avinashUserDoc._id,
        action: 'CREATE_LEAVE',
        entityType: 'LeaveApplication',
        entityId: leave1._id,
        before: null,
        after: { applicant: 'Avinash Bharti', totalDays: 3, status: 'PENDING' },
      });

      await AuditLog.create({
        actor: tgTestUser._id,
        action: 'TG_RECOMMEND_LEAVE',
        entityType: 'LeaveApplication',
        entityId: leave1._id,
        before: { status: 'PENDING' },
        after: { status: 'RECOMMENDED_BY_TG' },
      });

      // Leave 2: Faculty Leave PENDING (Prof. Kavita Sen direct to HOD - Awaiting HOD Action!)
      const leave2 = await LeaveApplication.create({
        applicant: teacher3User._id,
        applicantRole: 'TEACHER',
        teacher: teacher3._id,
        leaveType: 'DUTY',
        startDate: '2026-10-15',
        endDate: '2026-10-16',
        totalDays: 2,
        reason: 'Presenting research paper at National Conference on Machine Learning, IIT Delhi.',
        attachments: [],
        status: 'PENDING',
        history: [
          {
            status: 'PENDING',
            actor: teacher3User._id,
            actorRole: 'TEACHER',
            remarks: 'Submitted direct faculty leave request for conference presentation',
            at: new Date('2026-10-12T14:00:00Z'),
            via: 'MANUAL',
          },
        ],
      });

      await AuditLog.create({
        actor: teacher3User._id,
        action: 'CREATE_LEAVE',
        entityType: 'LeaveApplication',
        entityId: leave2._id,
        before: null,
        after: { applicant: 'Prof. Kavita Sen', totalDays: 2, status: 'PENDING' },
      });

      // Leave 3: Student Leave APPROVED_BY_HOD (Ayushi Sahu)
      if (ayushiStudentDoc && ayushiUserDoc) {
        const leave3 = await LeaveApplication.create({
          applicant: ayushiUserDoc._id,
          applicantRole: 'STUDENT',
          student: ayushiStudentDoc._id,
          tg: tgTestTeacher._id,
          leaveType: 'CASUAL',
          startDate: '2026-10-08',
          endDate: '2026-10-09',
          totalDays: 2,
          reason: 'Attending family wedding ceremony.',
          attachments: [],
          status: 'APPROVED_BY_HOD',
          tgReview: {
            remarks: 'Advance notice verified with guardian.',
            reviewedAt: new Date('2026-10-07T10:00:00Z'),
            reviewedBy: tgTestUser._id,
          },
          finalReview: {
            remarks: 'Approved casual leave.',
            reviewedAt: new Date('2026-10-07T16:00:00Z'),
            reviewedBy: hodUser._id,
          },
          history: [
            {
              status: 'APPROVED_BY_HOD',
              actor: hodUser._id,
              actorRole: 'HOD',
              remarks: 'Approved by HOD',
              at: new Date('2026-10-07T16:00:00Z'),
              via: 'MANUAL',
            },
          ],
        });

        await AuditLog.create({
          actor: hodUser._id,
          action: 'FINAL_APPROVE_LEAVE',
          entityType: 'LeaveApplication',
          entityId: leave3._id,
          before: { status: 'RECOMMENDED_BY_TG' },
          after: { status: 'APPROVED_BY_HOD' },
        });
      }

      // 10. Persistent In-App Notifications for HOD
      await Notification.create({
        user: hodUser._id,
        title: 'Attendance Consideration Recommended',
        message: 'Test Teacher recommended Avinash Bharti for Hackathon / Technical Competition (3 periods).',
        type: 'CONSIDERATION',
        link: '/hod/considerations',
        isRead: false,
      });

      await Notification.create({
        user: hodUser._id,
        title: 'Student Leave Application Recommended',
        message: 'Test Teacher recommended Medical Leave for Avinash Bharti (3 days).',
        type: 'LEAVE',
        link: '/hod/leaves',
        isRead: false,
      });

      await Notification.create({
        user: hodUser._id,
        title: 'Faculty Leave Application',
        message: 'Prof. Kavita Sen submitted an Academic Leave application for 2 days.',
        type: 'LEAVE',
        link: '/hod/leaves',
        isRead: false,
      });

      console.log('📋 Seeded Consideration Requests, Leaves, Notifications, and Audit Logs successfully');
    }

    console.log('\n=============================================================');
    console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('-------------------------------------------------------------');
    console.log('Default Password for all accounts: Password@123');
    console.log('Credentials:');
    console.log('  👑 ADMIN:   admin@campusflow.edu');
    console.log('  🏛️ HOD:     hod@campusflow.edu');
    console.log('  👩‍🏫 TG (Sec B): test_teacher@mail.in');
    console.log('  👩‍🏫 TG (Sec A): ananya.tg@campusflow.edu');
    console.log('  🧑‍🏫 Teacher:    kavita.teacher@campusflow.edu');
    console.log('  🎓 Student (Sec B): avinash@college.edu (Roll 0105CS241101)');
    console.log('  🎓 Student (Sec B): ayushmishra2372005@gmail.com (Roll 0105CS241110)');
    console.log('=============================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

runSeed();
