const path = require('path');
const fs = require('fs');

if (fs.existsSync(path.join(__dirname, 'server/src/server.js'))) {
  require('./server/src/server.js');
} else if (fs.existsSync(path.join(__dirname, 'src/server.js'))) {
  require('./src/server.js');
} else {
  require('./server/src/server');
}
