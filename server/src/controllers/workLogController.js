const WorkLog = require('../models/WorkLog');
const Employee = require('../models/Employee');
const Project = require('../models/Project');
const User = require('../models/User');
const { createNotification } = require('../services/notificationService');
const emailService = require('../services/emailService');
const { resolveEmployeeForUser } = require('../utils/employeeResolver');
const { sanitizeWorkLogTasks } = require('../utils/workLogSanitize');
const path = require('path');

exports.submitWorkLog = async (req, res, next) => {
  try {
    const { date, tasks, blockers, notes, projectLinks } = req.body;

    const employee = await resolveEmployeeForUser(req.user, { populate: { path: 'userId', select: 'name role' } });
    if (!employee) {
      console.error(`[work-log] Employee missing for user=${req.user.email} role=${req.user.role} id=${req.user._id}`);
      return res.status(404).json({ success: false, message: 'Employee record not found. Please log out and log in again, or contact your admin.' });
    }

    // Parse tasks if sent as string (multipart form)
    let parsedTasks = tasks;
    if (typeof tasks === 'string') {
      try { parsedTasks = JSON.parse(tasks); } catch { parsedTasks = []; }
    }
    parsedTasks = sanitizeWorkLogTasks(parsedTasks);

    if (!parsedTasks.length) {
      return res.status(400).json({ success: false, message: 'At least one task with name and hours is required.' });
    }

    let parsedLinks = projectLinks;
    if (typeof projectLinks === 'string') {
      try { parsedLinks = JSON.parse(projectLinks); } catch { parsedLinks = []; }
    }

    const totalHours = parsedTasks.reduce((acc, task) => acc + Number(task.hours || 0), 0);

    const logDate = date ? new Date(date) : new Date();
    logDate.setHours(0, 0, 0, 0);

    const existingLog = await WorkLog.findOne({
      employee: employee._id,
      date: { $gte: logDate, $lt: new Date(logDate.getTime() + 86400000) }
    });

    if (existingLog) {
      return res.status(400).json({ success: false, message: 'You have already submitted a log for this date.' });
    }

    // Handle uploaded files
    const screenshots = [];
    const attachments = [];
    if (req.files) {
      (req.files.screenshots || []).forEach(f => {
        screenshots.push(`/uploads/worklogs/${f.filename}`);
      });
      (req.files.attachments || []).forEach(f => {
        attachments.push(`/uploads/worklogs/${f.filename}`);
      });
    }

    const workLog = await WorkLog.create({
      employee: employee._id,
      employeeRole: req.user.role,
      branch: employee.branch,
      date: logDate,
      tasks: parsedTasks,
      blockers: blockers || '',
      notes: notes || '',
      totalHours,
      screenshots,
      attachments,
      projectLinks: parsedLinks || [],
      approvalStatus: 'pending',
    });

    // Notify managers (in-app)
    const managers = await User.find({ role: { $in: ['manager', 'admin'] }, isActive: true }).select('email').limit(5);
    for (const mgr of managers.filter((m) => m._id)) {
      await createNotification({
        recipient: mgr._id,
        title: 'New Work Log',
        message: `${req.user.name} submitted a work log for ${logDate.toLocaleDateString('en-LK')}`,
        type: 'system',
        link: '/manager/work-logs',
      }).catch(() => {});
    }

    res.status(201).json({ success: true, workLog });

    const managerEmails = managers.map((m) => m.email).filter(Boolean);
    emailService.sendWorkLogSubmittedEmail(managerEmails, req.user.name, logDate, parsedTasks.length)
      .catch((err) => console.warn('[work-log] notification email failed:', err.message));
  } catch (err) {
    console.error('[work-log] submit failed:', err.message);
    if (err.name === 'ValidationError' || err.message?.includes('Cast to ObjectId')) {
      return res.status(400).json({ success: false, message: 'Invalid task data. Leave project blank if none, and ensure hours are valid.' });
    }
    next(err);
  }
};

exports.getMyWorkLogs = async (req, res, next) => {
  try {
    const employee = await resolveEmployeeForUser(req.user);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee record not found.' });
    }

    const logs = await WorkLog.find({ employee: employee._id })
      .populate('tasks.project', 'title')
      .populate('approvedBy', 'name')
      .sort({ date: -1 });

    res.json({ success: true, count: logs.length, logs });
  } catch (err) { next(err); }
};

