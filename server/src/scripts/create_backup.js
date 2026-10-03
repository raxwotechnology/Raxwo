const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function createBackup() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is missing from environment');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB Atlas');

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  
  const rootDir = path.resolve(__dirname, '../../../');
  const backupDir = path.join(rootDir, 'backups', `backup_${timestamp}`);
  const collectionsDir = path.join(backupDir, 'collections');
  const avatarsDir = path.join(backupDir, 'exported_avatars');

  fs.mkdirSync(collectionsDir, { recursive: true });
  fs.mkdirSync(avatarsDir, { recursive: true });

  console.log(`Creating backup in: ${backupDir}`);

  const collections = await mongoose.connection.db.listCollections().toArray();
  const summary = {
    backupDate: now.toISOString(),
    timestamp,
    database: mongoose.connection.name,
    collections: {},
    totalDocuments: 0,
    exportedAvatarsCount: 0
  };

  // 1. Dump all collections
  for (const colMeta of collections) {
    const colName = colMeta.name;
    const col = mongoose.connection.db.collection(colName);
    const docs = await col.find({}).toArray();
    summary.collections[colName] = docs.length;
    summary.totalDocuments += docs.length;

    const filePath = path.join(collectionsDir, `${colName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
    console.log(`Saved collection [${colName}]: ${docs.length} docs`);
  }

  // 2. Extract and export standalone image files from User and Employee profile pictures
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  const employees = await mongoose.connection.db.collection('employees').find({}).toArray();

  const userMap = new Map();
  users.forEach(u => userMap.set(String(u._id), u));

  let avatarCount = 0;
  for (const user of users) {
    const avatar = user.avatar;
    if (avatar && avatar.startsWith('data:image/')) {
      try {
        const match = avatar.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (match) {
          const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
          const buffer = Buffer.from(match[2], 'base64');
          const cleanName = (user.name || 'user_' + user._id).replace(/[^a-zA-Z0-9_-]/g, '_');
          const filename = `${cleanName}.${ext}`;
          fs.writeFileSync(path.join(avatarsDir, filename), buffer);
          avatarCount++;
        }
      } catch (err) {
        console.warn(`Failed to export avatar for ${user.name}:`, err.message);
      }
    }
  }

  summary.exportedAvatarsCount = avatarCount;
  console.log(`Exported ${avatarCount} physical avatar image files to: ${avatarsDir}`);

  // 3. Write summary manifest
  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(summary, null, 2), 'utf8');

  // 4. Write human-readable README.md
  const readmeContent = `# Raxwo System Database Backup
**Backup Date:** ${now.toLocaleString()} (${now.toISOString()})
**Backup Location:** \`${backupDir}\`

## Highlights
- **Total Collections Backed Up:** ${collections.length}
- **Total Documents Backed Up:** ${summary.totalDocuments}
- **Exported High-Res Employee Profile Images:** ${summary.exportedAvatarsCount} files (saved in \`exported_avatars/\`)
- **Software Products & Services:** ${summary.collections.services || 0} items (saved in \`collections/services.json\`)
- **Employees Count:** ${summary.collections.employees || 0} (saved in \`collections/employees.json\`)
- **Active Users Count:** ${summary.collections.users || 0} (saved in \`collections/users.json\`)
- **Projects Count:** ${summary.collections.projects || 0} (saved in \`collections/projects.json\`)

## Folder Structure
- \`collections/\`: JSON snapshots of all database collections (can be imported or restored anytime)
- \`exported_avatars/\`: Standalone JPG/PNG files of all employee profile pictures decoded from MongoDB Base64
- \`manifest.json\`: Metadata and counts for verification
`;

  fs.writeFileSync(path.join(backupDir, 'README.md'), readmeContent, 'utf8');

  console.log('\n========================================');
  console.log('BACKUP COMPLETED SUCCESSFULLY!');
  console.log(`Backup Folder: ${backupDir}`);
  console.log(`Total Collections: ${collections.length}`);
  console.log(`Total Documents: ${summary.totalDocuments}`);
  console.log(`Avatars Exported: ${avatarCount}`);
  console.log('========================================');

  process.exit(0);
}

createBackup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
