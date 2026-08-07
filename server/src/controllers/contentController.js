const Service = require('../models/Service');
const PortfolioItem = require('../models/PortfolioItem');

// ── SERVICES ──────────────────────────────────────────────────────────────────

exports.getServices = async (req, res, next) => {
  try {
    const isPrivileged = ['admin', 'manager'].includes(req.user?.role);
    const query = isPrivileged ? { archived: { $ne: true } } : { active: true, archived: { $ne: true } };
    const services = await Service.find(query).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, count: services.length, services });
  } catch (err) { next(err); }
};

exports.getPublicServices = async (req, res, next) => {
  try {
    const services = await Service.find({ active: true, archived: { $ne: true } }).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, count: services.length, services });
  } catch (err) { next(err); }
};

exports.getServiceById = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, service });
  } catch (err) { next(err); }
};

exports.createService = async (req, res, next) => {
  try {
    const body = req.body;
    const payload = {
      ...body,
      topHighlights: Array.isArray(body.topHighlights)
        ? body.topHighlights
        : String(body.topHighlights || '').split('\n').map(s => s.trim()).filter(Boolean),
      features: Array.isArray(body.features)
        ? body.features
        : String(body.features || '').split(',').map((s) => s.trim()).filter(Boolean),
      categorizedFeatures: Array.isArray(body.categorizedFeatures) ? body.categorizedFeatures : [],
      modules: Array.isArray(body.modules) ? body.modules : [],
      screenshots: Array.isArray(body.screenshots) ? body.screenshots : [],
    };
    const service = await Service.create(payload);
    res.status(201).json({ success: true, service });
  } catch (err) { next(err); }
};

exports.updateService = async (req, res, next) => {
  try {
    const body = req.body;
    const payload = {
      ...body,
      ...(body.topHighlights !== undefined ? {
        topHighlights: Array.isArray(body.topHighlights)
          ? body.topHighlights
          : String(body.topHighlights || '').split('\n').map(s => s.trim()).filter(Boolean)
      } : {}),
      ...(body.features !== undefined ? {
        features: Array.isArray(body.features)
          ? body.features
          : String(body.features || '').split(',').map((s) => s.trim()).filter(Boolean),
      } : {}),
    };
    const service = await Service.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!service) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, service });
  } catch (err) { next(err); }
};

exports.archiveService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, { archived: true, active: false }, { new: true });
    if (!service) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, service });
  } catch (err) { next(err); }
};

exports.deleteService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) { next(err); }
};


// ── PACKAGE MANAGEMENT ────────────────────────────────────────────────────────

exports.addPackage = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });

    const pkg = {
      name: req.body.name,
      price: Number(req.body.price || 0),
      currency: req.body.currency || 'LKR',
      billingCycle: req.body.billingCycle || 'one-time',
      features: Array.isArray(req.body.features)
        ? req.body.features
        : String(req.body.features || '').split('\n').map(s => s.trim()).filter(Boolean),
      duration: req.body.duration || '',
      discount: Number(req.body.discount || 0),
      promotionLabel: req.body.promotionLabel || '',
      isPopular: req.body.isPopular === true || req.body.isPopular === 'true',
    };

    service.packages.push(pkg);
    await service.save();
    res.status(201).json({ success: true, service });
  } catch (err) { next(err); }
};

exports.updatePackage = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });

    const pkg = service.packages.id(req.params.pkgId);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

    const updates = {
      ...req.body,
      ...(req.body.features !== undefined ? {
        features: Array.isArray(req.body.features)
          ? req.body.features
          : String(req.body.features || '').split('\n').map(s => s.trim()).filter(Boolean),
      } : {}),
      ...(req.body.price !== undefined ? { price: Number(req.body.price) } : {}),
      ...(req.body.discount !== undefined ? { discount: Number(req.body.discount) } : {}),
    };

    Object.assign(pkg, updates);
    await service.save();
    res.json({ success: true, service });
  } catch (err) { next(err); }
};

exports.deletePackage = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });

    service.packages = service.packages.filter(p => String(p._id) !== req.params.pkgId);
    await service.save();
    res.json({ success: true, service });
  } catch (err) { next(err); }
};

// Bulk reorder services
exports.reorderServices = async (req, res, next) => {
  try {
    const { orderedIds } = req.body; // array of ids in new order
    if (!Array.isArray(orderedIds)) return res.status(400).json({ success: false, message: 'orderedIds must be an array' });

    await Promise.all(orderedIds.map((id, idx) =>
      Service.findByIdAndUpdate(id, { order: idx })
    ));
    res.json({ success: true, message: 'Services reordered' });
  } catch (err) { next(err); }
};

// ── PORTFOLIO ─────────────────────────────────────────────────────────────────

exports.getPortfolioItems = async (req, res, next) => {
  try {
    const isPrivileged = ['admin', 'manager'].includes(req.user?.role);
    const query = isPrivileged ? {} : { active: true };
    const items = await PortfolioItem.find(query).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, count: items.length, items });
  } catch (err) { next(err); }
};

exports.getPublicPortfolio = async (req, res, next) => {
  try {
    const items = await PortfolioItem.find({ active: true }).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, count: items.length, items });
  } catch (err) { next(err); }
};

exports.createPortfolioItem = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      technologies: Array.isArray(req.body.technologies)
        ? req.body.technologies
        : String(req.body.technologies || '').split(',').map((s) => s.trim()).filter(Boolean),
    };
    const item = await PortfolioItem.create(payload);
    res.status(201).json({ success: true, item });
  } catch (err) { next(err); }
};

exports.updatePortfolioItem = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      ...(req.body.technologies !== undefined ? {
        technologies: Array.isArray(req.body.technologies)
          ? req.body.technologies
          : String(req.body.technologies || '').split(',').map((s) => s.trim()).filter(Boolean),
      } : {}),
    };
    const item = await PortfolioItem.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Portfolio item not found' });
    res.json({ success: true, item });
  } catch (err) { next(err); }
};

exports.deletePortfolioItem = async (req, res, next) => {
  try {
    const item = await PortfolioItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Portfolio item not found' });
    res.json({ success: true, message: 'Portfolio item deleted' });
  } catch (err) { next(err); }
};
