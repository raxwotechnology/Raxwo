import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useSiteBranding } from '../../hooks/useSiteBranding'
import { absoluteMediaUrl } from '../../lib/media'

/**
 * Superb, Universal SEO Head Component for Raxwo Web Applications.
 * Dynamically manages:
 * - document.title
 * - meta description, keywords, robots, author
 * - canonical URL (exact per-page path)
 * - OpenGraph (Facebook, WhatsApp, LinkedIn)
 * - Twitter/X Cards
 * - JSON-LD Structured Data (Rich Snippets)
 */
export default function SEO({
  title,
  description,
  keywords,
  image,
  type = 'website',
  canonicalUrl,
  noindex = false,
  schema = null,
  article = null,
}) {
  const location = useLocation()
  const { settings } = useSiteBranding()

  // Base fallback details
  const siteName = settings?.siteName || 'Raxwo Technology'
  const defaultTitle = `${siteName} | Enterprise Software, Cloud & AI Solutions in Sri Lanka`
  const defaultDesc =
    settings?.siteDescription ||
    'Raxwo Technology is a leading software engineering and digital transformation company in Sri Lanka. We build enterprise ERP systems, custom web & mobile apps, cloud infrastructure, and modern AI platforms.'
  const defaultKeywords =
    'Raxwo, Raxwo Technology, Software Development Sri Lanka, Enterprise ERP Sri Lanka, Web Application Development Colombo, Mobile App Development Sri Lanka, Cloud Solutions, IT Consulting, Software Company Sri Lanka, custom software solutions'

  const finalTitle = title ? (title.includes('Raxwo') ? title : `${title} | ${siteName}`) : defaultTitle
  const finalDesc = description || defaultDesc
  const finalKeywords = keywords || defaultKeywords

  const siteOrigin = window.location.origin || 'https://manage.raxwo.net'
  const currentPath = location.pathname + location.search
  const finalCanonical = canonicalUrl || `${siteOrigin}${currentPath}`

  // Image fallback
  const logoFallback = settings?.logoUrl ? absoluteMediaUrl(settings.logoUrl) : `${siteOrigin}/raxwo-logo-final.png`
  const finalImage = image ? (image.startsWith('http') ? image : `${siteOrigin}${image}`) : logoFallback

  useEffect(() => {
    // 1. Title
    document.title = finalTitle

    // Helper to set or create a meta tag
    const setMeta = (attrName, attrVal, content) => {
      if (!content) return
      let el = document.querySelector(`meta[${attrName}="${attrVal}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attrName, attrVal)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    // 2. Primary Meta Tags
    setMeta('name', 'title', finalTitle)
    setMeta('name', 'description', finalDesc)
    setMeta('name', 'keywords', finalKeywords)
    setMeta('name', 'author', siteName)
    setMeta(
      'name',
      'robots',
      noindex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    )
    setMeta(
      'name',
      'googlebot',
      noindex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    )

    // 3. Canonical Link Tag
    let linkCanonical = document.querySelector('link[rel="canonical"]')
    if (!linkCanonical) {
      linkCanonical = document.createElement('link')
      linkCanonical.setAttribute('rel', 'canonical')
      document.head.appendChild(linkCanonical)
    }
    linkCanonical.setAttribute('href', finalCanonical)

    // 4. OpenGraph Tags (Facebook, WhatsApp, LinkedIn)
    setMeta('property', 'og:type', type)
    setMeta('property', 'og:site_name', siteName)
    setMeta('property', 'og:url', finalCanonical)
    setMeta('property', 'og:title', finalTitle)
    setMeta('property', 'og:description', finalDesc)
    setMeta('property', 'og:image', finalImage)
    setMeta('property', 'og:image:secure_url', finalImage)
    setMeta('property', 'og:locale', 'en_US')

    // If article metadata exists
    if (article) {
      if (article.publishedTime) setMeta('property', 'article:published_time', article.publishedTime)
      if (article.modifiedTime) setMeta('property', 'article:modified_time', article.modifiedTime)
      if (article.section) setMeta('property', 'article:section', article.section)
      if (article.tags && Array.isArray(article.tags)) {
        article.tags.forEach((tag) => setMeta('property', 'article:tag', tag))
      }
    }

    // 5. Twitter / X Card Tags
    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:site', '@raxwotechnology')
    setMeta('name', 'twitter:creator', '@raxwotechnology')
    setMeta('name', 'twitter:title', finalTitle)
    setMeta('name', 'twitter:description', finalDesc)
    setMeta('name', 'twitter:image', finalImage)
    setMeta('name', 'twitter:url', finalCanonical)

    // 6. JSON-LD Dynamic Schema Script
    let schemaScript = document.getElementById('raxwo-dynamic-jsonld')
    if (schema) {
      if (!schemaScript) {
        schemaScript = document.createElement('script')
        schemaScript.id = 'raxwo-dynamic-jsonld'
        schemaScript.type = 'application/ld+json'
        document.head.appendChild(schemaScript)
      }
      schemaScript.textContent = JSON.stringify(schema)
    } else if (schemaScript) {
      schemaScript.remove()
    }

    // Cleanup when unmounting or switching pages
    return () => {
      const activeSchema = document.getElementById('raxwo-dynamic-jsonld')
      if (activeSchema) activeSchema.remove()
    }
  }, [finalTitle, finalDesc, finalKeywords, finalCanonical, finalImage, type, noindex, schema, article, siteName])

  return null
}
