const User = require('../models/User');
const Employee = require('../models/Employee');

/** Demo staff logins — matches server/src/seed.js (not admin/client). */
const STAFF_SPECS = [
  { role: 'manager', name: 'Rashin Sheran', email: 'manager@raxwo.com', password: 'Manager@2026', department: 'Operations', designation: 'Operations Manager' },
  { role: 'developer', name: 'John Developer', email: 'john@raxwo.com', password: 'Employee@2026', department: 'Engineering', designation: 'Senior Software Engineer' },
  { role: 'developer', name: 'Nimal Silva', email: 'nimal@raxwo.com', password: 'Employee@2026', department: 'Engineering', designation: 'Junior Software Engineer' },
  { role: 'designer', name: 'Alex Designer', email: 'designer@raxwo.com', password: 'Designer@2026', department: 'Design', designation: 'UI/UX Designer' },
  { role: 'marketing', name: 'Maya Marketing', email: 'marketing@raxwo.com', password: 'Marketing@2026', department: 'Marketing', designation: 'Marketing Executive' },
];

async function ensureEmployeeProfile(user, spec) {
  const existing = await Employee.findOne({ userId: user._id });
  if (existing) return existing;
  const count = await Employee.countDocuments();
  return Employee.create({
    userId: user._id,
    employeeNo: `EMP${String(count + 1).padStart(4, '0')}`,
    department: spec.department,
    designation: spec.designation,
    basicSalary: 100000,
    allowances: 10000,
    joinedDate: new Date(),
    status: 'active',
    gender: 'male',
  });
}

async function upsertStaffUser(spec, { resetPassword = false } = {}) {
  const email = spec.email.toLowerCase();
  let user = await User.findOne({ email }).select('+password');
  if (!user) {
    user = await User.create({
      name: spec.name,
      email,
      password: spec.password,
      role: spec.role,
      isActive: true,
    });
    console.log(`[staff-logins] Created ${spec.role}: ${email}`);
  } else {
    let changed = false;
    if (user.name !== spec.name) {
      user.name = spec.name;
      changed = true;
    }
    if (resetPassword) {
      user.password = spec.password;
      user.role = spec.role;
      user.isActive = true;
      changed = true;
      console.log(`[staff-logins] Reset password for ${email} (${spec.role})`);
    } else if (!user.isActive || user.role !== spec.role) {
      user.role = spec.role;
      user.isActive = true;
      changed = true;
      console.log(`[staff-logins] Updated ${email} role/active`);
    }
    if (changed) {
      await user.save({ validateBeforeSave: false });
    }
  }

  // Auto-provision Employee profiles for staff portals (work logs, requests, exports)
  if (user && ['developer', 'designer', 'marketing'].includes(spec.role)) {
    await ensureEmployeeProfile(user, spec);
  }
  return user;
}

/**
 * Ensures demo staff users exist. When resetPassword is true, overwrites passwords (CLI script).
 */
async function ensureStaffLogins({ resetPassword = false } = {}) {
  for (const spec of STAFF_SPECS) {
    await upsertStaffUser(spec, { resetPassword });
  }
}

module.exports = { ensureStaffLogins, STAFF_SPECS, ensureEmployeeProfile };
