const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
});

const quotationSchema = new mongoose.Schema({
  quotationNo: { type: String, unique: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  title: { type: String, default: '' },
  quotationDate: { type: Date, default: Date.now },
  serviceType: {
    type: String,
    enum: ['ERP', 'POS', 'Hosting', 'Website', 'Maintenance', 'Custom', 'Other'],
    default: 'Other'
  },
  items: [quotationItemSchema],
  subtotal: { type: Number, default: 0 },
  globalDiscountType: { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
  globalDiscountValue: { type: Number, default: 0 },
  discountTotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  taxRate: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  currency: { type: String, default: 'LKR' },
  exchangeRateToLKR: { type: Number, default: 1 },
  advanceAmount: { type: Number, default: 0 },
  transportCharge: { type: Number, default: 0 },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'cheque', 'card', 'online', 'custom', ''],
    default: '',
  },
  paymentMethodCustom: { type: String, default: '' },
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
  bankBranch: { type: String, default: '' },
  preparedBy: { type: String, default: '' },
  directorRole: { type: String, enum: ['', 'admin', 'manager', 'hr'], default: '' },
  directorName: { type: String, default: '' },
  directorSealUrl: { type: String, default: '' },
  showSeal: { type: Boolean, default: true },
  validUntil: { type: Date },
  notes: { type: String, default: '' },
  terms: { type: String, default: '' },
  status: {
    type: String,
    enum: ['draft', 'sent', 'accepted', 'confirmed', 'rejected', 'expired', 'converted'],
    default: 'draft'
  },
  statusLog: [{
    status: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  convertedToInvoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  confirmedAt: Date,
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acceptedAt: Date,
  sentAt: Date,
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Auto-generate quotation number (must not collide with another quotation or any invoice number)
quotationSchema.pre('save', async function (next) {
  if (this.quotationNo) return next();
  try {
    const Invoice = require('./Invoice');
    const QuotationModel = mongoose.model('Quotation');
    const year = new Date().getFullYear();
    const baseCount = await QuotationModel.countDocuments();
    for (let i = 0; i < 5000; i++) {
      const candidate = `QT-${year}-${String(baseCount + 1 + i).padStart(3, '0')}`;
      const qFilter = { quotationNo: candidate };
      if (this._id) qFilter._id = { $ne: this._id };
      const [qClash, invClash] = await Promise.all([
        QuotationModel.findOne(qFilter).select('_id').lean(),
        Invoice.findOne({ invoiceNo: candidate }).select('_id').lean(),
      ]);
      if (!qClash && !invClash) {
        this.quotationNo = candidate;
        return next();
      }
    }
    return next(new Error('Could not allocate a unique quotation number'));
  } catch (e) {
    return next(e);
  }
});

// Composite indexes for fast query performance & sorting
quotationSchema.index({ createdAt: -1 });
quotationSchema.index({ status: 1, createdAt: -1 });
quotationSchema.index({ client: 1, createdAt: -1 });
quotationSchema.index({ branch: 1, createdAt: -1 });

module.exports = mongoose.model('Quotation', quotationSchema);

