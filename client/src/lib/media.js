import { getApiBaseUrl } from './devApi'

/** Normalize any stored upload reference to `/uploads/...` */
export function normalizeUploadPath(url) {
  if (!url) return ''
  const s = String(url).trim()
  if (!s) return ''
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s)
      if (u.pathname.startsWith('/uploads/')) return u.pathname + u.search
      return s
    }
  } catch {
    /* ignore */
  }
  if (s.startsWith('data:')) return s
  if (s.startsWith('blob:')) return s
  if (s.startsWith('/uploads/')) return s
  if (s.startsWith('uploads/')) return `/${s}`
  return s.startsWith('/') ? s : `/${s}`
}

/** Backend origin for uploads (no /api suffix). */
export function getUploadsOrigin() {
  const fromEnv = import.meta.env.VITE_UPLOADS_URL
  if (fromEnv) return String(fromEnv).replace(/\/$/, '')

  const apiBase = getApiBaseUrl()
  if (apiBase.startsWith('http')) {
    if (typeof window !== 'undefined' && apiBase.includes('localhost:5000') && !window.location.hostname.includes('localhost')) {
      return ''
    }
    return apiBase.replace(/\/api\/?$/i, '') || apiBase
  }
  return ''
}

/**
 * Build a browser-safe URL for `/uploads/...` files.
 * - Dev: always relative `/uploads/...` (Vite proxies to the API server).
 * - Prod: relative when same host; otherwise uses API/uploads origin.
 */
export function mediaUrl(url) {
  const path = normalizeUploadPath(url)
  if (!path) return ''
  if (!path.startsWith('/uploads/')) return path

  if (typeof window === 'undefined') {
    const origin = getUploadsOrigin()
    return origin ? `${origin}${path}` : path
  }

  // Local dev: always use same-origin path so Vite `/uploads` proxy works.
  if (import.meta.env.DEV) {
    return path
  }

  const uploadsOrigin = getUploadsOrigin()
  if (uploadsOrigin && uploadsOrigin !== window.location.origin) {
    return `${uploadsOrigin}${path}`
  }

  return path
}

/** Full URL for print/PDF/html2canvas — prefers backend uploads origin in production. */
export function absoluteMediaUrl(url) {
  const path = mediaUrl(url)
  if (!path) return ''
  if (path.startsWith('data:')) return path
  if (path.startsWith('blob:')) return path
  if (/^https?:\/\//i.test(path)) return path

  const uploadsOrigin = getUploadsOrigin()
  if (uploadsOrigin) {
    return path.startsWith('/') ? `${uploadsOrigin}${path}` : `${uploadsOrigin}/${path}`
  }

  if (typeof window !== 'undefined') {
    const origin = window.location.origin
    return path.startsWith('/') ? `${origin}${path}` : `${origin}/${path}`
  }

  return path
}

/** Convert all <img> src attributes in an HTML string to data URLs (base64). Essential for hosted PDF/Print. */
export async function inlineImagesToDataUrls(html) {
  if (typeof document === 'undefined') return html
  const div = document.createElement('div')
  div.innerHTML = html
  const imgs = div.querySelectorAll('img')
  for (const img of imgs) {
    try {
      const src = img.getAttribute('src')
      if (!src || src.startsWith('data:')) continue
      const res = await fetch(src)
      const blob = await res.blob()
      const reader = new FileReader()
      const dataUrl = await new Promise((r) => {
        reader.onloadend = () => r(reader.result)
        reader.readAsDataURL(blob)
      })
      img.setAttribute('src', dataUrl)
    } catch {
      // Keep original if failed
    }
  }
  return div.innerHTML
}
