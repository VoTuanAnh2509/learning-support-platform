import axios from 'axios'

const normalizeApiBaseUrl = rawUrl => {
  const trimmed = String(rawUrl || '').trim().replace(/\/+$/, '')
  if (!trimmed) return 'http://localhost:3000/api'
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}

const api = axios.create({
  baseURL: normalizeApiBaseUrl(import.meta.env.VITE_API_URL),
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('auth_token')

  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

export default api