const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Overtime = require('../models/Overtime');
const SalaryPayment = require('../models/SalaryPayment');
const Project = require('../models/Project');
const crypto = require('crypto');
const { createNotification } = require('../services/notificationService');
const EpfRecord = require('../models/EpfRecord');
const Loan = require('../models/Loan');
const Advance = require('../models/Advance');
const AuditLog = require('../models/AuditLog');
const { appendBankTransaction, postsToBankLedger } = require('../utils/bankLedger');
const { requiresBankAccount, isChequeMethod, parseLedgerDate } = require('../utils/paymentMethods');
const Cheque = require('../models/Cheque');
const { getStatutoryRates } = require('../utils/statutoryRates');
const { calculateMonthlyIncomeTax } = require('../services/incomeTaxService');
const IncomeTaxRecord = require('../models/IncomeTaxRecord');
const PayrollRecalcLog = require('../models/PayrollRecalcLog');
const PayrollAdjustment = require('../models/PayrollAdjustment');
const {
  syncPayrollForEmployee,
  computePayrollSnapshot,
  triggerPayrollSync,
  monthYearFromDate,
} = require('../services/payrollEngine');
const { attachSyncResult } = require('../utils/payrollSyncHook');
const { resolveEmployeeForUser } = require('../utils/employeeResolver');

// Internal audit logging helper (does not throw)
const createAuditLog = async ({ user, action, module, entityId, entityName, description, severity = 'info' }) => {
  try {
    await AuditLog.create({
      user: user?._id || user,
      userName: user?.name || 'System',
      userRole: user?.role || 'system',
      action, module,
      entityId: entityId ? String(entityId) : '',
      entityName: entityName || '',
      description: description || '',
      severity,
    });
  } catch (_) { /* never crash on audit log failure */ }
};

// EPF/ETF rates — loaded from Site Settings (defaults: 8% / 12% / 3%)
const COMMISSION_RATE = Number(process.env.PAYROLL_COMMISSION_RATE || 0.05);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const monthRange = (month, year) => ({
  start: new Date(Number(year), Number(month) - 1, 1),
  end: new Date(Number(year), Number(month), 0, 23, 59, 59, 999),
});

async function computeAutoCommission(employee, month, year) {
  const userId = employee.userId?._id || employee.userId;
  const { start, end } = monthRange(month, year);
  const completedProjects = await Project.find({
    status: 'completed',
    completedAt: { $gte: start, $lte: end },
    assignedEmployees: userId,
  }).select('title budget assignedEmployees');
  const autoCommission = completedProjects.reduce((sum, project) => {
    const members = Math.max((project.assignedEmployees || []).length, 1);
    const pool = Number(project.budget || 0) * COMMISSION_RATE;
    return sum + (pool / members);
  }, 0);
  return { autoCommission, completedProjects };
}

/** Project salaryAllocations for an employee (commission from project form; amount legacy). */
async function computeProjectAllocations(employee, month, year) {
  const employeeId = employee._id;
  const userId = employee.userId?._id || employee.userId;
  const { end } = monthRange(month, year);
  const projects = await Project.find({
    $or: [
      { assignedEmployees: userId },
      { 'salaryAllocations.employee': employeeId },
    ],
    status: { $in: ['active', 'completed', 'on_hold'] },
    startDate: { $lte: end },
  }).select('title salaryAllocations');

  let projectSalaryAlloc = 0;
  let projectCommissionAlloc = 0;
  const projectLines = [];

  projects.forEach((proj) => {
    const alloc = (proj.salaryAllocations || []).find((a) => String(a.employee) === String(employeeId));
    if (!alloc) return;
    const sal = Number(alloc.amount || 0);
    const comm = Number(alloc.commission || 0);
    projectSalaryAlloc += sal;
    projectCommissionAlloc += comm;
    if (comm > 0) {
      projectLines.push({
        project: proj._id,
        projectName: proj.title,
        amount: comm,
        type: 'commission',
      });
    }
    if (sal > 0) {
      projectLines.push({
        project: proj._id,
        projectName: proj.title,
        amount: sal,
        type: 'salary',
      });
    }
  });

  return { projectSalaryAlloc, projectCommissionAlloc, projectLines };
}

// @desc    Full live payroll snapshot (single source of truth for UI preview)
// @route   GET /api/payroll/live-snapshot/:employeeId
exports.getPayrollLiveSnapshot = async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId;
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (!employeeId || !month || !year) {
      return res.status(400).json({ success: false, message: 'employeeId, month, and year are required' });
    }

    const employee = await Employee.findById(employeeId).populate('userId', 'name email');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const snapshot = await computePayrollSnapshot(employeeId, month, year);
    const taxCalc = snapshot._taxCalc;
    delete snapshot._taxCalc;

    const { projectSalaryAlloc, projectCommissionAlloc, projectLines } = await computeProjectAllocations(employee, month, year);
    const autoCommission = await computeAutoCommission(employee, month, year);

    const activeLoans = await Loan.find({
      employee: employeeId,
      status: 'active',
      $or: [
        { deductionType: 'salary' },
        { deductionType: { $exists: false } },
        { deductionType: null },
        { deductionType: '' },
      ],
      payrollDeductionPaused: { $ne: true },
    }).select('reason monthlyInstallment outstandingBalance installmentsPaid totalInstallments deductionType startDate');

    const activeAdvances = await Advance.find({ employee: employeeId, status: 'active' })
      .select('amount outstandingBalance monthlyDeduction reason');

    const existingPayroll = await Payroll.findOne({ employee: employeeId, month, year })
      .select('status loanDeduction netSalary _id');

    res.json({
      success: true,
      employee: {
        _id: employee._id,
        userId: employee.userId,
        name: employee.userId?.name,
        employeeNo: employee.employeeNo,
        department: employee.department,
        designation: employee.designation,
        basicSalary: employee.basicSalary || 0,
        allowances: employee.allowances || 0,
        epfEtfEnrolled: Boolean(employee.epfEtfEnrolled),
        advanceBalance: employee.advanceBalance || 0,
        loanBalance: employee.loanBalance || 0,
        bank: employee.bank || '',
        bankBranch: employee.bankBranch || '',
        accountNumber: employee.accountNumber || '',
        accountHolder: employee.accountHolder || '',
      },
      period: { month, year },
      snapshot,
      projectPreview: {
        projectSalaryAlloc,
        projectCommissionAlloc,
        autoCommission,
        totalProjectCommissions: projectCommissionAlloc + autoCommission,
        projectLines,
      },
      activeLoans: activeLoans.map((l) => ({
        _id: l._id,
        reason: l.reason,
        monthlyInstallment: l.monthlyInstallment,
        outstandingBalance: l.outstandingBalance,
        installmentsPaid: l.installmentsPaid || 0,
        totalInstallments: l.totalInstallments || 0,
        deductionType: l.deductionType || 'salary',
        startDate: l.startDate,
      })),
      activeAdvances: activeAdvances.map((a) => ({
        _id: a._id,
        amount: a.amount,
        outstandingBalance: a.outstandingBalance,
        monthlyDeduction: a.monthlyDeduction,
        reason: a.reason,
      })),
      incomeTax: {
        taxAmount: snapshot.incomeTaxDeduction || 0,
        monthlyTaxable: taxCalc?.monthlyTaxable,
      },
      existingPayroll,
    });
  } catch (err) {
    console.error('[payroll] live-snapshot failed:', err.message);
    next(err);
  }
};

