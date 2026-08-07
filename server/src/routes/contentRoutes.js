const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getServices, getPublicServices, getServiceById, createService, updateService, archiveService, deleteService,
  addPackage, updatePackage, deletePackage, reorderServices,
  getPortfolioItems, getPublicPortfolio, createPortfolioItem, updatePortfolioItem, deletePortfolioItem,
} = require('../controllers/contentController');

// ── Public routes (no auth needed) ──────────────────────────────────────────
router.get('/public/services', getPublicServices);
router.get('/public/services/:id', getServiceById);
router.get('/public/portfolio', getPublicPortfolio);

// ── Services ─────────────────────────────────────────────────────────────────
router.get('/services', getServices);
router.get('/services/admin', protect, authorize('admin', 'manager'), getServices);
router.get('/services/:id', getServiceById);
router.post('/services', protect, authorize('admin', 'manager'), createService);
router.put('/services/reorder', protect, authorize('admin', 'manager'), reorderServices);
router.put('/services/:id', protect, authorize('admin', 'manager'), updateService);
router.put('/services/:id/archive', protect, authorize('admin', 'manager'), archiveService);
router.delete('/services/:id', protect, authorize('admin', 'manager'), deleteService);


// ── Packages ──────────────────────────────────────────────────────────────────
router.post('/services/:id/packages', protect, authorize('admin', 'manager'), addPackage);
router.put('/services/:id/packages/:pkgId', protect, authorize('admin', 'manager'), updatePackage);
router.delete('/services/:id/packages/:pkgId', protect, authorize('admin', 'manager'), deletePackage);

// ── Portfolio ─────────────────────────────────────────────────────────────────
router.get('/portfolio', getPortfolioItems);
router.get('/portfolio/admin', protect, authorize('admin', 'manager'), getPortfolioItems);
router.post('/portfolio', protect, authorize('admin', 'manager'), createPortfolioItem);
router.put('/portfolio/:id', protect, authorize('admin', 'manager'), updatePortfolioItem);
router.delete('/portfolio/:id', protect, authorize('admin', 'manager'), deletePortfolioItem);

module.exports = router;
