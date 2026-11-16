<script setup>
import { reactive, ref, watch } from 'vue'
import api from '@/services/api'

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

const savingProfile = ref(false)
const savingPassword = ref(false)
const profileMessage = ref('')
const passwordMessage = ref('')

const profileForm = reactive({
  name: props.profile?.name || '',
  email: props.profile?.email || '',
  bio: props.profile?.bio || '',
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

watch(
  () => props.profile,
  newProfile => {
    if (newProfile) {
      profileForm.name = newProfile.name || ''
      profileForm.email = newProfile.email || ''
      profileForm.bio = newProfile.bio || ''
    }
  },
  { immediate: true }
)

const saveProfile = async () => {
  savingProfile.value = true
  profileMessage.value = ''
  try {
    const { data } = await api.patch(`/users/${props.userId}/profile`, {
      name: profileForm.name.trim(),
      email: profileForm.email.trim(),
      bio: profileForm.bio.trim(),
    })
    emit('profile-updated', data)
    sessionStorage.setItem(
      'auth_user',
      JSON.stringify({ ...JSON.parse(sessionStorage.getItem('auth_user') || '{}'), ...data })
    )
    window.dispatchEvent(new Event('auth-changed'))
    profileMessage.value = 'Your profile has been saved.'
  } catch (error) {
    profileMessage.value = error?.response?.data?.error || 'Unable to save your profile.'
  } finally {
    savingProfile.value = false
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
        </label>
        <label class="field-label">
          About you
          <textarea v-model="profileForm.bio" rows="3" maxlength="300" placeholder="What are you learning right now?"></textarea>
        </label>
        <div class="form-footer">
          <p v-if="profileMessage" class="form-message" role="status">{{ profileMessage }}</p>
          <button class="save-button" type="submit" :disabled="savingProfile">
            {{ savingProfile ? 'Saving...' : 'Save profile' }}
          </button>
        </div>
      </form>

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
          <input v-model="passwordForm.currentPassword" type="password" autocomplete="current-password" required />
        </label>
        <label class="field-label">
          New password
          <input v-model="passwordForm.newPassword" type="password" autocomplete="new-password" minlength="8" required />
        </label>
        <label class="field-label">
          Confirm new password
          <input v-model="passwordForm.confirmPassword" type="password" autocomplete="new-password" minlength="8" required />
        </label>
        <div class="form-footer">
          <p v-if="passwordMessage" class="form-message" role="status">{{ passwordMessage }}</p>
          <button class="save-button secondary-save" type="submit" :disabled="savingPassword">
            {{ savingPassword ? 'Updating...' : 'Update password' }}
          </button>
        </div>
      </form>
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
}

.panel-mark {
  color: #a6b6a8;
  font-size: 0.65rem;
  font-weight: 850;
}

.field-label {
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

@media (max-width: 900px) {
  .account-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .settings-panel {
    padding: 15px;
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
