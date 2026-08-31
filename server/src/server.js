// Global error handlers to prevent backend process crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err);
});

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Robust .env resolution: works when run from root or server directory
[
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
].forEach((p) => {
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
});

const app = require('./app');
const connectDB = require('./config/db');
const http = require('http');
const { initSocket } = require('./socket');

const PORT = process.env.PORT || 5000;

// Start HTTP server immediately; DB connects with retries.
connectDB();
const server = http.createServer(app);
initSocket(server);
server.listen(PORT, () => {
  console.log(`🚀 Raxwo Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

require('./services/cronService');
