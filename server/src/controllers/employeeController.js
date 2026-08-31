const crypto = require('crypto');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Project = require('../models/Project');
const { createAuditLog } = require('./auditController');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Payroll = require('../models/Payroll');
const Performance = require('../models/Performance');
const { resolveEmployeeForUser } = require('../utils/employeeResolver');
const { sendMail, smtpConfigured } = require('../utils/mailer');
const { sendLoggedMail } = require('../services/emailService');
const { sendSms } = require('../services/smsService');
const { ASSIGNED_STATUSES, INACTIVE_STATUSES } = require('../utils/employeeFilters');
const { isTopManagerOrAdmin } = require('../utils/userPermissions');

function syncEmploymentTypeFromStatus(body) {
  const status = body.status;
  if (status === 'internship') body.employmentType = 'intern';
  else if (status === 'contract') body.employmentType = 'contract';
}

function isValidObjectId(v) {
  return v && mongoose.Types.ObjectId.isValid(v) && String(new mongoose.Types.ObjectId(v)) === String(v);
}

function sanitizeEmployeePayload(payload) {
  delete payload._id;
  delete payload.name;
  delete payload.email;
  delete payload.password;

  ['branch', 'manager'].forEach((key) => {
    if (payload[key] === '' || payload[key] == null) delete payload[key];
    else if (!isValidObjectId(payload[key])) delete payload[key];
  });

  const dateKeys = ['dob', 'resignationDate', 'joinedDate', 'probationEnd'];
  dateKeys.forEach((key) => {
    if (payload[key] === '' || payload[key] == null) delete payload[key];
  });

  if (payload.internship && typeof payload.internship === 'object') {
    ['startDate', 'endDate', 'convertedAt'].forEach((key) => {
      if (payload.internship[key] === '' || payload.internship[key] == null) delete payload.internship[key];
    });
    if (payload.internship.durationWeeks === '' || Number.isNaN(Number(payload.internship.durationWeeks))) {
      delete payload.internship.durationWeeks;
    }
  }

  if (payload.contract && typeof payload.contract === 'object') {
    ['startDate', 'endDate', 'renewalDate'].forEach((key) => {
      if (payload.contract[key] === '' || payload.contract[key] == null) delete payload.contract[key];
    });
  }

  return payload;
}

function applyResignationFields(body) {
  if (body.status === 'resigned') {
    if (!body.resignationDate) body.resignationDate = new Date();
  } else if (body.status && body.status !== 'resigned') {
    body.resignationDate = body.resignationDate === null ? null : undefined;
    if (body.clearResignation) {
      body.resignationDate = null;
      body.resignationReason = '';
    }
  }
  delete body.clearResignation;
}

// @desc    Get all employees
// @route   GET /api/employees
exports.getEmployees = async (req, res, next) => {
  try {
    const { department, status, search, branch, employmentType, includeFormer, assignable, manager } = req.query;
    let query = {};
    if (department) query.department = department;
    if (branch) query.branch = branch;
    if (employmentType) query.employmentType = employmentType;
    if (manager) query.manager = manager;
    if (status) query.status = status;
    else if (assignable === '1' || assignable === 'true') {
      query.status = { $in: ASSIGNED_STATUSES };
    } else if (!includeFormer) {
      query.status = { $nin: INACTIVE_STATUSES };
    }

    // If logged-in user is a PM or Team Leader (not Admin and not Rashin Sheran), restrict list to interns under them
    if (req.user && !isTopManagerOrAdmin(req.user)) {
      query.manager = req.user._id;
      query.employmentType = 'intern';
    }

    let employees = await Employee.find(query)
      .populate('userId', 'name email phone avatar role')
      .populate('manager', 'name email avatar role')
      .sort({ createdAt: -1 });

    if (search) {
      const s = search.toLowerCase();
      employees = employees.filter(e =>
        e.userId?.name?.toLowerCase().includes(s) ||
        e.employeeNo?.toLowerCase().includes(s) ||
        e.department?.toLowerCase().includes(s) ||
        e.designation?.toLowerCase().includes(s)
      );
    }

    employees = employees.filter((e) => e.userId);
    const seenUsers = new Set();
    employees = employees.filter((e) => {
      const uid = String(e.userId?._id || e.userId);
      if (seenUsers.has(uid)) return false;
      seenUsers.add(uid);
      return true;
    });

    res.json({ success: true, count: employees.length, employees });
  } catch (err) { next(err); }
};

