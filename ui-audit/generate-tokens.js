import jwt from '../backend/node_modules/jsonwebtoken/index.js';
import connectDB from '../backend/src/config/db.js';
import env from '../backend/src/config/env.js';
import User from '../backend/src/models/User.js';
import Student from '../backend/src/models/Student.js';
import Teacher from '../backend/src/models/Teacher.js';
import fs from 'node:fs';
import path from 'node:path';

async function generate() {
  await connectDB();
  const tokens = {};

  const accounts = [
    { role: 'HOD', email: 'hod@campusflow.edu', key: 'hod' },
    { role: 'STUDENT', email: 'ayushmishra2372005@gmail.com', key: 'student' },
    { role: 'TEACHER', email: 'test_teacher@mail.in', key: 'tg', effectiveRole: 'tg' },
    { role: 'ADMIN', email: 'admin@campusflow.edu', key: 'admin' },
  ];

  for (const acc of accounts) {
    const user = await User.findOne({ email: acc.email });
    if (!user) {
      console.error('User not found:', acc.email);
      continue;
    }

    let extraClaims = {};
    let profile = null;

    if (acc.role === 'STUDENT') {
      const student = await Student.findOne({ user: user._id }).populate('department section mentorGroup');
      profile = student;
    } else {
      const teacher = await Teacher.findOne({ user: user._id }).populate('department');
      profile = teacher;
      if (acc.key === 'tg' || user.isTG) {
        extraClaims.isTG = true;
        extraClaims.teacherId = teacher?._id?.toString();
      }
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        role: user.role,
        ...extraClaims,
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '7d' }
    );

    const userObj = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      isTG: Boolean(user.isTG || extraClaims.isTG),
      profile,
    };

    tokens[acc.key] = {
      token,
      user: userObj,
      role: acc.effectiveRole || user.role.toLowerCase(),
    };
  }

  const cachePath = path.resolve('ui-audit', 'auth-tokens.json');
  fs.writeFileSync(cachePath, JSON.stringify(tokens, null, 2));
  console.log('Saved generated auth tokens to', cachePath);
  process.exit(0);
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