exports.getEmployeePayrollPreview = async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId || req.query.employeeId;
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (!employeeId || !month || !year) {
      return res.status(400).json({ success: false, message: 'employeeId, month, and year are required' });
    }
    const employee = await Employee.findById(employeeId).populate('userId', 'name email');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const { projectSalaryAlloc, projectCommissionAlloc, projectLines } = await computeProjectAllocations(employee, month, year);
    const { autoCommission } = await computeAutoCommission(employee, month, year);
    const snapshot = await computePayrollSnapshot(employeeId, month, year).catch(() => null);

    res.json({
      success: true,
      preview: {
        projectSalaryAlloc,
        projectCommissionAlloc,
        autoCommission,
        totalProjectCommissions: projectCommissionAlloc + autoCommission,
        projectLines,
        loanDeduction: snapshot?.loanDeduction ?? 0,
        advanceDeduction: snapshot?.advanceDeduction ?? 0,
        leaveDeduction: snapshot?.leaveDeduction ?? 0,
        grossSalary: snapshot?.grossSalary ?? 0,
        netSalary: snapshot?.netSalary ?? 0,
        deductedLoans: snapshot?.deductedLoans ?? [],
      },
    });
  } catch (err) { next(err); }
};

// @desc    Generate monthly payroll
// @route   POST /api/payroll/generate
exports.generatePayroll = async (req, res, next) => {
  try {
    const {
      month, year, employeeId, allowances = 0, overtime = 0, commissions = 0, bonus = 0,
      deductions = 0, notes, empBankDetails,
    } = req.body;

    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    if (empBankDetails) {
      employee.bank = empBankDetails.bank || '';
      employee.bankBranch = empBankDetails.bankBranch || '';
      employee.accountHolder = empBankDetails.accountHolder || '';
      employee.accountNumber = empBankDetails.accountNumber || '';
      await employee.save();
    }

    const exists = await Payroll.findOne({ employee: employeeId, month, year })
      .populate({ path: 'employee', populate: { path: 'userId', select: 'name' } });
    if (exists) {
      console.log('[GENERATE] Existing payroll found. Status:', exists.status, 'ID:', exists._id);
      if (exists.status === 'paid') {
        console.log('[GENERATE] Calling reversePaidPayroll for paid payroll:', exists._id);
        await reversePaidPayroll(exists);
        console.log('[GENERATE] ✅ Reversal complete');
      }
      await Payroll.findByIdAndDelete(exists._id);
      console.log('[GENERATE] Deleted old payroll:', exists._id);
    }

    const sync = await syncPayrollForEmployee(employeeId, month, year, {
      source: 'manual_generate',
      module: 'payroll',
      user: req.user,
      reason: 'Manual payroll generation',
      createIfMissing: true,
      overrides: {
        allowances: Number(allowances),
        overtime: Number(overtime),
        commissions: Number(commissions),
        bonus: Number(bonus),
        deductions: Number(deductions),
        notes,
      },
    });

    const payroll = sync.payroll;
    if (!payroll) {
      return res.status(500).json({ success: false, message: sync.message || 'Payroll sync failed' });
    }

    const { payslipSignatory } = req.body;
    if (payslipSignatory && typeof payslipSignatory === 'object') {
      payroll.payslipSignatory = payslipSignatory;
      await payroll.save();
    }

    await createNotification({
      recipient: payroll.employee?.userId?._id,
      title: 'Payroll Generated',
      message: `Your payroll for ${month}/${year} has been generated (status: ${payroll.status}). Net: LKR ${Number(payroll.netSalary || 0).toLocaleString()}.`,
      type: 'payroll',
      link: '/developer/payslips',
    });

    res.status(201).json(attachSyncResult({ success: true, payroll, breakdown: sync.breakdown }, sync));
  } catch (err) { next(err); }
};

// @desc    Generate payroll for ALL employees
// @route   POST /api/payroll/generate-all
exports.generateAllPayroll = async (req, res, next) => {
  try {
    const { month, year, branch } = req.body;
    const query = { status: 'active' };
    if (branch) query.branch = branch;
    const employees = await Employee.find(query);
    const results = [];
    const errors = [];

    for (const emp of employees) {
      try {
        const sync = await syncPayrollForEmployee(emp._id, month, year, {
          source: 'bulk_generate',
          module: 'payroll',
          user: req.user,
          reason: 'Bulk payroll generation',
          createIfMissing: true,
        });
        if (sync.skipped && sync.reason === 'paid_locked') {
          errors.push({ employeeId: emp._id, message: 'Already paid' });
          continue;
        }
        if (sync.payroll) results.push(sync.payroll);
      } catch (e) {
        errors.push({ employeeId: emp._id, message: e.message });
      }
    }
    
    await createAuditLog({
      user: req.user, action: 'create', module: 'payroll',
      description: `Generated payroll batch for ${results.length} employees (${month}/${year})`,
    });
    res.status(201).json({ success: true, generated: results.length, errors, results });
  } catch (err) { next(err); }
};

