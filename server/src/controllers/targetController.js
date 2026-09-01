const Target   = require('../models/Target');
const Employee  = require('../models/Employee');
const Payroll   = require('../models/Payroll');
const { createNotification } = require('../services/notificationService');
const { isTopManagerOrAdmin } = require('../utils/userPermissions');

// ── Helper: push bonus into payroll ───────────────────────────────────────────
async function pushBonusToPayroll(target, employee) {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  // Determine bonus amount
  let bonusAmt = target.bonusAmount || 0;
  if (target.bonusPercentage > 0) {
    bonusAmt += (employee.basicSalary || 0) * (target.bonusPercentage / 100);
  }
  if (bonusAmt <= 0) return null;

  // Find or note existing payroll
  const payroll = await Payroll.findOne({ employee: employee._id, month, year });
  if (payroll && payroll.status !== 'paid') {
    payroll.bonus        = (payroll.bonus || 0) + bonusAmt;
    payroll.bonusNote    = payroll.bonusNote ? `${payroll.bonusNote} | Target: ${target.title}` : `Target achieved: ${target.title}`;
    payroll.grossSalary  = (payroll.grossSalary || 0) + bonusAmt;
    payroll.netSalary    = (payroll.netSalary   || 0) + bonusAmt;
    await payroll.save();
    return payroll._id;
  }
  return null;
}

// ── GET /api/targets ───────────────────────────────────────────────────────────
exports.getTargets = async (req, res, next) => {
  try {
    const { employee, manager, type, targetLevel, year, status } = req.query;
    const query = {};
    if (targetLevel) query.targetLevel = targetLevel;
    if (type) query.type = type;
    if (year) query.year = Number(year);
    if (status) query.status = status;

    if (req.user && !isTopManagerOrAdmin(req.user)) {
      const myReports = await Employee.find({ $or: [{ manager: req.user._id }, { userId: req.user._id }] }).select('_id');
      const myReportIds = myReports.map(e => e._id);
      if (employee) {
        if (myReportIds.some(id => String(id) === String(employee))) {
          query.employee = employee;
        } else {
          query.employee = { $in: [] };
        }
      } else {
        query.$or = [
          { employee: { $in: myReportIds } },
          { manager: req.user._id },
          { createdBy: req.user._id }
        ];
      }
    } else {
      if (employee) query.employee = employee;
      if (manager) query.manager = manager;
    }

    const targets = await Target.find(query)
      .populate({ path: 'employee', populate: { path: 'userId', select: 'name email avatar' } })
      .populate('manager', 'name email avatar role')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: targets.length, targets });
  } catch (err) { next(err); }
};

// ── POST /api/targets ──────────────────────────────────────────────────────────
exports.createTarget = async (req, res, next) => {
  try {
    const target = await Target.create({ ...req.body, createdBy: req.user._id });
    const pop = await Target.findById(target._id)
      .populate({ path: 'employee', populate: { path: 'userId', select: 'name email _id' } })
      .populate('manager', 'name email avatar role');

    // Notify employee if individual target
    if (pop.employee?.userId?._id) {
      await createNotification({
        recipient: pop.employee.userId._id,
        title: '🎯 New Target Assigned',
        message: `You have a new ${target.type} target: "${target.title}" — ${target.targetValue} ${target.unit}`,
        type: 'payroll', link: '/developer/performance',
      });
    }

    res.status(201).json({ success: true, target: pop });
  } catch (err) { next(err); }
};

// ── PUT /api/targets/:id ───────────────────────────────────────────────────────
exports.updateTarget = async (req, res, next) => {
  try {
    const { achievedValue, ...rest } = req.body;
    const target = await Target.findById(req.params.id)
      .populate({ path: 'employee', populate: { path: 'userId', select: 'name email _id' } });
    if (!target) return res.status(404).json({ success: false, message: 'Target not found' });

    // Update fields
    Object.assign(target, rest);
    if (achievedValue !== undefined) {
      target.achievedValue = Number(achievedValue);
    }

    // Auto-update status based on progress
    const pct = target.targetValue > 0 ? (target.achievedValue / target.targetValue) * 100 : 0;
    if (pct >= 100) {
      target.status     = 'achieved';
      target.achievedAt = target.achievedAt || new Date();

      // Auto-push bonus to payroll if not already done
      if (target.bonusEnabled && !target.bonusAdded) {
        const employee = await Employee.findById(target.employee._id || target.employee);
        if (employee) {
          const payrollId = await pushBonusToPayroll(target, employee);
          if (payrollId) {
            target.bonusAdded   = true;
            target.bonusPayroll = payrollId;
          }
        }
        // Notify employee
        if (target.employee?.userId?._id) {
          await createNotification({
            recipient: target.employee.userId._id,
            title: '🏆 Target Achieved!',
            message: `Congratulations! You achieved your target "${target.title}". Bonus has been added to your payroll.`,
            type: 'payroll', link: '/developer/performance',
          });
        }
      }
    } else if (pct > 0) {
      target.status = 'partial';
    }

    await target.save();
    res.json({ success: true, target });
  } catch (err) { next(err); }
};

// ── DELETE /api/targets/:id ────────────────────────────────────────────────────
exports.deleteTarget = async (req, res, next) => {
  try {
    await Target.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Target deleted' });
  } catch (err) { next(err); }
};

// ── GET /api/targets/stats ─────────────────────────────────────────────────────
exports.getTargetStats = async (req, res, next) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const [total, achieved, partial, active] = await Promise.all([
      Target.countDocuments({ year }),
      Target.countDocuments({ year, status: 'achieved' }),
      Target.countDocuments({ year, status: 'partial' }),
      Target.countDocuments({ year, status: 'active' }),
    ]);
    res.json({ success: true, stats: { total, achieved, partial, active, missed: total - achieved - partial - active } });
  } catch (err) { next(err); }
};
