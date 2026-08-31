const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: Date, required: true },
  status: {
    type: String,
    enum: ['present', 'present_short', 'absent', 'leave', 'half_day', 'short_leave', 'late'],
    default: 'present',
  },
  checkIn: Date,
  checkOut: Date,
  breakTimes: [{
    breakIn: Date,
    breakOut: Date,
    notes: String,
  }],
  totalWorkedHours: { type: Number, default: 0 },
  breakHours: { type: Number, default: 0 },
  leaveHours: { type: Number, default: 0 },
  nonWorkedHours: { type: Number, default: 0 },
  missingHours: { type: Number, default: 0 },
  otHours: { type: Number, default: 0 },
  otAmount: { type: Number, default: 0 },
  lateDeductionAmount: { type: Number, default: 0 },
  hourlyDeductionAmount: { type: Number, default: 0 },
  isHalfDay: { type: Boolean, default: false },
  isFullDay: { type: Boolean, default: true },
  notes: String,
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: -1 });
attendanceSchema.index({ employee: 1, date: -1 });
attendanceSchema.index({ status: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);

