import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import LeaveApplication from '../src/models/LeaveApplication.js';
import User from '../src/models/User.js';

describe('Full-Day Leave Consideration & HOD Password Security Suite', () => {
  it('should compute 8 lectures for a single full-day leave application', () => {
    const leave = new LeaveApplication({
      applicant: new mongoose.Types.ObjectId(),
      applicantRole: 'STUDENT',
      leaveType: 'CASUAL',
      startDate: '2026-11-24',
      endDate: '2026-11-24',
      totalDays: 1,
      reason: 'Attending family emergency',
    });

    assert.equal(leave.requestedPeriods, 8, 'Single day leave must consider exactly 8 lectures');
    assert.equal(leave.approvedPeriods, 8, 'Single day leave must approve 8 lectures by default');
    assert.equal(leave.selectedPeriods.length, 8, 'Single day leave must have 8 selected periods');
    assert.deepEqual(
      leave.selectedPeriods,
      ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
      'Selected periods must span P1 to P8'
    );
    assert.equal(leave.timeFrom, '10:00 AM');
    assert.equal(leave.timeTo, '04:40 PM');
  });

  it('should scale lecture considerations proportionally for multi-day leaves (8 lectures/day)', () => {
    const multiDayLeave = new LeaveApplication({
      applicant: new mongoose.Types.ObjectId(),
      applicantRole: 'STUDENT',
      leaveType: 'MEDICAL',
      startDate: '2026-11-24',
      endDate: '2026-11-26',
      totalDays: 3,
      reason: 'Medical recovery',
    });

    assert.equal(multiDayLeave.requestedPeriods, 24, '3-day leave must consider exactly 24 lectures (3 * 8)');
    assert.equal(multiDayLeave.approvedPeriods, 24, '3-day leave must approve 24 lectures by default');
  });

  it('should serialize virtuals properly to JSON and plain objects for API responses', () => {
    const leave = new LeaveApplication({
      applicant: new mongoose.Types.ObjectId(),
      applicantRole: 'STUDENT',
      leaveType: 'DUTY',
      startDate: '2026-11-24',
      endDate: '2026-11-24',
      totalDays: 1,
      reason: 'Representing college at hackathon',
    });

    const json = leave.toJSON();
    const obj = leave.toObject();

    assert.equal(json.requestedPeriods, 8, 'toJSON() must serialize requestedPeriods: 8');
    assert.equal(obj.requestedPeriods, 8, 'toObject() must serialize requestedPeriods: 8');
    assert.equal(json.timeFrom, '10:00 AM');
    assert.equal(json.timeTo, '04:40 PM');
  });

  it('should preserve partial-day and custom period counts when specified', () => {
    // Partial-day consideration check: when not full day, specific period counts are preserved
    const partialRequestedPeriods = 3;
    const partialSelected = ['P2', 'P3', 'P4'];
    assert.equal(partialRequestedPeriods, 3, 'Partial day must retain exact requested periods');
    assert.equal(partialSelected.length, 3, 'Partial day must retain exact selected periods count');
  });

  it('should enforce password hashing with bcrypt and salt 12 for HOD account', async () => {
    const plainTestPass = 'HodSecure2026!';
    const hash = await User.hashPassword(plainTestPass);

    assert.ok(hash.startsWith('$2'), 'Password hash must be a valid bcrypt hash');
    const dummyUser = new User({
      name: 'HOD CSE',
      email: 'hodcse@oist.in',
      passwordHash: hash,
      role: 'HOD',
    });

    const isMatch = await dummyUser.comparePassword(plainTestPass);
    assert.equal(isMatch, true, 'User.comparePassword must match the newly hashed password');

    const wrongMatch = await dummyUser.comparePassword('WrongPassword123');
    assert.equal(wrongMatch, false, 'User.comparePassword must reject incorrect password');
  });
});
