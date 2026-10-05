const SiteSetting = require('../models/SiteSetting');
const { toRelativeUploadUrl } = require('../utils/uploadsPath');

exports.downloadDatabase = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const dbDump = {};
    for (const modelName of Object.keys(mongoose.models)) {
      dbDump[modelName] = await mongoose.models[modelName].find({});
    }
    res.setHeader('Content-disposition', 'attachment; filename=raxwo_db_backup.json');
    res.setHeader('Content-type', 'application/json');
    res.send(JSON.stringify(dbDump, null, 2));
  } catch (err) { next(err); }
};

const sharp = require('sharp');

// In-memory settings cache to avoid repeated DB reads on every page load
let settingsCache = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 60000; // 1 minute

async function compressSignature(base64Str) {
  if (!base64Str || typeof base64Str !== 'string') return base64Str;
  if (!base64Str.startsWith('data:image/')) return base64Str;
  try {
    const parts = base64Str.split(',');
    if (parts.length < 2) return base64Str;
    const buf = Buffer.from(parts[1], 'base64');
    if (buf.length <= 25 * 1024) return base64Str; // already small

    const optBuf = await sharp(buf)
      .resize({ width: 400, height: 200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    return `data:image/webp;base64,${optBuf.toString('base64')}`;
  } catch (err) {
    console.warn('Failed to compress signature image:', err.message);
    return base64Str;
  }
}

exports.getSiteSettings = async (req, res, next) => {
  try {
    const now = Date.now();
    if (settingsCache && (now - settingsCacheTime) < SETTINGS_CACHE_TTL) {
      return res.json({ success: true, settings: settingsCache });
    }
    let settings = await SiteSetting.findOne()
      .select('-__v')
      .lean();
    if (!settings) {
      const created = await SiteSetting.create({});
      settings = created.toObject ? created.toObject() : created;
    }
    const plain = settings;
    if (plain.logoUrl) plain.logoUrl = toRelativeUploadUrl(plain.logoUrl);
    if (plain.sealUrl) plain.sealUrl = toRelativeUploadUrl(plain.sealUrl);
    if (plain.letterheadUrl) plain.letterheadUrl = toRelativeUploadUrl(plain.letterheadUrl);
    const sigs = plain.signatures || {};
    ['hr', 'admin', 'manager', 'director', 'marketing'].forEach((k) => {
      if (sigs[k]?.url) sigs[k].url = toRelativeUploadUrl(sigs[k].url);
    });
    plain.signatures = sigs;
    settingsCache = plain;
    settingsCacheTime = now;
    res.json({ success: true, settings: plain });
  } catch (err) { next(err); }
};

exports.updateSiteSettings = async (req, res, next) => {
  try {
    const body = { ...req.body };
    const normalizeUrl = (key) => {
      if (!(key in body)) return;
      const raw = String(body[key] || '').trim();
      body[key] = raw ? toRelativeUploadUrl(raw) : '';
    };
    normalizeUrl('logoUrl');
    normalizeUrl('sealUrl');
    normalizeUrl('letterheadUrl');

    if (body.signatures && typeof body.signatures === 'object') {
      const roles = ['hr', 'admin', 'manager', 'director', 'marketing'];
      for (const k of roles) {
        if (body.signatures[k]?.url != null) {
          let raw = String(body.signatures[k].url || '').trim();
          if (raw.startsWith('data:image/')) {
            raw = await compressSignature(raw);
          } else {
            raw = toRelativeUploadUrl(raw);
          }
          body.signatures[k].url = raw;
        }
      }
    }

    let settings = await SiteSetting.findOne();
    if (!settings) {
      settings = await SiteSetting.create(body);
    } else {
      Object.assign(settings, body);
      if ('logoUrl' in body && !String(body.logoUrl || '').trim()) {
        settings.logoUrl = '';
        settings.markModified('logoUrl');
      }
      await settings.save();
    }

    // Invalidate cache immediately on update
    settingsCache = null;
    settingsCacheTime = 0;

    res.json({ success: true, settings });
  } catch (err) { next(err); }
};
