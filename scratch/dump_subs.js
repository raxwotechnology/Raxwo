require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
require('../server/src/models/User');
require('../server/src/models/Project');
const Subscription = require('../server/src/models/Subscription');

async function listAll() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/raxwo');
  const subs = await Subscription.find().populate('client', 'name email').sort({ subscriptionNo: 1 }).lean();

  fs.writeFileSync('scratch/all_subs.json', JSON.stringify(subs, null, 2));
  console.log(`Saved ${subs.length} subscriptions to scratch/all_subs.json`);
  process.exit(0);
}

listAll().catch(e => { console.error(e); process.exit(1); });
