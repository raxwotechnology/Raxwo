import { useState, useEffect, useMemo } from 'react'
import { mediaUrl, normalizeUploadPath } from '../../lib/media'

const GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-indigo-500 to-purple-600',
  'from-violet-500 to-fuchsia-600',
  'from-sky-500 to-blue-600',
  'from-teal-500 to-emerald-600',
  'from-emerald-500 to-green-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
]

function getGradient(name) {
  if (!name) return GRADIENTS[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]
}

function getInitials(name) {
  if (!name || typeof name !== 'string') return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function UserAvatar({ user, className = '', imgClassName = '' }) {
  const [broken, setBroken] = useState(false)
  const avatarPath = typeof user === 'string'
    ? user
    : (user?.avatar || user?.profilePhoto || user?.userId?.avatar || user?.userId?.profilePhoto || '')

  // Reset broken state whenever the avatar URL changes
  useEffect(() => {
    setBroken(false)
  }, [avatarPath])

  const name = typeof user === 'string' ? '' : (user?.name || user?.userId?.name || '')
  const initials = useMemo(() => getInitials(name), [name])
  const gradient = useMemo(() => getGradient(name), [name])

  const getSrc = () => {
    if (!avatarPath || broken) return ''
    if (avatarPath.startsWith('data:') || avatarPath.startsWith('blob:')) return avatarPath
    return mediaUrl(normalizeUploadPath(avatarPath) || avatarPath)
  }

  const src = getSrc()

  // If no size is supplied in className, apply safe default w-10 h-10
  const hasWidth = /(?:^|\s)(?:w-|min-w-|max-w-|size-)/.test(className)
  const sizeClasses = hasWidth ? '' : 'w-10 h-10'

  if (!src || broken) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br ${gradient} text-white font-bold select-none shrink-0 aspect-square shadow-inner overflow-hidden ${sizeClasses} ${className}`}>
        <span className="text-[0.85em] tracking-tight font-heading leading-none">{initials}</span>
      </div>
    )
  }

  return (
    <div className={`overflow-hidden flex items-center justify-center shrink-0 aspect-square bg-slate-100 ${sizeClasses} ${className}`}>
      <img
        src={src}
        alt={name || 'User'}
        className={`w-full h-full max-w-full max-h-full object-cover object-top shrink-0 aspect-square block ${imgClassName}`}
        onError={() => setBroken(true)}
        loading="lazy"
      />
    </div>
  )
}