// @desc    Get payroll list
// @route   GET /api/payroll
exports.getPayrolls = async (req, res, next) => {
  try {
    const { month, year, employee, status, branch } = req.query;
    let query = {};
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);
    if (status) query.status = status;
    if (employee) {
      query.employee = employee;
    } else if (branch) {
      const emps = await Employee.find({ branch }).select('_id');
      if (emps.length > 0) {
        query.employee = { $in: emps.map(e => e._id) };
      } else {
        query.employee = null; // No employees for this branch
      }
    }

    const payrolls = await Payroll.find(query)
      .populate({ path: 'employee', populate: { path: 'userId', select: 'name email avatar' } })
      .populate('bankAccount', 'bankName accountNumber branchName currentBalance')
      .populate('deductedLoans')
      .sort({ year: -1, month: -1 })
      .lean();
    res.json({ success: true, count: payrolls.length, payrolls });
  } catch (err) { next(err); }
};


// @desc    Get my payslips
// @route   GET /api/payroll/my
exports.getMyPayrolls = async (req, res, next) => {
  try {
    const employee = await resolveEmployeeForUser(req.user);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    const payrolls = await Payroll.find({ employee: employee._id }).populate('deductedLoans').sort({ year: -1, month: -1 });
    res.json({ success: true, payrolls });
  } catch (err) { next(err); }
};

// @desc    Review payroll (draft → reviewed)
// @route   PUT /api/payroll/:id/review
exports.reviewPayroll = async (req, res, next) => {
  try {
    const payroll = await Payroll.findByIdAndUpdate(
      req.params.id,
      { status: 'reviewed', reviewedBy: req.user._id, reviewedAt: new Date() },
      { new: true }
    ).populate({ path: 'employee', populate: { path: 'userId', select: '_id name' } });
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });

    // Notify admins that this payroll is ready to approve
    const User = require('../models/User');
    const admins = await User.find({ role: 'admin' }).select('_id');
    await Promise.all(admins.map(a => createNotification({
      recipient: a._id,
      title: 'Payroll Ready for Approval',
      message: `Payroll for ${payroll.employee?.userId?.name} (${payroll.month}/${payroll.year}) has been reviewed and is awaiting approval.`,
      type: 'payroll',
      link: '/admin/payroll',
    })));

    res.json({ success: true, payroll });
  } catch (err) { next(err); }
};

// @desc    Approve payroll (reviewed → approved)
// @route   PUT /api/payroll/:id/approve
exports.approvePayroll = async (req, res, next) => {
  try {
    const payroll = await Payroll.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', approvedBy: req.user._id, approvedAt: new Date() },
      { new: true }
    ).populate({ path: 'employee', populate: { path: 'userId', select: '_id name' } });
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });

    // Notify employee: payroll approved, payment incoming
    if (payroll.employee?.userId?._id) {
      await createNotification({
        recipient: payroll.employee.userId._id,
        title: 'Payroll Approved 🎉',
        message: `Your payroll for ${payroll.month}/${payroll.year} has been approved. Net salary: LKR ${Number(payroll.netSalary || 0).toLocaleString()}. Payment is being processed.`,
        type: 'payroll',
        link: '/developer/payslips',
      });
    }

    res.json({ success: true, payroll });
  } catch (err) { next(err); }
};

// @desc    Update payroll (draft/reviewed only)
// @route   PUT /api/payroll/:id
exports.updatePayroll = async (req, res, next) => {
  try {
    const existing = await Payroll.findById(req.params.id).populate({ path: 'employee', populate: { path: 'userId', select: 'name' } });
    if (!existing) return res.status(404).json({ success: false, message: 'Payroll not found' });
    
    if (existing.status === 'paid') {
      const newStatus = req.body.status;
      if (newStatus && newStatus !== 'paid') {
        // Rollback triggered by status change from paid -> something else
        await reversePaidPayroll(existing);
        existing.status = newStatus;
        existing.isPaid = false;
        existing.paidAt = null;
        await existing.save();
        await createAuditLog({
          user: req.user,
          action: 'PAYROLL_ROLLBACK',
          module: 'payroll',
          entityId: existing._id,
          entityName: `Payroll ${existing.month}/${existing.year}`,
          description: `Status changed from paid to ${newStatus}. Bank and financials reversed.`,
          severity: 'warning'
        });
        return res.json({ success: true, payroll: existing });
      }
      // status is still 'paid' or not provided — no changes allowed on paid payrolls
      return res.json({ success: true, payroll: existing, message: 'No changes made to paid payroll' });
    }

    const {
      allowances, otHours, otRate, otMultiplier, bonus, bonusNote,
      commissions, advanceDeduction, loanDeduction, notes, paymentMethod,
      bankAccount, chequeNumber,
      otherAdditions, otherDeductions,
    } = req.body;

    const basic = existing.basicSalary;
    const mult = Number(otMultiplier || existing.otMultiplier || 1.5);
    const rate = Number(otRate || existing.otRate || 0);
    const hours = Number(otHours ?? existing.otHours ?? 0);
    const otPay = parseFloat((hours * rate * mult).toFixed(2));

    const addOthers = (otherAdditions || existing.otherAdditions || []).reduce((s, i) => s + Number(i.amount || 0), 0);
    const dedOthers = (otherDeductions || existing.otherDeductions || []).reduce((s, i) => s + Number(i.amount || 0), 0);

    const grossSalary = basic
      + Number(allowances ?? existing.allowances ?? 0)
      + otPay
      + Number(bonus ?? existing.bonus ?? 0)
      + Number(commissions ?? existing.commissions ?? 0)
      + addOthers;

    const employee = await Employee.findById(existing.employee);
    const { fractions: R } = await getStatutoryRates();
    const epfEmployee = employee?.epfEtfEnrolled ? Math.round(basic * R.epfEmployee) : 0;
    const epfEmployer = employee?.epfEtfEnrolled ? Math.round(basic * R.epfEmployer) : 0;
    const etfEmployer = employee?.epfEtfEnrolled ? Math.round(basic * R.etfEmployer) : 0;

    const totalDeductions = epfEmployee
      + Number(advanceDeduction ?? existing.advanceDeduction ?? 0)
      + Number(loanDeduction ?? existing.loanDeduction ?? 0)
      + dedOthers;

    const netSalary = grossSalary - totalDeductions;

    const updated = await Payroll.findByIdAndUpdate(
      req.params.id,
      {
        allowances: allowances ?? existing.allowances,
        otHours: hours, otRate: rate, otMultiplier: mult, otPay,
        bonus: bonus ?? existing.bonus,
        bonusNote: bonusNote ?? existing.bonusNote,
        commissions: commissions ?? existing.commissions,
        advanceDeduction: advanceDeduction ?? existing.advanceDeduction,
        loanDeduction: loanDeduction ?? existing.loanDeduction,
        notes: notes ?? existing.notes,
        paymentMethod: paymentMethod ?? existing.paymentMethod,
        bankAccount: bankAccount !== undefined ? (bankAccount || null) : existing.bankAccount,
        chequeNumber: chequeNumber !== undefined ? chequeNumber : existing.chequeNumber,
        otherAdditions: otherAdditions ?? existing.otherAdditions,
        otherDeductions: otherDeductions ?? existing.otherDeductions,
        epfEmployee, epfEmployer, etfEmployer,
        grossSalary, totalDeductions, netSalary,
        status: req.body.status || 'draft',
      },
      { new: true }
    ).populate({ path: 'employee', populate: { path: 'userId', select: 'name email' } });

    res.json({ success: true, payroll: updated });
  } catch (err) { next(err); }
};

