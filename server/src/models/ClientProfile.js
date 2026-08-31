const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  type: { type: String, enum: ['call', 'email', 'meeting', 'note'], default: 'note' },
  notes: { type: String, required: true },
  followUpDate: Date,
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const clientProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  companyName: { type: String, trim: true },
  contactPerson: { type: String, trim: true },
  designation: String,
  clientType: { type: String, enum: ['Individual', 'Company'], default: 'Individual' },
  industry: String,
  clientSource: { type: String, enum: ['referral', 'website', 'social media', 'direct', 'other'], default: 'direct' },
  primaryPhone: String,
  secondaryPhone: String,
  billingAddress: String,
  shippingAddress: String,
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  accountManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['Active', 'Inactive', 'Lead', 'Prospect', 'Lost'], default: 'Lead' },
  notes: [noteSchema],
}, { timestamps: true });

clientProfileSchema.index({ 'notes.followUpDate': 1 });
clientProfileSchema.index({ branch: 1, status: 1 });

module.exports = mongoose.model('ClientProfile', clientProfileSchema);

