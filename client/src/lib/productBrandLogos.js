/**
 * High-resolution brand assets mapping for Raxwo software products and ERP platforms.
 * References local production assets in /brands/<BrandFolder>/ and /previews/<BrandFolder>/
 */

const BRAND_DEFINITIONS = [
  {
    key: 'mobixa',
    brand: 'Mobixa',
    folder: 'Mobixa_Mobile_Shop_ERP',
    previewFolder: 'mobixa',
    previews: ['/previews/mobixa/Mobixa_Creative_Post.png', '/previews/mobixa/Mobixa_Creative_Post_Sinhala.png'],
    patterns: [/mobixa/i, /mobile\s*shop/i, /phone\s*shop/i],
    tagline: 'Mobile Phone Shop & IMEI Repair Management ERP',
  },
  {
    key: 'gymora',
    brand: 'Gymora',
    folder: 'Gymora_Gym_and_Fitness_ERP',
    previewFolder: 'gymora',
    previews: ['/previews/gymora/21e1724f-fa84-44cc-b183-73e62c16f0c7.jpg', '/previews/gymora/2262e29a-75bb-4a95-bc89-2ea79ea3a88a.jpg'],
    patterns: [/gymora/i, /gym/i, /fitness/i, /workout/i],
    tagline: 'Gym, Fitness & Member Management ERP Platform',
  },
  {
    key: 'restora',
    brand: 'Restora',
    folder: 'Restora_Restaurant_POS_and_Management_ERP',
    previewFolder: 'restora',
    previews: ['/previews/restora/248903b6-b4e6-4249-877d-c1d9edba0878.jpg', '/previews/restora/81b7fddb-1688-446b-bc08-5c6fd70c5d7b.jpg'],
    patterns: [/restora/i, /restaurant/i, /pos/i, /dining/i, /kitchen/i],
    tagline: 'Restaurant POS, Table Billing & KDS Management ERP',
  },
  {
    key: 'salvora',
    brand: 'Salvora',
    folder: 'Salvora_Salon_Management_System',
    previewFolder: 'salvora',
    previews: ['/previews/salvora/watermarked_img_1031768527167946242.jpg', '/previews/salvora/watermarked_img_10374199070234247789.jpg'],
    patterns: [/salvora/i, /salon/i, /spa/i, /stylist/i],
    tagline: 'Salon & Spa Management System with Stylist Booking',
  },
  {
    key: 'educo',
    brand: 'Educo',
    folder: 'Educo_Learning_Management_System',
    previewFolder: 'educo',
    previews: ['/previews/educo/Educo_Post_Creative.png', '/previews/educo/Educo_Post_Sinhala.png'],
    patterns: [/educo/i, /learning/i, /lms/i, /education/i, /school/i, /academy/i],
    tagline: 'Modern Learning Management & Student Information System',
  },
  {
    key: 'asipbook',
    brand: 'Asipbook',
    folder: 'Asipbook_Business_Management_System',
    previewFolder: 'asipbook',
    previews: ['/previews/asipbook/Gemini_Generated_Image_3ijvb3ijvb3ijvb3.jpg', '/previews/asipbook/Gemini_Generated_Image_57dnzr57dnzr57dn.jpg'],
    patterns: [/asipbook/i, /business\s*management/i, /accounting/i, /bookkeeping/i],
    tagline: 'All-in-One Enterprise Business Operations & Financial ERP',
  },
  {
    key: 'civora',
    brand: 'Civora',
    folder: 'Civora_Construction_Company_ERP',
    previewFolder: 'civora',
    previews: ['/previews/civora/Gemini_Generated_Image_1bkqcd1bkqcd1bkq.jpg', '/previews/civora/Gemini_Generated_Image_hfrvfphfrvfphfrv.jpg'],
    patterns: [/civora/i, /construction/i, /builder/i, /civil/i],
    tagline: 'Construction Project Management, BOQ & Site Labor ERP',
  },
  {
    key: 'autora',
    brand: 'Autora',
    folder: 'Autora_Vehicle_Rental_ERP',
    previewFolder: 'autora',
    previews: ['/previews/autora/Gemini_Generated_Image_e1lw28e1lw28e1lw.jpg', '/previews/autora/Gemini_Generated_Image_luw7uyluw7uyluw7.jpg'],
    patterns: [/autora/i, /vehicle\s*rental/i, /car\s*rental/i, /fleet/i],
    tagline: 'Vehicle & Car Rental Fleet Management ERP System',
  },
  {
    key: 'hotera',
    brand: 'Hotera',
    folder: 'Hotera_Hotel_Management_System',
    previewFolder: 'hotera',
    previews: ['/previews/hotera/Hotera_Post_Scenic.png', '/previews/hotera/Hotera_Post_Scenic_Sinhala.png'],
    patterns: [/hotera/i, /hotel/i, /resort/i, /room\s*booking/i],
    tagline: 'Hotel Reservation, Guest Folio & Front Desk ERP',
  },
  {
    key: 'invora',
    brand: 'Invora',
    folder: 'Invora_Invitation_Design_System',
    previewFolder: 'invora',
    previews: ['/previews/invora/Invora_Creative_Post.png', '/previews/invora/Invora_Creative_Post_Sinhala.png'],
    patterns: [/invora/i, /invitation/i, /events/i, /wedding/i],
    tagline: 'Digital Invitation Design & Event Guest Management System',
  },
  {
    key: 'medico',
    brand: 'Medico',
    folder: 'Medico_Healthcare_Management_System',
    previewFolder: 'medico',
    previews: ['/previews/medico/Medico_Creative_Post.png', '/previews/medico/Medico_Creative_Post_Sinhala.png'],
    patterns: [/medico/i, /health/i, /hospital/i, /clinic/i, /doctor/i, /pharmacy/i],
    tagline: 'Healthcare Clinic, Pharmacy & Patient Records ERP',
  },
  {
    key: 'movora',
    brand: 'Movora',
    folder: 'Movora_Transport_Management_ERP',
    previewFolder: 'movora',
    previews: ['/previews/movora/Movora_Creative_Post.png', '/previews/movora/Movora_Creative_Post_Sinhala.png'],
    patterns: [/movora/i, /transport/i, /logistics/i, /cargo/i, /delivery/i],
    tagline: 'Transport Logistics, Driver Dispatch & Fleet ERP',
  },
  {
    key: 'toolix',
    brand: 'Toolix',
    folder: 'Toolix_Tool_Rental_Management_System',
    previewFolder: 'toolix',
    previews: ['/previews/toolix/Toolix_Creative_Post.png', '/previews/toolix/Toolix_Creative_Post_Sinhala.png'],
    patterns: [/toolix/i, /tool/i, /equipment/i, /hardware/i, /distribution/i],
    tagline: 'Tool Rental, Equipment & Hardware Store Inventory ERP',
  },
  {
    key: 'exxplan',
    brand: 'Exxplan',
    folder: 'Exxplan_Software_Solutions',
    previewFolder: 'exxplan',
    previews: ['/previews/exxplan/Exxplan_Post_Creative.png', '/previews/exxplan/Exxplan_Post_Sinhala.png'],
    patterns: [/exxplan/i, /venture/i],
    tagline: 'Enterprise Software Solutions for Modern Ventures',
  },
]