const PAYROLL_METHODS_NEEDING_BANK = ['bank_transfer', 'cheque'];

// @desc    Mark payroll as paid
exports.markPaid = async (req, res, next) => {
  try {
    const paymentMethod = req.body.paymentMethod || 'bank_transfer';
    const rawBank = req.body.bankAccount;
    const bankAccountId = rawBank && String(rawBank).trim() ? String(rawBank).trim() : undefined;
    const chequeNumber = String(req.body.chequeNumber || '').trim();

    if (requiresBankAccount(paymentMethod) && !bankAccountId) {
      return res.status(400).json({
        success: false,
        message: 'Select which company bank account this payment is drawn from',
      });
    }
    if (isChequeMethod(paymentMethod) && !chequeNumber) {
      return res.status(400).json({ success: false, message: 'Cheque number is required for cheque payments' });
    }

    const updatePayload = {
      status: 'paid',
      paidAt: new Date(),
      paymentMethod,
      chequeNumber: isChequeMethod(paymentMethod) ? chequeNumber : '',
    };
    if (req.body.payslipSignatory && typeof req.body.payslipSignatory === 'object') {
      updatePayload.payslipSignatory = req.body.payslipSignatory;
    }
    if (requiresBankAccount(paymentMethod)) {
      updatePayload.bankAccount = bankAccountId;
    } else {
      updatePayload.bankAccount = null;
      updatePayload.chequeNumber = '';
    }

    const payroll = await Payroll.findByIdAndUpdate(req.params.id, updatePayload, { new: true })
      .populate({ path: 'employee', populate: { path: 'userId', select: '_id name email phone' } })
      .populate('bankAccount', 'bankName accountNumber branchName');
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });

    await createNotification({
      recipient: payroll.employee?.userId?._id,
      title: 'Salary Credited 💰',
      message: `Salary credited for ${payroll.month}/${payroll.year}. Net: LKR ${Number(payroll.netSalary || 0).toLocaleString()}`,
      type: 'payroll',
      link: '/developer/payslips',
    });

    // Send payslip email
    const emailService = require('../services/emailService');
    if (payroll.employee?.userId?.email) {
      await emailService.sendPayslipReadyEmail(
        payroll.employee.userId.email,
        payroll.employee.userId.name,
        { month: payroll.month, year: payroll.year, netSalary: payroll.netSalary }
      );
    }
    
    if (payroll.employee?.userId?.phone || payroll.employee?.phone) {
      const { sendPayslipSms } = require('../services/smsService');
      const phone = payroll.employee?.userId?.phone || payroll.employee?.phone;
      const monthName = new Date(payroll.year, payroll.month - 1).toLocaleString('default', { month: 'long' });
      await sendPayslipSms(phone, payroll.employee?.userId?.name, monthName, payroll.netSalary);
    }

    // Sync with EpfRecord
    await EpfRecord.findOneAndUpdate(
      { employee: payroll.employee?._id, month: payroll.month, year: payroll.year },
      { isPaid: true, paidAt: new Date(), paidBy: req.user._id }
    );

    // Sync advance repayments
    if (payroll.advanceDeduction > 0 && payroll.deductedAdvances?.length > 0) {
      let remainingAdvance = Number(payroll.advanceDeduction);
      for (const advId of payroll.deductedAdvances) {
        if (remainingAdvance <= 0) break;
        const advance = await Advance.findById(advId);
        if (!advance || advance.status !== 'active') continue;
        const dupPayroll = (advance.repayments || []).some((r) => String(r.payrollId) === String(payroll._id));
        if (dupPayroll) continue;
        const repayAmt = Math.min(remainingAdvance, advance.outstandingBalance || 0, advance.monthlyDeduction || advance.outstandingBalance || 0);
        if (repayAmt <= 0) continue;
        advance.repayments.push({
          amount: repayAmt,
          date: new Date(),
          payrollId: payroll._id,
          note: `Auto-deducted from ${MONTHS[payroll.month - 1]} ${payroll.year} payroll`,
        });
        advance.totalRecovered = (advance.totalRecovered || 0) + repayAmt;
        advance.outstandingBalance = Math.max(0, advance.amount - advance.totalRecovered);
        if (advance.outstandingBalance === 0) advance.status = 'cleared';
        await advance.save();
        await Employee.findByIdAndUpdate(payroll.employee._id, { $inc: { advanceBalance: -repayAmt } });
        remainingAdvance -= repayAmt;
      }
    }

    // Sync with Loan Payments
    if (payroll.loanDeduction > 0 && payroll.deductedLoans?.length > 0) {
      for (const loanId of payroll.deductedLoans) {
        const loan = await Loan.findById(loanId);
        if (loan && loan.status === 'active') {
          const alreadyPaid = (loan.payments || []).some((p) => String(p.payrollId) === String(payroll._id));
          if (alreadyPaid) continue;

          const installment = Math.min(loan.monthlyInstallment || 0, loan.outstandingBalance || 0);
          if (installment <= 0) continue;

          loan.payments.push({
            amount: installment,
            date: new Date(),
            payrollId: payroll._id,
            installmentNo: (loan.installmentsPaid || 0) + 1,
            deductionSource: 'payroll',
            note: `Auto-deducted from ${MONTHS[payroll.month - 1]} payroll`,
            method: 'salary_deduction',
          });
          loan.totalPaid = (loan.totalPaid || 0) + installment;
          loan.installmentsPaid = (loan.installmentsPaid || 0) + 1;
          loan.outstandingBalance = Math.max(0, loan.totalAmount - loan.totalPaid);
          if (loan.outstandingBalance === 0) loan.status = 'cleared';
          await loan.save();
          
          await Employee.findByIdAndUpdate(payroll.employee._id, { $inc: { loanBalance: -installment } });
        }
      }
      if (payroll.continueLoanDeduction === false) {
        await Loan.updateMany({ _id: { $in: payroll.deductedLoans } }, { $set: { payrollDeductionPaused: true } });
      } else {
        await Loan.updateMany({ _id: { $in: payroll.deductedLoans } }, { $set: { payrollDeductionPaused: false } });
      }
    }
    console.log('[PAY] ===== BANK DEDUCTION CHECK =====');
    console.log('[PAY] paymentMethod:', payroll.paymentMethod);
    console.log('[PAY] bankAccount:', payroll.bankAccount);
    console.log('[PAY] netSalary:', payroll.netSalary);

    if (payroll.paymentMethod !== 'cash' && payroll.paymentMethod !== 'other') {
      if (!payroll.bankAccount) {
        throw new Error('Bank account is missing for this payment method.');
      }
      if (!postsToBankLedger(payroll.paymentMethod)) {
        throw new Error(`Payment method '${payroll.paymentMethod}' is not configured to post to the bank ledger.`);
      }
      const bankId = payroll.bankAccount._id || payroll.bankAccount;
      console.log('[PAY] bankId resolved to:', bankId);
      const ref = isChequeMethod(payroll.paymentMethod)
        ? payroll.chequeNumber
        : `PAY-${payroll.month}-${payroll.year}-${payroll._id}`;
      console.log('[PAY] Calling appendBankTransaction with withdrawal amount:', payroll.netSalary);
      const updatedAccount = await appendBankTransaction(bankId, {
        type: 'withdrawal',
        amount: payroll.netSalary || 0,
        description: `Payroll: ${payroll.employee?.userId?.name} (${payroll.month}/${payroll.year})`,
        date: parseLedgerDate(payroll.paidAt),
        referenceId: ref,
        moduleSource: 'payroll',
        sourceType: 'Payroll',
        sourceId: payroll._id,
        recordedBy: req.user._id,
        paymentMethod: payroll.paymentMethod,
      });
      console.log('[PAY] ✅ Bank updated! New balance:', updatedAccount?.currentBalance);

      if (isChequeMethod(payroll.paymentMethod) && payroll.chequeNumber) {
        await Cheque.create({
          direction: 'issued',
          source: 'payroll',
          status: 'cleared',
          amount: payroll.netSalary || 0,
          currency: 'LKR',
          chequeNumber: payroll.chequeNumber,
          chequeDate: payroll.paidAt || new Date(),
          drawerOrPayee: payroll.employee?.userId?.name || 'Employee',
          bankAccount: bankId,
          notes: `Salary ${payroll.month}/${payroll.year}`,
          recordedBy: req.user._id,
        }).catch((e) => console.warn('[Payroll] Cheque record:', e.message));
      }
    }
    
    await createAuditLog({
      user: req.user, action: 'pay', module: 'payroll', entityId: payroll._id, entityName: `Payroll ${payroll.month}/${payroll.year}`,
      description: `Marked payroll as paid for ${payroll.employee?.userId?.name}`,
    });

    if (payroll.employee?.userId) {
      const { createNotification } = require('../services/notificationService');
      const userId = payroll.employee.userId._id || payroll.employee.userId;
      await createNotification({
        recipient: userId,
        title: 'Salary Deposited',
        message: `Your salary for ${payroll.month}/${payroll.year} has been processed and paid via ${payroll.paymentMethod.replace(/_/g, ' ')}.`,
        type: 'payroll',
        link: '/developer/payslips'
      });
    }

    const FinanceEntry = require('../models/FinanceEntry');
    let finMethod = 'Cash';
    if (payroll.paymentMethod === 'bank_transfer') finMethod = 'Bank Transfer';
    else if (payroll.paymentMethod === 'card') finMethod = 'Card';
    else if (payroll.paymentMethod === 'online') finMethod = 'Online Payment';
    else if (payroll.paymentMethod === 'cheque') finMethod = 'Cheque';
    else if (payroll.paymentMethod === 'other') finMethod = 'Other';

    await FinanceEntry.create({
      type: 'expense',
      category: 'Payroll',
      title: `Salary ${MONTHS[payroll.month - 1]} ${payroll.year} - ${payroll.employee?.userId?.name || 'Employee'}`,
      amount: payroll.netSalary || 0,
      date: payroll.paidAt || new Date(),
      paymentMethod: finMethod,
      bankAccount: payroll.bankAccount ? (payroll.bankAccount._id || payroll.bankAccount) : undefined,
      note: `Payroll ID: ${payroll._id}`,
      createdBy: req.user._id,
      branch: payroll.employee?.branch || undefined,
    }).catch(e => console.warn('[Payroll] FinanceEntry:', e.message));

    res.json({ success: true, payroll });
  } catch (err) { next(err); }
};

