const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { uploadDataUri } = require('../services/cloudinaryService');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/raxwo';

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB successfully.');

  const db = mongoose.connection.db;

  // 1. Migrate Signature Requests
  console.log('\n--- 1. Migrating Signature Requests ---');
  const sigCollection = db.collection('signaturerequests');
  const sigCursor = sigCollection.find({
    $or: [
      { originalDocUrl: { $regex: '^data:' } },
      { signedDocUrl: { $regex: '^data:' } },
    ]
  });
  const sigs = await sigCursor.toArray();
  console.log(`Found ${sigs.length} signature requests with Base64 files.`);

  let sigMigrated = 0;
  for (const s of sigs) {
    const updates = {};
    if (s.originalDocUrl && s.originalDocUrl.startsWith('data:')) {
      try {
        console.log(`[SigReq ${s.requestRef || s._id}] Uploading originalDocUrl...`);
        updates.originalDocUrl = await uploadDataUri(s.originalDocUrl, {
          folder: 'raxwo/signature_requests/originals',
          public_id: `orig_${s.requestRef || s._id}_${Date.now()}`
        });
      } catch (e) {
        console.error(`Failed originalDocUrl for ${s._id}:`, e.message);
      }
    }
    if (s.signedDocUrl && s.signedDocUrl.startsWith('data:')) {
      try {
        console.log(`[SigReq ${s.requestRef || s._id}] Uploading signedDocUrl...`);
        updates.signedDocUrl = await uploadDataUri(s.signedDocUrl, {
          folder: 'raxwo/signature_requests/signed',
          public_id: `signed_${s.requestRef || s._id}_${Date.now()}`
        });
      } catch (e) {
        console.error(`Failed signedDocUrl for ${s._id}:`, e.message);
      }
    }
    if (Object.keys(updates).length > 0) {
      await sigCollection.updateOne({ _id: s._id }, { $set: updates });
      sigMigrated++;
      console.log(`Updated SignatureRequest ${s.requestRef || s._id}`);
    }
  }
  console.log(`Finished Signature Requests: ${sigMigrated} updated.`);

  // 2. Migrate Employees
  console.log('\n--- 2. Migrating Employees ---');
  const empCollection = db.collection('employees');
  const emps = await empCollection.find({
    $or: [
      { profilePhoto: { $regex: '^data:' } },
      { cvUrl: { $regex: '^data:' } },
      { nicPhotoUrl: { $regex: '^data:' } },
      { nicPhotoBackUrl: { $regex: '^data:' } },
      { agreementUrl: { $regex: '^data:' } },
    ]
  }).toArray();
  console.log(`Found ${emps.length} employees with Base64 files.`);

  let empMigrated = 0;
  for (const emp of emps) {
    const updates = {};
    const label = emp.employeeNo || emp._id;
    if (emp.profilePhoto && emp.profilePhoto.startsWith('data:')) {
      try {
        console.log(`[Employee ${label}] Uploading profilePhoto...`);
        updates.profilePhoto = await uploadDataUri(emp.profilePhoto, {
          folder: 'raxwo/employees/photos',
        });
      } catch (e) {
        console.error(`Failed profilePhoto for ${label}:`, e.message);
      }
    }
    if (emp.cvUrl && emp.cvUrl.startsWith('data:')) {
      try {
        console.log(`[Employee ${label}] Uploading cvUrl...`);
        updates.cvUrl = await uploadDataUri(emp.cvUrl, {
          folder: 'raxwo/employees/cvs',
        });
      } catch (e) {
        console.error(`Failed cvUrl for ${label}:`, e.message);
      }
    }
    if (emp.nicPhotoUrl && emp.nicPhotoUrl.startsWith('data:')) {
      try {
        updates.nicPhotoUrl = await uploadDataUri(emp.nicPhotoUrl, { folder: 'raxwo/employees/nic' });
      } catch (e) {}
    }
    if (emp.nicPhotoBackUrl && emp.nicPhotoBackUrl.startsWith('data:')) {
      try {
        updates.nicPhotoBackUrl = await uploadDataUri(emp.nicPhotoBackUrl, { folder: 'raxwo/employees/nic' });
      } catch (e) {}
    }
    if (emp.agreementUrl && emp.agreementUrl.startsWith('data:')) {
      try {
        updates.agreementUrl = await uploadDataUri(emp.agreementUrl, { folder: 'raxwo/employees/agreements' });
      } catch (e) {}
    }

    if (Object.keys(updates).length > 0) {
      await empCollection.updateOne({ _id: emp._id }, { $set: updates });
      empMigrated++;
      console.log(`Updated Employee ${label}`);
    }
  }
  console.log(`Finished Employees: ${empMigrated} updated.`);

  // 3. Migrate Users
  console.log('\n--- 3. Migrating Users (Avatars) ---');
  const userCollection = db.collection('users');
  const users = await userCollection.find({ avatar: { $regex: '^data:' } }).toArray();
  console.log(`Found ${users.length} users with Base64 avatar.`);

  let userMigrated = 0;
  for (const u of users) {
    try {
      console.log(`[User ${u.email || u._id}] Uploading avatar...`);
      const newAvatar = await uploadDataUri(u.avatar, { folder: 'raxwo/users/avatars' });
      await userCollection.updateOne({ _id: u._id }, { $set: { avatar: newAvatar } });
      userMigrated++;
    } catch (e) {
      console.error(`Failed user avatar for ${u.email}:`, e.message);
    }
  }
  console.log(`Finished Users: ${userMigrated} updated.`);

  // 4. Migrate Site Settings
  console.log('\n--- 4. Migrating Site Settings ---');
  const settingsCollection = db.collection('sitesettings');
  const settings = await settingsCollection.find({}).toArray();
  for (const s of settings) {
    const updates = {};
    const checkFields = ['logoUrl', 'sealUrl', 'letterheadUrl'];
    for (const f of checkFields) {
      if (s[f] && typeof s[f] === 'string' && s[f].startsWith('data:')) {
        try {
          console.log(`[SiteSetting] Uploading ${f}...`);
          updates[f] = await uploadDataUri(s[f], { folder: 'raxwo/branding' });
        } catch (e) {}
      }
    }
    if (Object.keys(updates).length > 0) {
      await settingsCollection.updateOne({ _id: s._id }, { $set: updates });
      console.log('Updated SiteSettings branding.');
    }
  }

  console.log('\n=========================================');
  console.log('Migration to Cloudinary completed successfully!');
  console.log('=========================================');

  await mongoose.disconnect();
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { migrate };
