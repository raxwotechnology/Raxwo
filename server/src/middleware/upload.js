const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadSubdir, getUploadsRoot } = require('../utils/uploadsPath');
const { CloudinaryStorage } = require('../services/cloudinaryService');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Unified Cloudinary storage for all uploads (replaces memory-heavy Base64 in MongoDB)
const unifiedStorage = new CloudinaryStorage({ folder: 'raxwo' });

const cvFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only PDF, DOC, DOCX files are allowed'), false);
};

exports.uploadCV = multer({
  storage: unifiedStorage,
  fileFilter: cvFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).single('cv');

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files allowed'), false);
};

exports.uploadImage = multer({
  storage: unifiedStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('avatar');

exports.uploadImageLocal = multer({
  storage: unifiedStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 8 * 1024 * 1024 }
}).single('image');

const agreementFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only PDF, DOC, DOCX, JPG, PNG files are allowed'), false);
};

exports.uploadAgreement = multer({
  storage: unifiedStorage,
  fileFilter: agreementFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
}).single('agreement');

const billFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only PDF, JPG, PNG, WEBP files are allowed'), false);
};

exports.uploadBill = multer({
  storage: unifiedStorage,
  fileFilter: billFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).single('bill');

const docFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Unsupported file type'), false);
};

exports.uploadFile = multer({
  storage: unifiedStorage,
  fileFilter: docFilter,
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB
}).single('file');

exports.uploadDocument = multer({
  storage: unifiedStorage,
  fileFilter: billFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).single('document');

exports.uploadLeaderPhoto = multer({
  storage: unifiedStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('image');

exports.uploadSignedDocument = multer({
  storage: unifiedStorage,
  limits: { fileSize: 30 * 1024 * 1024 }
}).single('file');

const sigDocFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext) || file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type for signature document'), false);
  }
};

/** Upload original document submitted with a signature request (saved to Cloudinary). */
exports.uploadSigOriginalDoc = multer({
  storage: unifiedStorage,
  fileFilter: sigDocFilter,
  limits: { fileSize: 30 * 1024 * 1024 }
}).single('file');

/** Upload the finalized signed document (handles both 'signedDoc' and 'file' field names). */
exports.uploadSigSignedDoc = (req, res, next) => {
  multer({
    storage: unifiedStorage,
    limits: { fileSize: 30 * 1024 * 1024 }
  }).any()(req, res, (err) => {
    if (err) return next(err);
    if (req.files && req.files.length > 0) {
      req.file = req.files.find(f => f.fieldname === 'signedDoc') || req.files[0];
    }
    next();
  });
};
