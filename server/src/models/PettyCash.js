const mongoose = require('mongoose');

const pettyCashSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['in', 'out'],
    required: true,
  },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['office_supplies', 'travel', 'meals', 'utilities', 'maintenance', 'other', 'fund_top_up'],
    default: 'other',
  },
  paidTo: { type: String, default: '' },          // person or vendor (for OUT)
  paymentType: {
    type: String,
    enum: ['cash', 'bank_transfer', 'card', 'cheque'],
    default: 'cash',
  },
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
  chequeNumber: { type: String, default: '' },
  linkedCheque: { type: mongoose.Schema.Types.ObjectId, ref: 'Cheque' },
  referenceNumber: { type: String, default: '' },
  receiptUrl: { type: String, default: '' },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  runningBalance: { type: Number, default: 0 },   // updated on each transaction
}, { timestamps: true });

pettyCashSchema.index({ branch: 1, date: -1 });
pettyCashSchema.index({ date: -1 });

module.exports = mongoose.model('PettyCash', pettyCashSchema);

