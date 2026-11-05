const Request = require('../models/Request');
const Employee = require('../models/Employee');
const { createNotification } = require('../services/notificationService');
const emailService = require('../services/emailService');
const User = require('../models/User');
const { resolveEmployeeForUser } = require('../utils/employeeResolver');

// Submit a new request (employee)
exports.submitRequest = async (req, res, next) => {
  try {
    const { type, subject, description } = req.body;

    const employee = await resolveEmployeeForUser(req.user);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee record not found.' });
    }

    // Handle attachments
    const attachments = (req.files || []).map(f => `/uploads/requests/${f.filename}`);

    const request = await Request.create({
      employee: employee._id,
      employeeRole: req.user.role,
      type: type || 'general',
      subject,
      description: description || '',
      attachments,
      status: 'pending',
      approvalChain: [{ role: 'employee', action: 'approved', approvedBy: req.user._id, approvedAt: new Date(), note: 'Submitted' }],
    });

    // Notify managers via in-app only (no SMS or email)
    const managers = await User.find({ role: 'manager', isActive: true }).select('_id email');
    for (const mgr of managers) {
      await createNotification({
        recipient: mgr._id,
        title: 'New Employee Request',
        message: `${req.user.name} submitted a ${type || 'general'} request: "${subject}"`,
        type: 'system',
        link: '/manager/requests',
        sendSmsNotification: false,
      }).catch(() => {});
    }

    res.status(201).json({ success: true, request });
  } catch (err) { next(err); }
};

// Get my requests (employee)
exports.getMyRequests = async (req, res, next) => {
  try {
    const employee = await resolveEmployeeForUser(req.user);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const requests = await Request.find({ employee: employee._id })
      .populate('approvalChain.approvedBy', 'name role')
      .sort({ createdAt: -1 });

    res.json({ success: true, requests });
  } catch (err) { next(err); }
};

// Get pending/all requests (admin/manager)
exports.getAllRequests = async (req, res, next) => {
  try {
    const { status, role: empRole } = req.query;
    const query = {};

    if (req.user.role === 'manager') {
      // Manager sees pending requests (from employees, not manager-level approval)
      query.status = 'pending';
    } else if (status) {
      query.status = status;
    }

    if (empRole && empRole !== 'all') query.employeeRole = empRole;

    const requests = await Request.find(query)
      .populate({ path: 'employee', populate: { path: 'userId', select: 'name email avatar role' } })
      .populate('approvalChain.approvedBy', 'name role')
      .sort({ createdAt: -1 });

    res.json({ success: true, requests });
  } catch (err) { next(err); }
};

// Get single request
exports.getRequest = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate({ path: 'employee', populate: { path: 'userId', select: 'name email avatar role' } })
      .populate('approvalChain.approvedBy', 'name role');

    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    res.json({ success: true, request });
  } catch (err) { next(err); }
};

// Approve request (manager → moves to admin queue; admin → final approval)
exports.approveRequest = async (req, res, next) => {
  try {
    const { note } = req.body;
    const request = await Request.findById(req.params.id)
      .populate({ path: 'employee', populate: { path: 'userId', select: '_id name' } });

    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    const newStatus = req.user.role === 'manager' ? 'manager_approved' : 'admin_approved';

    request.approvalChain.push({
      role: req.user.role,
      approvedBy: req.user._id,
      approvedAt: new Date(),
      note: note || '',
      action: 'approved',
    });
    request.status = newStatus;
    await request.save();

    // Notify employee via in-app + email
    if (request.employee?.userId) {
      const empUser = await User.findById(request.employee.userId._id || request.employee.userId).select('email name');
      await createNotification({
        recipient: request.employee.userId._id || request.employee.userId,
        title: 'Request Approved ✅',
        message: `Your request "${request.subject}" has been approved by ${req.user.name}.`,
        type: 'system',
        link: `/${request.employeeRole}/requests`,
      }).catch(() => {});
      if (empUser?.email) {
        emailService.sendRequestDecisionEmail(empUser.email, empUser.name, request.subject, newStatus, note)
          .catch((err) => console.warn('[request] decision email failed:', err.message));
      }
    }

    // If manager approved, notify admins
    if (req.user.role === 'manager') {
      const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
      for (const adm of admins) {
        await createNotification({
          recipient: adm._id,
          title: 'Request Needs Final Approval',
          message: `${request.employee?.userId?.name || 'An employee'}'s request "${request.subject}" is awaiting your final approval.`,
          type: 'system',
          link: '/admin/requests',
        }).catch(() => {});
      }
    }

    res.json({ success: true, request });
  } catch (err) { next(err); }
};

// Reject request
exports.rejectRequest = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const request = await Request.findById(req.params.id)
      .populate({ path: 'employee', populate: { path: 'userId', select: '_id name' } });

    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    request.approvalChain.push({
      role: req.user.role,
      approvedBy: req.user._id,
      approvedAt: new Date(),
      note: reason || '',
      action: 'rejected',
    });
    request.status = 'rejected';
    request.rejectionReason = reason || '';
    await request.save();

    if (request.employee?.userId) {
      const empUser = await User.findById(request.employee.userId._id || request.employee.userId).select('email name');
      await createNotification({
        recipient: request.employee.userId._id || request.employee.userId,
        title: 'Request Rejected ❌',
        message: `Your request "${request.subject}" was rejected${reason ? ': ' + reason : '.'}`,
        type: 'system',
        link: `/${request.employeeRole}/requests`,
      }).catch(() => {});
      if (empUser?.email) {
        emailService.sendRequestDecisionEmail(empUser.email, empUser.name, request.subject, 'rejected', reason)
          .catch((err) => console.warn('[request] decision email failed:', err.message));
      }
    }

    res.json({ success: true, request });
  } catch (err) { next(err); }
};