exports.getAllWorkLogs = async (req, res, next) => {
  try {
    const { branch, date, role, employee, manager } = req.query;
    const query = {};
    if (branch) query.branch = branch;
    if (role && role !== 'all') query.employeeRole = role;
    if (employee) {
      query.employee = employee;
    } else if (manager) {
      const empIds = await Employee.find({ manager }).select('_id');
      query.employee = { $in: empIds.map(e => e._id) };
    }
    if (date) {
      const d = new Date(date);
      d.setHours(0,0,0,0);
      query.date = { $gte: d, $lt: new Date(d.getTime() + 86400000) };
    }

    const logs = await WorkLog.find(query)
      .populate({ path: 'employee', populate: { path: 'userId', select: 'name email avatar role' } })
      .populate('tasks.project', 'title')
      .populate('approvedBy', 'name')
      .sort({ date: -1 });

    // Calculate submission rate if date is provided
    let submissionRate = 0;
    if (date) {
      const empQuery = { status: 'active' };
      if (branch) empQuery.branch = branch;
      const totalEmployees = await Employee.countDocuments(empQuery);
      submissionRate = totalEmployees > 0 ? Math.round((logs.length / totalEmployees) * 100) : 0;
    }

    res.json({ success: true, count: logs.length, submissionRate, logs });
  } catch (err) { next(err); }
};

exports.addComment = async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment) return res.status(400).json({ success: false, message: 'Comment is required' });

    const workLog = await WorkLog.findById(req.params.id).populate('employee');
    if (!workLog) return res.status(404).json({ success: false, message: 'WorkLog not found' });

    workLog.comments.push({
      user: req.user._id,
      name: req.user.name,
      comment
    });
    await workLog.save();

    if (workLog.employee?.userId) {
      await createNotification({
        recipient: workLog.employee.userId,
        title: 'New Comment on Work Log',
        message: `${req.user.name} commented on your daily work log for ${new Date(workLog.date).toLocaleDateString()}.`,
        type: 'system',
        link: `/${req.user.role === 'admin' ? 'developer' : 'developer'}/work-logs`
      }).catch(() => {});
    }

    res.json({ success: true, workLog });
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const workLog = await WorkLog.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!workLog) return res.status(404).json({ success: false, message: 'WorkLog not found' });
    res.json({ success: true, workLog });
  } catch (err) { next(err); }
};

exports.approveWorkLog = async (req, res, next) => {
  try {
    const { approvalStatus, approvalNote } = req.body;
    if (!['approved', 'rejected'].includes(approvalStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid approval status' });
    }

    const workLog = await WorkLog.findByIdAndUpdate(
      req.params.id,
      {
        approvalStatus,
        approvalNote: approvalNote || '',
        approvedBy: req.user._id,
        approvedAt: new Date(),
        status: approvalStatus === 'approved' ? 'reviewed' : 'flagged',
      },
      { new: true }
    ).populate({ path: 'employee', populate: { path: 'userId', select: 'name' } });

    if (!workLog) return res.status(404).json({ success: false, message: 'WorkLog not found' });

    if (workLog.employee?.userId) {
      const empUser = await User.findById(workLog.employee.userId._id || workLog.employee.userId).select('email name');
      await createNotification({
        recipient: workLog.employee.userId._id || workLog.employee.userId,
        title: `Work Log ${approvalStatus === 'approved' ? 'Approved ✅' : 'Rejected ❌'}`,
        message: `Your work log for ${new Date(workLog.date).toLocaleDateString()} has been ${approvalStatus}${approvalNote ? ': ' + approvalNote : '.'}`,
        type: 'system',
        link: '/developer/work-logs'
      }).catch(() => {});
      // Send email
      if (approvalStatus === 'approved' && empUser?.email) {
        await emailService.sendWorkLogApprovedEmail(empUser.email, empUser.name, workLog.date, approvalNote);
      }
    }

    res.json({ success: true, workLog });
  } catch (err) { next(err); }
};
