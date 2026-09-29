const Job = require('../models/Job');
const Service = require('../models/Service');
const PortfolioItem = require('../models/PortfolioItem');

const getBaseUrl = (req) => {
  if (process.env.CLIENT_URL) {
    return process.env.CLIENT_URL.replace(/\/$/, '');
  }
  const protocol = req.headers?.['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers?.['x-forwarded-host'] || (typeof req.get === 'function' ? req.get('host') : req.headers?.host) || 'manage.raxwo.net';
  return `${protocol}://${host}`;
};

const formatDate = (date) => {
  if (!date) return new Date().toISOString().split('T')[0];
  try {
    return new Date(date).toISOString().split('T')[0];
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
};

const escapeXml = (unsafe) => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Generates dynamic XML Sitemap for all public routes, jobs, services, and products.
 */
exports.getSitemap = async (req, res) => {
  try {
    const baseUrl = getBaseUrl(req);
    const today = new Date().toISOString().split('T')[0];

    // Static core routes
    const staticPages = [
      { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'daily', lastmod: today },
      { loc: `${baseUrl}/services`, priority: '0.9', changefreq: 'weekly', lastmod: today },
      { loc: `${baseUrl}/software-products`, priority: '0.9', changefreq: 'weekly', lastmod: today },
      { loc: `${baseUrl}/portfolio`, priority: '0.8', changefreq: 'weekly', lastmod: today },
      { loc: `${baseUrl}/careers`, priority: '0.9', changefreq: 'daily', lastmod: today },
      { loc: `${baseUrl}/about`, priority: '0.8', changefreq: 'monthly', lastmod: today },
      { loc: `${baseUrl}/team`, priority: '0.7', changefreq: 'monthly', lastmod: today },
      { loc: `${baseUrl}/contact`, priority: '0.8', changefreq: 'monthly', lastmod: today },
      { loc: `${baseUrl}/login`, priority: '0.5', changefreq: 'monthly', lastmod: today },
    ];

    // Fetch dynamic content from MongoDB with error tolerance
    let jobUrls = [];
    try {
      const jobs = await Job.find({ status: 'open' }).select('_id updatedAt').lean();
      jobUrls = (jobs || []).map(j => ({
        loc: `${baseUrl}/careers/${j._id}`,
        priority: '0.8',
        changefreq: 'daily',
        lastmod: formatDate(j.updatedAt),
      }));
    } catch (e) {
      console.error('Error fetching jobs for sitemap:', e.message);
    }

    let serviceUrls = [];
    try {
      const services = await Service.find({ active: true, archived: { $ne: true } })
        .select('_id type updatedAt')
        .lean();
      
      serviceUrls = (services || []).map(s => {
        const pathPrefix = s.type === 'service' ? 'services' : 'software-products';
        return {
          loc: `${baseUrl}/${pathPrefix}/${s._id}`,
          priority: '0.85',
          changefreq: 'weekly',
          lastmod: formatDate(s.updatedAt),
        };
      });
    } catch (e) {
      console.error('Error fetching services for sitemap:', e.message);
    }

    const allUrls = [...staticPages, ...jobUrls, ...serviceUrls];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
    xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

    for (const item of allUrls) {
      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(item.loc)}</loc>\n`;
      xml += `    <lastmod>${item.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${item.changefreq}</changefreq>\n`;
      xml += `    <priority>${item.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=7200');
    return res.status(200).send(xml);
  } catch (err) {
    console.error('Sitemap generation error:', err);
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
};

/**
 * Returns dynamic robots.txt configured for production indexing and private route protection.
 */
exports.getRobots = (req, res) => {
  const baseUrl = getBaseUrl(req);

  const robots = [
    '# robots.txt — Raxwo Enterprise Management System',
    '# https://manage.raxwo.net',
    '',
    'User-agent: *',
    'Allow: /',
    'Allow: /services',
    'Allow: /software-products',
    'Allow: /portfolio',
    'Allow: /careers',
    'Allow: /about',
    'Allow: /team',
    'Allow: /contact',
    'Allow: /login',
    '',
    '# Disallow internal portals & private APIs',
    'Disallow: /api/',
    'Disallow: /admin/',
    'Disallow: /manager/',
    'Disallow: /developer/',
    'Disallow: /designer/',
    'Disallow: /marketing/',
    'Disallow: /my-dashboard/',
    'Disallow: /client/',
    'Disallow: /apply/',
    'Disallow: /uploads/private/',
    '',
    '# Search engine bot rules',
    'User-agent: Googlebot',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    'Disallow: /manager/',
    '',
    'User-agent: Bingbot',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    'Disallow: /manager/',
    '',
    '# Sitemap location',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.status(200).send(robots);
};
