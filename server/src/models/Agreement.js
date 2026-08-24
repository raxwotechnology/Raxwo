const mongoose = require('mongoose');

const agreementSchema = new mongoose.Schema({
  // ── Type & Party ──────────────────────────────────────────────────────────
  agreementType: {
    type: String,
    enum: ['client_project', 'subscription_service', 'invoice_payment', 'employee_agreement', 'general', 'custom'],
    required: true,
    default: 'general',
  },
  partyType: {
    type: String,
    enum: ['client', 'employee', 'other'],
    default: 'client',
  },

  // ── Title / Reference ─────────────────────────────────────────────────────
  title: { type: String, required: true },
  agreementNo: { type: String, unique: true },
  agreementDate: { type: Date },

  // ── Linked records ────────────────────────────────────────────────────────
  client:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  employee:     { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  project:      { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  invoice:      { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },

  // ── Content ───────────────────────────────────────────────────────────────
  content: { type: String, default: '' },   // rich HTML content
  templateId: String,                        // template used to generate
  hasFrame: { type: Boolean, default: false },

  // ── Status ────────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['draft', 'finalised', 'signed', 'expired'],
    default: 'draft',
  },
  finalisedAt: Date,
  signedAt: Date,

  approvalStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none',
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,

  signatures: {
    provider: {
      data: { type: String, default: '' },
      signerName: { type: String, default: '' },
      signerDesignation: { type: String, default: '' },
      signedAt: Date,
    },
    client: {
      label: { type: String, default: 'Client / Counterparty' },
      data: { type: String, default: '' },
      signerName: { type: String, default: '' },
      signerDesignation: { type: String, default: '' },
      signerIdNumber: { type: String, default: '' },
      signedAt: Date,
    },
    witness: {
      name: { type: String, default: '' },
      data: { type: String, default: '' },
      signedAt: Date,
    },
    seal: {
      data: { type: String, default: '' },
    },
  },

  history: [{
    at: { type: Date, default: Date.now },
    action: { type: String, required: true },
    detail: { type: String, default: '' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],

  // ── Meta ──────────────────────────────────────────────────────────────────
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fileUrl: { type: String, default: '' },  // stored PDF/file URL
}, { timestamps: true });

// Auto agreement number
agreementSchema.pre('save', async function (next) {
  if (!this.agreementNo) {
    const count = await mongoose.model('Agreement').countDocuments();
    this.agreementNo = `AGR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Agreement', agreementSchema);
