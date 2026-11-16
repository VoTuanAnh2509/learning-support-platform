<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import api from '@/services/api'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const message = ref('')
const showPassword = ref(false)
const oauthBaseUrl = (api.defaults.baseURL || '').replace(/\/$/, '')

const form = reactive({
  email: '',
  password: '',
})

const finishSocialLogin = async () => {
  const token = route.query.token
  if (typeof token !== 'string') {
    if (route.query.error) {
      message.value = 'Social sign-in failed. Please try again.'
      router.replace('/login')
    }
    return
  }

  loading.value = true
  try {
    const encodedPayload = token.split('.')[1]
    const payload = JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')))
    if (!payload.userId) throw new Error('Social sign-in token is invalid.')

    sessionStorage.setItem('auth_token', token)
    const { data: user } = await api.get(`/users/${payload.userId}/profile`)
    sessionStorage.setItem('auth_user', JSON.stringify(user))
    window.dispatchEvent(new Event('auth-changed'))
    await router.replace(['admin', 'instructor'].includes(user.role) ? '/admin' : '/profile')
  } catch (_error) {
    sessionStorage.removeItem('auth_token')
    sessionStorage.removeItem('auth_user')
    message.value = 'Unable to complete social sign-in. Please try again.'
    await router.replace('/login')
  } finally {
    loading.value = false
  }
}

onMounted(finishSocialLogin)

const submitLogin = async () => {
  loading.value = true
  message.value = ''

  try {
    const { data } = await api.post('/users/login', form)
    if (!data || typeof data !== 'object' || !data.token || !data.user) {
      throw new Error(
        'Invalid API response. Please check that VITE_API_URL on Render points to your Backend Web Service URL.'
      )
    }

    sessionStorage.setItem('auth_user', JSON.stringify(data.user))
    sessionStorage.setItem('auth_token', data.token)

    message.value = data.message || 'Login successful.'
    window.dispatchEvent(new Event('auth-changed'))
    await router.push(['admin', 'instructor'].includes(data.user.role) ? '/admin' : '/profile')
  } catch (error) {
    message.value =
      error?.response?.data?.error ||
      error?.message ||
      'Unable to sign in right now.'
  } finally {
    loading.value = false
  }
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <p class="eyebrow">Welcome back</p>
      <h1>Sign in</h1>
      <p class="supporting-text">Access your learning dashboard, AI help, and personal progress.</p>

      <form class="auth-form" @submit.prevent="submitLogin">
        <label>
          <span>Email</span>
          <input v-model="form.email" type="email" placeholder="you@example.com" required />
        </label>

        <label>
          <span>Password</span>
          <div class="password-field">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Enter your password"
              required
            />
            <button
              class="toggle-password"
              type="button"
              @click="togglePasswordVisibility"
              :aria-pressed="showPassword"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
            >
              <svg v-if="showPassword" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5.05 0-9.27-3.11-11-7 1.06-2.11 2.8-3.9 4.88-5.06"/><path d="M1 1l22 22"/></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </label>

        <button class="submit-button" type="submit" :disabled="loading">
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>

        <div class="social-login-divider"><span>or</span></div>

        <div class="social-login-group" aria-label="Sign in with another provider">
          <a :href="`${oauthBaseUrl}/auth/google`" class="btn-social" aria-label="Continue with Google">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
          </a>
          <a :href="`${oauthBaseUrl}/auth/facebook`" class="btn-social" aria-label="Continue with Facebook">
            <img src="https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg" alt="Facebook" />
          </a>
          <a :href="`${oauthBaseUrl}/auth/github`" class="btn-social" aria-label="Continue with GitHub">
            <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Octicons-mark-github.svg" alt="GitHub" />
          </a>
        </div>

        <p v-if="message" class="message">{{ message }}</p>
      </form>

      <p class="helper-link">
        Don't have an account?
        <RouterLink to="/register">Create account</RouterLink>
      </p>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  display: grid;
  place-items: center;
}

.auth-card {
  width: min(100%, 520px);
  border-radius: 28px;
  padding: clamp(1.5rem, 4vw, 2.5rem);
  border: 1px solid rgba(16, 24, 40, 0.08);
  background: rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(12px);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14);
}

.eyebrow {
  margin: 0 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.78rem;
  font-weight: 700;
  color: #0f766e;
}

h1 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(2rem, 4vw, 3rem);
}

.supporting-text {
  margin: 0.6rem 0 0;
  color: #475569;
}

.auth-form {
  display: grid;
  gap: 1rem;
  margin-top: 1.5rem;
}

label {
  display: grid;
  gap: 0.45rem;
  color: #0f172a;
  font-weight: 600;
}

input {
  width: 100%;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 16px;
  padding: 0.9rem 1rem;
  font: inherit;
  background: rgba(248, 250, 252, 0.95);
}

input:focus {
  outline: 2px solid rgba(29, 78, 216, 0.2);
  border-color: rgba(29, 78, 216, 0.4);
}

.submit-button {
  min-height: 48px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #0f766e, #1d4ed8);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.submit-button:disabled {
  opacity: 0.75;
  cursor: progress;
}

.social-login-divider {
  position: relative;
  margin: 0.5rem 0;
  text-align: center;
}

.social-login-divider::before {
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  border-top: 1px solid #e2e8f0;
  content: '';
}

.social-login-divider span {
  position: relative;
  z-index: 1;
  padding: 0 15px;
  background: white;
  color: #64748b;
  font-size: 0.9rem;
}

.social-login-group {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.btn-social {
  display: flex;
  width: 70px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  text-decoration: none;
  transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.btn-social:hover {
  transform: translateY(-1px);
  background: #f8fafc;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.btn-social:focus-visible {
  outline: 2px solid #0f766e;
  outline-offset: 2px;
}

.btn-social img {
  width: 24px;
  height: 24px;
}

.message {
  margin: 0;
  color: #0f172a;
}

.helper-link {
  margin: 1rem 0 0;
  color: #475569;
}

.helper-link a {
  color: #1d4ed8;
  font-weight: 700;
}

.password-field {
  position: relative;
}
.password-field input {
  padding-right: 3rem;
}
.toggle-password {
  position: absolute;
  right: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 36px;
  cursor: pointer;
  color: #0f172a;
}
.toggle-password svg {
  width: 20px;
  height: 20px;
}
</style>