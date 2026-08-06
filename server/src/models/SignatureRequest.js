const mongoose = require('mongoose');

const signatureRequestSchema = new mongoose.Schema({
  requestRef: { type: String, index: true },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  employeeName: { type: String },
  employeeEmail: { type: String },
  employeePhone: { type: String },
  employeeType: { type: String, enum: ['intern', 'permanent', 'contract', 'other'], default: 'permanent' },
  title: { type: String, required: true },
  documentType: {
    type: String,
    enum: ['Internship Certificate', 'Contract Agreement', 'NOC', 'Service Letter', 'Recommendation Letter', 'Bank Document', 'Other'],
    default: 'Other'
  },
  reason: { type: String, required: true },
  urgency: { type: String, enum: ['normal', 'urgent'], default: 'normal' },
  notes: { type: String },
  originalDocUrl: { type: String, required: true },
  signedDocUrl: { type: String },
  status: {
    type: String,
    enum: ['pending', 'signed', 'rejected'],
    default: 'pending',
    index: true
  },
  signedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  signedByName: { type: String },
  signedByRole: { type: String, enum: ['', 'admin', 'owner', 'manager'], default: '' },
  signedAt: { type: Date },
  rejectionReason: { type: String },
  stampsMeta: {
    signature: { x: Number, y: Number, width: Number, height: Number, page: Number },
    seal: { x: Number, y: Number, width: Number, height: Number, page: Number }
  }
}, { timestamps: true });

signatureRequestSchema.pre('save', async function (next) {
  if (!this.requestRef) {
    const y = new Date().getFullYear();
    const count = await mongoose.model('SignatureRequest').countDocuments();
    this.requestRef = `SIG-${y}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('SignatureRequest', signatureRequestSchema);
