const mongoose = require('mongoose');

const financeEntrySchema = new mongoose.Schema({
  type: { type: String, enum: ['income', 'expense'], required: true },
  category: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true, default: Date.now },
  note: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  // Bill / receipt support
  billFile: { type: String, default: '' },    // URL to uploaded bill/receipt file
  billFileName: { type: String, default: '' }, // Original file name
  paymentMethod: { type: String, enum: ['Cash', 'Card', 'Bank Transfer', 'Online Payment', 'Cheque', 'Other'], default: 'Cash' },
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
}, { timestamps: true });

financeEntrySchema.index({ type: 1, category: 1, date: -1 });
financeEntrySchema.index({ branch: 1, date: -1 });
financeEntrySchema.index({ date: -1 });
financeEntrySchema.index({ type: 1, date: -1 });
financeEntrySchema.index({ branch: 1, type: 1, date: -1 }); // compound for branch+type dashboard queries

module.exports = mongoose.model('FinanceEntry', financeEntrySchema);

