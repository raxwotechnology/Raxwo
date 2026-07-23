import api from './api'
import { buildLetterheadHtml, buildRefDateHtml, buildFooterHtml, LETTER_COMPACT_CSS, applyLetterPageFit } from './letterDocument'
import { absoluteMediaUrl } from './media'

function escapeHtml(s) {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeImgSrc(u) {
  if (!u || typeof u !== 'string') return ''
  const abs = absoluteMediaUrl(u.trim())
  if (!abs) return ''
  return abs.replace(/"/g, '').replace(/'/g, '')
}

/**
 * Build agreement HTML using the same letterhead as Letters.
 * opts: { company, title, agreementNo, agreementDate, bodyHtml, signatures, hasFrame }
 * company: from buildCompanyFromSettings()
 */
export function buildAgreementBodyHtml(opts) {
  const {
    // New letter-style fields
    company,
    // Legacy fields (still supported for back-compat)
    siteName,
    logoUrl,
    address,
    phone,
    email,
    websiteUrl,
    locationLine,
    // Common
    title,
    agreementNo,
    agreementDate,
    bodyHtml,
    signatures,
    hasFrame,
  } = opts

  // Build a "company" object if one wasn't passed directly
  const co = company || {
    name: siteName || 'Company',
    logo: logoUrl || '',
    logoPath: logoUrl || '',
    address: address || '',
    phone: phone || '',
    email: email || '',
    website: websiteUrl || '',
    branchDetails: locationLine || '',
    tagline: '',
  }

  // --- Frame wrappers ---
  const frameWrapperOpen = hasFrame
    ? `<div style="border: 12px double #1e3a8a; border-radius: 8px; outline: 2px solid #1e3a8a; outline-offset: -8px; padding: 32px; background: #fff;">`
    : ''
  const frameWrapperClose = hasFrame ? `</div>` : ''

  // --- Build using the shared letter helpers ---
  const headerHtml = buildLetterheadHtml(co)
  const refHtml = buildRefDateHtml(agreementNo || '—', agreementDate || '')
  const titleHtml = title
    ? `<h2 style="margin:0 0 20px;font-size:15pt;font-weight:800;color:#0f172a;letter-spacing:-0.01em;border-left:4px solid #0ea5e9;padding-left:12px">${escapeHtml(title)}</h2>`
    : ''

  // --- Signatures: Right-aligned, stacked, professional look ---
  const sigBlock = (heading, data, name) => {
    if (!data) {
      return `<div style="margin-bottom:24px;text-align:right;">
        <p style="margin:0 0 36px;font-size:10px;text-transform:uppercase;color:#64748b;letter-spacing:0.04em;font-family:system-ui,sans-serif;">${heading}</p>
        <div style="border-bottom:1px solid #0f172a;width:160px;margin-left:auto;"></div>
        ${name ? `<p style="margin:4px 0 0;font-weight:600;font-size:10pt;color:#0f172a;">${escapeHtml(name)}</p>` : `<p style="margin:4px 0 0;font-size:10pt;color:#64748b;">Signature</p>`}
      </div>`
    }
    return `<div style="margin-bottom:24px;text-align:right;">
      <p style="margin:0 0 8px;font-size:10px;text-transform:uppercase;color:#64748b;letter-spacing:0.04em;font-family:system-ui,sans-serif;">${heading}</p>
      <img src="${safeImgSrc(data)}" alt="" style="max-height:60px;max-width:180px;object-fit:contain;margin-left:auto;display:block;"/>
      ${name ? `<p style="margin:4px 0 0;font-weight:600;font-size:10pt;color:#0f172a;">${escapeHtml(name)}</p>` : ''}
    </div>`
  }

  const witness =
    signatures?.witness?.name || signatures?.witness?.data
      ? `<div style="margin-bottom:24px;text-align:right;">
          <p style="margin:0 0 ${signatures.witness.data ? '8px' : '36px'};font-size:10px;text-transform:uppercase;color:#64748b;letter-spacing:0.04em;font-family:system-ui,sans-serif;">Witness</p>
          ${signatures.witness.data ? `<img src="${safeImgSrc(signatures.witness.data)}" style="max-height:60px;max-width:180px;object-fit:contain;margin-left:auto;display:block;"/>` : `<div style="border-bottom:1px solid #0f172a;width:160px;margin-left:auto;"></div>`}
          ${signatures.witness.name ? `<p style="margin:4px 0 0;font-weight:600;font-size:10pt;color:#0f172a;">${escapeHtml(signatures.witness.name)}</p>` : ''}
        </div>`
      : ''

  const sealHtml = signatures?.seal?.data
      ? `<div style="text-align:right;">
          <p style="margin:0 0 8px;font-size:10px;text-transform:uppercase;color:#64748b;letter-spacing:0.04em;font-family:system-ui,sans-serif;">Company Seal</p>
          <img src="${safeImgSrc(signatures.seal.data)}" style="max-height:80px;max-width:120px;object-fit:contain;margin-left:auto;display:block;"/>
        </div>`
      : ''

  const agreementSigsHtml = `
    <div style="margin-top:40px;padding-top:24px;border-top:1px solid #e2e8f0;page-break-inside:avoid;">
      <div style="margin-left:auto;width:fit-content;min-width:200px;text-align:right;font-family:system-ui,Segoe UI,sans-serif;">
        ${sigBlock('Service provider', signatures?.provider?.data, signatures?.provider?.signerName)}
        ${sigBlock(signatures?.client?.label || 'Client / counterparty', signatures?.client?.data, signatures?.client?.signerName)}
        ${witness}
        ${sealHtml}
      </div>
    </div>`

  const footerHtml = buildFooterHtml(co)

  return `
    ${frameWrapperOpen}
    <div class="letter-page-wrap" style="font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#0f172a;font-size:11pt;line-height:1.55;max-width:780px;margin:0 auto">
      <div class="letter-page-content">
        ${headerHtml}
        ${refHtml}
        ${titleHtml}
        <div class="agreement-content letter-body" style="font-size:11pt;line-height:1.6;color:#1e293b;">${bodyHtml || ''}</div>
        ${agreementSigsHtml}
        ${footerHtml}
      </div>
    </div>
    ${frameWrapperClose}
  `
}

const AGREEMENT_PRINT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Outfit:wght@400;500;600;700&display=swap');
  @page { size: A4; margin: 15mm 15mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #fff; font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #0f172a; }
  img { max-width: 100%; height: auto; }
  header { max-width: 100%; box-sizing: border-box; }
  ${LETTER_COMPACT_CSS}
  .agreement-content { font-family: inherit; }
  .agreement-content h1, .agreement-content h2, .agreement-content h3 { color: #0f172a; margin-top: 1.25em; margin-bottom: 0.5em; }
  .agreement-content p { margin: 0 0 12px; }
  .agreement-content ul { margin: 0 0 12px 1.2em; }
  .ql-font-sans-serif { font-family: 'Inter', sans-serif !important; }
  .ql-font-serif { font-family: 'Georgia', serif !important; }
  .ql-font-monospace { font-family: 'Monaco', 'Courier New', monospace !important; }
  .ql-size-small { font-size: 0.75em !important; }
  .ql-size-large { font-size: 1.5em !important; }
  .ql-size-huge { font-size: 2.5em !important; }
  .ql-align-center { text-align: center !important; }
  .ql-align-right { text-align: right !important; }
  .ql-align-justify { text-align: justify !important; }
  .letter-page-wrap { width: 100%; max-width: 100%; margin: 0 auto; box-sizing: border-box; }
  .letter-page-content { transform-origin: top center; width: 100%; box-sizing: border-box; }
  @media print {
    body { margin: 0; padding: 0; width: 100%; }
    header { width: 100% !important; max-width: 100% !important; page-break-inside: avoid; }
    .letter-page-wrap { width: 100% !important; max-width: 100% !important; }
  }
`

export async function openAgreementPrint(opts) {
  const inner = buildAgreementBodyHtml(opts)
  const rawHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(opts.title || 'Agreement')}</title><style>${AGREEMENT_PRINT_STYLES}</style></head><body>${inner}</body></html>`
  const html = await inlineImagesToDataUrls(rawHtml)

  // Use a hidden iframe (same approach as letters) to avoid browser header/footer
  const oldFrame = document.getElementById('__agreement-print-frame')
  if (oldFrame) oldFrame.remove()

  const iframe = document.createElement('iframe')
  iframe.id = '__agreement-print-frame'
  iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:794px;min-height:1123px;border:none;visibility:hidden;`
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow.document
  doc.open()
  doc.write(html)
  doc.close()

  const runPrint = () => {
    try {
      applyLetterPageFit(doc, { fitToOnePage: false, scale: 1 })
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } catch {
      window.print()
    }
  }

  iframe.onload = () => {
    // Wait for images to load before triggering print
    setTimeout(() => requestAnimationFrame(runPrint), 500)
    // Clean up after a delay to let the print dialog finish
    setTimeout(() => {
      const el = document.getElementById('__agreement-print-frame')
      if (el) el.remove()
    }, 2500)
  }
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
      const dataUrl = await new Promise((r) => { reader.onloadend = () => r(reader.result); reader.readAsDataURL(blob) })
      img.src = dataUrl
    } catch { /* keep original src */ }
  }
  return div.innerHTML
}

export async function downloadAgreementPdf(opts, filenameBase = 'agreement') {
  const inner = buildAgreementBodyHtml(opts)
  const inlinedInner = await inlineImagesToDataUrls(inner)
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(opts.title || 'Agreement')}</title><style>${AGREEMENT_PRINT_STYLES}
    .agreement-pdf-page { width:794px;min-height:1123px;padding:40px 48px;background:#fff;box-sizing:border-box; }
  </style></head><body style="margin:0;padding:0;background:#fff">
    <div class="agreement-pdf-page">${inlinedInner}</div>
  </body></html>`

  try {
    const { htmlStringToPdfDownload } = await import('./pdfGenerator')
    const res = await api.post('/agreements/generate-pdf?html=true', {
      html: fullHtml,
      filename: filenameBase,
    }, { responseType: 'text' })
    const finalHtml = typeof res.data === 'string' ? res.data : await res.data.text()
    
    await htmlStringToPdfDownload(finalHtml, filenameBase)
  } catch (err) {
    console.error('Agreement PDF Generation Error:', err)
    throw err
  }
}
