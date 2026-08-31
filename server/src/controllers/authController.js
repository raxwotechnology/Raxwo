const User = require('../models/User');
const Branch = require('../models/Branch');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getOrCreateReward, awardPoints, handleReferralForNewClient } = require('../services/rewardService');
const { sendMail } = require('../utils/mailer');
const { sendClientWelcomeEmail } = require('../services/welcomeEmail');
const { validateStrongPassword } = require('../utils/passwordValidation');
const { toRelativeUploadUrl } = require('../utils/uploadsPath');
const { resolveEmployeeForUser } = require('../utils/employeeResolver');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });

function serializeUser(user) {
  if (!user) return user;
  const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  if (obj.avatar) obj.avatar = toRelativeUploadUrl(obj.avatar);
  return obj;
}

// @desc    Register user
// @route   POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, referralCode, phone } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });

    // Only admin can create admin/manager accounts
    const allowedRole = ['admin', 'manager'].includes(role) ? (req.user?.role === 'admin' ? role : 'developer') : (role || 'developer');
    const user = await User.create({ name, email, password, role: allowedRole, phone: phone || '' });
    if (allowedRole === 'client') {
      await getOrCreateReward(user._id);
      await awardPoints({
        userId: user._id,
        action: 'register_account',
        sourceKey: `register:${user._id}`,
        note: 'Account registration reward',
      });
      if (referralCode) await handleReferralForNewClient({ newUserId: user._id, referralCode });
      try {
        const mailResult = await sendClientWelcomeEmail(user);
        if (!mailResult.sent) console.warn('[register] welcome email skipped:', mailResult.reason);
        
        if (user.phone) {
          const { sendClientWelcomeSms } = require('../services/smsService');
          await sendClientWelcomeSms(user.phone, user.name, user.email, password || 'User@2026');
        }
      } catch (mailErr) {
        console.warn('[register] welcome email/sms failed:', mailErr.message);
      }
    }
    const token = generateToken(user._id);
    res.status(201).json({ success: true, token, user: serializeUser(user) });
  } catch (err) { next(err); }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Please provide email and password' });

    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.isActive) return res.status(401).json({ success: false, message: 'Account is deactivated' });

    const prevLastLogin = user.lastLogin;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    if (user.role === 'client') {
      await getOrCreateReward(user._id);
      const prev = prevLastLogin ? new Date(prevLastLogin) : null;
      const now = new Date();
      const sameMonth = prev && prev.getMonth() === now.getMonth() && prev.getFullYear() === now.getFullYear();
      if (!sameMonth) {
        await awardPoints({
          userId: user._id,
          action: 'monthly_active_usage',
          sourceKey: `monthly-active:${user._id}:${now.getFullYear()}-${now.getMonth() + 1}`,
          note: 'Monthly active usage reward',
        });
      }
    }

    const token = generateToken(user._id);
    // Ensure staff portal users have a linked Employee record (work logs, exports, requests)
    await resolveEmployeeForUser(user).catch((err) => {
      console.warn(`[auth/login] Employee sync for ${user.email}:`, err.message);
    });
    res.json({ success: true, token, user: serializeUser(user) });
  } catch (err) { next(err); }
};

// @desc    Get current user
// @route   GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const employee = await resolveEmployeeForUser(req.user);
    res.json({
      success: true,
      user: serializeUser(req.user),
      employeeLinked: Boolean(employee),
      employeeId: employee?._id || null,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update profile
// @route   PUT /api/auth/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar } = req.body;
    const updates = {};
    if (name != null) updates.name = name;
    if (phone != null) updates.phone = phone;
    if (Object.prototype.hasOwnProperty.call(req.body, 'avatar')) {
      updates.avatar = avatar != null && String(avatar).trim() !== ''
        ? toRelativeUploadUrl(avatar)
        : '';
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true },
    );
    res.json({ success: true, user: serializeUser(user) });
  } catch (err) { next(err); }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    const strengthErr = validateStrongPassword(newPassword);
    if (strengthErr) return res.status(400).json({ success: false, message: strengthErr });

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'No password is set on this account. Use Forgot Password to create one.',
      });
    }

    let currentMatches = false;
    try {
      currentMatches = await user.matchPassword(currentPassword);
    } catch {
      return res.status(400).json({ success: false, message: 'Could not verify your current password' });
    }
    if (!currentMatches) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    let sameAsCurrent = false;
    try {
      sameAsCurrent = await user.matchPassword(newPassword);
    } catch { /* ignore */ }
    if (sameAsCurrent) {
      return res.status(400).json({ success: false, message: 'New password must be different from your current password' });
    }

    user.password = newPassword;
    await user.save();

    try {
      await sendMail({
        to: user.email,
        subject: 'Your Raxwo password was changed',
        html: `<p>Hi ${user.name},</p><p>Your account password was changed successfully. If you did not make this change, contact support immediately.</p>`,
        text: `Hi ${user.name}, your Raxwo account password was changed. If this was not you, contact support.`,
      });
    } catch (mailErr) {
      console.warn('[changePassword] email notification failed:', mailErr.message);
    }

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) { next(err); }
};

