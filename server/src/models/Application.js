const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  // Parsed CV Data
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  linkedin: { type: String, default: '' },
  portfolio: { type: String, default: '' },
  address: { type: String, default: '' },
  // CV File
  cvUrl: { type: String, required: true },
  cvPublicId: String,
  // Parsed / Extracted
  extractedData: {
    summary: String,
    skills: [String],
    education: [{
      institution: String,
      degree: String,
      field: String,
      year: String,
    }],
    experience: [{
      company: String,
      role: String,
      duration: String,
      description: String,
    }],
    languages: [String],
    certifications: [String],
  },
  skills: [String],
  experienceYears: { type: Number, default: 0 },
  // ATS Score
  matchScore: { type: Number, default: 0, min: 0, max: 100 },
  // Status pipeline
  status: {
    type: String,
    enum: ['new', 'reviewing', 'shortlisted', 'interview', 'offered', 'hired', 'rejected'],
    default: 'new'
  },
  // Scheduling
  interviewDate: Date,
  interviewNotes: String,
  // Admin actions
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: String,
  coverLetter: String,
}, { timestamps: true });

applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ job: 1, status: 1 });

module.exports = mongoose.model('Application', applicationSchema);
