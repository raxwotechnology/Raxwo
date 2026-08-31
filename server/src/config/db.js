const mongoose = require('mongoose');

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI;
  const fallbackUri = process.env.MONGO_URI_FALLBACK;
  let uri = primaryUri;
  if (!uri) {
    console.error('❌ MongoDB Error: MONGO_URI is not set');
    return;
  }

  const maxDelayMs = 15000;
  let attempt = 0;

  // Keep retrying so dev server can recover from DNS hiccups / temporary Atlas downtime
  while (true) {
    try {
      attempt += 1;
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      if (process.env.ENSURE_STAFF_LOGINS === 'true') {
        const { ensureStaffLogins } = require('../services/ensureStaffLogins');
        ensureStaffLogins({ resetPassword: false }).catch((err) => {
          console.error('[staff-logins] Could not ensure demo staff users:', err.message);
        });
      }
      return;
    } catch (error) {
      // If SRV lookups are blocked on this network, allow fallback to non-SRV/local URI.
      if (fallbackUri && uri === primaryUri && String(error.message || '').includes('querySrv')) {
        console.error('⚠️ MongoDB SRV lookup failed; trying MONGO_URI_FALLBACK...');
        uri = fallbackUri;
        attempt = 0;
        continue;
      }
      const delay = Math.min(2000 + attempt * 1000, maxDelayMs);
      console.error(`❌ MongoDB Error: ${error.message} (retrying in ${Math.round(delay / 1000)}s)`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
};

module.exports = connectDB;
