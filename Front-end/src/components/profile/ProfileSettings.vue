<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import api from '@/services/api'
import { validateEmailSpelling } from '@/utils/emailValidator'
import { AVATAR_PRESETS, getAvatarPreset } from '@/utils/avatarPresets'

const props = defineProps({
  profile: {
    type: Object,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['profile-updated'])
const router = useRouter()

const savingProfile = ref(false)
const savingPassword = ref(false)
const savingAvatar = ref(false)
const resettingCourse = ref(false)
const exportingData = ref(false)
const deletingAccount = ref(false)

const profileMessage = ref('')
const passwordMessage = ref('')
const avatarMessage = ref('')
const selectedResetCourseId = ref('')
const avatarImgFailed = ref(false)

const profileForm = reactive({
  name: props.profile?.name || '',
  email: props.profile?.email || '',
  bio: props.profile?.bio || '',
  avatarUrl: props.profile?.avatarUrl || '',
  avatarPreset: props.profile?.avatarPreset || '',
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const enrolledCourses = computed(() =>
  (props.profile?.enrolledCourses || []).filter(entry => entry.course)
)

watch(
  () => props.profile,
  newProfile => {
    if (newProfile) {
      profileForm.name = newProfile.name || ''
      profileForm.email = newProfile.email || ''
      profileForm.bio = newProfile.bio || ''
      profileForm.avatarUrl = newProfile.avatarUrl || ''
      profileForm.avatarPreset = newProfile.avatarPreset || ''
      avatarImgFailed.value = false

      const firstCourse = (newProfile.enrolledCourses || []).find(entry => entry.course)
      if (firstCourse && !selectedResetCourseId.value) {
        selectedResetCourseId.value = String(firstCourse.course?._id || firstCourse.course)
      }
    }
  },
  { immediate: true }
)

watch(
  () => profileForm.avatarUrl,
  () => {
    avatarImgFailed.value = false
  }
)

const displayInitials = computed(() => {
  const name = profileForm.name || props.profile?.email?.split('@')[0] || 'L'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p.charAt(0))
    .join('')
    .toUpperCase()
})

const activePresetObj = computed(() => getAvatarPreset(profileForm.avatarPreset))

const emailValidation = computed(() => {
  if (!profileForm.email.trim() || !profileForm.email.includes('@')) {
    return { valid: true, error: '', suggestedEmail: '' }
  }
  return validateEmailSpelling(profileForm.email)
})

const applySuggestedEmail = () => {
  if (emailValidation.value.suggestedEmail) {
    profileForm.email = emailValidation.value.suggestedEmail
    profileMessage.value = ''
  }
}

const syncUserSession = data => {
  emit('profile-updated', data)
  sessionStorage.setItem(
    'auth_user',
    JSON.stringify({ ...JSON.parse(sessionStorage.getItem('auth_user') || '{}'), ...data })
  )
  window.dispatchEvent(new Event('auth-changed'))
}

const saveProfile = async () => {
  profileMessage.value = ''
  const emailCheck = validateEmailSpelling(profileForm.email)
  if (!emailCheck.valid) {
    profileMessage.value = emailCheck.error
    return
  }

  savingProfile.value = true
  try {
    const { data } = await api.patch(`/users/${props.userId}/profile`, {
      name: profileForm.name.trim(),
      email: profileForm.email.trim(),
      bio: profileForm.bio.trim(),
    })
    syncUserSession(data)
    profileMessage.value = 'Your profile has been saved.'
  } catch (error) {
    profileMessage.value = error?.response?.data?.error || 'Unable to save your profile.'
  } finally {
    savingProfile.value = false
  }
}

const selectPreset = presetId => {
  profileForm.avatarPreset = presetId
  if (presetId) {
    profileForm.avatarUrl = ''
  }
}

const saveAvatarAppearance = async () => {
  avatarMessage.value = ''
  savingAvatar.value = true
  try {
    const { data } = await api.patch(`/users/${props.userId}/profile`, {
      avatarUrl: profileForm.avatarUrl.trim(),
      avatarPreset: profileForm.avatarPreset,
    })
    syncUserSession(data)
    avatarMessage.value = 'Avatar & profile appearance updated.'
  } catch (error) {
    avatarMessage.value = error?.response?.data?.error || 'Unable to update avatar.'
  } finally {
    savingAvatar.value = false
  }
}

const changePassword = async () => {
  passwordMessage.value = ''
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordMessage.value = 'The new passwords do not match.'
    return
  }

  savingPassword.value = true
  try {
    const { data } = await api.patch(`/users/${props.userId}/password`, {
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    })
    passwordMessage.value = data.message || 'Password updated successfully.'
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (error) {
    passwordMessage.value = error?.response?.data?.error || 'Unable to update your password.'
  } finally {
    savingPassword.value = false
  }
}

// === BLOCK 06: DANGER ZONE & DATA EXPORT ===
const handleExportData = async () => {
  exportingData.value = true
  try {
    const { data } = await api.get(`/users/${props.userId}/export`)
    const safeName = (props.profile?.name || 'learner')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const dateStamp = new Date().toISOString().slice(0, 10)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `learning-support-data-${safeName}-${dateStamp}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    Swal.fire({
      icon: 'success',
      title: 'Learning Data Exported',
      text: 'Your complete learning history, quiz scores, and bookmarks have been downloaded as a JSON report.',
      confirmButtonColor: '#0f766e',
    })
  } catch (error) {
    Swal.fire(
      'Export Failed',
      error?.response?.data?.error || 'Unable to export your learning data right now.',
      'error'
    )
  } finally {
    exportingData.value = false
  }
}

const handleResetCourseProgress = async () => {
  if (!selectedResetCourseId.value) return
  const targetEntry = enrolledCourses.value.find(
    entry => String(entry.course?._id || entry.course) === String(selectedResetCourseId.value)
  )
  const courseTitle = targetEntry?.course?.title || 'this course'

  const result = await Swal.fire({
    icon: 'warning',
    title: `Reset "${courseTitle}"?`,
    text: `This will clear all completed lessons, quiz history, and progress (back to 0%) for "${courseTitle}" so you can study it from the beginning.`,
    showCancelButton: true,
    confirmButtonText: 'Yes, reset progress',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#d97706',
  })

  if (!result.isConfirmed) return

  resettingCourse.value = true
  try {
    const { data } = await api.delete(
      `/users/${props.userId}/progress/${selectedResetCourseId.value}`
    )
    if (data?.user) {
      syncUserSession(data.user)
    }
    Swal.fire({
      icon: 'success',
      title: 'Progress Reset',
      text: `Your progress for "${courseTitle}" has been reset to 0%.`,
      confirmButtonColor: '#0f766e',
    })
  } catch (error) {
    Swal.fire(
      'Reset Failed',
      error?.response?.data?.error || 'Unable to reset course progress.',
      'error'
    )
  } finally {
    resettingCourse.value = false
  }
}

const handleDeleteAccount = async () => {
  const result = await Swal.fire({
    icon: 'error',
    title: 'Permanently Delete Account?',
    html: `
      <p style="color: #475569; font-size: 0.92rem; line-height: 1.5; margin-bottom: 10px;">
        This action <strong>cannot be undone</strong>. All your course progress, quiz scores, bookmarks, and profile data will be permanently erased.
      </p>
      <p style="color: #b91c1c; font-size: 0.85rem; font-weight: 700;">
        Type <code>DELETE</code> below to confirm:
      </p>
    `,
    input: 'text',
    inputPlaceholder: 'Type DELETE to confirm',
    showCancelButton: true,
    confirmButtonText: 'Permanently Delete Account',
    cancelButtonText: 'Keep My Account',
    confirmButtonColor: '#dc2626',
    inputValidator: value => {
      if (value !== 'DELETE') {
        return 'Please type DELETE in uppercase to confirm account deletion.'
      }
      return null
    },
  })

  if (!result.isConfirmed) return

  deletingAccount.value = true
  try {
    await api.delete(`/users/${props.userId}/account`)
    sessionStorage.removeItem('auth_user')
    sessionStorage.removeItem('auth_token')
    window.dispatchEvent(new Event('auth-changed'))

    await Swal.fire({
      icon: 'success',
      title: 'Account Deleted',
      text: 'Your account and all associated data have been permanently removed.',
      confirmButtonColor: '#0f766e',
    })
    router.replace('/login')
  } catch (error) {
    Swal.fire(
      'Deletion Failed',
      error?.response?.data?.error || 'Unable to delete your account right now.',
      'error'
    )
  } finally {
    deletingAccount.value = false
  }
}
</script>

<template>
  <section class="account-section">
    <div class="section-heading">
      <div>
        <p class="kicker">PROFILE & ACCESS</p>
        <h2>Account settings</h2>
      </div>
      <span class="security-note"><span aria-hidden="true">●</span> Private to your account</span>
    </div>

    <div class="account-grid">
      <!-- 01: PERSONAL INFORMATION -->
      <form class="profile-panel settings-panel" @submit.prevent="saveProfile">
        <div class="panel-heading">
          <div>
            <h3>Personal information</h3>
            <p>Update the details shown on your account.</p>
          </div>
          <span class="panel-mark">01</span>
        </div>
        <label class="field-label">
          Display name
          <input v-model="profileForm.name" autocomplete="name" required maxlength="80" />
        </label>
        <label class="field-label">
          Email address
          <input v-model="profileForm.email" type="email" autocomplete="email" required />
          <span v-if="!emailValidation.valid" class="email-typo-alert">
            ⚠️ {{ emailValidation.error }}
            <button
              v-if="emailValidation.suggestedEmail"
              type="button"
              class="fix-typo-btn"
              @click="applySuggestedEmail"
            >
              Use {{ emailValidation.suggestedEmail }}
            </button>
          </span>
        </label>
        <label class="field-label">
          About you
          <textarea
            v-model="profileForm.bio"
            rows="3"
            maxlength="300"
            placeholder="What are you learning right now?"
          ></textarea>
        </label>
        <div class="form-footer">
          <p v-if="profileMessage" class="form-message" role="status">{{ profileMessage }}</p>
          <button class="save-button" type="submit" :disabled="savingProfile">
            {{ savingProfile ? 'Saving...' : 'Save profile' }}
          </button>
        </div>
      </form>

      <!-- 02: CHANGE PASSWORD -->
      <form class="profile-panel settings-panel password-panel" @submit.prevent="changePassword">
        <div class="panel-heading">
          <div>
            <h3>Change password</h3>
            <p>Use at least 8 characters for your new password.</p>
          </div>
          <span class="panel-mark">02</span>
        </div>
        <label class="field-label">
          Current password
          <input
            v-model="passwordForm.currentPassword"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>
        <label class="field-label">
          New password
          <input
            v-model="passwordForm.newPassword"
            type="password"
            autocomplete="new-password"
            minlength="8"
            required
          />
        </label>
        <label class="field-label">
          Confirm new password
          <input
            v-model="passwordForm.confirmPassword"
            type="password"
            autocomplete="new-password"
            minlength="8"
            required
          />
        </label>
        <div class="form-footer">
          <p v-if="passwordMessage" class="form-message" role="status">{{ passwordMessage }}</p>
          <button class="save-button secondary-save" type="submit" :disabled="savingPassword">
            {{ savingPassword ? 'Updating...' : 'Update password' }}
          </button>
        </div>
      </form>

      <!-- 05: AVATAR & PROFILE APPEARANCE -->
      <form class="profile-panel settings-panel avatar-panel" @submit.prevent="saveAvatarAppearance">
        <div class="panel-heading">
          <div>
            <h3>Avatar & profile appearance</h3>
            <p>Choose a developer badge preset or paste a custom avatar image URL (synced with Navbar).</p>
          </div>
          <span class="panel-mark">05</span>
        </div>

        <div class="avatar-preview-banner">
          <div
            class="avatar-live-box"
            :style="{ background: activePresetObj?.bg || '#d8ed91' }"
          >
            <img
              v-if="profileForm.avatarUrl && !avatarImgFailed"
              :src="profileForm.avatarUrl"
              alt="Avatar preview"
              @error="avatarImgFailed = true"
            />
            <span v-else-if="activePresetObj?.emoji" class="preset-emoji">
              {{ activePresetObj.emoji }}
            </span>
            <span v-else>{{ displayInitials }}</span>
          </div>
          <div class="avatar-preview-meta">
            <strong>{{ profileForm.name || 'Learner' }}</strong>
            <small v-if="profileForm.avatarUrl && !avatarImgFailed">Using Custom / OAuth Image URL</small>
            <small v-else-if="activePresetObj?.emoji">Using "{{ activePresetObj.label }}" Preset</small>
            <small v-else>Using Default Monogram Initials</small>
          </div>
        </div>

        <div class="preset-section">
          <span class="field-label-text">Developer Avatar Presets</span>
          <div class="preset-grid">
            <button
              v-for="preset in AVATAR_PRESETS"
              :key="preset.id || 'initials'"
              type="button"
              class="preset-chip"
              :class="{ active: !profileForm.avatarUrl && profileForm.avatarPreset === preset.id }"
              @click="selectPreset(preset.id)"
            >
              <span class="preset-chip-icon" :style="{ background: preset.bg }">
                {{ preset.emoji || displayInitials }}
              </span>
              <span class="preset-chip-label">{{ preset.label }}</span>
            </button>
          </div>
        </div>

        <label class="field-label">
          Custom Avatar Image URL (or Google/GitHub photo link)
          <input
            v-model="profileForm.avatarUrl"
            type="url"
            placeholder="https://avatars.githubusercontent.com/u/..."
          />
        </label>

        <div class="form-footer">
          <p v-if="avatarMessage" class="form-message" role="status">{{ avatarMessage }}</p>
          <button class="save-button" type="submit" :disabled="savingAvatar">
            {{ savingAvatar ? 'Saving...' : 'Save appearance' }}
          </button>
        </div>
      </form>

      <!-- 06: DANGER ZONE & DATA EXPORT -->
      <div class="profile-panel settings-panel danger-zone-panel">
        <div class="panel-heading">
          <div>
            <h3>Data export & danger zone</h3>
            <p>Export your learning history, reset course progress, or permanently close your account.</p>
          </div>
          <span class="panel-mark danger-mark">06</span>
        </div>

        <!-- 1. Export Learning Data -->
        <div class="lifecycle-box export-box">
          <div class="lifecycle-copy">
            <strong>📦 Export Learning Data (GDPR JSON)</strong>
            <p>Download a complete JSON report of your completed lessons, quiz scores, and saved bookmarks.</p>
          </div>
          <button
            type="button"
            class="lifecycle-btn export-btn"
            :disabled="exportingData"
            @click="handleExportData"
          >
            {{ exportingData ? 'Exporting...' : 'Download .JSON' }}
          </button>
        </div>

        <!-- 2. Reset Course Progress -->
        <div class="lifecycle-box reset-box">
          <div class="lifecycle-copy">
            <strong>🔄 Reset Course Progress</strong>
            <p>Clear your completion history for a specific course so you can study it again from 0%.</p>
          </div>
          <div v-if="enrolledCourses.length" class="reset-controls">
            <select v-model="selectedResetCourseId" class="reset-course-select" aria-label="Select course to reset">
              <option
                v-for="entry in enrolledCourses"
                :key="entry.course._id"
                :value="String(entry.course._id)"
              >
                {{ entry.course.title }} ({{ Math.round(entry.completionRate || 0) }}%)
              </option>
            </select>
            <button
              type="button"
              class="lifecycle-btn reset-btn"
              :disabled="resettingCourse || !selectedResetCourseId"
              @click="handleResetCourseProgress"
            >
              {{ resettingCourse ? 'Resetting...' : 'Reset to 0%' }}
            </button>
          </div>
          <small v-else class="no-courses-note">You don't have any active courses to reset yet.</small>
        </div>

        <!-- 3. Delete Account -->
        <div class="lifecycle-box delete-box">
          <div class="lifecycle-copy">
            <strong>⚠️ Delete Account Permanently</strong>
            <p>Erase your account, progress records, and bookmarks permanently. Requires typing DELETE.</p>
          </div>
          <button
            type="button"
            class="lifecycle-btn delete-btn"
            :disabled="deletingAccount"
            @click="handleDeleteAccount"
          >
            {{ deletingAccount ? 'Deleting...' : 'Delete Account' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.kicker {
  margin: 0;
  color: #82928a;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.09em;
}

.account-section {
  margin-top: 29px;
}

.section-heading,
.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-heading {
  margin-bottom: 13px;
  align-items: flex-end;
}

.section-heading h2 {
  margin: 4px 0 0;
  color: #17324d;
  font-size: 1.28rem;
}

.security-note {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #798a82;
  font-size: 0.68rem;
  white-space: nowrap;
}

.security-note span {
  color: #3c9d78;
  font-size: 0.55rem;
}

.account-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.profile-panel {
  border: 1px solid #e2e8e0;
  border-radius: 10px;
  background: #fff;
}

.settings-panel {
  display: grid;
  align-content: start;
  gap: 13px;
  padding: 20px;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 2px;
}

.panel-heading h3 {
  margin: 0;
  color: #17324d;
  font-size: 0.93rem;
}

.panel-heading p {
  margin: 4px 0 0;
  color: #84928b;
  font-size: 0.67rem;
  line-height: 1.45;
}

.panel-mark {
  color: #a6b6a8;
  font-size: 0.65rem;
  font-weight: 850;
}

.danger-mark {
  color: #dc2626;
}

.field-label,
.field-label-text {
  display: grid;
  gap: 6px;
  color: #566b61;
  font-size: 0.68rem;
  font-weight: 750;
}

.field-label input,
.field-label textarea {
  width: 100%;
  min-width: 0;
  padding: 10px 11px;
  border: 1px solid #dfe8e1;
  border-radius: 6px;
  outline: 0;
  background: #fbfcfa;
  color: #17324d;
  font-size: 0.76rem;
  font-weight: 450;
}

.field-label input:focus,
.field-label textarea:focus {
  border-color: #62a98d;
  box-shadow: 0 0 0 3px rgba(56, 145, 111, 0.12);
}

.field-label textarea {
  resize: vertical;
  line-height: 1.45;
}

.form-footer {
  align-items: center;
  margin-top: 2px;
}

.form-message {
  margin: 0;
  color: #398269;
  font-size: 0.66rem;
  line-height: 1.4;
}

.save-button {
  min-height: 36px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: #0f766e;
  color: white;
  font-size: 0.7rem;
  font-weight: 750;
  cursor: pointer;
  white-space: nowrap;
}

.save-button:hover {
  background: #0d5144;
}

.save-button:disabled {
  opacity: 0.62;
  cursor: wait;
}

.secondary-save {
  background: #607f54;
}

.email-typo-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #b45309;
  font-size: 0.72rem;
  font-weight: 600;
}

.fix-typo-btn {
  padding: 3px 8px;
  border-radius: 999px;
  border: none;
  background: #0f766e;
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
}

/* BLOCK 05: AVATAR & APPEARANCE */
.avatar-preview-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border-radius: 10px;
  background: #f8fbf8;
  border: 1px solid #e2ece4;
}

.avatar-live-box {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #17324d;
  font-size: 1.2rem;
  font-weight: 850;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
}

.avatar-live-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preset-emoji {
  font-size: 1.65rem;
  line-height: 1;
}

.avatar-preview-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.avatar-preview-meta strong {
  font-size: 0.88rem;
  color: #17324d;
}

.avatar-preview-meta small {
  font-size: 0.7rem;
  color: #60726c;
}

.preset-section {
  display: grid;
  gap: 8px;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.preset-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 8px 6px;
  border-radius: 8px;
  border: 1px solid #dfe8e1;
  background: #fbfcfa;
  cursor: pointer;
  transition: all 0.16s ease;
}

.preset-chip:hover {
  border-color: #10b981;
  background: #f0fdf4;
}

.preset-chip.active {
  border-color: #0f766e;
  background: #ecfdf5;
  box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.16);
}

.preset-chip-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 1.05rem;
  font-weight: 800;
  color: #17324d;
}

.preset-chip-label {
  font-size: 0.64rem;
  font-weight: 700;
  color: #334155;
  text-align: center;
}

/* BLOCK 06: DANGER ZONE & DATA EXPORT */
.danger-zone-panel {
  border-color: #f3d4ce;
}

.lifecycle-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 9px;
  border: 1px solid #e6ece7;
  background: #fbfcfa;
  flex-wrap: wrap;
}

.delete-box {
  background: #fff8f6;
  border-color: #f5cfc7;
}

.lifecycle-copy {
  flex: 1 1 200px;
}

.lifecycle-copy strong {
  display: block;
  font-size: 0.78rem;
  color: #17324d;
  margin-bottom: 3px;
}

.delete-box .lifecycle-copy strong {
  color: #991b1b;
}

.lifecycle-copy p {
  margin: 0;
  font-size: 0.68rem;
  color: #64748b;
  line-height: 1.45;
}

.reset-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  width: 100%;
  margin-top: 4px;
}

.reset-course-select {
  flex: 1;
  min-width: 150px;
  padding: 7px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #17324d;
  font-size: 0.74rem;
  font-weight: 600;
}

.no-courses-note {
  font-size: 0.68rem;
  color: #94a3b8;
  font-style: italic;
}

.lifecycle-btn {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 6px;
  border: none;
  font-size: 0.7rem;
  font-weight: 750;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.16s ease;
}

.lifecycle-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.export-btn {
  background: #0f766e;
  color: #ffffff;
}

.reset-btn {
  background: #d97706;
  color: #ffffff;
}

.delete-btn {
  background: #dc2626;
  color: #ffffff;
}

.lifecycle-btn:hover:not(:disabled) {
  opacity: 0.9;
}

@media (max-width: 900px) {
  .account-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .settings-panel {
    padding: 15px;
  }
  .preset-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .section-heading {
    align-items: flex-start;
  }
  .security-note {
    max-width: 105px;
    justify-content: flex-end;
    text-align: right;
    white-space: normal;
  }
}
</style>
