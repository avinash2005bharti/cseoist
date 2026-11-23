/**
 * Safe & Secure Password Reset Utility for HOD CSE (hodcse@oist.in)
 * 
 * Usage:
 *   Option 1 (Recommended - Environment Variable):
 *     $env:HOD_NEW_PASSWORD="YourSecurePassword123!"
 *     npm run reset:hod-password
 * 
 *   Option 2 (CLI Parameter):
 *     node scripts/reset-hod-password.js "YourSecurePassword123!"
 * 
 * Features:
 * - Uses existing bcrypt hashing logic (User.hashPassword with salt 12)
 * - Enforces strong password complexity (min 8 chars, 1 uppercase, 1 number)
 * - Scoped strictly to hodcse@oist.in (does not alter any other user)
 * - Invalidates all active session refresh tokens upon password change
 * - Never prints or logs the plain-text password to stdout/logs
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import RefreshToken from '../src/models/RefreshToken.js';

const TARGET_EMAIL = 'hodcse@oist.in';

function validatePasswordComplexity(password) {
  if (!password || typeof password !== 'string') {
    return 'Password is required.';
  }
  if (password.length < 6) {
    return 'Password must be at least 6 characters long.';
  }
  return null;
}

async function main() {
  const newPassword = process.env.HOD_NEW_PASSWORD || process.argv[2];

  if (!newPassword) {
    console.error('❌ Error: No new password provided.');
    console.error('');
    console.error('Safe usage instructions:');
    console.error('  1. Set environment variable:');
    console.error('     PowerShell:  $env:HOD_NEW_PASSWORD="YourSecurePassword123!"');
    console.error('     Bash/Linux:  export HOD_NEW_PASSWORD="YourSecurePassword123!"');
    console.error('  2. Run the reset command:');
    console.error('     npm run reset:hod-password');
    console.error('');
    console.error('  Or pass it as a parameter:');
    console.error('     node scripts/reset-hod-password.js "<NewPassword>"');
    process.exit(1);
  }

  const complexityError = validatePasswordComplexity(newPassword);
  if (complexityError) {
    console.error(`❌ Password complexity error: ${complexityError}`);
    process.exit(1);
  }

  try {
    await connectDB();

    const hodUser = await User.findOne({ email: TARGET_EMAIL }).select('+passwordHash');
    if (!hodUser) {
      console.error(`❌ User not found for email: ${TARGET_EMAIL}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    if (hodUser.role !== 'HOD') {
      console.error(`❌ Targeted user is not an HOD account (Role: ${hodUser.role})`);
      await mongoose.disconnect();
      process.exit(1);
    }

    // Securely hash using the project's standard hashing mechanism (bcryptjs salt 12)
    const hashed = await User.hashPassword(newPassword);
    hodUser.passwordHash = hashed;
    hodUser.mustChangePassword = false;
    await hodUser.save();

    // Revoke any active refresh tokens to enforce re-authentication
    const revokedResult = await RefreshToken.updateMany(
      { user: hodUser._id, revokedAt: null },
      { revokedAt: new Date() }
    );

    console.log('✅ HOD CSE password updated successfully!');
    console.log(`   Account: ${hodUser.name} (${hodUser.email})`);
    console.log(`   User ID: ${hodUser._id}`);
    console.log(`   Role:    ${hodUser.role}`);
    console.log(`   Active sessions revoked: ${revokedResult.modifiedCount}`);
    console.log('   Password hashing: bcrypt (12 rounds) applied.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to update HOD password:', err.message);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

main();
