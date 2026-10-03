const mongoose = require('mongoose');
const path = require('path');
const sharp = require('sharp');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const Service = require('../models/Service');

async function optimizeBase64(base64Str, maxWidth = 500, maxHeight = 500) {
  if (!base64Str || typeof base64Str !== 'string') return base64Str;
  if (!base64Str.startsWith('data:image/')) return base64Str;

  try {
    const parts = base64Str.split(',');
    if (parts.length < 2) return base64Str;
    const buf = Buffer.from(parts[1], 'base64');
    
    // Only optimize if buffer is larger than 30KB
    if (buf.length <= 30 * 1024) return base64Str;

    const optBuf = await sharp(buf)
      .resize({ width: maxWidth, height: maxHeight, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    return `data:image/webp;base64,${optBuf.toString('base64')}`;
  } catch (err) {
    console.error('Failed to optimize image with sharp:', err.message);
    return base64Str;
  }
}

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is missing');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB Atlas');

  const services = await Service.find({});
  console.log(`Processing ${services.length} services...`);

  let totalBefore = 0;
  let totalAfter = 0;

  for (const s of services) {
    const origImgLen = (s.imageUrl || '').length;
    const origLogoLen = (s.logoUrl || '').length;
    totalBefore += origImgLen + origLogoLen;

    // Pick the best available image source
    const raw = s.imageUrl || s.logoUrl || '';
    if (raw.startsWith('data:image/')) {
      const optimized = await optimizeBase64(raw, 500, 500);
      s.imageUrl = optimized;
      s.logoUrl = optimized;
    } else {
      if (s.imageUrl) s.imageUrl = await optimizeBase64(s.imageUrl, 500, 500);
      if (s.logoUrl) s.logoUrl = await optimizeBase64(s.logoUrl, 500, 500);
    }

    // Optimize screenshots if any
    if (Array.isArray(s.screenshots) && s.screenshots.length > 0) {
      const optScreens = [];
      for (const sc of s.screenshots) {
        optScreens.push(await optimizeBase64(sc, 1200, 800));
      }
      s.screenshots = optScreens;
    }

    const newImgLen = (s.imageUrl || '').length;
    const newLogoLen = (s.logoUrl || '').length;
    totalAfter += newImgLen + newLogoLen;

    await s.save();
    console.log(`✓ [${s.type}] ${s.title}: ${(origImgLen / 1024).toFixed(1)} KB -> ${(newImgLen / 1024).toFixed(1)} KB`);
  }

  console.log('\n--- Optimization Complete ---');
  console.log(`Total image payload before: ${(totalBefore / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total image payload after:  ${(totalAfter / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Saved: ${((totalBefore - totalAfter) / 1024 / 1024).toFixed(2)} MB (${((1 - totalAfter / totalBefore) * 100).toFixed(1)}% reduction)`);

  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error during optimization:', err);
  process.exit(1);
});
