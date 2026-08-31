const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity:    { type: Number, default: 1 },
  unitPrice:   { type: Number, default: 0 },
  discount:    { type: Number, default: 0 },   // % per line
  tax:         { type: Number, default: 0 },   // % per line
  total:       { type: Number, default: 0 },
});

const paymentEntrySchema = new mongoose.Schema({
  amount:      { type: Number, required: true },
  date:        { type: Date,   default: Date.now },
  method:      { type: String, enum: ['cash', 'card', 'bank_transfer', 'cheque', 'payhere', 'online_transfer'], default: 'cash' },
  reference:   { type: String, default: '' },
  notes:       { type: String, default: '' },
  recordedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isAdvance:   { type: Boolean, default: false },  // true = advance before invoice fully issued
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
}, { timestamps: true });

const invoiceSchema = new mongoose.Schema({
  // ── Identity ────────────────────────────────────────────────────────────────
  invoiceNo:    { type: String, unique: true },
  invoicePrefix:{ type: String, default: 'INV' },

  // ── Relations ───────────────────────────────────────────────────────────────
  client:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  project:      { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  quotationRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
  branch:       { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // ── Source ──────────────────────────────────────────────────────────────────
  source: {
    type: String,
    enum: ['manual', 'subscription'],
    default: 'manual',
  },
  subscriptionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  serviceType: {
    type: String,
    enum: ['ERP', 'POS', 'Hosting', 'Website', 'Maintenance', 'Custom', 'Subscription', 'Other'],
    default: 'Other'
  },

  // ── Dates ───────────────────────────────────────────────────────────────────
  invoiceDate:  { type: Date, default: Date.now },
  dueDate:      Date,

  // ── Line Items ───────────────────────────────────────────────────────────────
  items:        [lineItemSchema],
  subtotal:     { type: Number, default: 0 },
  globalDiscountType: { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
  globalDiscountValue: { type: Number, default: 0 },
  discountTotal:{ type: Number, default: 0 },
  tax:          { type: Number, default: 0 },
  taxRate:      { type: Number, default: 0 },  // global tax %
  total:        { type: Number, default: 0 },
  currency:     { type: String, default: 'LKR' },
  /** When currency is not LKR: LKR equivalent of 1 unit of `currency` (for reference / reporting). Default 1 for LKR. */
  exchangeRateToLKR: { type: Number, default: 1 },
  transportCharge: { type: Number, default: 0 },

  // ── Terms / Notes ────────────────────────────────────────────────────────────
  paymentTerms: { type: String, default: '' },
  terms:        { type: String, default: '' },
  notes:        { type: String, default: '' },

  // ── Bank & Method ────────────────────────────────────────────────────────────
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'cheque', 'card', 'online', 'custom', ''],
    default: '',
  },
  paymentMethodCustom: { type: String, default: '' },
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
  bankBranch: { type: String, default: '' },

  // ── Payment Tracking ─────────────────────────────────────────────────────────
  payments:          [paymentEntrySchema],   // all payments (advances + regular)
  totalPaid:         { type: Number, default: 0 },
  totalAdvances:     { type: Number, default: 0 },
  remainingBalance:  { type: Number, default: 0 },

  // ── Status ───────────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['draft', 'unpaid', 'partial', 'paid', 'overdue', 'cancelled'],
    default: 'draft',
  },

  // ── Signatures ───────────────────────────────────────────────────────────────
  signatures: {
    authorizer: {
      data: { type: String, default: '' },
      name: { type: String, default: '' },
      title: { type: String, default: 'Authorized Signatory' }
    },
    seal: {
      data: { type: String, default: '' },
      note: { type: String, default: '' }
    }
  },

  // ── Legacy PayHere ───────────────────────────────────────────────────────────
  paidAt:     Date,
  paymentRef: { type: String, default: '' },

}, { timestamps: true });

// Invoice numbers are assigned in controllers (quotation → same as QUO-…; otherwise generateAutoInvoiceNo).
// A pre-save hook here was overwriting quotation-based numbers with INV-….

// ── Auto-recalculate totals & status ─────────────────────────────────────────
invoiceSchema.pre('save', function (next) {
  // Recalculate payment totals
  this.totalAdvances    = this.payments.filter(p => p.isAdvance).reduce((s, p) => s + p.amount, 0);
  this.totalPaid        = this.payments.reduce((s, p) => s + p.amount, 0);
  this.remainingBalance = Math.max(0, this.total - this.totalPaid);

  // Auto-update status (don't override cancelled/draft)
  if (this.status !== 'cancelled' && this.status !== 'draft') {
    if (this.remainingBalance === 0) {
      this.status = 'paid';
      if (!this.paidAt) this.paidAt = new Date();
    } else if (this.totalPaid > 0) {
      this.status = this.dueDate && new Date() > this.dueDate ? 'overdue' : 'partial';
    } else {
      this.status = this.dueDate && new Date() > this.dueDate ? 'overdue' : 'unpaid';
    }
  }
  next();
});

invoiceSchema.index({ branch: 1, createdAt: -1 });
invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ client: 1, createdAt: -1 });
invoiceSchema.index({ project: 1 });
invoiceSchema.index({ 'payments.date': 1 });
invoiceSchema.index({ source: 1, createdAt: -1 }); // source filter (manual vs subscription)

module.exports = mongoose.model('Invoice', invoiceSchema);

