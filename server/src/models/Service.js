const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, default: 0 },
  currency: { type: String, default: 'LKR' },
  billingCycle: { type: String, enum: ['one-time', 'monthly', 'quarterly', 'yearly', 'lifetime', 'startup', 'custom'], default: 'one-time' },
  features: [{ type: String }],
  duration: { type: String, default: '' },
  discount: { type: Number, default: 0 },
  promotionLabel: { type: String, default: '' },
  isPopular: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const categorizedFeatureSchema = new mongoose.Schema({
  categoryName: { type: String, default: 'General Features', trim: true },
  items: [{ type: String, trim: true }],
}, { _id: false });

const moduleSchema = new mongoose.Schema({
  name: { type: String, default: '', trim: true },
  description: { type: String, default: '', trim: true },
}, { _id: false });

const serviceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  tagline: { type: String, default: '', trim: true },
  description: { type: String, default: '', trim: true },
  type: { type: String, enum: ['service', 'product'], default: 'product' },
  category: { type: String, default: 'ERP' },
  badge: { type: String, default: 'ERP', trim: true },
  
  // Feature management
  topHighlights: [{ type: String, trim: true }], // Top 4 features on front card
  categorizedFeatures: [categorizedFeatureSchema], // Full features breakdown in Modal & Detail Page
  features: [{ type: String }], // Legacy array fallback

  // Demo & Auto Login Config
  demoUrl: { type: String, default: '', trim: true },
  demoUsername: { type: String, default: '', trim: true },
  demoPassword: { type: String, default: '', trim: true },
  autoLoginUrl: { type: String, default: '', trim: true },

  // Pricing & Lead Generation
  price: { type: Number, default: 0 },
  currency: { type: String, enum: ['LKR', 'USD'], default: 'LKR' },
  billingPeriod: { type: String, enum: ['monthly', 'yearly', 'one-time', 'lifetime', 'custom'], default: 'monthly' },
  priceText: { type: String, default: '' },
  priceType: { type: String, enum: ['one-time', 'monthly', 'yearly', 'lifetime', 'startup', 'custom'], default: 'monthly' },
  contactActionType: { type: String, enum: ['whatsapp', 'form'], default: 'whatsapp' },
  whatsappNumber: { type: String, default: '', trim: true },
  leadFormUrl: { type: String, default: '', trim: true },

  // Detail Page Media & Modules
  imageUrl: { type: String, default: '' }, // Logo/Main image
  logoUrl: { type: String, default: '' },
  icon: { type: String, default: 'FiCode' },
  colorFrom: { type: String, default: '#3b82f6' },
  colorTo: { type: String, default: '#1d4ed8' },
  screenshots: [{ type: String }],
  videoUrl: { type: String, default: '' },
  modules: [moduleSchema],

  active: { type: Boolean, default: true },
  archived: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  packages: [packageSchema],
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
