import axios from 'axios'
import { auth } from '../lib/firebase'

// API Configuration with fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const apiService = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add the Firebase ID token (refreshed automatically by the SDK)
apiService.interceptors.request.use(
  async (config) => {
    await auth.authStateReady()
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken()
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors
apiService.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isProfileCheck = error.config?.url === '/auth/me' // handled by AuthContext
    if (error.response?.status === 401 && !isProfileCheck) {
      await auth.signOut()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export { apiService }
