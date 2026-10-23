import ExcelJS from 'exceljs';
import crypto from 'node:crypto';
import User from '../../models/User.js';
import Student from '../../models/Student.js';
import Teacher from '../../models/Teacher.js';
import Department from '../../models/Department.js';
import Section from '../../models/Section.js';
import ApiError from '../../utils/ApiError.js';

export const generateTemplate = async (type, res) => {
  const workbook = new ExcelJS.Workbook();

  if (type === 'students') {
    const ws = workbook.addWorksheet('Students Import Template');
    ws.columns = [
      { header: 'Full Name', key: 'name', width: 22 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Department Code', key: 'deptCode', width: 16 },
      { header: 'Section Code', key: 'sectionCode', width: 16 },
      { header: 'Roll Number', key: 'rollNumber', width: 16 },
      { header: 'Enrollment Year', key: 'enrollmentYear', width: 16 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Guardian Name', key: 'guardianName', width: 20 },
      { header: 'Guardian Phone', key: 'guardianPhone', width: 16 },
    ];
    ws.addRow({
      name: 'John Doe',
      email: 'john.doe@college.edu',
      deptCode: 'CSE',
      sectionCode: 'CSE-4A',
      rollNumber: 'CS2026_01',
      enrollmentYear: 2026,
      phone: '9876543210',
      guardianName: 'Robert Doe',
      guardianPhone: '9876543211',
    });
    ws.getRow(1).font = { bold: true };
  } else if (type === 'teachers') {
    const ws = workbook.addWorksheet('Teachers Import Template');
    ws.columns = [
      { header: 'Full Name', key: 'name', width: 22 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Department Code', key: 'deptCode', width: 16 },
      { header: 'Designation', key: 'designation', width: 22 },
      { header: 'Employee ID', key: 'employeeId', width: 16 },
      { header: 'Phone', key: 'phone', width: 16 },
    ];
    ws.addRow({
      name: 'Dr. Jane Smith',
      email: 'jane.smith@college.edu',
      deptCode: 'CSE',
      designation: 'Associate Professor',
      employeeId: 'EMP_CSE_01',
      phone: '9876543212',
    });
    ws.getRow(1).font = { bold: true };
  } else {
    throw ApiError.badRequest("Invalid template type. Must be 'students' or 'teachers'.");
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-template.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
};

export const importStudents = async (fileBuffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw ApiError.badRequest('Excel sheet is empty');
  }

  const errors = [];
  const created = [];
  const rows = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const values = row.values;
    rows.push({
      rowNumber,
      name: values[1]?.toString()?.trim(),
      email: values[2]?.toString()?.trim()?.toLowerCase(),
      deptCode: values[3]?.toString()?.trim()?.toUpperCase(),
      sectionCode: values[4]?.toString()?.trim()?.toUpperCase(),
      rollNumber: values[5]?.toString()?.trim(),
      enrollmentYear: parseInt(values[6], 10),
      phone: values[7]?.toString()?.trim(),
      guardianName: values[8]?.toString()?.trim(),
      guardianPhone: values[9]?.toString()?.trim(),
    });
  });

  for (const r of rows) {
    let createdUserId = null;
    try {
      if (!r.name || !r.email || !r.deptCode || !r.sectionCode || !r.rollNumber || !r.enrollmentYear) {
        errors.push({ row: r.rowNumber, error: 'Missing required fields' });
        continue;
      }

      // Check duplicates
      const [emailExists, rollExists] = await Promise.all([
        User.findOne({ email: r.email }),
        Student.findOne({ rollNumber: r.rollNumber }),
      ]);

      if (emailExists) {
        errors.push({ row: r.rowNumber, error: `Email '${r.email}' already exists` });
        continue;
      }
      if (rollExists) {
        errors.push({ row: r.rowNumber, error: `Roll number '${r.rollNumber}' already exists` });
        continue;
      }

      // Department & Section
      const department = await Department.findOne({ code: r.deptCode });
      if (!department) {
        errors.push({ row: r.rowNumber, error: `Department code '${r.deptCode}' not found` });
        continue;
      }

      const section = await Section.findOne({ code: r.sectionCode });
      if (!section) {
        errors.push({ row: r.rowNumber, error: `Section code '${r.sectionCode}' not found` });
        continue;
      }

      const tempPassword = 'Temp@' + crypto.randomBytes(3).toString('hex');
      const passwordHash = await User.hashPassword(tempPassword);

      const user = await User.create({
        name: r.name,
        email: r.email,
        passwordHash,
        role: 'STUDENT',
        phone: r.phone,
        mustChangePassword: true,
        isActive: true,
      });
      createdUserId = user._id;

      const student = await Student.create({
        user: user._id,
        department: department._id,
        section: section._id,
        rollNumber: r.rollNumber,
        enrollmentYear: r.enrollmentYear,
        guardianName: r.guardianName,
        guardianPhone: r.guardianPhone,
      });

      created.push({
        id: student._id,
        name: r.name,
        email: r.email,
        rollNumber: r.rollNumber,
        tempPassword,
      });
    } catch (err) {
      if (createdUserId) {
        await User.findByIdAndDelete(createdUserId).catch(() => {});
      }
      errors.push({ row: r.rowNumber, error: err.message });
    }
  }

  return {
    totalProcessed: rows.length,
    successCount: created.length,
    errorCount: errors.length,
    created,
    errors,
  };
};

export const importTeachers = async (fileBuffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw ApiError.badRequest('Excel sheet is empty');
  }

  const errors = [];
  const created = [];
  const rows = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values;
    rows.push({
      rowNumber,
      name: values[1]?.toString()?.trim(),
      email: values[2]?.toString()?.trim()?.toLowerCase(),
      deptCode: values[3]?.toString()?.trim()?.toUpperCase(),
      designation: values[4]?.toString()?.trim() || 'Assistant Professor',
      employeeId: values[5]?.toString()?.trim(),
      phone: values[6]?.toString()?.trim(),
    });
  });

  for (const r of rows) {
    let createdUserId = null;
    try {
      if (!r.name || !r.email || !r.deptCode || !r.employeeId) {
        errors.push({ row: r.rowNumber, error: 'Missing required fields' });
        continue;
      }

      const [emailExists, empExists] = await Promise.all([
        User.findOne({ email: r.email }),
        Teacher.findOne({ employeeId: r.employeeId }),
      ]);

      if (emailExists) {
        errors.push({ row: r.rowNumber, error: `Email '${r.email}' already exists` });
        continue;
      }
      if (empExists) {
        errors.push({ row: r.rowNumber, error: `Employee ID '${r.employeeId}' already exists` });
        continue;
      }

      const department = await Department.findOne({ code: r.deptCode });
      if (!department) {
        errors.push({ row: r.rowNumber, error: `Department code '${r.deptCode}' not found` });
        continue;
      }

      const tempPassword = 'Temp@' + crypto.randomBytes(3).toString('hex');
      const passwordHash = await User.hashPassword(tempPassword);

      const user = await User.create({
        name: r.name,
        email: r.email,
        passwordHash,
        role: 'TEACHER',
        phone: r.phone,
        mustChangePassword: true,
        isActive: true,
      });
      createdUserId = user._id;

      const teacher = await Teacher.create({
        user: user._id,
        department: department._id,
        designation: r.designation,
        employeeId: r.employeeId,
      });

      created.push({
        id: teacher._id,
        name: r.name,
        email: r.email,
        employeeId: r.employeeId,
        tempPassword,
      });
    } catch (err) {
      if (createdUserId) {
        await User.findByIdAndDelete(createdUserId).catch(() => {});
      }
      errors.push({ row: r.rowNumber, error: err.message });
    }
  }

  return {
    totalProcessed: rows.length,
    successCount: created.length,
    errorCount: errors.length,
    created,
    errors,
  };
};

export default {
  generateTemplate,
  importStudents,
  importTeachers,
};
