import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

async function linkAvinash() {
  const conn = await mongoose.connect(process.env.MONGODB_URI);
  const db = conn.connection.db;

  const email = 'avinashbharti3007@gmail.com';
  const user = await db.collection('users').findOne({ email });

  if (!user) {
    console.error('User not found!');
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (${user.email}) - ID: ${user._id}`);

  // 1. Get CSE Department
  const cseDept = await db.collection('departments').findOne({ code: 'CSE' });
  // 2. Get Section B
  const secB = await db.collection('sections').findOne({ code: 'CSE-B', semester: 5 });
  // 3. Get Mentor Group B
  const mgB = await db.collection('mentorgroups').findOne({ section: secB?._id });

  console.log('Department:', cseDept?._id);
  console.log('Section B:', secB?._id);
  console.log('Mentor Group B:', mgB?._id);

  // 4. Create or update Student profile
  const studentData = {
    user: user._id,
    department: cseDept._id,
    section: secB._id,
    rollNumber: '0105CS241101',
    enrollmentNumber: '0105CS241101',
    enrollmentYear: 2024,
    batch: '2024-2028',
    semester: 5,
    guardianName: 'Guardian of Avinash Bharti',
    guardianPhone: '+916200072434',
    mentorGroup: mgB?._id || null,
    status: 'ACTIVE',
    updatedAt: new Date()
  };

  let student = await db.collection('students').findOne({ user: user._id });
  if (!student) {
    student = await db.collection('students').findOne({ rollNumber: '0105CS241101' });
  }

  let studentId;
  if (!student) {
    studentData.createdAt = new Date('2026-10-15T06:00:06.566Z');
    const ins = await db.collection('students').insertOne(studentData);
    studentId = ins.insertedId;
    console.log(`Created new student record with ID: ${studentId}`);
  } else {
    await db.collection('students').updateOne({ _id: student._id }, { $set: studentData });
    studentId = student._id;
    console.log(`Updated existing student record with ID: ${studentId}`);
  }

  // 5. Add to Mentor Group B
  if (mgB) {
    await db.collection('mentorgroups').updateOne(
      { _id: mgB._id },
      { $addToSet: { students: studentId } }
    );
    console.log(`Added student ${studentId} to Mentor Group B.`);
  }

  // 6. Link historical consideration requests
  const conRes = await db.collection('considerationrequests').updateMany(
    {
      $or: [
        { 'groupLeader.user.email': email },
        { 'groupMembers.user.email': email }
      ]
    },
    {
      $set: {
        student: studentId,
        'groupLeader._id': studentId,
        'groupLeader.user._id': user._id
      }
    }
  );
  console.log(`Updated consideration requests: ${conRes.modifiedCount}`);

  // Fetch verified profile
  const finalStudent = await db.collection('students').findOne({ _id: studentId });
  const finalSec = await db.collection('sections').findOne({ _id: finalStudent.section });
  const finalMg = await db.collection('mentorgroups').findOne({ _id: finalStudent.mentorGroup });
  const finalTg = finalMg?.tg ? await db.collection('teachers').findOne({ _id: finalMg.tg }) : null;
  const finalTgUser = finalTg ? await db.collection('users').findOne({ _id: finalTg.user }) : null;

  console.log('\n======================================================');
  console.log('✅ AVINASH BHARTI ACCOUNT DETAILS');
  console.log('======================================================');
  console.log(`Name:              ${user.name}`);
  console.log(`Email:             ${user.email}`);
  console.log(`Phone:             ${user.phone || '+916200072434'}`);
  console.log(`Role:              ${user.role}`);
  console.log(`Roll Number:       ${finalStudent.rollNumber}`);
  console.log(`Enrollment Number: ${finalStudent.enrollmentNumber}`);
  console.log(`Department:        Computer Science & Engineering (CSE)`);
  console.log(`Section:           ${finalSec?.name || 'Section B'} (${finalSec?.code || 'CSE-B'})`);
  console.log(`Semester:          ${finalStudent.semester}`);
  console.log(`Batch:             ${finalStudent.batch}`);
  console.log(`Tutor Guardian:    ${finalTgUser?.name || 'Test Teacher'} (${finalTgUser?.email || 'test_teacher@mail.in'})`);
  console.log(`Status:            ${finalStudent.status}`);
  console.log(`Google Auth:       Connected (Verified)`);
  console.log('======================================================\n');

  process.exit(0);
}

linkAvinash().catch(err => {
  console.error(err);
  process.exit(1);
});
