const mongoose = require('mongoose');

const CHEQUE_STATUSES = [
  'pending', 'deposited', 'cleared', 'bounced', 'cancelled',
  // legacy values kept for existing records
  'unpaid', 'paid', 'expected', 'received', 'returned', 'renewed',
];

const chequeSchema = new mongoose.Schema({
  direction: { type: String, enum: ['received', 'issued', 'incoming', 'outgoing'], required: true },
  source: { type: String, enum: ['subscription', 'invoice', 'income', 'expense', 'payroll', 'manual'], default: 'manual' },
  status: { type: String, enum: CHEQUE_STATUSES, default: 'pending' },
  paymentType: { type: String, enum: ['incoming', 'outgoing', ''], default: '' },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'LKR' },
  chequeNumber: { type: String, required: true, trim: true },
  chequeDate: { type: Date },
  bankName: { type: String, default: '' },
  drawerOrPayee: { type: String, default: '' },
  renewalDate: { type: Date },
  notes: { type: String, default: '' },
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
  linkedSubscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  linkedInvoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ledgerPosted: { type: Boolean, default: false },
  ledgerPostedAt: Date,
  ledgerPostedStatus: { type: String, default: '' },
}, { timestamps: true });

chequeSchema.pre('validate', function normalizeDirection() {
  if (this.direction === 'incoming') this.direction = 'received';
  if (this.direction === 'outgoing') this.direction = 'issued';
});

chequeSchema.index({ status: 1, chequeDate: -1 });
chequeSchema.index({ chequeNumber: 1 });
chequeSchema.index({ branch: 1, status: 1 });
chequeSchema.index({ ledgerPosted: 1, direction: 1, status: 1 });

module.exports = mongoose.model('Cheque', chequeSchema);