// @desc    Admin sets a client login password
// @route   PUT /api/auth/users/:id/password
exports.adminSetUserPassword = async (req, res, next) => {
  try {
    const newPassword = String(req.body.newPassword || '');
    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'New password is required' });
    }
    const strengthErr = validateStrongPassword(newPassword);
    if (strengthErr) return res.status(400).json({ success: false, message: strengthErr });

    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'client') {
      return res.status(403).json({ success: false, message: 'Only client account passwords can be updated here' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Client password updated' });
  } catch (err) { next(err); }
};

// @desc    Get all users (admin)
// @route   GET /api/auth/users
exports.getAllUsers = async (req, res, next) => {
  try {
    const { branch } = req.query;
    const query = branch ? { branch } : {};
    const users = await User.find(query).sort({ createdAt: -1 }).populate('branch', 'name').lean();
    res.json({ success: true, count: users.length, users });
  } catch (err) { next(err); }
};

// @desc    Toggle user status (admin)
// @route   PUT /api/auth/users/:id/toggle
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, user, message: `User ${user.isActive ? 'activated' : 'deactivated'}` });
  } catch (err) { next(err); }
};

// @desc    Update user profile (admin/manager)
// @route   PUT /api/auth/users/:id
exports.updateUserByAdmin = async (req, res, next) => {
  try {
    const userBefore = await User.findById(req.params.id);
    if (!userBefore) return res.status(404).json({ success: false, message: 'User not found' });

    const { name, email, phone, isActive, role, branch, referralCode } = req.body;
    const payload = {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(branch !== undefined ? { branch: branch || null } : {}),
    };
    const user = await User.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });

    if (referralCode !== undefined && user.role === 'client') {
      const Reward = require('../models/Reward');
      const { getOrCreateReward } = require('../services/rewardService');
      const code = String(referralCode || '').trim().toUpperCase();
      if (code) {
        const existing = await Reward.findOne({ referralCode: code, userId: { $ne: user._id } });
        if (existing) {
          return res.status(400).json({ success: false, message: 'Referral code already in use' });
        }
        await Reward.findOneAndUpdate(
          { userId: user._id },
          { referralCode: code },
          { upsert: true, new: true },
        );
      } else {
        await getOrCreateReward(user._id);
      }
    }

    const { createAuditLog } = require('./auditController');
    await createAuditLog({
      user: req.user, action: 'update', module: user.role === 'client' ? 'clients' : 'employees', entityId: user._id, entityName: user.name,
      description: `Updated profile for ${user.name}`,
      changes: { before: userBefore.toObject(), after: user.toObject() }
    });

    res.json({ success: true, user });
  } catch (err) { next(err); }
};

// @desc    Delete user (admin) — used from Clients screen for client accounts
// @route   DELETE /api/auth/users/:id
exports.deleteUserByAdmin = async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Administrator accounts cannot be deleted here' });
    }
    // Clients page only intends to remove client logins; block staff deletes unless needed later
    if (user.role !== 'client') {
      return res.status(403).json({ success: false, message: 'Only client accounts can be deleted from this endpoint' });
    }
    await user.deleteOne();

    const { createAuditLog } = require('./auditController');
    await createAuditLog({
      user: req.user, action: 'delete', module: 'clients', entityId: user._id, entityName: user.name,
      description: `Deleted client account ${user.name}`,
      changes: { after: user.toObject() }
    });

    res.json({ success: true, message: 'User deleted' });
  } catch (err) { next(err); }
};

// @desc    Create client account (admin)
// @route   POST /api/auth/clients
exports.createClient = async (req, res, next) => {
  try {
    const { name, email, phone, password, referralCode, branch } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });
    const user = await User.create({
      name,
      email,
      phone: phone || '',
      password: password || 'Client@2026',
      role: 'client',
      branch: branch || null,
    });
    const { getOrCreateReward, handleReferralForNewClient, awardPoints } = require('../services/rewardService');
    await getOrCreateReward(user._id);
    await awardPoints({
      userId: user._id,
      action: 'register_account',
      sourceKey: `register:${user._id}`,
      note: 'Account registration reward',
    });
    if (referralCode) await handleReferralForNewClient({ newUserId: user._id, referralCode });

    try {
      const { sendClientWelcomeEmail } = require('../services/emailService');
      await sendClientWelcomeEmail(user, password || 'Client@2026');
      
      if (user.phone) {
        const { sendClientWelcomeSms } = require('../services/smsService');
        await sendClientWelcomeSms(user.phone, user.name, user.email, password || 'Client@2026');
      }
    } catch (msgErr) {
      console.warn('[createClient] Welcome notifications failed:', msgErr.message);
    }

    const { createAuditLog } = require('./auditController');
    await createAuditLog({
      user: req.user, action: 'create', module: 'clients', entityId: user._id, entityName: user.name,
      description: `Created new client account for ${user.name}`,
      changes: { after: user.toObject() }
    });

    res.status(201).json({ success: true, user });
  } catch (err) { next(err); }
};
// @desc    Reset password using email + token from reset link
// @route   POST /api/auth/reset-password
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, token, password } = req.body;
    if (!email || !token || !password) {
      return res.status(400).json({ success: false, message: 'Email, token, and new password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const hashedToken = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+password +resetPasswordToken +resetPasswordExpire');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully. You can sign in now.' });
  } catch (err) { next(err); }
};

