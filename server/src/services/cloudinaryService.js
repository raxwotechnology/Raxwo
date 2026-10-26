const cloudinary = require('cloudinary').v2;

// Hardcoded Cloudinary credentials (direct connection in code as requested because Hostinger env cannot be updated)
const envCloudName = process.env.CLOUDINARY_CLOUD_NAME;
const envApiKey = process.env.CLOUDINARY_API_KEY;
const envApiSecret = process.env.CLOUDINARY_API_SECRET;

const CLOUD_NAME = (envCloudName && envCloudName !== 'your_cloud_name') ? envCloudName : 'r3e3ltny';
const API_KEY = (envApiKey && envApiKey !== 'your_api_key') ? envApiKey : '135924784336352';
const API_SECRET = (envApiSecret && envApiSecret !== 'your_api_secret') ? envApiSecret : 'witcxPITzc-W3dYs5kmKSPEUwT0';

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
  secure: true,
});

/**
 * Determine if a resource should be 'image' or 'raw'
 */
function getResourceType(mimetype, originalname = '') {
  const ext = (originalname.split('.').pop() || '').toLowerCase();
  if (mimetype && mimetype.startsWith('image/')) {
    return 'image';
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
    return 'image';
  }
  return 'raw';
}

/**
 * Upload a stream (e.g. from Multer) directly to Cloudinary
 */
function uploadStream(fileStream, options = {}) {
  return new Promise((resolve, reject) => {
    const defaultOptions = {
      folder: 'raxwo/general',
      resource_type: 'auto',
      access_mode: 'public',
      ...options,
    };
    const cStream = cloudinary.uploader.upload_stream(defaultOptions, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    fileStream.pipe(cStream);
  });
}

/**
 * Upload a Buffer directly to Cloudinary
 */
function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const defaultOptions = {
      folder: 'raxwo/general',
      resource_type: 'auto',
      access_mode: 'public',
      ...options,
    };
    const cStream = cloudinary.uploader.upload_stream(defaultOptions, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    cStream.end(buffer);
  });
}

/**
 * Upload a Base64 data URI string directly to Cloudinary.
 * If upload fails, gracefully falls back to returning the original dataUri.
 */
async function uploadDataUri(dataUri, options = {}) {
  if (!dataUri || typeof dataUri !== 'string') return dataUri;
  if (!dataUri.startsWith('data:')) {
    // If it's already an http/https URL, return as-is
    return dataUri;
  }

  try {
    // Detect mime
    const mimeMatch = dataUri.match(/^data:([^;]+);base64,/);
    const mimetype = mimeMatch ? mimeMatch[1] : '';
    const isImage = mimetype.startsWith('image/');
    const resourceType = isImage ? 'image' : 'raw';
    const folder = isImage ? 'raxwo/images' : 'raxwo/documents';

    const defaultOptions = {
      folder,
      resource_type: resourceType,
      access_mode: 'public',
      ...options,
    };

    const result = await cloudinary.uploader.upload(dataUri, defaultOptions);
    return result.secure_url;
  } catch (err) {
    console.warn('[uploadDataUri Fallback to Base64]:', err.message);
    return dataUri;
  }
}

/**
 * Custom Multer Storage Engine for Cloudinary with Base64 fallback
 */
function CloudinaryStorage(opts = {}) {
  this.defaultFolder = opts.folder || 'raxwo';
}

CloudinaryStorage.prototype._handleFile = function (req, file, cb) {
  const isImage = file.mimetype && file.mimetype.startsWith('image/');
  const resource_type = isImage ? 'image' : 'raw';
  const folder = isImage ? `${this.defaultFolder}/images` : `${this.defaultFolder}/documents`;

  const chunks = [];
  file.stream.on('data', (chunk) => chunks.push(chunk));
  file.stream.on('error', (err) => cb(err));
  file.stream.on('end', async () => {
    try {
      const buffer = Buffer.concat(chunks);
      try {
        const result = await uploadBuffer(buffer, {
          folder,
          resource_type,
          access_mode: 'public',
        });

        return cb(null, {
          fieldname: file.fieldname,
          originalname: file.originalname,
          encoding: file.encoding,
          mimetype: file.mimetype,
          filename: result.secure_url,
          path: result.secure_url,
          url: result.secure_url,
          secure_url: result.secure_url,
          public_id: result.public_id,
          size: result.bytes || buffer.length,
          buffer,
        });
      } catch (cloudErr) {
        console.warn('[CloudinaryStorage Fallback to Base64]:', cloudErr.message);
        const b64 = buffer.toString('base64');
        const dataUri = `data:${file.mimetype};base64,${b64}`;
        return cb(null, {
          fieldname: file.fieldname,
          originalname: file.originalname,
          encoding: file.encoding,
          mimetype: file.mimetype,
          filename: dataUri,
          path: dataUri,
          url: dataUri,
          size: buffer.length,
          buffer,
        });
      }
    } catch (err) {
      console.error('[CloudinaryStorage Error]:', err.message);
      cb(err);
    }
  });
};

CloudinaryStorage.prototype._removeFile = function (req, file, cb) {
  cb(null);
};

module.exports = {
  cloudinary,
  uploadStream,
  uploadBuffer,
  uploadDataUri,
  CloudinaryStorage,
  getResourceType,
};
