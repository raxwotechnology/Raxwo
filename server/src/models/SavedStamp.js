const mongoose = require('mongoose');

const savedStampSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ['signature', 'seal'], default: 'signature' },
  imageUrl: { type: String, required: true },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('SavedStamp', savedStampSchema);
