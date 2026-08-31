const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  leaveType: {
    type: String,
    enum: ['annual', 'medical', 'casual', 'half_day', 'short_leave', 'no_pay', 'sick', 'maternity', 'paternity', 'unpaid'],
    required: true,
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  days: { type: Number, required: true },

  // Half-day options
  halfDayPeriod: { type: String, enum: ['AM', 'PM'] },

  // Short leave options
  shortLeaveDuration: { type: Number }, // hours: 1, 2, or 3
  shortLeaveStart: { type: String },    // HH:MM
  shortLeaveEnd: { type: String },      // HH:MM

  reason: { type: String, default: '' },
  documentUrl: { type: String, default: '' }, // required for medical

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  insufficientBalance: { type: Boolean, default: false }, // flagged if balance = 0

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rejectedReason: String,
  remarks: String,
}, { timestamps: true });

leaveSchema.index({ employee: 1, status: 1 });
leaveSchema.index({ status: 1, createdAt: -1 });
leaveSchema.index({ startDate: 1, endDate: 1 });
leaveSchema.index({ employee: 1, startDate: 1 }); // for date range leave queries

module.exports = mongoose.model('Leave', leaveSchema);

