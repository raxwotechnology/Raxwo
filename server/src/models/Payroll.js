const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  label: { type: String, required: true },
  amount: { type: Number, default: 0 },
  type: { type: String, enum: ['addition', 'deduction'], default: 'addition' },
});

const projectAllocationSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  projectName: String,
  amount: { type: Number, default: 0 },
  type: { type: String, enum: ['salary', 'commission'], default: 'salary' },
});

const payrollSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },

  // ── Core salary ─────────────────────────────────────────────────────────────
  basicSalary: { type: Number, default: 0 },
  allowances: { type: Number, default: 0 },

  // ── Project-based income (auto-populated from project allocations) ───────────
  projectAllocations: [projectAllocationSchema],

  // ── OT ──────────────────────────────────────────────────────────────────────
  otHours: { type: Number, default: 0 },
  otRate: { type: Number, default: 0 },       // per hour amount
  otMultiplier: { type: Number, default: 1.5 },
  otPay: { type: Number, default: 0 },        // calculated: otHours × otRate × otMultiplier

  // ── Bonus ────────────────────────────────────────────────────────────────────
  bonus: { type: Number, default: 0 },
  bonusNote: { type: String, default: '' },

  // ── Commissions ──────────────────────────────────────────────────────────────
  commissions: { type: Number, default: 0 },
  projectCommissions: { type: Number, default: 0 },

  // ── Deductions ───────────────────────────────────────────────────────────────
  advanceDeduction: { type: Number, default: 0 },
  loanDeduction: { type: Number, default: 0 },
  deductedLoans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Loan' }],
  deductedAdvances: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Advance' }],
  continueLoanDeduction: { type: Boolean, default: true },
  leaveDeduction: { type: Number, default: 0 },     // auto-deducted for excess leaves
  leaveDeductionDays: { type: Number, default: 0 }, // number of excess leave days deducted
  incomeTaxDeduction: { type: Number, default: 0 },

  // ── EPF / ETF (Sri Lanka statutory) ──────────────────────────────────────────
  epfEmployee: { type: Number, default: 0 },   // 8% of basic (deducted from employee)
  epfEmployer: { type: Number, default: 0 },   // 12% of basic (employer contribution, informational)
  etfEmployer: { type: Number, default: 0 },   // 3% of basic (employer contribution, informational)

  // ── Free-form additions/deductions ───────────────────────────────────────────
  otherAdditions: [lineItemSchema],
  otherDeductions: [lineItemSchema],

  // ── Extra earnings / penalties (auto-sync) ───────────────────────────────────
  incentives: { type: Number, default: 0 },
  penaltyDeduction: { type: Number, default: 0 },
  totalAdditions: { type: Number, default: 0 },

  // ── Totals (calculated) ───────────────────────────────────────────────────────
  grossSalary: { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 },
  netSalary: { type: Number, default: 0 },

  // ── Auto-sync metadata ────────────────────────────────────────────────────────
  lastRecalculatedAt: Date,
  lastRecalcSource: { type: String, default: '' },
  recalcVersion: { type: Number, default: 0 },
  autoSyncEnabled: { type: Boolean, default: true },

  // ── Payment ───────────────────────────────────────────────────────────────────
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'cheque', 'payhere', 'card_payment', 'online_transfer'],
    default: 'bank_transfer',
  },
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
  chequeNumber: { type: String, default: '', trim: true },
  paymentReference: { type: String, default: '' },

  // ── Workflow status ───────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['draft', 'reviewed', 'approved', 'paid'],
    default: 'draft',
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  paidAt: Date,
  payslipUrl: String,
  payslipSignatory: {
    role: { type: String, enum: ['director', 'manager', 'hr', 'admin', ''], default: '' },
    signatureUrl: { type: String, default: '' },
    signatureName: { type: String, default: '' },
    signatureTitle: { type: String, default: '' },
    sealUrl: { type: String, default: '' },
  },

  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: String,

  // legacy compat
  overtime: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  targetBonus: { type: Number, default: 0 },
  advancePayment: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
}, { timestamps: true });

payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });
payrollSchema.index({ status: 1, year: -1, month: -1 });
payrollSchema.index({ year: -1, month: -1 });

module.exports = mongoose.model('Payroll', payrollSchema);

