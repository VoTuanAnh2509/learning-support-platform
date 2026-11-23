<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import api from '@/services/api'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const message = ref('')
const isSuccess = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const form = reactive({
  password: '',
  confirmPassword: '',
})

const submitResetPassword = async () => {
  message.value = ''
  isSuccess.value = false

  if (form.password.length < 8) {
    message.value = 'New password must be at least 8 characters.'
    return
  }

  if (form.password !== form.confirmPassword) {
    message.value = 'Confirmation password does not match.'
    return
  }

  loading.value = true
  try {
    const token = route.params.token
    const { data } = await api.post(`/users/reset-password/${token}`, {
      password: form.password,
    })

    isSuccess.value = true
    message.value = data?.message || 'Your password has been reset successfully.'

    await Swal.fire({
      icon: 'success',
      title: 'Password Reset Complete',
      text: 'Your new password has been saved. Please sign in with your new password.',
      confirmButtonText: 'Go to Sign in',
      confirmButtonColor: '#0f766e',
    })

    await router.push('/login')
  } catch (error) {
    isSuccess.value = false
    message.value =
      error?.response?.data?.error ||
      error?.message ||
      'Unable to reset password. Your reset link may have expired.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <p class="eyebrow">Security Update</p>
      <h1>Reset password</h1>
      <p class="supporting-text">
        Choose a strong new password (at least 8 characters) for your Learning Support account.
      </p>

      <form class="auth-form" @submit.prevent="submitResetPassword">
        <label>
          <span>New Password</span>
          <div class="password-field">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="At least 8 characters"
              minlength="8"
              required
              :disabled="loading"
            />
            <button
              class="toggle-password"
              type="button"
              :aria-pressed="showPassword"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <svg
                v-if="showPassword"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5.05 0-9.27-3.11-11-7 1.06-2.11 2.8-3.9 4.88-5.06" />
                <path d="M1 1l22 22" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </label>

        <label>
          <span>Confirm New Password</span>
          <div class="password-field">
            <input
              v-model="form.confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              placeholder="Re-enter your new password"
              minlength="8"
              required
              :disabled="loading"
            />
            <button
              class="toggle-password"
              type="button"
              :aria-pressed="showConfirmPassword"
              :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
              @click="showConfirmPassword = !showConfirmPassword"
            >
              <svg
                v-if="showConfirmPassword"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5.05 0-9.27-3.11-11-7 1.06-2.11 2.8-3.9 4.88-5.06" />
                <path d="M1 1l22 22" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </label>

        <button class="submit-button" type="submit" :disabled="loading">
          {{ loading ? 'Updating password...' : 'Save New Password' }}
        </button>

        <p
          v-if="message"
          class="message"
          :class="isSuccess ? 'success-message' : 'error-message'"
          role="status"
        >
          {{ message }}
        </p>
      </form>

      <p class="helper-link">
        <RouterLink to="/login">← Return to Sign in</RouterLink>
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
  font-size: clamp(2rem, 4vw, 2.8rem);
}

.supporting-text {
  margin: 0.6rem 0 0;
  color: #475569;
  line-height: 1.55;
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

.password-field {
  position: relative;
  display: flex;
  align-items: center;
}

.password-field input {
  padding-right: 3rem;
}

.toggle-password {
  position: absolute;
  right: 0.85rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  padding: 0;
  border: none;
  background: transparent;
  color: #475569;
  cursor: pointer;
}

.toggle-password svg {
  width: 1.25rem;
  height: 1.25rem;
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

.message {
  margin: 0;
  padding: 0.8rem 1rem;
  border-radius: 12px;
  font-size: 0.92rem;
  font-weight: 600;
}

.success-message {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.error-message {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.helper-link {
  margin: 1.25rem 0 0;
  color: #475569;
}

.helper-link a {
  color: #1d4ed8;
  font-weight: 700;
}
</style>
