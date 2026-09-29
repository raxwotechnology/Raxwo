const fs = require('fs');
const path = require('path');
const Job = require('../models/Job');
const Service = require('../models/Service');

let cachedIndexHtml = null;
let cachedHtmlMtime = 0;

const readTemplateHtml = (distDir) => {
  const indexPath = path.join(distDir, 'index.html');
  try {
    const stats = fs.statSync(indexPath);
    if (!cachedIndexHtml || stats.mtimeMs > cachedHtmlMtime) {
      cachedIndexHtml = fs.readFileSync(indexPath, 'utf8');
      cachedHtmlMtime = stats.mtimeMs;
    }
    return cachedIndexHtml;
  } catch (err) {
    console.error('Failed to read dist/index.html for SEO prerender:', err.message);
    return null;
  }
};

const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const getBaseUrl = (req) => {
  if (process.env.CLIENT_URL) {
    return process.env.CLIENT_URL.replace(/\/$/, '');
  }
  const protocol = req.headers?.['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers?.['x-forwarded-host'] || (typeof req.get === 'function' ? req.get('host') : req.headers?.host) || 'manage.raxwo.net';
  return `${protocol}://${host}`;
};

const STATIC_METADATA = {
  '/': {
    title: 'Raxwo | Enterprise Management System & ERP Platform – Raxwo Technology',
    description: "Raxwo is Sri Lanka's leading Enterprise Management System (ERP) by Raxwo Technology. Manage employees, payroll, attendance, leaves, agreements, digital signatures, and corporate analytics — all in one powerful platform.",
    type: 'website',
  },
  '/about': {
    title: 'About Us | Raxwo Technology – Enterprise Software & Digital Solutions',
    description: 'Learn about Raxwo Technology: our story, vision, mission, and the world-class engineering team delivering enterprise ERP platforms, mobile apps, and custom software.',
    type: 'website',
  },
  '/services': {
    title: 'Services & Solutions | Enterprise Software, Cloud & Mobile Apps – Raxwo',
    description: 'Explore enterprise services by Raxwo Technology: Custom Software Engineering, ERP & CRM Systems, Mobile Apps, Cloud Infrastructure, and IT Consulting.',
    type: 'website',
  },
  '/software-products': {
    title: 'Software Products & Solutions | ERP, POS & Business Software – Raxwo',
    description: 'Discover powerful, ready-to-deploy software products by Raxwo Technology — enterprise ERP, point-of-sale (POS), billing systems, and workflow automation platforms.',
    type: 'website',
  },
  '/portfolio': {
    title: 'Portfolio & Case Studies | Successful Digital Deliveries – Raxwo',
    description: 'Explore real-world case studies and digital transformation projects successfully engineered and delivered by Raxwo Technology across industries.',
    type: 'website',
  },
  '/careers': {
    title: 'Careers at Raxwo | Join Our Engineering & Product Team',
    description: 'Join Raxwo Technology. Explore current job openings in software engineering, UI/UX design, QA, project management, and business analytics in Sri Lanka.',
    type: 'website',
  },
  '/team': {
    title: 'Our Team & Leadership | The Engineers Behind Raxwo Technology',
    description: 'Meet the talented engineers, designers, project managers, and leadership driving enterprise software innovation at Raxwo Technology.',
    type: 'website',
  },
  '/contact': {
    title: 'Contact Us | Speak with an Enterprise Solution Consultant – Raxwo',
    description: 'Get in touch with Raxwo Technology. Request a project quotation, schedule a software demo, or discuss enterprise IT solutions with our team.',
    type: 'website',
  },
  '/login': {
    title: 'Client & Staff Portal Login | Raxwo',
    description: 'Sign in to your Raxwo account to manage projects, support tickets, and enterprise services.',
    type: 'website',
    noindex: true,
  },
  '/register': {
    title: 'Create a Client Account | Raxwo',
    description: "Join Raxwo's enterprise platform to access client portal tools, project tracking, and dedicated support.",
    type: 'website',
    noindex: true,
  },
};

/**
 * Creates the SEO Prerender Middleware for Express
 */
function createSeoPrerenderMiddleware(distDir) {
  return async function seoPrerender(req, res, next) {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();

    // Check if path is a static asset request with an extension (e.g. .js, .css, .png, .ico, .svg)
    if (path.extname(req.path)) return next();

    const template = readTemplateHtml(distDir);
    if (!template) return next();

    const baseUrl = getBaseUrl(req);
    const cleanPath = req.path.replace(/\/$/, '') || '/';
    const canonicalUrl = `${baseUrl}${cleanPath === '/' ? '' : cleanPath}`;
    const defaultImage = `${baseUrl}/raxwo-logo-final.png`;

    let meta = STATIC_METADATA[cleanPath] || {
      title: 'Raxwo | Enterprise Management System & ERP Platform – Raxwo Technology',
      description: "Raxwo is Sri Lanka's leading Enterprise Management System (ERP) by Raxwo Technology. Manage employees, payroll, attendance, leaves, agreements, digital signatures, and corporate analytics — all in one powerful platform.",
      type: 'website',
    };

    let dynamicImage = defaultImage;
    let jsonLd = null;

    // Check for dynamic job opening: /careers/:id
    const careerMatch = cleanPath.match(/^\/careers\/([a-f0-9]{24})$/i);
    if (careerMatch) {
      try {
        const job = await Job.findById(careerMatch[1]).lean();
        if (job) {
          meta = {
            title: `${job.title} – Career Opening | Raxwo Technology`,
            description: `We are hiring a ${job.title} (${job.type || 'Full-time'}) in ${job.location || 'Colombo, Sri Lanka'}. Department: ${job.department}. Apply now on Raxwo Careers.`,
            type: 'article',
          };
          jsonLd = {
            '@context': 'https://schema.org',
            '@type': 'JobPosting',
            title: job.title,
            description: job.description || meta.description,
            datePosted: job.createdAt || new Date().toISOString(),
            validThrough: job.deadline ? new Date(job.deadline).toISOString() : undefined,
            employmentType: (job.type || 'FULL_TIME').toUpperCase().replace('-', '_'),
            hiringOrganization: {
              '@type': 'Organization',
              name: 'Raxwo Technology',
              sameAs: 'https://manage.raxwo.net',
              logo: defaultImage,
            },
            jobLocation: {
              '@type': 'Place',
              address: {
                '@type': 'PostalAddress',
                addressLocality: job.location || 'Colombo',
                addressCountry: 'LK',
              },
            },
          };
        }
      } catch (e) {
        // Fall back to default
      }
    }

    // Check for dynamic software product / service: /software-products/:id or /services/:id
    const serviceMatch = cleanPath.match(/^\/(?:software-products|services)\/([a-f0-9]{24})$/i);
    if (serviceMatch) {
      try {
        const item = await Service.findById(serviceMatch[1]).lean();
        if (item) {
          const itemType = item.type === 'service' ? 'Service' : 'Software Product';
          meta = {
            title: `${item.title} | Raxwo ${itemType}s`,
            description: item.tagline || (item.description ? item.description.slice(0, 160) : `Learn more about ${item.title} by Raxwo Technology.`),
            type: 'product',
          };
          if (item.imageUrl) {
            dynamicImage = item.imageUrl.startsWith('http') ? item.imageUrl : `${baseUrl}${item.imageUrl.startsWith('/') ? '' : '/'}${item.imageUrl}`;
          }
          jsonLd = {
            '@context': 'https://schema.org',
            '@type': item.type === 'service' ? 'Service' : 'Product',
            name: item.title,
            description: meta.description,
            image: dynamicImage,
            brand: {
              '@type': 'Brand',
              name: 'Raxwo Technology',
            },
            offers: item.price ? {
              '@type': 'Offer',
              price: item.price,
              priceCurrency: item.currency || 'LKR',
              availability: 'https://schema.org/InStock',
            } : undefined,
          };
        }
      } catch (e) {
        // Fall back to default
      }
    }

    // Replace Title
    let modifiedHtml = template.replace(
      /<title>[\s\S]*?<\/title>/i,
      `<title>${escapeHtml(meta.title)}</title>`
    );

    // Replace meta title
    modifiedHtml = modifiedHtml.replace(
      /<meta\s+name="title"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="title" content="${escapeHtml(meta.title)}" />`
    );

    // Replace meta description
    modifiedHtml = modifiedHtml.replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(meta.description)}" />`
    );

    // Replace canonical URL
    modifiedHtml = modifiedHtml.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`
    );

    // Replace OpenGraph Title & Description & URL & Image & Type
    modifiedHtml = modifiedHtml.replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${escapeHtml(meta.title)}" />`
    );
    modifiedHtml = modifiedHtml.replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${escapeHtml(meta.description)}" />`
    );
    modifiedHtml = modifiedHtml.replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`
    );
    modifiedHtml = modifiedHtml.replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:image" content="${escapeHtml(dynamicImage)}" />`
    );
    modifiedHtml = modifiedHtml.replace(
      /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:type" content="${escapeHtml(meta.type || 'website')}" />`
    );

    // Replace Twitter Title & Description & URL & Image
    modifiedHtml = modifiedHtml.replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`
    );
    modifiedHtml = modifiedHtml.replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`
    );
    modifiedHtml = modifiedHtml.replace(
      /<meta\s+name="twitter:url"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:url" content="${escapeHtml(canonicalUrl)}" />`
    );
    modifiedHtml = modifiedHtml.replace(
      /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:image" content="${escapeHtml(dynamicImage)}" />`
    );

    // Handle noindex if needed
    if (meta.noindex) {
      modifiedHtml = modifiedHtml.replace(
        /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="robots" content="noindex, nofollow" />`
      );
    }

    // Inject dynamic JSON-LD structured data if available
    if (jsonLd) {
      const scriptTag = `\n    <script type="application/ld+json" id="raxwo-server-jsonld">\n${JSON.stringify(jsonLd, null, 2)}\n    </script>\n  </head>`;
      modifiedHtml = modifiedHtml.replace('</head>', scriptTag);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(modifiedHtml);
  };
}

module.exports = {
  createSeoPrerenderMiddleware,
};
