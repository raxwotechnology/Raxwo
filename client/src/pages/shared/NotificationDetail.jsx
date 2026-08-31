import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import { resolveNotificationLink } from '../../lib/notificationLink'

export default function NotificationDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { user } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['notification-detail', id],
    queryFn: () => api.get(`/system-metrics/notifications/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  })

  const markRead = useMutation({
    mutationFn: () => api.put(`/system-metrics/notifications/${id}/read`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['developer-notifications'] })
      qc.invalidateQueries({ queryKey: ['client-notifications-page'] })
      qc.invalidateQueries({ queryKey: ['client-navbar-notifications'] })
      qc.invalidateQueries({ queryKey: ['notification-detail', id] })
    },
  })

  const n = data?.notification
  const resolvedLink = n?.link ? resolveNotificationLink(n.link, user?.role, n._id) : null

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in py-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notification Details</h1>
          <p className="page-subtitle">Full details and quick action for this notification.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-12 text-center"><div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto" /></div>
      ) : !n ? (
        <div className="card p-12 text-center text-slate-400 font-medium">Notification not found.</div>
      ) : (
        <div className="card p-6 sm:p-8 space-y-6 bg-white rounded-3xl border border-slate-200/80 shadow-md">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">{n.type || 'System'}</span>
              <h2 className="text-2xl font-bold text-slate-900 font-heading mt-2.5 leading-snug">{n.title}</h2>
            </div>
            {!n.read ? <span className="badge badge-blue px-3 py-1 text-xs font-bold shrink-0">Unread</span> : <span className="badge badge-green px-3 py-1 text-xs font-bold shrink-0">Read</span>}
          </div>
          <p className="text-slate-700 text-base leading-relaxed bg-slate-50/80 p-5 rounded-2xl border border-slate-100">{n.message}</p>
          <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
            <span>Received:</span> <strong className="text-slate-600">{new Date(n.createdAt).toLocaleString()}</strong>
          </p>
          <div className="flex items-center gap-3 pt-2">
            {!n.read ? <button type="button" className="btn-primary btn-md shadow-xs" onClick={() => markRead.mutate()}>Mark as read</button> : null}
            {resolvedLink ? <Link to={resolvedLink} className="btn-outline btn-md">Open related page</Link> : null}
          </div>
        </div>
      )}
    </div>
  )
}

