require('dotenv').config();
const mongoose = require('mongoose');

async function cleanSarahFromDb() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGO_URI_FALLBACK || 'mongodb://127.0.0.1:27017/raxwo';
  try {
    console.log(`Connecting to MongoDB... (${mongoUri})`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    const User = require('../models/User');

    // Update Manager to Rashin Sheran
    const result = await User.updateMany(
      { $or: [{ name: /Sarah Manager/i }, { name: /Operations Manager/i }, { email: 'manager@raxwo.com' }] },
      { $set: { name: 'Rashin Sheran' } }
    );

    console.log(`✅ Successfully updated ${result.modifiedCount} user record(s) in Database.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating database:', error.message);
    process.exit(1);
  }
}

cleanSarahFromDb();
