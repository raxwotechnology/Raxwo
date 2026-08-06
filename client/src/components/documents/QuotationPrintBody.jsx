import { formatMoney } from '../../lib/currencies'
import { buildDocumentLetterheadHtml, directorSealBlockHtml } from '../../lib/documentPrint'
import DocumentTotalsSection from './DocumentTotalsSection'

const PAYMENT_LABELS = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  card: 'Card',
  online: 'Online Payment',
  custom: 'Custom',
}

/* ── shared inline-style constants (keeps values identical between preview & PDF) ── */
const FONT = "'Segoe UI', system-ui, sans-serif"
const CLR = { dark: '#0f172a', mid: '#475569', light: '#64748b', muted: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', accent: '#0ea5e9' }
const thStyle = { border: `1px solid ${CLR.border}`, padding: '8px 10px', fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.05em', color: CLR.mid, fontWeight: 700 }
const tdStyle = { border: `1px solid ${CLR.border}`, padding: '8px 10px', verticalAlign: 'top' }

export default function QuotationPrintBody({
  quotation,
  siteSettings = {},
  preparedByDisplay,
  bankLabel,
  showLetterhead = true,
  thankYouMessage,
  showRefOnDocument = true,
  showSeal = true,
  editableNotes,
  editableTerms,
  onNotesChange,
  onTermsChange,
  onThankYouChange,
}) {
  const q = quotation || {}
  const currency = q.currency || 'LKR'
  const prepared = preparedByDisplay || q.preparedBy || q.generatedBy?.name || ''
  const roleProfile = siteSettings.signatures?.[q.directorRole] || null
  const directorName = q.directorName || roleProfile?.label || siteSettings.quotationDirectorName || ''
  const sealUrl = q.directorSealUrl || roleProfile?.url || siteSettings.sealUrl || ''
  const thanks = thankYouMessage ?? siteSettings.quotationThankYouMessage ?? 'We appreciate your business and look forward to the opportunity to work with you. Should you have any questions regarding this quotation, please do not hesitate to contact us.'
  const notes = editableNotes !== undefined ? editableNotes : q.notes
  const terms = editableTerms !== undefined ? editableTerms : q.terms

  const payLabel =
    q.paymentMethod === 'custom'
      ? q.paymentMethodCustom || 'Custom'
      : PAYMENT_LABELS[q.paymentMethod] || q.paymentMethod || ''

  /* Parse terms into bullet lines for modern display */
  const termsLines = (terms || '').split('\n').map(l => l.trim()).filter(Boolean)

  return (
    <div className="quotation-doc-inner" style={{ fontFamily: FONT, color: CLR.dark, fontSize: '10.5pt', lineHeight: 1.55, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>

      {/* ── Letterhead ── */}
      {showLetterhead && (
        <div className="doc-letterhead-wrap" style={{ marginBottom: '20px', pageBreakInside: 'avoid', pageBreakAfter: 'avoid' }}>
          <div
            dangerouslySetInnerHTML={{
              __html: buildDocumentLetterheadHtml(siteSettings, {
                forPrint: false,
                showTagline: siteSettings.letterheadTagline || 'Next Level Tech',
              }),
            }}
          />
        </div>
      )}

      {/* ── Title + Valid Until ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', pageBreakInside: 'avoid' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '20pt', fontWeight: 800, letterSpacing: '0.06em', color: CLR.dark }}>QUOTATION</h2>
          {q.quotationNo && (
            <p style={{ margin: '2px 0 0', fontSize: '10pt', fontWeight: 600, color: CLR.accent, letterSpacing: '0.02em' }}>{q.quotationNo}</p>
          )}
          {q.title ? <p style={{ margin: '6px 0 0', color: CLR.dark, fontWeight: 600, fontSize: '11pt', wordBreak: 'break-word', maxWidth: '480px', lineHeight: 1.4 }}>{q.title}</p> : null}
        </div>
        <div style={{ textAlign: 'right', fontSize: '10pt', color: CLR.mid, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0 }}>
            <span style={{ color: CLR.muted, textTransform: 'uppercase', fontSize: '8.5pt', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Date</span>
            <span style={{ color: CLR.dark, fontWeight: 500 }}>{q.quotationDate ? new Date(q.quotationDate).toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </p>
          {showRefOnDocument && q.quotationNo && (
            <p style={{ margin: 0 }}>
              <span style={{ color: CLR.muted, textTransform: 'uppercase', fontSize: '8.5pt', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Ref</span>
              <span style={{ color: CLR.dark, fontWeight: 500 }}>{q.quotationNo}</span>
            </p>
          )}
          {q.validUntil && (
            <p style={{ margin: 0 }}>
              <span style={{ color: CLR.muted, textTransform: 'uppercase', fontSize: '8.5pt', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Valid until</span>
              <span style={{ color: CLR.dark, fontWeight: 500 }}>{new Date(q.validUntil).toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </p>
          )}
        </div>
      </div>

      {/* ── Client + Prepared by info cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px', pageBreakInside: 'avoid' }}>
        <div style={{ padding: '14px 16px', background: CLR.bg, borderRadius: '8px', border: `1px solid ${CLR.border}`, wordBreak: 'break-word' }}>
          <p style={{ margin: '0 0 6px', fontSize: '8.5pt', fontWeight: 700, color: CLR.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quotation for</p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '10.5pt', color: CLR.dark }}>{q.client?.name || 'Client'}</p>
          {q.client?.email && <p style={{ margin: '3px 0 0', fontSize: '9.5pt', color: CLR.light }}>{q.client.email}</p>}
          {q.client?.phone && <p style={{ margin: '3px 0 0', fontSize: '9.5pt', color: CLR.light }}>{q.client.phone}</p>}
        </div>
        <div className="quotation-meta-block" style={{ padding: '14px 16px', background: CLR.bg, borderRadius: '8px', border: `1px solid ${CLR.border}`, wordBreak: 'break-word' }}>
          <style dangerouslySetInnerHTML={{__html: `@media (min-width: 480px) { .quotation-meta-block { text-align: right; } }`}} />
          <p style={{ margin: '0 0 6px', fontSize: '8.5pt', fontWeight: 700, color: CLR.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prepared by</p>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '10.5pt', color: CLR.dark }}>{prepared || '—'}</p>
          {q.serviceType && (
            <p style={{ margin: '6px 0 0', fontSize: '9.5pt', color: CLR.light }}>
              <span style={{ color: CLR.muted }}>Service:</span> {q.serviceType}
            </p>
          )}
          {payLabel && (
            <p style={{ margin: '3px 0 0', fontSize: '9.5pt', color: CLR.light }}>
              <span style={{ color: CLR.muted }}>Payment:</span> {payLabel}
            </p>
          )}
          {bankLabel && (
            <p style={{ margin: '3px 0 0', fontSize: '9.5pt', color: CLR.light }}>
              <span style={{ color: CLR.muted }}>Bank:</span> {bankLabel}
            </p>
          )}
          {(q.bankBranch || q.bankAccount?.branchName) && (
            <p style={{ margin: '3px 0 0', fontSize: '9.5pt', color: CLR.light }}>
              <span style={{ color: CLR.muted }}>Bank branch:</span> {q.bankBranch || q.bankAccount?.branchName}
            </p>
          )}
        </div>
      </div>

      {/* ── Items table ── */}
      <table className="doc-table" style={{ width: '100%', borderCollapse: 'collapse', margin: '0 0 20px', fontSize: '10pt' }}>
        <thead style={{ display: 'table-header-group' }}>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ ...thStyle, textAlign: 'left' }}>Description</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Qty</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Unit price</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Disc.</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {(q.items || []).map((item, i) => (
            <tr key={i}>
              <td style={{ ...tdStyle }}>{item.description}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{formatMoney(item.unitPrice || 0, currency)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{item.discount > 0 ? `${item.discount}%` : '—'}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatMoney(item.total || 0, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <DocumentTotalsSection doc={q} currency={currency} showTransport showAdvance />

      {/* ── Notes (kept near totals — part of the commercial section) ── */}
      {notes && (
        <div style={{ borderTop: `1px solid ${CLR.border}`, paddingTop: '14px', marginBottom: '16px', fontSize: '9.5pt', pageBreakInside: 'avoid' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '8.5pt', fontWeight: 700, color: CLR.light, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</h4>
          <p style={{ margin: 0, color: CLR.mid, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{notes}</p>
        </div>
      )}

      {/* ── Seal / Director signature ── */}
      {showSeal && (directorName || sealUrl) && (
        <div
          style={{ marginTop: '20px', textAlign: 'right', pageBreakInside: 'avoid' }}
          dangerouslySetInnerHTML={{
            __html: directorSealBlockHtml({ directorName, sealUrl, forPrint: false }),
          }}
        />
      )}

      {/* ── Terms & Conditions — modern styled block at the very end ── */}
      {termsLines.length > 0 && (
        <div style={{ marginTop: '28px', pageBreakInside: 'avoid', pageBreakBefore: 'auto' }}>
          <div style={{
            border: `1px solid ${CLR.border}`,
            borderRadius: '10px',
            overflow: 'hidden',
          }}>
            {/* Header bar */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
              padding: '10px 18px',
            }}>
              <h4 style={{
                margin: 0,
                fontSize: '9pt',
                fontWeight: 700,
                color: '#ffffff',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                Terms &amp; Conditions
              </h4>
            </div>
            {/* Terms body */}
            <div style={{ padding: '14px 18px', background: '#fafbfc' }}>
              <ol style={{
                margin: 0,
                paddingLeft: '18px',
                fontSize: '8.5pt',
                lineHeight: 1.7,
                color: CLR.mid,
              }}>
                {termsLines.map((line, i) => (
                  <li key={i} style={{ paddingLeft: '4px', marginBottom: i < termsLines.length - 1 ? '5px' : 0 }}>
                    {line}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ── Thank you message — absolute bottom ── */}
      {thanks ? (
        <div style={{ margin: '24px 0 0', textAlign: 'center', borderTop: `1px solid ${CLR.border}`, paddingTop: '14px' }}>
          <p style={{ margin: 0, color: CLR.mid, fontSize: '9pt', lineHeight: 1.65, maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>{thanks}</p>
        </div>
      ) : null}
    </div>
  )
}
