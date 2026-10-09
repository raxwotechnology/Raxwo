import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_PROXY_API || 'http://127.0.0.1:5000'
  const secure = /^https:/i.test(target)

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true, secure },
        '/uploads': { target, changeOrigin: true, secure },
      },
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React & router
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            // State management & queries
            'vendor-state': ['zustand', '@tanstack/react-query'],
            // Animation
            'vendor-motion': ['framer-motion'],
            // Charts (heaviest single library)
            'vendor-recharts': ['recharts'],
            // Icons
            'vendor-icons': ['react-icons'],
            // Toast notifications
            'vendor-toast': ['react-hot-toast'],
          },
        },
      },
    },
  }
})