// @desc    Get active employees for public team page
// @route   GET /api/employees/public-team
exports.getPublicOurTeam = async (req, res, next) => {
  try {
    let employees = await Employee.find({
      status: { $in: ASSIGNED_STATUSES },
    })
      .populate('userId', 'name email avatar role isActive')
      .populate('manager', 'name email avatar role')
      .sort({ createdAt: -1 });

    employees = employees.filter((e) => e.userId && e.userId.isActive !== false);

    const seenUsers = new Set();
    employees = employees.filter((e) => {
      const uid = String(e.userId?._id || e.userId);
      if (seenUsers.has(uid)) return false;
      seenUsers.add(uid);
      return true;
    });

    res.json({ success: true, count: employees.length, employees });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single employee
// @route   GET /api/employees/:id
exports.getEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('userId', 'name email phone avatar role')
      .populate('manager', 'name email');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, employee });
  } catch (err) { next(err); }
};

// @desc    Get my employee profile
// @route   GET /api/employees/me
exports.getMyProfile = async (req, res, next) => {
  try {
    const employee = await resolveEmployeeForUser(req.user);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found' });
    const populated = await Employee.findById(employee._id)
      .populate('userId', 'name email phone avatar role')
      .populate('manager', 'name email');
    res.json({ success: true, employee: populated });
  } catch (err) { next(err); }
};

