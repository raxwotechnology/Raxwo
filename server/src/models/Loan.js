const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  totalAmount: { type: Number, required: true },
  monthlyInstallment: { type: Number, required: true },
  startDate: { type: Date, required: true },
  reason: { type: String, default: '' },

  // Deduction type: salary = auto-deduct from payroll, separate = employee repays independently
  deductionType: {
    type: String,
    enum: ['salary', 'separate'],
    default: 'salary',
  },

  // Tax fields
  taxRate: { type: Number, default: 0 },    // percentage
  taxAmount: { type: Number, default: 0 },  // calculated amount

  totalPaid: { type: Number, default: 0 },
  outstandingBalance: { type: Number, default: 0 },
  installmentsPaid: { type: Number, default: 0 },
  repaymentMonths: { type: Number, default: 0 },
  totalInstallments: { type: Number, default: 0 }, // auto-calculated
  payrollDeductionPaused: { type: Boolean, default: false },

  status: {
    type: String,
    enum: ['active', 'cleared'],
    default: 'active',
  },
  payments: [{
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    payrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' },
    installmentNo: { type: Number, default: 0 },
    deductionSource: { type: String, enum: ['payroll', 'manual'], default: 'payroll' },
    method: { type: String, enum: ['cash', 'bank_transfer', 'card', 'online_transfer', 'payhere', 'salary_deduction', 'external'], default: 'salary_deduction' },
    bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
    note: String,
  }],
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

loanSchema.pre('save', function (next) {
  if (this.isNew) {
    this.outstandingBalance = this.totalAmount;
    this.totalInstallments = this.monthlyInstallment > 0
      ? Math.ceil(this.totalAmount / this.monthlyInstallment)
      : 0;
  }
  next();
});

loanSchema.index({ employee: 1, status: 1 });
loanSchema.index({ status: 1 });
loanSchema.index({ startDate: -1 });
loanSchema.index({ 'payments.date': 1 });

module.exports = mongoose.model('Loan', loanSchema);

