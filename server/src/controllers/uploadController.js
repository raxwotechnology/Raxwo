let sharp = null;
try {
  sharp = require('sharp');
} catch (_) {
  sharp = null;
}

const { relativeUploadPath } = require('../utils/uploadsPath');

exports.uploadImageFile = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    let imageUrl;
    if (req.file.filename && req.file.filename.startsWith('data:')) {
      imageUrl = req.file.filename;
    } else {
      const isSvg = req.file.mimetype === 'image/svg+xml';
      if (!isSvg && sharp) {
        try {
          const optimized = await sharp(req.file.buffer)
            .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();
          imageUrl = `data:image/webp;base64,${optimized.toString('base64')}`;
        } catch (e) {
          const b64 = Buffer.from(req.file.buffer).toString('base64');
          imageUrl = `data:${req.file.mimetype};base64,${b64}`;
        }
      } else {
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        imageUrl = `data:${req.file.mimetype};base64,${b64}`;
      }
    }
    res.status(201).json({ success: true, imageUrl });
  } catch (err) { next(err); }
};
