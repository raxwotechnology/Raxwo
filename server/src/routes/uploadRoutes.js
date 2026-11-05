const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadImageLocal, uploadImagesLocal, uploadFile } = require('../middleware/upload');
const { uploadImageFile, uploadMultipleImages } = require('../controllers/uploadController');
const { relativeUploadPath } = require('../utils/uploadsPath');

router.post('/images', protect, (req, res, next) => {
  uploadImagesLocal(req, res, (err) => {
    if (err) return next(err);
    return uploadMultipleImages(req, res, next);
  });
});

router.post('/image', protect, (req, res, next) => {
  uploadImageLocal(req, res, (err) => {
    if (err) return next(err);
    return uploadImageFile(req, res, next);
  });
});

// Generic document / file upload (CV, NIC, agreement etc.)
router.post('/file', protect, (req, res, next) => {
  uploadFile(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const fileUrl = relativeUploadPath('documents', req.file.filename);
    return res.json({ success: true, fileUrl, filename: req.file.filename, originalName: req.file.originalname, size: req.file.size });
  });
});

module.exports = router;