// @desc    Generate payslip PDF from HTML (hosted-safe with image inlining)
// @route   POST /api/payroll/generate-pdf
exports.generatePayslipPdf = async (req, res, next) => {
  try {
    const { html, filename } = req.body;
    if (!html) {
      return res.status(400).json({ success: false, message: 'HTML content is required' });
    }
    const { inlineUploadImagesInHtml } = require('../services/documentHtmlService');
    const inlinedHtml = inlineUploadImagesInHtml(html);

    if (req.query.html === 'true') {
      return res.send(inlinedHtml);
    }

    const { htmlToPdfBuffer } = require('../services/documentPdfService');
    const pdfBuffer = await htmlToPdfBuffer(inlinedHtml);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'payslip'}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
};

// @desc    Get EPF/ETF summary — all enrolled employees (with or without payroll)
// @route   GET /api/payroll/epf-summary
exports.getEpfSummary = async (req, res, next) => {
  try {
    const { month, year } = req.query;

    const enrolledEmployees = await Employee.find({
      epfEtfEnrolled: true,
      status: { $nin: ['former', 'terminated', 'intern_ended'] },
    }).populate('userId', 'name email');

    const enrolledIds = enrolledEmployees.map(e => e._id);
    const payrollQuery = { employee: { $in: enrolledIds } };
    if (month) payrollQuery.month = Number(month);
    if (year)  payrollQuery.year  = Number(year);

    const payrolls = await Payroll.find(payrollQuery);
    const payrollMap = {};
    payrolls.forEach(p => { payrollMap[String(p.employee)] = p; });

    const { fractions: R, percentages: statutoryRates } = await getStatutoryRates();

    const summary = enrolledEmployees.map(emp => {
      const p           = payrollMap[String(emp._id)];
      const basicSalary = p ? p.basicSalary : (emp.basicSalary || 0);
      const epfEmployee = p ? p.epfEmployee : Math.round(basicSalary * R.epfEmployee);
      const epfEmployer = p ? p.epfEmployer : Math.round(basicSalary * R.epfEmployer);
      const etfEmployer = p ? p.etfEmployer : Math.round(basicSalary * R.etfEmployer);
      return {
        employeeId: String(emp._id),
        payrollId:  p?._id ? String(p._id) : null,
        employeeNo: emp.employeeNo,
        name:       emp.userId?.name,
        epfNo:      emp.epfNumber,
        etfNo:      emp.etfNumber,
        basicSalary,
        epfEmployee,
        epfEmployer,
        totalEPF:   epfEmployee + epfEmployer,
        etfEmployer,
        isPaid:     p?.status === 'paid',
        paidAt:     p?.paidAt || null,
        hasPayroll: !!p,
      };
    });

    const totals = {
      epfEmployee: summary.reduce((a, b) => a + b.epfEmployee, 0),
      epfEmployer: summary.reduce((a, b) => a + b.epfEmployer, 0),
      totalEPF:    summary.reduce((a, b) => a + b.totalEPF,    0),
      etfEmployer: summary.reduce((a, b) => a + b.etfEmployer, 0),
    };

    res.json({ success: true, summary, totals, statutoryRates });
  } catch (err) { next(err); }
};

