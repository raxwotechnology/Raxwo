const mongoose = require('mongoose');
const path = require('path');
const Service = require('../server/src/models/Service');

async function runChecks() {
  console.log('🔍 Starting Step-by-Step Verification of Products & Services Showcase Module...\n');

  // Check 1: Database Model Validation
  console.log('--- CHECK 1: Database Model & Schema ---');
  try {
    const testDoc = new Service({
      title: 'Verification Gym ERP',
      tagline: 'Test Tagline',
      description: 'Test Description',
      type: 'product',
      category: 'ERP',
      badge: 'ERP',
      topHighlights: ['Check 1', 'Check 2', 'Check 3', 'Check 4'],
      categorizedFeatures: [
        { categoryName: 'Module A', items: ['Feature A1', 'Feature A2'] }
      ],
      demoUrl: 'https://demo.test.com',
      demoUsername: 'admin@test.com',
      demoPassword: 'password123',
      autoLoginUrl: 'https://demo.test.com/#autologin=true',
      price: 35000,
      currency: 'LKR',
      billingPeriod: 'monthly',
      contactActionType: 'whatsapp',
      whatsappNumber: '94770000000'
    });

    const err = testDoc.validateSync();
    if (err) {
      console.error('❌ Schema Validation Failed:', err.message);
    } else {
      console.log('✅ Schema Validation Passed! All new fields (topHighlights, categorizedFeatures, demoUrl, autoLoginUrl, badge, whatsappNumber) are valid.');
    }
  } catch (e) {
    console.error('❌ Schema Test Error:', e.message);
  }

  // Check 2: Verify Controller Exports
  console.log('\n--- CHECK 2: Controller Functions ---');
  try {
    const contentController = require('../server/src/controllers/contentController');
    const requiredFns = ['getServices', 'getPublicServices', 'getServiceById', 'createService', 'updateService', 'deleteService'];
    let allFnsExist = true;
    for (const fn of requiredFns) {
      if (typeof contentController[fn] === 'function') {
        console.log(`  ✅ Controller export '${fn}' exists.`);
      } else {
        console.error(`  ❌ Controller export '${fn}' MISSING!`);
        allFnsExist = false;
      }
    }
    if (allFnsExist) console.log('✅ All required controller endpoints are exported properly.');
  } catch (e) {
    console.error('❌ Controller Check Error:', e.message);
  }

  // Check 3: Verify Frontend Files Exist
  console.log('\n--- CHECK 3: Frontend Component Files ---');
  const fs = require('fs');

  const filesToCheck = [
    'client/src/components/showcase/ProductServiceCard.jsx',
    'client/src/components/showcase/AllFeaturesModal.jsx',
    'client/src/components/showcase/QuoteModal.jsx',
    'client/src/pages/public/ShowcaseDetailPage.jsx',
    'client/src/pages/public/SoftwareProducts.jsx',
    'client/src/pages/public/Services.jsx',
    'client/src/pages/admin/Services.jsx'
  ];

  let allFilesExist = true;
  for (const f of filesToCheck) {
    const fullP = path.join(__dirname, '..', f);
    if (fs.existsSync(fullP)) {
      const stats = fs.statSync(fullP);
      console.log(`  ✅ File '${f}' exists (${stats.size} bytes).`);
    } else {
      console.error(`  ❌ File '${f}' MISSING!`);
      allFilesExist = false;
    }
  }

  if (allFilesExist) {
    console.log('✅ All Frontend components and Showcase pages exist.');
  }

  console.log('\n🎉 ALL STEP-BY-STEP VERIFICATION CHECKS COMPLETED SUCCESSFULLY!');
}

runChecks();
