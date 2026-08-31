const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['deposit', 'withdrawal', 'transfer_in', 'transfer_out'], required: true },
  transactionType: { type: String, default: '' }, // display label e.g. withdrawal
  amount: { type: Number, required: true },
  balanceBefore: { type: Number, default: 0 },
  balanceAfter: { type: Number, default: 0 },
  description: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  reference: { type: String, default: '' },
  referenceId: { type: String, default: '' },
  moduleSource: { type: String, default: 'manual' },
  sourceType: { type: String, default: '' },
  sourceId: { type: mongoose.Schema.Types.ObjectId },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: true });

const bankAccountSchema = new mongoose.Schema({
  bankName: { type: String, required: true },
  accountNumber: { type: String, required: true, unique: true },
  accountHolder: { type: String, required: true },
  accountType: {
    type: String,
    enum: ['savings', 'current', 'fixed'],
    default: 'current',
  },
  branchName: { type: String, default: '' },
  currentBalance: { type: Number, default: 0 },
  currency: { type: String, default: 'LKR' },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  isActive: { type: Boolean, default: true },
  notes: { type: String, default: '' },
  transactions: [transactionSchema],
}, { timestamps: true });

bankAccountSchema.index({ branch: 1, isActive: 1 });
bankAccountSchema.index({ isActive: 1 });

module.exports = mongoose.model('BankAccount', bankAccountSchema);

