import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import { FiFileText, FiPrinter } from 'react-icons/fi'
import { mediaUrl } from '../../lib/media'
import { openLetterPrint } from '../../lib/letterDocument'

const typeColor = {
  offer: 'badge-blue',
  appointment: 'badge-green',
  confirmation: 'badge-purple',
  experience: 'badge-navy',
  salary: 'badge-yellow',
  service_agreement: 'badge-blue',
  internship: 'badge-purple',
  contract: 'badge-yellow',
  part_time: 'badge-navy',
  resignation: 'badge-red',
  custom: 'badge-gray',
}

function isHtml(s) {
  return typeof s === 'string' && /^\s*</.test(s)
}

export default function EmployeeLetters() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-letters'],
    queryFn: () => api.get('/letters/my').then((r) => r.data),
  })
  const { data: coRes } = useQuery({
    queryKey: ['letter-company-info'],
    queryFn: () => api.get('/letters/company-info').then((r) => r.data),
  })

  const letters = data?.letters || []
  const company = {
    ...(coRes?.company || {}),
    logo: coRes?.company?.logo ? mediaUrl(coRes.company.logo) : '',
    footer: coRes?.company?.footer || coRes?.company?.address || '',
  }

  const print = (l) => {
    let bodyHtml = l.content || ''
    if (bodyHtml && typeof bodyHtml === 'string' && l.letterRef) {
      bodyHtml = bodyHtml.replace(/LTR-\d{4}-XXXX/g, l.letterRef).replace(/LTR-XXXX/g, l.letterRef)
    }
    openLetterPrint({
      company,
      letterTitle: l.title,
      letterRef: l.letterRef,
      issuedDate: l.issuedDate ? new Date(l.issuedDate).toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' }) : '',
      bodyHtml,
      signatures: l.signatures,
      isFullHtml: Boolean(l.structuredData),
    })
  }

  return (
    <div className="erp-module space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">My letters</h1>
          <p className="page-subtitle">{letters.length} document{letters.length !== 1 ? 's' : ''} on file</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto" />
        </div>
      ) : letters.length === 0 ? (
        <div className="card card-body text-center py-16 text-slate-400">
          <FiFileText size={40} className="mx-auto mb-2 opacity-30" />
          <p>No letters issued yet.</p>
          <p className="text-xs mt-1">Contact HR if you need an official letter.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {letters.map((l) => (
            <div key={l._id} className="finance-tx-card p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <FiFileText className="text-secondary" size={18} />
                </div>
                <span className={`badge ${typeColor[l.type] || 'badge-gray'} capitalize`}>{l.type.replace(/_/g, ' ')}</span>
              </div>
              <h3 className="font-bold text-primary font-heading text-sm leading-snug mb-1">{l.title}</h3>
              <p className="text-xs font-mono text-slate-400 mb-1">{l.letterRef || '—'}</p>
              <p className="text-xs text-slate-500 mb-4">
                Issued {l.issuedDate ? new Date(l.issuedDate).toLocaleDateString('en-LK', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
              </p>
              {isHtml(l.content) ? (
                <div className="letter-pdf-prose text-xs text-slate-600 line-clamp-4 mb-4 border-t border-slate-100 pt-3" dangerouslySetInnerHTML={{ __html: l.content }} />
              ) : (
                <pre className="text-xs text-slate-600 line-clamp-4 whitespace-pre-wrap mb-4 border-t border-slate-100 pt-3">{l.content}</pre>
              )}
              <button type="button" onClick={() => print(l)} className="btn-outline btn-sm w-full justify-center gap-2 mt-auto">
                <FiPrinter size={14} /> Print
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
