const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema({
  employee:    { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  manager:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetLevel: { type: String, enum: ['employee', 'team'], default: 'team' },
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  type:        { type: String, enum: ['monthly', 'quarterly', 'annual'], default: 'monthly' },

  // Period
  month:       { type: Number },   // 1-12 (for monthly)
  quarter:     { type: Number },   // 1-4 (for quarterly)
  year:        { type: Number, required: true },

  // Target value & achievement
  targetValue:   { type: Number, required: true },  // e.g. projects, tasks, sales
  achievedValue: { type: Number, default: 0 },
  unit:          { type: String, default: 'units' }, // 'projects', 'tasks', 'LKR', etc.

  // Bonus config (auto-calculated when target achieved)
  bonusEnabled:    { type: Boolean, default: false },
  bonusAmount:     { type: Number, default: 0 },   // fixed bonus
  bonusPercentage: { type: Number, default: 0 },   // % of salary as bonus

  // Status
  status: {
    type: String,
    enum: ['active', 'achieved', 'partial', 'missed', 'cancelled'],
    default: 'active',
  },
  achievedAt:   Date,
  bonusAdded:   { type: Boolean, default: false },  // has bonus been pushed to payroll?
  bonusPayroll: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' },

  notes:     { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Auto-calc progress %
targetSchema.virtual('progressPct').get(function () {
  if (!this.targetValue) return 0;
  return Math.min(100, Math.round((this.achievedValue / this.targetValue) * 100));
});

targetSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Target', targetSchema);
