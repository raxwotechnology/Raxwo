import axios from 'axios'
import { getApiBaseUrl } from './devApi'

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor - attach token
api.interceptors.request.use(
  (config) => {
    const stored = localStorage.getItem('raxwo-auth')
    if (stored) {
      const { state } = JSON.parse(stored)
      if (state?.token) config.headers.Authorization = `Bearer ${state.token}`
    }
    // Instance default is application/json; FormData must omit Content-Type so the boundary is set.
    if (config.data instanceof FormData && config.headers) {
      if (typeof config.headers.delete === 'function') config.headers.delete('Content-Type')
      else delete config.headers['Content-Type']
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If 401 is triggered by password verification modal, do NOT clear token or redirect
    const isVerifyPasswordRequest = error.config?.url?.includes('/auth/verify-password')
    
    if (error.response?.status === 401 && !isVerifyPasswordRequest) {
      // Check if we are already logged out intentionally
      const stored = localStorage.getItem('raxwo-auth')
      let hasToken = false
      if (stored) {
        try { hasToken = !!JSON.parse(stored)?.state?.token } catch(e){}
      }
      
      localStorage.removeItem('raxwo-auth')
      
      const p = window.location.pathname
      // Only redirect if we had a token (meaning the 401 was unexpected expiration, not a manual logout)
      if (hasToken && p !== '/login' && p !== '/' && !p.startsWith('/services') && !p.startsWith('/about')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
