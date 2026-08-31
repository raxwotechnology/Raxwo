const mongoose = require('mongoose');

const approvalStepSchema = new mongoose.Schema({
  role: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  note: { type: String, default: '' },
  action: { type: String, enum: ['approved', 'rejected', 'pending'], default: 'pending' },
});

const requestSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeRole: { type: String, default: 'developer' },
  type: {
    type: String,
    enum: [
      'experience_letter',
      'salary_confirmation',
      'leave_letter',
      'hr_document',
      'general',
      'tool_request',
      'other',
    ],
    default: 'general',
  },
  subject: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'manager_approved', 'admin_approved', 'rejected'],
    default: 'pending',
  },
  rejectionReason: { type: String, default: '' },
  approvalChain: [approvalStepSchema],
  attachments: [{ type: String }],
  generatedDocument: { type: String, default: '' },
}, { timestamps: true });

requestSchema.index({ status: 1, createdAt: -1 });
requestSchema.index({ employee: 1, status: 1 });

module.exports = mongoose.model('Request', requestSchema);
