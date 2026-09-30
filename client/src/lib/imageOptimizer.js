/**
 * Compresses and resizes image files into high-quality, lightweight Base64 data URLs.
 * Keeps avatars crisp while preventing large database payloads.
 */
export function compressImageFile(file, { maxWidth = 480, maxHeight = 480, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('')

    // If it's already not a standard image or SVG, use simple FileReader
    if (!file.type || !file.type.startsWith('image/') || file.type.includes('svg')) {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          } else {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, width)
        canvas.height = Math.max(1, height)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          return resolve(e.target.result)
        }

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        try {
          const compressed = canvas.toDataURL('image/jpeg', quality)
          resolve(compressed)
        } catch {
          resolve(e.target.result)
        }
      }
      img.onerror = () => {
        // Fallback to original data URL
        resolve(e.target.result)
      }
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
