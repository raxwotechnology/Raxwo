export function resolveNotificationLink(link, role, id) {
  if (!link) {
    if (role === 'client') return id ? `/notifications/${id}` : '/notifications'
    return `/${role}/notifications/${id || ''}`
  }

  // If role is client, map admin routes to client portal routes
  if (role === 'client') {
    if (link.includes('/projects')) return '/my-projects'
    if (link.includes('/subscriptions')) return '/my-subscriptions'
    if (link.includes('/invoices') || link.includes('/payments') || link.includes('/financial')) return '/payments'
    if (link.includes('/messages')) return '/messages'
    if (link.includes('/notifications')) return id ? `/notifications/${id}` : '/notifications'
    if (link.includes('/booking') || link.includes('/meetings')) return '/meetings'
    if (link.startsWith('/admin')) return '/my-dashboard'
    return link
  }

  // If link starts with /admin but role is non-admin staff (manager, developer, designer, marketing)
  if (link.startsWith('/admin') && role !== 'admin') {
    const subPath = link.replace(/^\/admin/, '')
    if (!subPath || subPath === '/') return `/${role}`
    return `/${role}${subPath}`
  }

  if (link === '/messages') {
    return `/${role}/messages`
  }

  if (link === '/notifications') {
    if (role === 'developer' || role === 'designer' || role === 'marketing') return `/${role}/notifications`
    return `/${role}/notifications/${id || ''}`
  }

  return link
}