// @desc    Edit EPF/ETF amounts on an existing payroll record
// @route   PUT /api/payroll/:id/epf
exports.updateEpfRecord = async (req, res, next) => {
  try {
    const existing = await Payroll.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Record not found' });
    const epfEmployee = req.body.epfEmployee ?? existing.epfEmployee;
    const epfEmployer = req.body.epfEmployer ?? existing.epfEmployer;
    const etfEmployer = req.body.etfEmployer ?? existing.etfEmployer;
    const newNet = existing.netSalary - (epfEmployee - existing.epfEmployee);
    const updated = await Payroll.findByIdAndUpdate(
      req.params.id,
      { epfEmployee, epfEmployer, etfEmployer, netSalary: newNet },
      { new: true }
    );
    res.json({ success: true, payroll: updated });
  } catch (err) { next(err); }
};

async function reversePaidPayroll(rec) {
  if (rec.status !== 'paid') return;
  if (rec.bankAccount && postsToBankLedger(rec.paymentMethod)) {
    const { appendBankTransaction } = require('../utils/bankLedger');
    await appendBankTransaction(rec.bankAccount, {
      type: 'deposit',
      amount: rec.netSalary || 0,
      description: `Payroll Reversal (Overwritten/Deleted): ${rec.employee?.userId?.name || 'Employee'} (${rec.month}/${rec.year})`,
      date: new Date(),
      referenceId: `REV-PAY-${rec._id}`,
      moduleSource: 'payroll',
      sourceType: 'Payroll',
      sourceId: rec._id,
      paymentMethod: rec.paymentMethod,
    });

    if (isChequeMethod(rec.paymentMethod) && rec.chequeNumber) {
      const Cheque = require('../models/Cheque');
      await Cheque.findOneAndDelete({ source: 'payroll', chequeNumber: rec.chequeNumber });
    }
  }

  const FinanceEntry = require('../models/FinanceEntry');
  await FinanceEntry.deleteMany({ note: `Payroll ID: ${rec._id}` });

  await EpfRecord.findOneAndUpdate(
    { employee: rec.employee?._id || rec.employee, month: rec.month, year: rec.year },
    { isPaid: false, paidAt: null, paidBy: null },
  );

  if (rec.advanceDeduction > 0 && rec.deductedAdvances?.length) {
    for (const advId of rec.deductedAdvances) {
      const advance = await Advance.findById(advId);
      if (!advance) continue;
      const repayment = (advance.repayments || []).find((r) => String(r.payrollId) === String(rec._id));
      if (!repayment) continue;
      const repayAmt = Number(repayment.amount || 0);
      advance.repayments = advance.repayments.filter((r) => String(r.payrollId) !== String(rec._id));
      advance.totalRecovered = Math.max(0, (advance.totalRecovered || 0) - repayAmt);
      advance.outstandingBalance = Math.min(advance.amount, (advance.outstandingBalance || 0) + repayAmt);
      if (advance.outstandingBalance > 0) advance.status = 'active';
      await advance.save();
      await Employee.findByIdAndUpdate(rec.employee?._id || rec.employee, { $inc: { advanceBalance: repayAmt } });
    }
  }

  if (rec.loanDeduction > 0 && rec.deductedLoans?.length) {
    for (const loanId of rec.deductedLoans) {
      const loan = await Loan.findById(loanId);
      if (!loan) continue;
      const payment = (loan.payments || []).find((p) => String(p.payrollId) === String(rec._id));
      if (!payment) continue;
      const payAmt = Number(payment.amount || 0);
      loan.payments = loan.payments.filter((p) => String(p.payrollId) !== String(rec._id));
      loan.totalPaid = Math.max(0, (loan.totalPaid || 0) - payAmt);
      loan.installmentsPaid = Math.max(0, (loan.installmentsPaid || 0) - 1);
      loan.outstandingBalance = Math.min(loan.totalAmount, (loan.outstandingBalance || 0) + payAmt);
      if (loan.outstandingBalance > 0) loan.status = 'active';
      await loan.save();
      await Employee.findByIdAndUpdate(rec.employee?._id || rec.employee, { $inc: { loanBalance: payAmt } });
    }
  }
}