// @desc    Forgot password — send OTP to email (works for all roles)
// @route   POST /api/auth/forgot-password/otp
exports.sendForgotPasswordOtp = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email }).select('+otpCode +otpExpire');
    const genericMsg = 'If that email is registered, a verification code has been sent.';

    if (!user || !user.isActive) {
      return res.json({ success: true, message: genericMsg });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.otpCode = crypto.createHash('sha256').update(otp).digest('hex');
    user.otpExpire = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    let mailResult = { sent: false, reason: 'not attempted' };
    try {
      mailResult = await sendMail({
        to: user.email,
        subject: 'Raxwo — Password reset verification code',
        html: `<p>Hi ${user.name},</p><p>Your password reset code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${otp}</p><p>This code expires in 15 minutes. If you did not request this, ignore this email.</p>`,
        text: `Your Raxwo password reset code is ${otp}. It expires in 15 minutes.`,
      });
    } catch (mailErr) {
      console.error('[sendForgotPasswordOtp] SMTP error:', mailErr.message);
      mailResult = { sent: false, reason: mailErr.message };
    }

    const payload = { success: true, message: genericMsg };
    if (!mailResult.sent) {
      if (process.env.NODE_ENV !== 'production') {
        payload.devOtp = otp;
      }
      payload.mailNote = mailResult.reason;
    }
    res.json(payload);
  } catch (err) { next(err); }
};

// @desc    Verify OTP before reset
// @route   POST /api/auth/forgot-password/verify-otp
exports.verifyForgotPasswordOtp = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const otp = String(req.body.otp || '').trim();
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and verification code are required' });
    }

    const hashed = crypto.createHash('sha256').update(otp).digest('hex');
    const user = await User.findOne({
      email,
      otpCode: hashed,
      otpExpire: { $gt: Date.now() },
    }).select('+otpCode +otpExpire');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    }

    res.json({ success: true, verified: true, message: 'Code verified. You may set a new password.' });
  } catch (err) { next(err); }
};

// @desc    Reset client password with OTP
// @route   POST /api/auth/forgot-password/reset
exports.resetPasswordWithOtp = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const otp = String(req.body.otp || '').trim();
    const password = req.body.password;
    if (!email || !otp || !password) {
      return res.status(400).json({ success: false, message: 'Email, verification code, and new password are required' });
    }

    const strengthErr = validateStrongPassword(password);
    if (strengthErr) return res.status(400).json({ success: false, message: strengthErr });

    const hashed = crypto.createHash('sha256').update(otp).digest('hex');
    const user = await User.findOne({
      email,
      otpCode: hashed,
      otpExpire: { $gt: Date.now() },
    }).select('+password +otpCode +otpExpire');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    }

    user.password = password;
    user.otpCode = undefined;
    user.otpExpire = undefined;
    await user.save();

    try {
      await sendMail({
        to: user.email,
        subject: 'Your Raxwo password was reset',
        html: `<p>Hi ${user.name},</p><p>Your password was reset successfully. You can sign in with your new password.</p>`,
        text: `Hi ${user.name}, your Raxwo password was reset successfully.`,
      });
    } catch (mailErr) {
      console.warn('[resetPasswordWithOtp] email notification failed:', mailErr.message);
    }

    res.json({ success: true, message: 'Password reset successfully. You can sign in now.' });
  } catch (err) { next(err); }
};

// @desc    Verify password (for sensitive actions like delete)
// @route   POST /api/auth/verify-password
exports.verifyPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'Password required' });
    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }
    res.json({ success: true, message: 'Password verified' });
  } catch (err) { next(err); }
};

// @desc    Create or reset demo staff logins (admin only)
// @route   POST /api/auth/ensure-demo-staff
exports.ensureDemoStaffLogins = async (req, res, next) => {
  try {
    const { ensureStaffLogins, STAFF_SPECS } = require('../services/ensureStaffLogins');
    const resetPassword = req.body?.resetPassword === true;
    await ensureStaffLogins({ resetPassword });
    res.json({
      success: true,
      message: resetPassword ? 'Demo staff passwords reset' : 'Demo staff accounts ensured',
      accounts: STAFF_SPECS.map((s) => ({ role: s.role, email: s.email, password: s.password })),
    });
  } catch (err) { next(err); }
};
