const mongoose = require('mongoose');

const workLogSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  description: { type: String, required: true },
  hoursWorked: { type: Number, default: 0 },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const targetSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  targetValue: { type: Number, default: 0 },
  currentValue: { type: Number, default: 0 },
  unit: { type: String, default: 'units' },
  bonusAmount: { type: Number, default: 0 },
  deadline: Date,
  status: { type: String, enum: ['active', 'completed', 'missed'], default: 'active' },
  completedAt: Date,
  setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['cv', 'agreement', 'nic_front', 'nic_back', 'other'], default: 'other' },
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const historyLogSchema = new mongoose.Schema({
  action: String,
  note: String,
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, default: Date.now },
});

const employeeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  employeeNo: { type: String, unique: true, sparse: true },

  // ── Employment ──────────────────────────────────────────────────────────────
  department: { type: String, default: '' },
  designation: { type: String, default: '' },
  basicSalary: { type: Number, default: 0 },
  allowances: { type: Number, default: 0 },
  joinedDate: { type: Date },
  probationEnd: Date,
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  employmentType: {
    type: String,
    enum: ['permanent', 'intern', 'contract', 'part_time'],
    default: 'permanent',
  },

  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'internship', 'contract', 'on_leave', 'resigned', 'terminated', 'former', 'intern_ended'],
    default: 'active',
  },

  resignationDate: Date,
  resignationReason: { type: String, default: '' },

  // ── Internship ──────────────────────────────────────────────────────────────
  internship: {
    startDate: Date,
    endDate: Date,
    durationWeeks: Number,
    university: { type: String, default: '' },
    supervisorName: { type: String, default: '' },
    convertedAt: Date,
    convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    removalReason: String,
  },

  // ── Contract ──────────────────────────────────────────────────────────────
  contract: {
    startDate: Date,
    endDate: Date,
    contractType: { type: String, default: '' }, // e.g. 'Fixed Term', 'Project Based'
    noticePeriodDays: { type: Number, default: 30 },
    probationPeriodDays: { type: Number, default: 90 },
    renewalDate: Date,
    notes: { type: String, default: '' },
  },

  // ── Personal Info ───────────────────────────────────────────────────────────
  profilePhoto: { type: String, default: '' },
  additionalPhoto: { type: String, default: '' },
  portfolioUrl: { type: String, default: '' },
  idType: { type: String, enum: ['nic', 'driving_license', 'passport'], default: 'nic' },
  idNumber: { type: String, default: '' },
  nic: { type: String, default: '' },
  dob: Date,
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'male' },
  primaryPhone: { type: String, default: '' },
  secondaryPhone: { type: String, default: '' },

  // ── Address ─────────────────────────────────────────────────────────────────
  address: { type: String, default: '' },
  permanentAddress: { type: String, default: '' },
  currentAddress: { type: String, default: '' },
  sameAsPermanent: { type: Boolean, default: false },

  // ── Emergency Contact ───────────────────────────────────────────────────────
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String,
  },

  // ── Bank Details ────────────────────────────────────────────────────────────
  bank: { type: String, default: '' },
  bankBranch: { type: String, default: '' },
  accountNumber: { type: String, default: '' },
  accountHolder: { type: String, default: '' },
  accountType: { type: String, enum: ['savings', 'current'], default: 'savings' },

  // ── EPF / ETF ───────────────────────────────────────────────────────────────
  epfEtfEnrolled: { type: Boolean, default: false },
  epfNumber: { type: String, default: '' },
  etfNumber: { type: String, default: '' },

  // ── Leave ───────────────────────────────────────────────────────────────────
  leavesTaken: { type: Number, default: 0 },

  // ── Documents ───────────────────────────────────────────────────────────────
  cvUrl: { type: String, default: '' },
  agreementUrl: { type: String, default: '' },
  nicPhotoUrl: { type: String, default: '' },
  nicPhotoBackUrl: { type: String, default: '' },
  documents: [documentSchema],

  // ── Skills & Other ──────────────────────────────────────────────────────────
  skills: [String],

  // ── Finance ─────────────────────────────────────────────────────────────────
  advanceBalance: { type: Number, default: 0 },
  loanBalance: { type: Number, default: 0 },

  // ── Work Logs & Targets ─────────────────────────────────────────────────────
  workLogs: [workLogSchema],
  targets: [targetSchema],

  // ── History Log ─────────────────────────────────────────────────────────────
  historyLog: [historyLogSchema],

}, { timestamps: true });

// Auto-generate employee number if not set
employeeSchema.pre('save', async function (next) {
  if (!this.employeeNo) {
    const count = await mongoose.model('Employee').countDocuments();
    this.employeeNo = `EMP-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Virtual: days remaining in internship
employeeSchema.virtual('internshipDaysRemaining').get(function () {
  if (this.employmentType !== 'intern' || !this.internship?.endDate) return null;
  const diff = new Date(this.internship.endDate) - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
});

employeeSchema.set('toJSON', { virtuals: true });
employeeSchema.set('toObject', { virtuals: true });

employeeSchema.index({ branch: 1, status: 1 });
employeeSchema.index({ manager: 1, employmentType: 1 });
employeeSchema.index({ status: 1 });

module.exports = mongoose.model('Employee', employeeSchema);