// @desc    Delete a payroll / EPF record (with financial reversal if paid)
// @route   DELETE /api/payroll/:id
exports.deletePayroll = async (req, res, next) => {
  try {
    const rec = await Payroll.findById(req.params.id)
      .populate({ path: 'employee', populate: { path: 'userId', select: 'name' } });
    if (!rec) return res.status(404).json({ success: false, message: 'Record not found' });

    await reversePaidPayroll(rec);

    await Payroll.findByIdAndDelete(req.params.id);

    await createAuditLog({
      user: req.user,
      action: 'delete',
      module: 'payroll',
      entityId: rec._id,
      entityName: `Payroll ${rec.month}/${rec.year}`,
      description: `Deleted payroll for ${rec.employee?.userId?.name || 'employee'} (${rec.month}/${rec.year})`,
      changes: { before: rec.toObject() },
      severity: 'warning',
    });
    res.json({ success: true, message: 'Record deleted' });
  } catch (err) { next(err); }
};

// @desc    Send payslip notification (email / SMS)
// @route   POST /api/payroll/:id/send
exports.sendPayrollNotification = async (req, res, next) => {
  try {
    const methods = Array.isArray(req.body.methods) ? req.body.methods : ['email'];
    const payroll = await Payroll.findById(req.params.id)
      .populate({ path: 'employee', populate: { path: 'userId', select: 'name email phone' } });
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });

    const emp = payroll.employee?.userId;
    const monthName = MONTHS[payroll.month - 1];
    const billUrl = `${process.env.APP_URL || 'http://localhost:5173'}/developer/payslips`;
    const results = { email: false, sms: false };

    if (methods.includes('email') && emp?.email) {
      const { sendPayslipReadyEmail } = require('../services/emailService');
      await sendPayslipReadyEmail(emp.email, emp.name, {
        month: payroll.month,
        year: payroll.year,
        netSalary: payroll.netSalary,
        viewUrl: billUrl,
      });
      results.email = true;
    }

    if (methods.includes('sms') && (emp?.phone || payroll.employee?.phone)) {
      const { sendPayslipSms } = require('../services/smsService');
      const phone = emp?.phone || payroll.employee?.phone;
      await sendPayslipSms(phone, emp?.name, monthName, payroll.netSalary, billUrl);
      results.sms = true;
    }

    res.json({ success: true, results, message: 'Notification sent' });
  } catch (err) { next(err); }
};



// @desc    Add overtime for selected employee/month
// @route   POST /api/payroll/overtime
exports.addOvertime = async (req, res, next) => {
  try {
    const { employeeId, month, year, amount, hours = 0, note = '' } = req.body;
    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const row = await Overtime.create({
      employee: employeeId,
      month,
      year,
      amount: Number(amount || 0),
      hours: Number(hours || 0),
      note,
      addedBy: req.user._id,
    });

    const sync = await triggerPayrollSync({
      employeeId,
      month,
      year,
      source: 'overtime',
      module: 'payroll',
      entityId: row._id,
      reason: 'Overtime added',
      user: req.user,
    });

    res.status(201).json(attachSyncResult({ success: true, overtime: row }, sync));
  } catch (err) { next(err); }
};

// @desc    Delete overtime row
// @route   DELETE /api/payroll/overtime/:id
exports.deleteOvertime = async (req, res, next) => {
  try {
    const row = await Overtime.findByIdAndDelete(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Overtime record not found' });

    const sync = await triggerPayrollSync({
      employeeId: row.employee,
      month: row.month,
      year: row.year,
      source: 'overtime',
      module: 'payroll',
      entityId: req.params.id,
      reason: 'Overtime deleted',
      user: req.user,
    });

    res.json(attachSyncResult({ success: true, message: 'Overtime deleted' }, sync));
  } catch (err) { next(err); }
};

// @desc    Force sync payroll for employee/month
// @route   POST /api/payroll/sync
exports.syncPayroll = async (req, res, next) => {
  try {
    const { employeeId, month, year, force } = req.body;
    if (!employeeId || !month || !year) {
      return res.status(400).json({ success: false, message: 'employeeId, month, and year are required' });
    }
    const sync = await syncPayrollForEmployee(employeeId, month, year, {
      source: 'manual_sync',
      module: 'payroll',
      user: req.user,
      reason: 'Admin triggered payroll sync',
      force: force === true,
    });
    if (!sync.success) return res.status(400).json(sync);
    res.json(attachSyncResult({ success: true, ...sync }, sync));
  } catch (err) { next(err); }
};

// @desc    Reopen finalized (approved) payroll to draft for recalculation
// @route   PUT /api/payroll/:id/reopen
exports.reopenPayroll = async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });
    if (payroll.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Paid payroll cannot be reopened. Use adjustment entries.' });
    }
    await Payroll.findByIdAndUpdate(req.params.id, {
      status: 'draft',
      approvedBy: null,
      approvedAt: null,
    });
    const sync = await syncPayrollForEmployee(payroll.employee, payroll.month, payroll.year, {
      source: 'reopen',
      module: 'payroll',
      entityId: payroll._id,
      user: req.user,
      reason: 'Payroll reopened by admin',
      force: true,
    });
    res.json(attachSyncResult({ success: true, message: 'Payroll reopened and recalculated' }, sync));
  } catch (err) { next(err); }
};

// @desc    Payroll recalculation audit log
// @route   GET /api/payroll/recalc-logs
exports.getRecalcLogs = async (req, res, next) => {
  try {
    const { employeeId, payrollId, month, year, limit = 50 } = req.query;
    const q = {};
    if (employeeId) q.employee = employeeId;
    if (payrollId) q.payroll = payrollId;
    if (month) q.month = Number(month);
    if (year) q.year = Number(year);
    const logs = await PayrollRecalcLog.find(q)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 50, 200))
      .populate('user', 'name email');
    res.json({ success: true, count: logs.length, logs });
  } catch (err) { next(err); }
};

