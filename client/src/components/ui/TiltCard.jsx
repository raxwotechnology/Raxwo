import { useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

export default function TiltCard({ children, className = '' }) {
  const ref = useRef(null)
  
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 })
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 })

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['3.5deg', '-3.5deg'])
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-3.5deg', '3.5deg'])

  const handleMouseMove = (e) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const xPct = mouseX / width - 0.5
    const yPct = mouseY / height - 0.5
    x.set(xPct)
    y.set(yPct)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        perspective: 1000
      }}
      className={`relative ${className}`}
      whileHover={{ scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 250, damping: 25 }}
    >
      {/* Glow effect on hover based on mouse position could be added here, but preserving 3D is key */}
      <div className="w-full h-full relative z-10 bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-xl transition-shadow hover:shadow-2xl overflow-hidden">
        {children}
      </div>
    </motion.div>
  )
}
