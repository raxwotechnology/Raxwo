import { useState, useEffect } from 'react'
import { mediaUrl, normalizeUploadPath } from '../../lib/media'

export default function UserAvatar({ user, className = '', imgClassName = '' }) {
  const [broken, setBroken] = useState(false)
  const avatarPath = user?.avatar || user?.profilePhoto || ''

  // Reset broken state whenever the avatar URL changes
  useEffect(() => {
    setBroken(false)
  }, [avatarPath])

  const initial = user?.name?.charAt(0)?.toUpperCase() || '?'

  const getSrc = () => {
    if (!avatarPath || broken) return ''
    if (avatarPath.startsWith('data:') || avatarPath.startsWith('blob:')) return avatarPath
    return mediaUrl(normalizeUploadPath(avatarPath) || avatarPath)
  }

  const src = getSrc()

  if (!src || broken) {
    return (
      <div className={`flex items-center justify-center bg-secondary/10 text-secondary font-semibold select-none shrink-0 aspect-square ${className}`}>
        {initial}
      </div>
    )
  }

  return (
    <div className={`overflow-hidden flex items-center justify-center shrink-0 aspect-square ${className}`}>
      <img
        src={src}
        alt={user?.name || 'User'}
        className={`w-full h-full object-cover object-top shrink-0 aspect-square ${imgClassName}`}
        onError={() => setBroken(true)}
        loading="lazy"
      />
    </div>
  )
}
