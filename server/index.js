const path = require('path');
const fs = require('fs');

// Support running when Application Root is 'server' or root directory
if (fs.existsSync(path.join(__dirname, 'src/server.js'))) {
  require('./src/server.js');
} else if (fs.existsSync(path.join(__dirname, 'server/src/server.js'))) {
  require('./server/src/server.js');
} else {
  require('./src/server');
}