const mongoose = require('mongoose');

const repaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  payrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' },
  note: String,
});

const advanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  reason: { type: String, default: '' },

  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'cheque', 'card'],
    default: 'cash',
  },
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
  paymentReference: { type: String, default: '' },
  chequeNumber: { type: String, default: '', trim: true },

  repaymentType: {
    type: String,
    enum: ['lump_sum', 'installments'],
    default: 'lump_sum',
  },
  installments: { type: Number, default: 1 },
  monthlyDeduction: { type: Number, default: 0 },

  totalRecovered: { type: Number, default: 0 },
  outstandingBalance: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['active', 'cleared'],
    default: 'active',
  },
  repayments: [repaymentSchema],
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

advanceSchema.pre('save', function (next) {
  if (this.repaymentType === 'installments' && this.installments > 0) {
    this.monthlyDeduction = parseFloat((this.amount / this.installments).toFixed(2));
  } else {
    this.monthlyDeduction = this.amount;
  }
  if (this.isNew) this.outstandingBalance = this.amount;
  next();
});

advanceSchema.index({ employee: 1, status: 1 });
advanceSchema.index({ status: 1 });
advanceSchema.index({ date: -1 });

module.exports = mongoose.model('Advance', advanceSchema);

