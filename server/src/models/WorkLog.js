const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  taskName: { type: String, required: true },
  hours: { type: Number, required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  notes: { type: String, default: '' },
});

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const workLogSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeRole: { type: String, enum: ['developer', 'designer', 'marketing', 'manager', 'admin'], default: 'developer' },
  date: { type: Date, required: true, default: Date.now },
  tasks: [taskSchema],
  blockers: { type: String },
  notes: { type: String, default: '' },
  totalHours: { type: Number, default: 0 },
  status: { type: String, enum: ['submitted', 'flagged', 'reviewed', 'approved', 'rejected'], default: 'submitted' },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvalNote: { type: String, default: '' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  screenshots: [{ type: String }],
  attachments: [{ type: String }],
  projectLinks: [{ url: String, label: String }],
  comments: [commentSchema],
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }
}, { timestamps: true });

workLogSchema.index({ approvalStatus: 1 });
workLogSchema.index({ employee: 1, date: -1 });
workLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('WorkLog', workLogSchema);
