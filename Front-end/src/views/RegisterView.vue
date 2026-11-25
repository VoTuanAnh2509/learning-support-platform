<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import api from '@/services/api'
import { validateEmailSpelling } from '@/utils/emailValidator'

const router = useRouter()
const loading = ref(false)
const registrationAllowed = ref(true)
const message = ref('')
const isError = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

onMounted(async () => {
  try {
    const { data } = await api.get('/system/settings')
    if (data && typeof data.allowRegistration === 'boolean') {
      registrationAllowed.value = data.allowRegistration
    }
  } catch (_err) {
    // Mặc định vẫn cho phép nếu chưa tải được
  }
})

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const emailDuplicateState = reactive({
  checking: false,
  checked: false,
  exists: false,
  message: '',
})
let emailCheckTimer = null

const emailValidation = computed(() => {
  if (!form.email.trim() || !form.email.includes('@')) {
    return { valid: true, error: '', suggestedEmail: '' }
  }
  return validateEmailSpelling(form.email)
})

const checkEmailInDatabase = async rawEmail => {
  const check = validateEmailSpelling(rawEmail)
  if (!check.valid) {
    emailDuplicateState.checking = false
    emailDuplicateState.checked = false
    emailDuplicateState.exists = false
    emailDuplicateState.message = ''
    return
  }

  emailDuplicateState.checking = true
  try {
    const { data } = await api.get('/users/check-email', {
      params: { email: rawEmail.trim().toLowerCase() },
    })
    emailDuplicateState.checked = true
    emailDuplicateState.exists = Boolean(data?.exists)
    emailDuplicateState.message = data?.message || ''
  } catch (_err) {
    emailDuplicateState.checked = false
    emailDuplicateState.exists = false
    emailDuplicateState.message = ''
  } finally {
    emailDuplicateState.checking = false
  }
}

watch(
  () => form.email,
  newEmail => {
    if (emailCheckTimer) clearTimeout(emailCheckTimer)
    emailDuplicateState.checked = false
    emailDuplicateState.exists = false
    emailDuplicateState.message = ''

    const trimmed = newEmail.trim()
    if (!trimmed || !trimmed.includes('@')) {
      emailDuplicateState.checking = false
      return
    }

    const spellCheck = validateEmailSpelling(trimmed)
    if (!spellCheck.valid) {
      emailDuplicateState.checking = false
      return
    }

    emailDuplicateState.checking = true
    emailCheckTimer = setTimeout(() => {
      checkEmailInDatabase(trimmed)
    }, 350)
  }
)

onBeforeUnmount(() => {
  if (emailCheckTimer) clearTimeout(emailCheckTimer)
})

const applySuggestedEmail = () => {
  if (emailValidation.value.suggestedEmail) {
    form.email = emailValidation.value.suggestedEmail
    message.value = ''
    isError.value = false
  }
}