// @desc    Employee financial summary (live balances + payroll)
// @route   GET /api/payroll/employee-summary/:employeeId
exports.getEmployeeFinancialSummary = async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId;
    const month = Number(req.query.month) || monthYearFromDate().month;
    const year = Number(req.query.year) || monthYearFromDate().year;

    const [employee, loans, advances, overtime, payroll, targets, adjustments] = await Promise.all([
      Employee.findById(employeeId).populate('userId', 'name email'),
      Loan.find({ employee: employeeId }).sort({ createdAt: -1 }).limit(20),
      Advance.find({ employee: employeeId }).sort({ createdAt: -1 }).limit(20),
      Overtime.find({ employee: employeeId, month, year }),
      Payroll.findOne({ employee: employeeId, month, year }),
      BonusTarget.find({ employee: employeeId, status: 'achieved' }).sort({ achievedAt: -1 }).limit(10),
      PayrollAdjustment.find({ employee: employeeId, status: 'pending' }).sort({ createdAt: -1 }),
    ]);

    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const preview = await computePayrollSnapshot(employeeId, month, year).catch(() => null);

    res.json({
      success: true,
      summary: {
        employee: {
          _id: employee._id,
          name: employee.userId?.name,
          employeeNo: employee.employeeNo,
          basicSalary: employee.basicSalary,
          advanceBalance: employee.advanceBalance,
          loanBalance: employee.loanBalance,
        },
        period: { month, year },
        payroll,
        preview,
        loans,
        advances,
        overtime,
        bonusHistory: targets,
        pendingAdjustments: adjustments,
      },
    });
  } catch (err) { next(err); }
};

// @desc    Get overtime rows
// @route   GET /api/payroll/overtime
exports.getOvertime = async (req, res, next) => {
  try {
    const { month, year, employeeId } = req.query;
    const q = {};
    if (month) q.month = Number(month);
    if (year) q.year = Number(year);
    if (employeeId) q.employee = employeeId;

    const records = await Overtime.find(q)
      .populate({ path: 'employee', populate: { path: 'userId', select: 'name email' } })
      .sort({ createdAt: -1 });
    res.json({ success: true, records });
  } catch (err) { next(err); }
};

// @desc    Initiate salary payment via PayHere (admin)
// @route   POST /api/payroll/:id/payhere/init
exports.initiateSalaryPayHere = async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate({ path: 'employee', populate: { path: 'userId', select: 'name email phone _id' } });
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });

    const merchantId = process.env.PAYHERE_MERCHANT_ID;
    const merchantSecret = process.env.PAYHERE_SECRET;
    const amount = Number(payroll.netSalary || 0).toFixed(2);
    const currency = 'LKR';
    const orderId = `SAL-${payroll._id}-${Date.now()}`;
    const sandbox = process.env.NODE_ENV !== 'production';

    const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const rawHash = `${merchantId}${orderId}${amount}${currency}${secretHash}`;
    const hash = crypto.createHash('md5').update(rawHash).digest('hex').toUpperCase();

    await SalaryPayment.create({
      payroll: payroll._id,
      employee: payroll.employee._id,
      user: payroll.employee.userId._id,
      amount: payroll.netSalary,
      currency,
      payhere_order_id: orderId,
      status: 'pending',
    });

    res.json({
      success: true,
      paymentData: {
        sandbox,
        merchant_id: merchantId,
        return_url: `${process.env.CLIENT_URL}/admin/payroll?payment=success`,
        cancel_url: `${process.env.CLIENT_URL}/admin/payroll?payment=cancelled`,
        notify_url: `${process.env.SERVER_URL || 'http://localhost:5000'}/api/payroll/payhere/notify`,
        order_id: orderId,
        items: `Salary ${payroll.month}/${payroll.year} - ${payroll.employee.userId.name}`,
        amount,
        currency,
        first_name: payroll.employee.userId.name.split(' ')[0] || payroll.employee.userId.name,
        last_name: payroll.employee.userId.name.split(' ').slice(1).join(' ') || '-',
        email: payroll.employee.userId.email || 'salary@raxwo.com',
        phone: payroll.employee.userId.phone || '0000000000',
        address: 'Colombo',
        city: 'Colombo',
        country: 'Sri Lanka',
        hash,
      },
    });
  } catch (err) { next(err); }
};

// @desc    Handle salary payment PayHere webhook
// @route   POST /api/payroll/payhere/notify
exports.salaryPayHereNotify = async (req, res, next) => {
  try {
    const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig } = req.body;
    const merchantSecret = process.env.PAYHERE_SECRET;
    const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const rawHash = `${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${secretHash}`;
    const localSig = crypto.createHash('md5').update(rawHash).digest('hex').toUpperCase();
    if (localSig !== md5sig) return res.status(400).json({ success: false, message: 'Invalid signature' });

    if (status_code === '2') {
      const payment = await SalaryPayment.findOneAndUpdate(
        { payhere_order_id: order_id },
        { status: 'completed', paidAt: new Date(), payhere_payment_id: req.body.payment_id, payhere_status_code: status_code, md5sig },
        { new: true }
      ).populate({ path: 'employee', populate: { path: 'userId', select: '_id name' } });

      if (payment) {
        const payroll = await Payroll.findByIdAndUpdate(payment.payroll, { status: 'paid', paidAt: new Date(), paymentMethod: 'online' }, { new: true });
        if (payroll) {
          await createNotification({
            recipient: payment.employee.userId._id,
            title: 'Salary Credited',
            message: `Salary credited for ${payroll.month}/${payroll.year}. Net: LKR ${Number(payroll.netSalary || 0).toLocaleString()}`,
            type: 'payroll',
            link: '/developer/payslips',
          });
          const FinanceEntry = require('../models/FinanceEntry');
          await FinanceEntry.create({
            type: 'expense',
            category: 'Payroll',
            title: `Salary ${MONTHS[payroll.month - 1] || 'Month'} ${payroll.year} - ${payment.employee?.userId?.name || 'Employee'}`,
            amount: payroll.netSalary || 0,
            date: payroll.paidAt || new Date(),
            paymentMethod: 'Online Payment',
            note: `Payroll ID: ${payroll._id}`,
            createdBy: payment.employee?.userId?._id, // Fallback since it's a webhook
          }).catch(e => console.warn('[Payroll] FinanceEntry:', e.message));
        }
      }
    }
    res.send('OK');
  } catch (err) { next(err); }
};
