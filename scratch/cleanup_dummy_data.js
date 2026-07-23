const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://raxwotechnology_db_user:2ZPD18kFcIVlwTBm@cluster0.4zrxp6p.mongodb.net/raxwo_db?retryWrites=true&w=majority&appName=Cluster0';

const ServiceSchema = new mongoose.Schema({
  title: String,
  type: String,
  category: String,
  description: String,
}, { timestamps: true, collection: 'services' });

const Service = mongoose.model('Service', ServiceSchema);

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const services = await Service.find({});
  console.log(`Total services in DB: ${services.length}`);
  services.forEach(s => {
    console.log(`- ID: ${s._id}, Title: "${s.title}", Type: "${s.type || 'N/A'}", Category: "${s.category || 'N/A'}"`);
  });

  const keepTitles = ['Gymora ERP', 'Web Development', 'Mobile App Development', 'Enterprise Systems', 'Cloud & DevOps'];
  
  const toDelete = services.filter(s => !keepTitles.some(k => s.title && s.title.toLowerCase().includes(k.toLowerCase())));
  console.log(`Found ${toDelete.length} extra/dummy items to clean up.`);

  for (const item of toDelete) {
    console.log(`Deleting extra item: ${item._id} - ${item.title}`);
    await Service.deleteOne({ _id: item._id });
  }

  const remaining = await Service.find({});
  console.log(`Remaining services in DB: ${remaining.length}`);
  remaining.forEach(s => {
    console.log(`- ${s.title} (${s.type || 'service'})`);
  });

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error running cleanup:', err);
  process.exit(1);
});