const submitRegister = async () => {
  message.value = ''
  isError.value = false

  const emailCheck = validateEmailSpelling(form.email)
  if (!emailCheck.valid) {
    isError.value = true
    message.value = emailCheck.error
    return
  }

  // Kiểm tra email đã tồn tại trong DB chưa trước khi tạo tài khoản
  if (!emailDuplicateState.checked) {
    await checkEmailInDatabase(form.email)
  }
  if (emailDuplicateState.exists) {
    isError.value = true
    message.value =
      emailDuplicateState.message ||
      'This email is already registered by you or another user. Please sign in or use a different email.'
    return
  }

  if (form.password.length < 8) {
    isError.value = true
    message.value = 'Password must be at least 8 characters.'
    return
  }

  if (form.password !== form.confirmPassword) {
    isError.value = true
    message.value = 'Passwords do not match. Please check again.'
    return
  }

  loading.value = true

  try {
    const { data } = await api.post('/users/register', {
      name: form.name,
      email: form.email,
      password: form.password,
    })

    if (data?.user) {
      sessionStorage.setItem('auth_user', JSON.stringify(data.user))
    }

    if (data?.token) {
      sessionStorage.setItem('auth_token', data.token)
    }

    window.dispatchEvent(new Event('auth-changed'))
    message.value = data?.message || 'Account created successfully.'
    await router.push(data?.user?.role === 'admin' ? '/admin' : '/profile')
  } catch (error) {
    isError.value = true
    message.value = error?.response?.data?.error || 'Unable to create account right now.'
  } finally {
    loading.value = false
  }
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

const toggleConfirmPasswordVisibility = () => {
  showConfirmPassword.value = !showConfirmPassword.value
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <p class="eyebrow">Get started</p>
      <h1>Register</h1>
      <p class="supporting-text">Create an account to track progress and receive personalized suggestions.</p>

      <div v-if="!registrationAllowed" class="registration-closed-alert" role="alert">
        <strong>🔒 Registration Temporarily Closed</strong>
        <p>New account registration is currently disabled by the platform administrator. Existing users can still sign in below.</p>
      </div>

      <form class="auth-form" autocomplete="off" @submit.prevent="submitRegister">
        <label>
          <span>Full name</span>
          <input v-model="form.name" type="text" name="register_name" autocomplete="off" placeholder="John Doe" required />
        </label>

        <label>
          <span>Email</span>
          <input
            v-model="form.email"
            type="email"
            name="register_email"
            autocomplete="off"
            placeholder="you@gmail.com"
            required
            @blur="form.email.trim() && checkEmailInDatabase(form.email)"
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
          <div v-else-if="emailDuplicateState.checking" class="email-checking-status">
            ⏳ Checking if this email is already registered...
          </div>
          <div v-else-if="emailDuplicateState.checked && emailDuplicateState.exists" class="email-duplicate-warning">
            <span>❌ {{ emailDuplicateState.message }}</span>
            <RouterLink to="/login" class="btn-goto-login">Sign in instead ➔</RouterLink>
          </div>
          <div v-else-if="emailDuplicateState.checked && !emailDuplicateState.exists" class="email-available-badge">
            ✓ This email is available for registration.
          </div>
        </label>

        <label>
          <span>Password</span>
          <div class="password-field">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              name="register_new_password"
              autocomplete="new-password"
              placeholder="At least 8 characters"
              minlength="8"
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

        <label>
          <span>Confirm password</span>
          <div class="password-field">
            <input
              v-model="form.confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              name="register_confirm_password"
              autocomplete="new-password"
              placeholder="Re-enter your password"
              minlength="8"
              required
            />
            <button
              class="toggle-password"
              type="button"
              @click="toggleConfirmPasswordVisibility"
              :aria-pressed="showConfirmPassword"
              :aria-label="showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'"
            >
              <svg v-if="showConfirmPassword" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5.05 0-9.27-3.11-11-7 1.06-2.11 2.8-3.9 4.88-5.06"/><path d="M1 1l22 22"/></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </label>

        <button
          class="submit-button"
          type="submit"
          :disabled="loading || !registrationAllowed || !emailValidation.valid || emailDuplicateState.exists || emailDuplicateState.checking"
        >
          {{ !registrationAllowed ? 'Registration Disabled' : loading ? 'Creating account...' : 'Register' }}
        </button>

        <p v-if="message" class="message" :class="{ 'error-message': isError }">{{ message }}</p>
      </form>

      <p class="helper-link">
        Already have an account?
        <RouterLink to="/login">Sign in</RouterLink>
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

.registration-closed-alert {
  margin-top: 1.15rem;
  padding: 0.9rem 1rem;
  border-radius: 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  font-size: 0.85rem;
}

.registration-closed-alert strong {
  display: block;
  margin-bottom: 0.25rem;
}

.registration-closed-alert p {
  margin: 0;
  line-height: 1.45;
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

input,
select {
  width: 100%;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 16px;
  padding: 0.9rem 1rem;
  font: inherit;
  background: rgba(248, 250, 252, 0.95);
}

input:focus,
select:focus {
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
  color: #0f766e;
  font-weight: 600;
}

.error-message {
  color: #dc2626;
}

.helper-link {
  margin: 1rem 0 0;
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

.btn-fix-email:hover {
  background: #0d9488;
}

.email-checking-status {
  font-size: 0.8rem;
  font-weight: 600;
  color: #64748b;
  padding: 0.25rem 0.2rem;
}

.email-duplicate-warning {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  border-radius: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 0.82rem;
  font-weight: 600;
}

.btn-goto-login {
  padding: 0.28rem 0.75rem;
  border-radius: 999px;
  background: #b91c1c;
  color: #ffffff !important;
  font-size: 0.76rem;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.btn-goto-login:hover {
  background: #991b1b;
}

.email-available-badge {
  padding: 0.45rem 0.75rem;
  border-radius: 10px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #047857;
  font-size: 0.8rem;
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