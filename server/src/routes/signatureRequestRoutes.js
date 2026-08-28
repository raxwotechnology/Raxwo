const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadFile, uploadImageLocal, uploadSignedDocument, uploadSigOriginalDoc, uploadSigSignedDoc } = require('../middleware/upload');
const controller = require('../controllers/signatureRequestController');

// 1. Get saved signature and seal stamps for logged in Admin/Owner
router.get('/stamps', protect, controller.getSavedStamps);

// 2. Save/update signature and seal stamps
router.post(
  '/stamps',
  protect,
  authorize('admin', 'owner', 'manager'),
  uploadImageLocal,
  controller.saveStamps
);

// Saved Stamp Library Routes
router.get('/saved-stamps', protect, controller.getSavedStampsList);
router.post('/saved-stamps', protect, authorize('admin', 'owner', 'manager'), uploadImageLocal, controller.createSavedStamp);
router.put('/saved-stamps/:id', protect, authorize('admin', 'owner', 'manager'), uploadImageLocal, controller.updateSavedStamp);
router.delete('/saved-stamps/:id', protect, authorize('admin', 'owner', 'manager'), controller.deleteSavedStamp);

// 3. Create a new Signature Request (Employee / Intern)
// Uses disk storage → file saved as /uploads/documents/sigdoc_xxx.pdf
router.post(
  '/',
  protect,
  (req, res, next) => {
    uploadSigOriginalDoc(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message });
      next();
    });
  },
  controller.createRequest
);

// 4. Get Signature Requests (Filtered)
router.get('/', protect, controller.getRequests);

// 5. Get Single Request Details
router.get('/:id', protect, controller.getRequestById);

// 6. Sign and finalize request (Admin / Owner) — primary route
router.put(
  '/:id/sign',
  protect,
  authorize('admin', 'owner', 'manager'),
  (req, res, next) => {
    uploadSigSignedDoc(req, res, (err) => {
      if (err) {
        console.warn('Upload signed document warning:', err.message);
      }
      next();
    });
  },
  controller.signAndFinalize
);

// 6b. Submit signed document — alias called by DocSignatureEditorModal
router.post(
  '/:id/submit-signed',
  protect,
  authorize('admin', 'owner', 'manager'),
  (req, res, next) => {
    uploadSigSignedDoc(req, res, (err) => {
      if (err) console.warn('Upload signed document warning:', err.message);
      next();
    });
  },
  controller.signAndFinalize
);

// 7. Reject signature request (Admin / Owner)
router.put(
  '/:id/reject',
  protect,
  authorize('admin', 'owner', 'manager'),
  controller.rejectRequest
);

// 8. Hard Delete signature request (Admin / Owner)
router.delete(
  '/:id',
  protect,
  authorize('admin', 'owner', 'manager'),
  controller.deleteRequest
);

// 9. Update signature request (Admin / Owner / Manager or Requester if pending)
router.put(
  '/:id',
  protect,
  (req, res, next) => {
    uploadSigOriginalDoc(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message });
      next();
    });
  },
  controller.updateRequest
);

module.exports = router;
