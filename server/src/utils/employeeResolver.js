const mongoose = require('mongoose');
const Employee = require('../models/Employee');

const STAFF_ROLES = ['developer', 'designer', 'marketing', 'manager', 'admin', 'owner', 'director', 'hr'];

const ROLE_DEFAULTS = {
  developer: { department: 'Engineering', designation: 'Software Developer' },
  designer: { department: 'Design', designation: 'UI/UX Designer' },
  marketing: { department: 'Marketing', designation: 'Marketing Executive' },
  manager: { department: 'Operations', designation: 'Manager' },
  admin: { department: 'Administration', designation: 'System Administrator' },
  owner: { department: 'Executive', designation: 'Managing Director' },
  director: { department: 'Executive', designation: 'Director' },
  hr: { department: 'Human Resources', designation: 'HR Officer' },
};

async function nextEmployeeNo() {
  const count = await Employee.countDocuments();
  return `EMP${String(count + 1).padStart(5, '0')}`;
}

function normalizeUserId(userId) {
  if (!userId) return null;
  try {
    return mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(String(userId)) : null;
  } catch {
    return null;
  }
}

/**
 * Resolve Employee for an authenticated User. Auto-provisions a minimal profile
 * for portal staff roles when missing (fixes "Employee record not found").
 */
async function resolveEmployeeForUser(user, { autoCreate = true, populate } = {}) {
  if (!user?._id) return null;

  const userId = normalizeUserId(user._id);
  if (!userId) return null;

  const query = Employee.findOne({ userId });
  if (populate) query.populate(populate);
  let employee = await query;

  if (employee) return employee;

  const role = String(user.role || '').toLowerCase();
  if (!autoCreate || !STAFF_ROLES.includes(role)) {
    console.warn(`[employee-resolver] No Employee for ${user.email} (role=${role})`);
    return null;
  }

  const defaults = ROLE_DEFAULTS[role] || { department: 'General', designation: role };
  try {
    employee = await Employee.create({
      userId,
      employeeNo: await nextEmployeeNo(),
      department: defaults.department,
      designation: defaults.designation,
      basicSalary: 0,
      allowances: 0,
      joinedDate: new Date(),
      status: 'active',
      gender: 'male',
    });
    console.log(`[employee-resolver] Auto-provisioned ${employee.employeeNo} for ${user.email} (${role})`);
    if (populate) {
      employee = await Employee.findById(employee._id).populate(populate);
    }
    return employee;
  } catch (err) {
    console.error(`[employee-resolver] Create failed for ${user.email}:`, err.message);
    if (err.code === 11000) {
      const retryQuery = Employee.findOne({ userId });
      if (populate) retryQuery.populate(populate);
      return retryQuery;
    }
    throw err;
  }
}

module.exports = { resolveEmployeeForUser, STAFF_ROLES, ROLE_DEFAULTS };
