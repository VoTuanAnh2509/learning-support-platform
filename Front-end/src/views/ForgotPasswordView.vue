<script setup>
import { computed, ref } from 'vue'
import api from '@/services/api'
import { validateEmailSpelling } from '@/utils/emailValidator'

const email = ref('')
const loading = ref(false)
const message = ref('')
const isSuccess = ref(false)

const emailValidation = computed(() => {
  if (!email.value.trim() || !email.value.includes('@')) {
    return { valid: true, error: '', suggestedEmail: '' }
  }
  return validateEmailSpelling(email.value)
})

const applySuggestedEmail = () => {
  if (emailValidation.value.suggestedEmail) {
    email.value = emailValidation.value.suggestedEmail
    message.value = ''
  }
}

const submitForgotPassword = async () => {
  message.value = ''
  isSuccess.value = false

  const emailCheck = validateEmailSpelling(email.value)
  if (!emailCheck.valid) {
    message.value = emailCheck.error
    return
  }

  loading.value = true

  try {
    const { data } = await api.post('/users/forgot-password', {
      email: email.value.trim(),
    })
    isSuccess.value = true
    message.value =
      data?.message || 'A password reset link has been sent to your email address.'
  } catch (error) {
    isSuccess.value = false
    message.value =
      error?.response?.data?.error ||
      error?.message ||
      'Unable to send reset email right now.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <p class="eyebrow">Account Recovery</p>
      <h1>Forgot password?</h1>
      <p class="supporting-text">
        Enter the email address linked to your account and we will send you a 15-minute password reset link.
      </p>

      <form class="auth-form" @submit.prevent="submitForgotPassword">
        <label>
          <span>Email</span>
          <input
            v-model="email"
            type="email"
            placeholder="you@gmail.com"
            required
            :disabled="loading"
          />
          <div v-if="!emailValidation.valid" class="email-spell-warning">
            <span>⚠️ {{ emailValidation.error }}</span>
            <button
              v-if="emailValidation.suggestedEmail"
              type="button"
              class="btn-fix-email"
              @click="applySuggestedEmail"
            >
              Fix to {{ emailValidation.suggestedEmail }}
            </button>
          </div>
        </label>

        <button class="submit-button" type="submit" :disabled="loading">
          {{ loading ? 'Sending reset link...' : 'Send Reset Link' }}
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
        Remembered your password?
        <RouterLink to="/login">← Back to Sign in</RouterLink>
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

.email-spell-warning {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.55rem 0.85rem;
  border-radius: 12px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #b45309;
  font-size: 0.82rem;
  font-weight: 600;
}

.btn-fix-email {
  padding: 0.28rem 0.7rem;
  border-radius: 999px;
  border: none;
  background: #0f766e;
  color: #ffffff;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
}
</style>