export function getBrandAssets(itemOrTitle) {
  if (!itemOrTitle) return null
  const text = typeof itemOrTitle === 'string'
    ? itemOrTitle
    : `${itemOrTitle.title || ''} ${itemOrTitle.badge || ''} ${itemOrTitle.category || ''} ${itemOrTitle.tagline || ''}`

  const match = BRAND_DEFINITIONS.find(def =>
    def.patterns.some(p => p.test(text))
  )

  if (!match) return null

  const prefix = `/brands/${match.folder}`
  return {
    key: match.key,
    brand: match.brand,
    tagline: match.tagline,
    folder: match.folder,
    iconBlack: `${prefix}/${match.brand}_Icon_Black.png`,
    iconWhite: `${prefix}/${match.brand}_Icon_White.png`,
    logoBlack: `${prefix}/${match.brand}_Logo_Black.png`,
    logoWhite: `${prefix}/${match.brand}_Logo_White.png`,
    previews: match.previews || [],
  }
}

/**
 * Returns the best image/logo URL for a product, prioritizing high-res brand icons/logos
 * where applicable, while allowing custom uploaded images.
 * @param {Object} item - Product/Service item
 * @param {'icon' | 'logo'} mode - 'icon' for small squares, 'logo' for wide badges
 * @param {'black' | 'white'} theme - 'black' (dark graphics on transparent/light bg) or 'white' (light graphics)
 */
export function resolveProductImage(item, mode = 'logo', theme = 'black') {
  if (!item) return ''
  const brand = getBrandAssets(item)

  if (brand) {
    if (mode === 'icon') {
      return theme === 'white' ? brand.iconWhite : brand.iconBlack
    }
    return theme === 'white' ? brand.logoWhite : brand.logoBlack
  }

  return item.logoUrl || item.imageUrl || ''
}

/**
 * Returns an array of screenshot/preview image URLs for a product.
 * Merges custom uploaded Cloudinary screenshots with built-in brand preview graphics.
 */
export function resolveProductScreenshots(item) {
  if (!item) return []
  const uploaded = Array.isArray(item.screenshots) ? item.screenshots.filter(Boolean) : []
  const brand = getBrandAssets(item)
  const brandPreviews = brand?.previews || []

  // Combine uploaded screenshots first, then brand graphic previews
  const all = [...uploaded, ...brandPreviews]
  return Array.from(new Set(all))
}