// @desc    Create employee
// @route   POST /api/employees
exports.createEmployee = async (req, res, next) => {
  try {
    const {
      name, email, password, role, department, designation, basicSalary, allowances, joinedDate,
      idType, idNumber, nic, dob, gender, address, primaryPhone, secondaryPhone, cvUrl,
      emergencyContact, bank, bankBranch, accountNumber, accountHolder, accountType, skills, manager,
      // file upload fields
      profilePhoto, nicPhotoUrl, nicPhotoBackUrl, agreementUrl,
      // employment extras
      employmentType, branch, epfNumber, etfNumber,
      portfolioUrl, secondaryAddress, permanentAddress, currentAddress,
      internship, contract, epfEtfEnrolled, status: statusBody,
      resignationDate, resignationReason,
    } = req.body;

    if (!department?.trim()) {
      return res.status(400).json({ success: false, message: 'Department is required' });
    }
    if (!designation?.trim()) {
      return res.status(400).json({ success: false, message: 'Designation is required' });
    }
    if (!joinedDate) {
      return res.status(400).json({ success: false, message: 'Join date is required' });
    }

    // Create user account
    let user = await User.findOne({ email });
    if (!user) {
      const requestedRole = role || 'developer';
      const allowedRoles = ['developer', 'designer', 'marketing', 'manager', 'admin'];
      let safeRole = allowedRoles.includes(requestedRole) ? requestedRole : 'developer';
      if (safeRole === 'admin' && req.user.role !== 'admin') safeRole = 'developer';
      user = await User.create({ name, email, password: password || 'Raxwo@2026', role: safeRole });
    } else if (role && req.user.role === 'admin') {
      // Admin can update an existing user's role when creating the employee profile
      await User.findByIdAndUpdate(user._id, { role, ...(name ? { name } : {}) });
      user = await User.findById(user._id);
    } else if (name && user.name !== name) {
      // Ensure correct employee name mapping (fixes "Admin User" showing due to reused accounts)
      user.name = name;
      await user.save({ validateBeforeSave: false });
    }

    const existingProfile = await Employee.findOne({ userId: user._id });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: `This email already has an employee profile (${existingProfile.employeeNo})`,
      });
    }

    const employeeCount = await Employee.countDocuments();
    const employeeNo = `EMP${String(employeeCount + 1).padStart(4, '0')}`;

    const status = statusBody || (employmentType === 'intern' ? 'internship' : employmentType === 'contract' ? 'contract' : 'active');
    const createPayload = {
      userId: user._id, employeeNo, department, designation,
      basicSalary: Number(basicSalary) || 0, allowances: Number(allowances) || 0,
      joinedDate,
      status,
      idType: idType || 'nic',
      idNumber: idNumber || nic || '',
      nic: nic || idNumber || '',
      dob,
      gender,
      address,
      primaryPhone: primaryPhone || '',
      secondaryPhone: secondaryPhone || '',
      cvUrl: cvUrl || '',
      emergencyContact: emergencyContact || undefined,
      bank,
      bankBranch,
      accountNumber,
      accountHolder,
      accountType,
      skills: skills ? skills.split(',').map(s => s.trim()) : [],
      manager,
      // uploaded file URLs
      ...(profilePhoto   && { profilePhoto }),
      ...(nicPhotoUrl    && { nicPhotoUrl }),
      ...(nicPhotoBackUrl && { nicPhotoBackUrl }),
      ...(agreementUrl   && { agreementUrl }),
      // employment extras
      ...(employmentType  && { employmentType }),
      ...(branch          && { branch }),
      ...(epfNumber       && { epfNumber }),
      ...(etfNumber       && { etfNumber }),
      ...(portfolioUrl    && { portfolioUrl }),
      ...(permanentAddress && { permanentAddress }),
      ...(currentAddress  && { currentAddress }),
      ...(internship      && { internship }),
      ...(contract        && { contract }),
      epfEtfEnrolled: !!epfEtfEnrolled,
    };
    if (status === 'resigned') {
      createPayload.resignationDate = resignationDate ? new Date(resignationDate) : new Date();
      createPayload.resignationReason = resignationReason || '';
    }
    const employee = await Employee.create(createPayload);

    const populated = await employee.populate('userId', 'name email phone avatar role');
    await createAuditLog({
      user: req.user, action: 'create', module: 'employees', entityId: employee._id, entityName: name,
      description: `Created new employee profile for ${name} (${employeeNo})`,
      changes: { after: employee.toObject() }
    });

    // Send welcome email and SMS to new employee
    try {
      const loginPassword = password || 'Raxwo@2026';
      const loginUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '') + '/login';
      await sendLoggedMail({
        to: email,
        subject: 'Welcome to Raxwo ERP — Your Account Details',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#1e40af">Welcome to Raxwo ERP, ${name}! 🎉</h2>
            <p>Your employee account has been created. Here are your login credentials:</p>
            <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0">
              <p><strong>Portal:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Password:</strong> ${loginPassword}</p>
              <p><strong>Employee No:</strong> ${employeeNo}</p>
            </div>
            <p style="color:#ef4444">Please change your password after your first login.</p>
            <p>— Raxwo Team</p>
          </div>`,
        text: `Welcome to Raxwo ERP, ${name}! Login: ${loginUrl} | Email: ${email} | Password: ${loginPassword} | Employee No: ${employeeNo}`,
        category: 'hr'
      });

      if (primaryPhone) {
        await sendSms(
          primaryPhone,
          `Welcome to Raxwo ERP, ${name}!\nYour employee account is ready.\n\nLogin: ${loginUrl}\nEmail: ${email}\nPassword: ${loginPassword}\nEmp No: ${employeeNo}\n\nPlease change your password upon login.`,
          name,
          'hr'
        );
      }
    } catch (notifErr) {
      console.warn('[createEmployee] Welcome notifications failed:', notifErr.message);
    }

    res.status(201).json({ success: true, employee: populated });
  } catch (err) { next(err); }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
exports.updateEmployee = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Capture name & email BEFORE sanitizeEmployeePayload deletes it
    const nameUpdate = typeof req.body.name === 'string' ? req.body.name.trim() : null;
    const emailUpdate = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : null;

    const payload = sanitizeEmployeePayload({ ...req.body });
    delete payload.maxLeavesPerYear;

    if (payload.status === 'resigned' && !payload.resignationDate) {
      payload.resignationDate = new Date();
    }
    syncEmploymentTypeFromStatus(payload);
    applyResignationFields(payload);

    const employeeBefore = await Employee.findById(req.params.id);
    if (!employeeBefore) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Update name on linked User if provided
    if (nameUpdate) {
      await User.findByIdAndUpdate(employeeBefore.userId, { name: nameUpdate });
    }

    // Update email on linked User if provided
    if (emailUpdate) {
      const existingUser = await User.findOne({ email: emailUpdate, _id: { $ne: employeeBefore.userId } });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email address is already in use by another account' });
      }
      await User.findByIdAndUpdate(employeeBefore.userId, { email: emailUpdate });
    }

    // Update role on linked user if provided (admin/manager only)
    if (payload.role) {
      await User.findByIdAndUpdate(employeeBefore.userId, { role: payload.role });
      delete payload.role;
    }

    if ('profilePhoto' in payload) {
      const photo = String(payload.profilePhoto || '').trim();
      payload.profilePhoto = photo;
      await User.findByIdAndUpdate(employeeBefore.userId, { avatar: photo });
    }
    const employee = await Employee.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true })
      .populate('userId', 'name email phone avatar role');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const empName = employee.userId?.name || employee.employeeNo;
    await createAuditLog({
      user: req.user, action: 'update', module: 'employees', entityId: employee._id, entityName: empName,
      description: `Updated employee profile for ${empName} (${employee.employeeNo})`,
      changes: { before: employeeBefore.toObject(), after: employee.toObject() }
    });

    res.json({ success: true, employee });
  } catch (err) { next(err); }
};

// @desc    Hard delete employee — permanently removes Employee + linked User from DB
// @route   DELETE /api/employees/:id
exports.deleteEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id).populate('userId', 'name email role');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const empName = employee.userId?.name || employee.employeeNo;
    const empNo = employee.employeeNo;
    
    // Resolve user ID robustly whether populated or not
    let linkedUserId = null;
    let linkedUserRole = '';
    
    if (employee.userId) {
      if (employee.userId._id) {
        linkedUserId = employee.userId._id;
        linkedUserRole = employee.userId.role;
      } else {
        linkedUserId = employee.userId;
      }
    }

    // 1. Hard-delete the employee profile
    await Employee.findByIdAndDelete(req.params.id);

    // 2. Hard-delete the linked user account (unless they are an admin or client)
    if (linkedUserId) {
      if (linkedUserRole === 'admin') {
        console.warn(`[deleteEmployee] Skipped deleting user ${linkedUserId} — cannot delete admin users.`);
      } else if (linkedUserRole === 'client') {
        console.warn(`[deleteEmployee] Skipped deleting user ${linkedUserId} — role is 'client'.`);
      } else {
        await User.findByIdAndDelete(linkedUserId);
      }
      
      try {
        // Clean up references to the deleted user
        await mongoose.model('Project').updateMany(
          { assignedEmployees: linkedUserId },
          { $pull: { assignedEmployees: linkedUserId } }
        );
        // Also remove from task assignments within projects if any
        await mongoose.model('Project').updateMany(
          { 'tasks.assignedTo': linkedUserId },
          { $set: { 'tasks.$[elem].assignedTo': null } },
          { arrayFilters: [{ 'elem.assignedTo': linkedUserId }] }
        );
      } catch (cleanupErr) {
        console.warn('[deleteEmployee] Cleanup of projects failed:', cleanupErr.message);
      }
    }

    try {
      await createAuditLog({
        user: req.user, action: 'delete', module: 'employees', entityId: employee._id, entityName: empName,
        description: `Permanently deleted employee ${empName} (${empNo}) and their user account`,
        changes: { before: employee.toObject() }
      });
    } catch (auditErr) {
      console.warn('Audit log creation failed, continuing with delete success response', auditErr);
    }

    res.json({ success: true, message: `Employee ${empName} permanently deleted from the system.` });
  } catch (err) { next(err); }
};


// @desc    Convert intern to permanent employee
// @route   PUT /api/employees/:id/convert-intern
exports.convertIntern = async (req, res, next) => {
  try {
    const { newStartDate } = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    if (employee.employmentType !== 'intern') {
      return res.status(400).json({ success: false, message: 'Employee is not an intern' });
    }
    const updated = await Employee.findByIdAndUpdate(
      req.params.id,
      {
        employmentType: 'permanent',
        status: 'active',
        joinedDate: newStartDate ? new Date(newStartDate) : new Date(),
        'internship.convertedAt': new Date(),
        'internship.convertedBy': req.user._id,
        $push: {
          historyLog: {
            action: 'converted_to_permanent',
            note: `Converted from intern to permanent on ${new Date().toLocaleDateString()}`,
            performedBy: req.user._id,
            date: new Date(),
          },
        },
      },
      { new: true }
    ).populate('userId', 'name email role');
    res.json({ success: true, employee: updated, message: 'Intern converted to permanent employee' });
  } catch (err) { next(err); }
};

// @desc    Remove intern (soft delete — data retained)
// @route   PUT /api/employees/:id/remove-intern
exports.removeIntern = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    if (employee.employmentType !== 'intern') {
      return res.status(400).json({ success: false, message: 'Employee is not an intern' });
    }
    const updated = await Employee.findByIdAndUpdate(
      req.params.id,
      {
        status: 'intern_ended',
        'internship.removalReason': req.body.reason || 'Internship ended',
        $push: {
          historyLog: {
            action: 'intern_removed',
            note: req.body.reason || 'Internship period ended',
            performedBy: req.user._id,
            date: new Date(),
          },
        },
      },
      { new: true }
    );
    res.json({ success: true, employee: updated, message: 'Intern removed. All attendance, payroll, and project data retained.' });
  } catch (err) { next(err); }
};

// @desc    Get department stats
// @route   GET /api/employees/stats
exports.getStats = async (req, res, next) => {
  try {
    const total = await Employee.countDocuments();
    const active = await Employee.countDocuments({ status: { $in: ASSIGNED_STATUSES } });
    const byDept = await Employee.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json({ success: true, stats: { total, active, byDept } });
  } catch (err) { next(err); }
};

// @desc    Get employee activity overview (admin/manager)
// @route   GET /api/employees/:id/activity
exports.getEmployeeActivity = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id).populate('userId', 'name email role');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const userId = employee.userId?._id;

    const projects = await Project.find({ assignedEmployees: userId })
      .select('title status progress deadline startDate tasks client projectManager')
      .populate('client', 'name email')
      .populate('projectManager', 'name email')
      .populate('tasks.assignedTo', 'name email')
      .sort({ updatedAt: -1 })
      .limit(50);

    const tasks = projects.flatMap((p) => (p.tasks || []).map((t) => ({ ...t.toObject(), projectId: p._id, projectTitle: p.title })));
    const myTasks = tasks.filter((t) => String(t.assignedTo?._id || t.assignedTo) === String(userId));
    const tasksCompleted = myTasks.filter((t) => t.status === 'done').length;
    const tasksPending = myTasks.filter((t) => t.status !== 'done').length;

    const attendance30dStart = new Date();
    attendance30dStart.setDate(attendance30dStart.getDate() - 30);

    const attendance = await Attendance.find({ employee: employee._id, date: { $gte: attendance30dStart } })
      .sort({ date: -1 })
      .limit(120);

    const attendanceSummary = attendance.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    const leaves = await Leave.find({ employee: employee._id }).sort({ createdAt: -1 }).limit(50);
    const leaveSummary = leaves.reduce((acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});

    const payrolls = await Payroll.find({ employee: employee._id }).sort({ year: -1, month: -1 }).limit(12);

    const performance = userId
      ? await Performance.find({ developer: userId }).populate('project', 'title status').sort({ year: -1, month: -1 }).limit(12)
      : [];

    res.json({
      success: true,
      employee,
      overview: {
        projectsCount: projects.length,
        tasksCompleted,
        tasksPending,
        attendance30d: attendanceSummary,
        leaves: leaveSummary,
        lastPayroll: payrolls[0] || null,
        performanceLatest: performance[0] || null,
      },
      projects,
      tasks: myTasks.slice(0, 200),
      attendance,
      leaves,
      payrolls,
      performance,
    });
  } catch (err) { next(err); }
};

// @desc  Admin sets employee login password (hashed via User pre-save)
// @route PUT /api/employees/:id/password
exports.adminSetEmployeePassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    const user = await User.findById(employee.userId).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User account not found' });
    user.password = newPassword;
    await user.save();
    await createAuditLog({
      user: req.user, action: 'update', module: 'employees', entityId: employee._id,
      description: `Password changed for ${employee.employeeNo}`,
    });
    res.json({ success: true, message: 'Password updated' });
  } catch (err) { next(err); }
};

// @desc  Admin resets password to a new random value (returned once in response)
// @route POST /api/employees/:id/reset-password
exports.adminResetEmployeePassword = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id).populate('userId', 'name email');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    const user = await User.findById(employee.userId).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User account not found' });
    const tempPassword = `Raxwo@${crypto.randomBytes(4).toString('hex')}`;
    user.password = tempPassword;
    await user.save();
    await createAuditLog({
      user: req.user, action: 'update', module: 'employees', entityId: employee._id,
      description: `Password reset for ${employee.employeeNo}`,
    });
    res.json({
      success: true,
      message: 'Password reset',
      tempPassword,
      email: user.email,
    });
  } catch (err) { next(err); }
};

// @desc  Send password reset email (token link) when SMTP is configured
// @route POST /api/employees/:id/send-password-reset
exports.adminSendPasswordResetEmail = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id).populate('userId', 'name email');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    const user = await User.findById(employee.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User account not found' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const clientBase = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    const resetUrl = `${clientBase}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    const html = `
      <p>Hello ${user.name},</p>
      <p>An administrator requested a password reset for your Raxwo account.</p>
      <p><a href="${resetUrl}">Reset your password</a> (link expires in 1 hour).</p>
      <p>If you did not request this, contact your administrator.</p>
    `;

    const mailResult = await sendMail({
      to: user.email,
      subject: 'Raxwo — Password reset',
      html,
      text: `Reset your password: ${resetUrl}`,
    });

    res.json({
      success: true,
      message: mailResult.sent
        ? `Reset email sent to ${user.email}`
        : 'SMTP not configured — use the reset link below',
      emailSent: mailResult.sent,
      resetUrl: mailResult.sent ? undefined : resetUrl,
      smtpConfigured: smtpConfigured(),
    });
  } catch (err) { next(err); }
};

