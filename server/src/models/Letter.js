const mongoose = require('mongoose');

const letterSchema = new mongoose.Schema({
  recipientType: { type: String, enum: ['employee', 'client'], default: 'employee' },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: {
    type: String,
    enum: ['offer', 'appointment', 'confirmation', 'experience', 'salary', 'service_agreement', 'epf_confirmation', 'warning', 'termination', 'internship', 'contract', 'part_time', 'resignation', 'custom', 'quotation_cover', 'welcome', 'thank_you', 'overdue_notice', 'renewal_notice'],
    required: true
  },
  title: { type: String, required: true },
  content: { type: String, required: true },
  bodyFormat: { type: String, enum: ['html', 'text'], default: 'html' },
  letterRef: { type: String, index: true },
  pdfUrl: String,
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  issuedDate: { type: Date, default: Date.now },
  sentByEmail: { type: Boolean, default: false },
  sentAt: Date,
  approvalStatus: {
    type: String,
    enum: ['none', 'pending', 'approved'],
    default: 'none',
  },
  signatures: {
    activeRole: { type: String, enum: ['', 'admin', 'director', 'manager', 'hr', 'custom', 'marketing'], default: 'admin' },
    includeSignature: { type: Boolean, default: true },
    includeSeal: { type: Boolean, default: true },
    signatory: {
      role: { type: String, default: '' },
      data: { type: String, default: '' },
      name: { type: String, default: '' },
      title: { type: String, default: '' },
    },
    hr: { data: { type: String, default: '' }, name: { type: String, default: '' }, title: { type: String, default: '' } },
    manager: { data: { type: String, default: '' }, name: { type: String, default: '' }, title: { type: String, default: '' } },
    seal: { data: { type: String, default: '' } },
    director: { data: { type: String, default: '' }, name: { type: String, default: '' }, title: { type: String, default: '' } },
    marketing: { data: { type: String, default: '' }, name: { type: String, default: '' }, title: { type: String, default: '' } },
  },
  structuredData: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

letterSchema.pre('save', async function letterRefPre(next) {
  if (!this.letterRef) {
    const y = new Date().getFullYear();
    const n = await mongoose.model('Letter').countDocuments();
    this.letterRef = `LTR-${y}-${String(n + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Letter', letterSchema);
