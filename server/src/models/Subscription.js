const mongoose = require('mongoose');

const paymentRecordSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  paidAt: { type: Date, default: Date.now },
  method: {
    type: String,
    default: 'manual',
  },
  reference: { type: String, default: '' },
  note: { type: String, default: '' },
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', default: null },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  chequeNumber: { type: String, default: '' },
  chequeDate: { type: Date },
  chequeBank: { type: String, default: '' },
  chequeDrawer: { type: String, default: '' },
}, { timestamps: true });

const hostingDetailSchema = new mongoose.Schema({
  hostingUrl: { type: String, default: '' },
  domainName: { type: String, default: '' },
  provider: { type: String, default: '' },
  hostingPlan: { type: String, default: '' },
  expiryDate: { type: Date },
  renewalStatus: { type: String, enum: ['active', 'pending_renewal', 'expired', 'cancelled'], default: 'active' },
  sslEnabled: { type: Boolean, default: false },
  nameservers: { type: String, default: '' },
  registrar: { type: String, default: '' },
  domainExpiryDate: { type: Date },
  notes: { type: String, default: '' },
});

const socialMediaLinksSchema = new mongoose.Schema({
  facebook: { type: String, default: '' },
  instagram: { type: String, default: '' },
  tiktok: { type: String, default: '' },
  youtube: { type: String, default: '' },
  linkedin: { type: String, default: '' },
  twitter: { type: String, default: '' },
}, { _id: false });

const agreementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['hosting', 'maintenance', 'service', 'social_media', 'other'], default: 'service' },
  fileUrl: { type: String, default: '' },
  fileName: { type: String, default: '' },
  uploadedAt: { type: Date, default: Date.now },
  validFrom: { type: Date },
  validUntil: { type: Date },
  notes: { type: String, default: '' },
});

const subscriptionSchema = new mongoose.Schema({
  // Core relations
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  previousProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],

  // Subscription info
  subscriptionNo: { type: String, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  subscriptionType: {
    type: String,
    enum: [
      'website_maintenance',
      'app_maintenance',
      'hosting_domain',
      'social_media_facebook',
      'social_media_instagram',
      'social_media_tiktok',
      'content_management',
      'technical_support',
      'bug_fixing',
      'seo_marketing',
      'social_media_management',
      'custom',
    ],
    required: true,
  },
  customServiceType: { type: String, default: '' },

  // Billing
  amount: { type: Number, required: true }, // Custom per-client monthly amount
  currency: { type: String, default: 'LKR' },
  billingFrequency: { type: String, enum: ['monthly', 'quarterly', 'semi_annual', 'annual'], default: 'monthly' },
  billingDay: { type: Number, default: 1, min: 1, max: 31 }, // Day of month billing is due
  nextDueDate: { type: Date, required: true },
  /** @deprecated Use reminderDaysBefore; kept for backward compatibility (overdue grace). */
  gracePeriodDays: { type: Number, default: 0 },
  /** Notify admins this many days before nextDueDate (e.g. 5). Null/0 = no reminder. */
  reminderDaysBefore: { type: Number, default: null, min: 0, max: 90 },
  /** Last calendar day we sent the pre-due admin reminder (dedupe). */
  lastSubscriptionReminderDay: { type: String, default: '' },

  // Payment tracking
  totalBilled: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  payments: [paymentRecordSchema],

  // Overdue
  overdueDays: { type: Number, default: 0 },
  lastOverdueCheck: { type: Date },

  // Status
  status: {
    type: String,
    enum: ['active', 'paused', 'overdue', 'cancelled', 'expired'],
    default: 'active',
  },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },

  // Hosting & Domain
  hostingDetails: hostingDetailSchema,

  // Social Media Links
  socialMediaLinks: { type: socialMediaLinksSchema, default: () => ({}) },

  // Agreements
  agreements: [agreementSchema],

  // Initial Payment Method (Default)
  paymentMethod: { type: String, default: 'cash' },
  bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', default: null },

  // Notes
  adminNotes: { type: String, default: '' },

}, { timestamps: true });

// Auto-generate subscription number
subscriptionSchema.pre('save', async function (next) {
  if (this.subscriptionNo) return next();
  try {
    const SubscriptionModel = mongoose.model('Subscription');
    const year = new Date().getFullYear();
    const baseCount = await SubscriptionModel.countDocuments();
    for (let i = 0; i < 5000; i++) {
      const candidate = `SUB-${year}-${String(baseCount + 1 + i).padStart(4, '0')}`;
      const filter = { subscriptionNo: candidate };
      if (this._id) filter._id = { $ne: this._id };
      const clash = await SubscriptionModel.findOne(filter).select('_id').lean();
      if (!clash) {
        this.subscriptionNo = candidate;
        return next();
      }
    }
    return next(new Error('Could not allocate a unique subscription number'));
  } catch (e) {
    return next(e);
  }
});

// Virtual: remaining balance
subscriptionSchema.virtual('remainingBalance').get(function () {
  return Math.max(0, this.totalBilled - this.totalPaid);
});

// Index for quick lookups
subscriptionSchema.index({ client: 1, status: 1 });
subscriptionSchema.index({ nextDueDate: 1 });
subscriptionSchema.index({ 'hostingDetails.expiryDate': 1 });

subscriptionSchema.set('toJSON', { virtuals: true });
subscriptionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