// @desc    Get summary of all leaders with their assigned members
// @route   GET /api/employees/leaders/summary
exports.getLeadersSummary = async (req, res, next) => {
  try {
    // 1. Fetch all active/internship employees with users
    const allEmployeesRaw = await Employee.find({
      status: { $in: ['active', 'internship', 'contract', 'on_leave'] }
    })
      .populate('userId', 'name email phone avatar role isActive')
      .populate('manager', 'name email avatar role isActive')
      .populate('branch', 'name')
      .sort({ createdAt: -1 });

    // Filter to ensure only employees with active user accounts are included
    const allEmployees = allEmployeesRaw.filter(e => e.userId && e.userId.isActive !== false);
    const activeUserIds = new Set(allEmployees.map(e => String(e.userId._id)));

    // 2. Find all users who are active managers/admins OR are assigned as manager on any active employee
    const assignedManagerIds = await Employee.distinct('manager', {
      manager: { $ne: null },
      status: { $in: ['active', 'internship', 'contract', 'on_leave'] }
    });
    
    const leaderUsers = await User.find({
      $or: [
        { role: { $in: ['manager', 'admin'] } },
        { _id: { $in: assignedManagerIds } }
      ],
      isActive: true,
    }).select('name email avatar role phone isActive').sort({ name: 1 });

    // Group employees by manager id
    const managerMap = {};
    const unassigned = [];

    leaderUsers.forEach((u) => {
      managerMap[String(u._id)] = {
        leader: u,
        members: [],
        internsCount: 0,
        regularCount: 0,
        totalMembers: 0,
      };
    });

    allEmployees.forEach((emp) => {
      const mgrId = emp.manager?._id ? String(emp.manager._id) : (emp.manager ? String(emp.manager) : null);
      if (mgrId) {
        if (!managerMap[mgrId]) {
          // If manager user is active
          if (emp.manager && emp.manager.isActive !== false) {
            managerMap[mgrId] = {
              leader: emp.manager,
              members: [],
              internsCount: 0,
              regularCount: 0,
              totalMembers: 0,
            };
          }
        }
        if (managerMap[mgrId]) {
          managerMap[mgrId].members.push(emp);
          if (emp.employmentType === 'intern') {
            managerMap[mgrId].internsCount += 1;
          } else {
            managerMap[mgrId].regularCount += 1;
          }
          managerMap[mgrId].totalMembers += 1;
        } else {
          unassigned.push(emp);
        }
      } else {
        unassigned.push(emp);
      }
    });

    // 3. Build comprehensive list of all potential leaders (Active Managers + All Active Employees)
    const potentialLeadersMap = new Map();

    // Add admin / manager accounts first
    const adminManagers = await User.find({
      role: { $in: ['admin', 'manager'] },
      isActive: true
    }).select('name email role avatar').sort({ name: 1 });

    adminManagers.forEach(u => {
      potentialLeadersMap.set(String(u._id), {
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        avatar: u.avatar,
        designation: u.role === 'admin' ? 'Administrator' : 'Manager',
        department: 'Management',
        employmentType: 'management',
      });
    });

    // Add active employees as potential leaders
    allEmployees.forEach(emp => {
      if (emp.userId && emp.userId._id && emp.userId.isActive !== false) {
        const uid = String(emp.userId._id);
        potentialLeadersMap.set(uid, {
          _id: emp.userId._id,
          employeeId: emp._id,
          name: emp.userId.name,
          email: emp.userId.email,
          role: emp.userId.role,
          avatar: emp.profilePhoto || emp.userId.avatar,
          designation: emp.designation || 'Staff Member',
          department: emp.department || 'General',
          employmentType: emp.employmentType,
          employeeNo: emp.employeeNo,
        });
      }
    });

    const potentialLeaders = Array.from(potentialLeadersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    
    // Only return leaders who are active and have at least 1 member or have admin/manager role
    const leaders = Object.values(managerMap).filter(l => l.leader && l.leader.isActive !== false);

    res.json({
      success: true,
      leaders,
      potentialLeaders,
      unassigned,
      totalEmployees: allEmployees.length,
      totalUnassigned: unassigned.length,
    });
  } catch (err) { next(err); }
};

// @desc    Assign or unassign a leader/manager for employees
// @route   POST /api/employees/assign-leader
exports.assignLeader = async (req, res, next) => {
  try {
    const { employeeIds, managerId } = req.body;
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide employee IDs' });
    }

    let targetManager = null;
    if (managerId) {
      targetManager = await User.findById(managerId);
      if (!targetManager) {
        return res.status(404).json({ success: false, message: 'Selected leader/manager not found' });
      }
    }

    await Employee.updateMany(
      { _id: { $in: employeeIds } },
      { $set: { manager: managerId || null } }
    );

    await createAuditLog({
      user: req.user,
      action: 'update',
      module: 'employees',
      description: `Assigned leader ${targetManager ? targetManager.name : 'None'} to ${employeeIds.length} employee(s)`,
    });

    res.json({
      success: true,
      message: `Successfully assigned leader to ${employeeIds.length} team member(s)`,
    });
  } catch (err) { next(err); }
};

// @desc    Designate an employee as a Team Leader (updates User role to manager)
// @route   POST /api/employees/designate-leader
exports.designateLeader = async (req, res, next) => {
  try {
    const { userId, role = 'manager' } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'admin' && user.role !== 'manager') {
      user.role = role;
      await user.save();
    }
    await createAuditLog({
      user: req.user,
      action: 'update',
      module: 'employees',
      description: `Designated ${user.name} as a Team Leader (${role})`,
    });
    res.json({ success: true, message: `${user.name} has been designated as a Team Leader` });
  } catch (err) { next(err); }
};

