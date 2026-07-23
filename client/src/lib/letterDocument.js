import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { absoluteMediaUrl } from './media'
import { buildCompanyFromSettings, companyContactLines, companyLogoHtml, contactBlockHtml } from './companyBranding'
import { buildDocumentLetterheadHtml } from './documentPrint'
import { resolveLetterSignatory } from './letterSignatures'
import api from './api'

function safeImgSrc(u) {
  if (!u || typeof u !== 'string') return ''
  const abs = absoluteMediaUrl(u.trim())
  if (!abs) return ''
  return abs.replace(/"/g, '').replace(/'/g, '')
}

function esc(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const LOGO_MAX_HEIGHT = 48
const SIG_IMAGE_MAX_HEIGHT = 44
const SEAL_MAX_HEIGHT = 52

/** Build the quotation-style letterhead (logo+name left, contact right, blue border bottom) */
export function buildLetterheadHtml(company, { forPrint = true, siteSettings } = {}) {
  if (siteSettings && Object.keys(siteSettings).length) {
    return buildDocumentLetterheadHtml(siteSettings, {
      forPrint,
      showTagline: company?.tagline || siteSettings.letterheadTagline || 'Next Level Tech',
    })
  }
  const logoHtml = companyLogoHtml(company, { forPrint, maxHeight: LOGO_MAX_HEIGHT })

  const tagline = company.tagline || 'Next Level Tech'
  const taglineHtml = `<p style="margin:4px 0 0;font-size:11pt;font-weight:500;color:#0284c7;letter-spacing:0.01em;">${esc(tagline)}</p>`

  const contactHtml = contactBlockHtml(company)

  return `
    <header style="display:flex;align-items:center;justify-content:space-between;gap:24px;padding-bottom:24px;border-bottom:2px solid #e2e8f0;margin-bottom:32px;position:relative;">
      <div style="position:absolute;bottom:-2px;left:0;width:100%;height:2px;background:linear-gradient(90deg, #0284c7, #38bdf8);"></div>
      <div style="display:flex;align-items:center;gap:20px;min-width:0">
        <div style="flex-shrink:0">${logoHtml}</div>
        <div>
          <h1 style="margin:0;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.03em">${esc(company.name || 'Company')}</h1>
          ${taglineHtml}
        </div>
      </div>
      <div style="text-align:right;min-width:200px;flex:1;color:#475569;font-size:9.5pt;line-height:1.5;">${contactHtml}</div>
    </header>`
}


export function buildRefDateHtml(letterRef, issuedDate) {
  const dateStr =
    issuedDate && !Number.isNaN(new Date(issuedDate).getTime())
      ? new Date(issuedDate).toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' })
      : issuedDate || ''

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;font-size:10pt;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="color:#64748b;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Ref</span>
        <div style="height:14px;width:2px;background:#e2e8f0;border-radius:2px;"></div>
        <strong style="color:#0f172a;font-family:monospace;font-size:11pt;letter-spacing:0.02em;">${esc(letterRef || '—')}</strong>
      </div>
      <div style="display:flex;align-items:center;gap:10px;text-align:right;">
        <span style="color:#64748b;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Date</span>
        <div style="height:14px;width:2px;background:#e2e8f0;border-radius:2px;"></div>
        <strong style="color:#0f172a;font-size:10.5pt;letter-spacing:0.01em;">${esc(dateStr)}</strong>
      </div>
    </div>`
}

export function buildTitleHtml(letterTitle) {
  return letterTitle
    ? `<h2 style="margin:0 0 24px;font-size:16pt;font-weight:800;color:#0f172a;letter-spacing:-0.02em;line-height:1.3;">${esc(letterTitle)}</h2>`
    : ''
}

export function buildSigsHtml(signatures, opts = {}) {
  if (!signatures) return ''
  const siteSettings = opts.siteSettings || {}
  const { signatory, seal } = resolveLetterSignatory(signatures, siteSettings)
  const roleLabel = (signatory.role || 'admin').replace(/^./, (c) => c.toUpperCase())

  const includeSignature = signatures.includeSignature !== false
  const includeSeal = signatures.includeSeal !== false && !opts.hideSeal

  const hasSig = includeSignature && (signatory.data || signatory.name)
  const hasSeal = includeSeal && Boolean(seal?.data)
  if (!hasSig && !hasSeal) return ''

  const sigBlock = hasSig
    ? `
      ${signatory.data
        ? `<img src="${safeImgSrc(signatory.data)}" alt="" style="max-height:${SIG_IMAGE_MAX_HEIGHT}px;max-width:140px;object-fit:contain;display:block;margin:0 0 8px auto"/>`
        : `<div style="height:36px;border-bottom:1px solid #94a3b8;width:140px;margin:0 0 8px auto"></div>`}
      <p style="margin:0;font-size:10pt;font-weight:700;color:#0f172a">${esc(signatory.name || roleLabel)}</p>
      ${signatory.title ? `<p style="margin:4px 0 0;font-size:9pt;color:#64748b">${esc(signatory.title)}</p>` : ''}
      <p style="margin:6px 0 0;font-size:8pt;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8">Authorized Signatory</p>`
    : ''

  const sealBlock = hasSeal
    ? `<img src="${safeImgSrc(seal.data)}" alt="Company seal" style="max-height:${SEAL_MAX_HEIGHT}px;max-width:72px;object-fit:contain;display:block;margin:${hasSig ? '14px' : '0'} 0 0 auto;opacity:0.95"/>`
    : ''

  return `
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #e2e8f0;page-break-inside:avoid">
      <div style="margin-left:auto;max-width:240px;text-align:right">
        ${sigBlock}
        ${sealBlock}
      </div>
    </div>`
}

export function buildFooterHtml(company) {
  return ''
}

export function buildLetterInnerForPrint({ company, letterTitle, letterRef, issuedDate, bodyHtml, signatures, siteSettings, isFullHtml }) {
  // If isFullHtml is true, the bodyHtml already contains letterhead, ref, title,
  // signatures, and footer (e.g. custom letters from Enterprise Builder).
  // Just wrap it in the outer container without adding duplicate elements.
  if (isFullHtml) {
    return `
    <div class="letter-page-wrap" style="font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#0f172a;font-size:11pt;line-height:1.55;max-width:780px;margin:0 auto">
      <div class="letter-page-content">
        <div class="letter-body" style="margin-top:0">${bodyHtml || ''}</div>
      </div>
    </div>`
  }

  const issued =
    issuedDate && !Number.isNaN(new Date(issuedDate).getTime())
      ? new Date(issuedDate).toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' })
      : issuedDate || ''
  // Standard letter bodies from letterTemplatesHtml already contain their own <h1> title,
  // so we skip buildTitleHtml to avoid duplicates.
  return `
  <div class="letter-page-wrap" style="font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#0f172a;font-size:11pt;line-height:1.55;max-width:780px;margin:0 auto">
    <div class="letter-page-content">
      ${buildLetterheadHtml(company, { forPrint: true, siteSettings })}
      ${buildRefDateHtml(letterRef, issued)}
      <div class="letter-body" style="margin-top:4px">${bodyHtml || ''}</div>
      ${buildSigsHtml(signatures, { siteSettings })}
      ${buildFooterHtml(company)}
    </div>
  </div>`
}

export const LETTER_COMPACT_CSS = `
  .letter-compact { font-size: 11.5pt !important; line-height: 1.6 !important; }
  .letter-compact header { margin-bottom: 20px !important; padding-bottom: 16px !important; }
  .letter-compact .letter-body p, .letter-compact .letter-body .letter-p { margin: 0 0 10px !important; font-size: 11.5pt !important; }
  .letter-compact .letter-body .letter-h1 { font-size: 16pt !important; margin: 0 0 12px !important; padding-bottom: 8px !important; }
  .letter-compact .letter-body .letter-h2 { margin: 16px 0 8px !important; font-size: 12pt !important; }
  .letter-compact .letter-body .letter-close { margin-top: 24px !important; }
  .letter-compact .letter-body .letter-sig-space { height: 32px !important; }
  .letter-compact .letter-body .letter-info-table { margin: 12px 0 16px !important; font-size: 11pt !important; }
  .letter-compact .letter-body .letter-info-table th,
  .letter-compact .letter-body .letter-info-table td { padding: 8px 12px !important; }
  .letter-compact-more { font-size: 11pt !important; line-height: 1.5 !important; }
  .letter-compact-more header { margin-bottom: 16px !important; }
  .letter-compact-more .letter-body .letter-p, .letter-compact-more .letter-body p { margin-bottom: 8px !important; font-size: 11pt !important; }
`

export const LETTER_PAGE_WIDTH = 794
export const LETTER_PAGE_HEIGHT = 1123
export const LETTER_PAGE_PADDING = '14mm 16mm'
export const LETTER_PAGE_GAP = 0

const A4_WIDTH_PX = LETTER_PAGE_WIDTH
const A4_CONTENT_HEIGHT_PX = 1015

const PRINT_STYLES = `
  @page { margin: 25mm 15mm; size: A4; }
  body { margin: 0; padding: 0; background: #fff; font-family: 'Segoe UI', system-ui, sans-serif; }
  ${LETTER_COMPACT_CSS}
  /* Letter body prose styles */
  .letter-body p, .letter-body .letter-p { margin: 0 0 16px; font-size: 12.5pt; line-height: 1.7; color: #1e293b; }
  .letter-body strong, .letter-body b { color: #0f172a; font-weight: 700; }
  .letter-body .letter-h1 { font-size: 20pt; font-weight: 800; color: #0f172a; margin: 0 0 28px; letter-spacing: -0.02em; line-height: 1.3; }
  .letter-body .letter-h2 { font-size: 14pt; font-weight: 700; color: #0f172a; margin: 28px 0 14px; letter-spacing: -0.01em; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  .letter-body .letter-salutation { margin: 16px 0 28px; font-size: 12.5pt; color: #0f172a; font-weight: 600; }
  .letter-body .letter-ref-line { font-size: 11.5pt; color: #475569; margin: 0 0 10px; }
  .letter-body .letter-info-table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 24px 0 32px; font-size: 12pt; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .letter-body .letter-info-table th { text-align: left; width: 35%; padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #cbd5e1; font-weight: 600; color: #334155; }
  .letter-body .letter-info-table td { padding: 12px 16px; border-bottom: 1px solid #cbd5e1; color: #0f172a; }
  .letter-body .letter-info-table tr:last-child th, .letter-body .letter-info-table tr:last-child td { border-bottom: none; }
  .letter-body .letter-ol { margin: 16px 0 20px 1.5em; padding: 0; color: #1e293b; font-size: 12.5pt; }
  .letter-body .letter-ol li { margin-bottom: 10px; line-height: 1.7; }
  .letter-body .letter-small { font-size: 10.5pt; color: #64748b; }
  .letter-body .letter-upper { text-transform: uppercase; letter-spacing: 0.05em; font-size: 11pt; font-weight: 700; }
  .letter-body .letter-close { margin-top: 40px; margin-bottom: 0; color: #1e293b; font-size: 12.5pt; }
  .letter-body .letter-sig-space { height: 56px; }
  .letter-body .letter-sig-name { font-weight: 700; margin: 0; color: #0f172a; font-size: 12.5pt; }
  .letter-body .letter-sig-title { font-size: 11pt; color: #64748b; margin: 4px 0 0; }
  /* Quill rich-text */
  .letter-body .ql-font-serif { font-family: Georgia,'Times New Roman',serif; }
  .letter-body .ql-font-monospace { font-family: Consolas,Monaco,'Courier New',monospace; }
  .letter-body .ql-size-small { font-size: 0.85em; }
  .letter-body .ql-size-large { font-size: 1.35em; }
  .letter-body .ql-size-huge { font-size: 1.85em; }
  .letter-body .ql-align-center { text-align: center; }
  .letter-body .ql-align-right { text-align: right; }
  .letter-body .ql-align-justify { text-align: justify; }
  /* legacy class names */
  .letter-pdf-prose .letter-h1 { font-size: 20pt; font-weight: 800; color: #0f172a; margin: 0 0 28px; letter-spacing: -0.02em; line-height: 1.3; }
  .letter-pdf-prose .letter-h2 { font-size: 14pt; font-weight: 700; color: #0f172a; margin: 28px 0 14px; letter-spacing: -0.01em; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  .letter-pdf-prose .letter-p { margin: 0 0 16px; font-size: 12.5pt; line-height: 1.7; color: #1e293b; }
  .letter-pdf-prose .letter-salutation { margin: 16px 0 28px; font-size: 12.5pt; color: #0f172a; font-weight: 600; }
  .letter-pdf-prose .letter-info-table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 24px 0 32px; font-size: 12pt; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .letter-pdf-prose .letter-info-table th { text-align: left; width: 35%; padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #cbd5e1; font-weight: 600; color: #334155; }
  .letter-pdf-prose .letter-info-table td { padding: 12px 16px; border-bottom: 1px solid #cbd5e1; color: #0f172a; }
  .letter-pdf-prose .letter-info-table tr:last-child th, .letter-pdf-prose .letter-info-table tr:last-child td { border-bottom: none; }
  .letter-pdf-prose .letter-ol { margin: 16px 0 20px 1.5em; padding: 0; color: #1e293b; font-size: 12.5pt; }
  .letter-pdf-prose .letter-ol li { margin-bottom: 10px; line-height: 1.7; }
  .letter-pdf-prose .ql-align-center { text-align: center; }
  .letter-pdf-prose .ql-align-right { text-align: right; }
  .letter-pdf-prose .ql-align-justify { text-align: justify; }
  /* Enterprise letter styles (custom builder) */
  .enterprise-letter-body { font-size: 12.5pt; line-height: 1.7; color: #1e293b; }
  .enterprise-letter-body p { margin-bottom: 18px; }
  .enterprise-letter-body table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 24px 0 32px; font-size: 12pt; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .enterprise-letter-body td, .enterprise-letter-body th { border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; padding: 12px 16px; }
  .enterprise-letter-body th { background: #f8fafc; font-weight: 600; color: #334155; }
  .enterprise-letter-body tr:last-child th, .enterprise-letter-body tr:last-child td { border-bottom: none; }
  .enterprise-letter-body th:last-child, .enterprise-letter-body td:last-child { border-right: none; }
  .enterprise-footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 8pt; color: #94a3b8; letter-spacing: 0.02em; }
  @media print {
    body { margin: 0; padding: 0; }
    .letter-page-wrap { width: 100%; max-width: none; }
  }
  .letter-page-wrap { width: 100%; max-width: 780px; margin: 0 auto; }
  .letter-page-content { transform-origin: top center; }
`

function measureContentHeight(el) {
  if (!el) return 0
  return Math.max(el.scrollHeight || 0, el.offsetHeight || 0, el.getBoundingClientRect?.().height || 0)
}

/** Tighten spacing first, then apply a gentle zoom — never shrink below 75%. */
export function applyLetterPageFit(docOrEl, { fitToOnePage = false, scale = 1 } = {}) {
  if (!docOrEl) return 1
  
  // If it's a document, use doc.body. If it's an element, use it directly.
  const rootEl = docOrEl.body ? docOrEl.body : docOrEl;
  
  const wrap = rootEl.querySelector?.('.letter-page-wrap') || rootEl.firstElementChild
  if (!wrap) return 1

  const content = wrap.querySelector?.('.letter-page-content') || wrap
  content.classList.remove('letter-compact', 'letter-compact-more')
  content.style.zoom = ''
  content.style.transform = ''
  content.style.width = ''
  wrap.style.height = ''
  wrap.style.overflow = ''

  const userScale = Math.max(0.75, Math.min(1.15, Number(scale) || 1))

  if (fitToOnePage) {
    content.classList.add('letter-compact')
  }

  let height = measureContentHeight(content)
  if (fitToOnePage && height > A4_CONTENT_HEIGHT_PX) {
    content.classList.add('letter-compact-more')
    height = measureContentHeight(content)
  }

  let fitZoom = 1
  if (fitToOnePage && height > A4_CONTENT_HEIGHT_PX) {
    fitZoom = A4_CONTENT_HEIGHT_PX / height
    fitZoom = Math.max(0.75, Math.min(1, fitZoom))
  }

  const finalZoom = userScale * fitZoom
  if (Math.abs(finalZoom - 1) > 0.004) {
    content.style.zoom = String(finalZoom)
    if (!content.style.zoom || content.style.zoom === 'normal') {
      content.style.transform = `scale(${finalZoom})`
      content.style.transformOrigin = 'top center'
      content.style.width = `${100 / finalZoom}%`
      wrap.style.height = `${height * finalZoom}px`
      wrap.style.overflow = 'hidden'
    }
  }

  return finalZoom
}

/** Full HTML document — used for the iframe preview so preview === print */
export function buildLetterFullHtml(opts) {
  const inner = buildLetterInnerForPrint(opts)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>* { box-sizing: border-box; } ${PRINT_STYLES}</style></head><body>${inner}</body></html>`
}

export async function openLetterPrint(opts) {
  const { fitToOnePage = true, letterScale = 1, ...buildOpts } = opts
  const inner = buildLetterInnerForPrint(buildOpts)
  const rawHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(buildOpts.letterTitle || 'Letter')}</title><style>${PRINT_STYLES}</style></head><body>${inner}</body></html>`
  const html = await inlineImagesToDataUrls(rawHtml)

  // Use a hidden iframe instead of window.open to avoid opening a new tab.
  // The iframe prints from its own context so the parent page stays responsive.
  const oldFrame = document.getElementById('__letter-print-frame')
  if (oldFrame) oldFrame.remove()

  const iframe = document.createElement('iframe')
  iframe.id = '__letter-print-frame'
  iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${A4_WIDTH_PX}px;min-height:1123px;border:none;visibility:hidden;`
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow.document
  doc.open()
  doc.write(html)
  doc.close()

  const runPrint = () => {
    try {
      applyLetterPageFit(doc, { fitToOnePage, scale: letterScale })
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } catch {
      window.print()
    }
  }

  iframe.onload = () => {
    requestAnimationFrame(() => setTimeout(runPrint, 80))
    // Clean up after a delay to let the print dialog finish
    setTimeout(() => {
      const el = document.getElementById('__letter-print-frame')
      if (el) el.remove()
    }, 2000)
  }
}

async function waitForImages(container) {
  const imgs = container.querySelectorAll('img')
  await Promise.all(
    [...imgs].map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
          setTimeout(resolve, 4000)
        }),
    ),
  )
}

async function inlineImagesToDataUrls(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  const imgs = div.querySelectorAll('img')
  for (const img of imgs) {
    try {
      const src = img.src
      if (!src || src.startsWith('data:')) continue
      const res = await fetch(src)
      const blob = await res.blob()
      const reader = new FileReader()
      const dataUrl = await new Promise(r => { reader.onloadend = () => r(reader.result); reader.readAsDataURL(blob) })
      img.src = dataUrl
    } catch(e) {}
  }
  return div.innerHTML
}

export async function downloadLetterPdf(opts, filenameBase = 'letter') {
  const { fitToOnePage = false, letterScale = 1, ...buildOpts } = opts
  const innerHtml = buildLetterInnerForPrint(buildOpts)
  
  // Inline any blob: or remote URLs into base64 so backend Puppeteer doesn't fail fetching them
  const inlinedInnerHtml = await inlineImagesToDataUrls(innerHtml)

  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(buildOpts.letterTitle || 'Letter')}</title><style>${PRINT_STYLES}
    .letter-pdf-page { width:794px;min-height:1123px;padding:64px 72px;background:#fff;box-sizing:border-box; font-family: 'Segoe UI', system-ui, sans-serif; }
    .letter-pdf-page .letter-page-wrap { max-width:100%;margin:0; }
    .letter-pdf-page .letter-body { font-size:12.5pt;line-height:1.7;color:#1e293b; font-family: 'Segoe UI', system-ui, sans-serif; }
    .letter-pdf-page .letter-body p { margin:0 0 16px; }
    .letter-pdf-page header { margin-bottom:32px;padding-bottom:24px; }
  </style></head><body style="margin:0;padding:0;background:#fff">
    <div class="letter-pdf-page">${inlinedInnerHtml}</div>
  </body></html>`

  try {
    const { htmlStringToPdfDownload } = await import('./pdfGenerator')
    const res = await api.post('/letters/generate-pdf?html=true', {
      html: fullHtml,
      filename: filenameBase,
    }, { responseType: 'text' })
    const finalHtml = typeof res.data === 'string' ? res.data : await res.data.text()
    
    await htmlStringToPdfDownload(finalHtml, filenameBase)
  } catch (err) {
    console.error('Letter PDF Generation Error:', err)
    throw err
  }
}
