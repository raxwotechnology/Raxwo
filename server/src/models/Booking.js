const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isGuest: { type: Boolean, default: false },
  guestName: { type: String },
  guestEmail: { type: String },
  guestPhone: { type: String },
  service: { type: String, required: true, trim: true },
  brief: { type: String, default: '' },
  preferredDate: Date,
  budget: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected'],
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid',
  },
  amount: { type: Number, default: 0 },
  bookingType: { type: String, enum: ['service', 'product'], default: 'service' },
  monthlyPrice: { type: String, default: '' },
  selectedFeatures: [{ type: String }],
  productDetails: {
    title: String,
    category: String,
    priceText: String,
    features: [String],
    imageUrl: String,
  },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
}, { timestamps: true });

bookingSchema.index({ client: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);

