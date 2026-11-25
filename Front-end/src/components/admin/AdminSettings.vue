<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/services/api'

const loading = ref(false)
const saving = ref(false)
const broadcasting = ref(false)
const statusMsg = ref({ text: '', isError: false })
const broadcastMsg = ref({ text: '', isError: false })

const settingsForm = reactive({
  allowRegistration: true,
  aiTutorEnabled: true,
  defaultAiModel: 'gemini-2.5-flash',
  maintenanceMode: false,
  maintenanceMessage:
    'Scheduled maintenance is in progress. Some platform features may be temporarily limited.',
  updatedAt: null,
})

const broadcastForm = reactive({
  title: '',
  message: '',
  targetRole: 'all',
})

const aiModelOptions = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash (Recommended)',
    desc: 'Fast, balanced accuracy & low latency for live code review and chat.',
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    desc: 'Ultra-lightweight model with highest quota availability.',
  },
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    desc: 'Next-gen reasoning model (auto-falls back to 2.5 Flash on 503/429).',
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    desc: 'Stable legacy backup model for high-traffic periods.',
  },
]

const fallbackOrderPreview = computed(() => {
  const all = aiModelOptions.map(m => m.id)
  const primary = settingsForm.defaultAiModel || 'gemini-2.5-flash'
  return [primary, ...all.filter(id => id !== primary)]
})

const formatUpdatedTime = value => {
  if (!value) return 'Just now'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const loadSystemSettings = async () => {
  loading.value = true
  try {
    const { data } = await api.get('/system/settings')
    settingsForm.allowRegistration = Boolean(data?.allowRegistration ?? true)
    settingsForm.aiTutorEnabled = Boolean(data?.aiTutorEnabled ?? true)
    settingsForm.defaultAiModel = data?.defaultAiModel || 'gemini-2.5-flash'
    settingsForm.maintenanceMode = Boolean(data?.maintenanceMode ?? false)
    settingsForm.maintenanceMessage =
      data?.maintenanceMessage ||
      'Scheduled maintenance is in progress. Some platform features may be temporarily limited.'
    settingsForm.updatedAt = data?.updatedAt || null
  } catch (error) {
    statusMsg.value = {
      text: error?.response?.data?.error || 'Unable to load system settings.',
      isError: true,
    }
  } finally {
    loading.value = false
  }
}

const saveSystemSettings = async () => {
  saving.value = true
  statusMsg.value = { text: '', isError: false }
  try {
    const { data } = await api.patch('/admin/settings', {
      allowRegistration: settingsForm.allowRegistration,
      aiTutorEnabled: settingsForm.aiTutorEnabled,
      defaultAiModel: settingsForm.defaultAiModel,
      maintenanceMode: settingsForm.maintenanceMode,
      maintenanceMessage: settingsForm.maintenanceMessage,
    })

    if (data?.settings) {
      settingsForm.allowRegistration = Boolean(data.settings.allowRegistration)
      settingsForm.aiTutorEnabled = Boolean(data.settings.aiTutorEnabled)
      settingsForm.defaultAiModel = data.settings.defaultAiModel
      settingsForm.maintenanceMode = Boolean(data.settings.maintenanceMode)
      settingsForm.maintenanceMessage = data.settings.maintenanceMessage
      settingsForm.updatedAt = data.settings.updatedAt
    }

    window.dispatchEvent(new Event('system-settings-changed'))
    statusMsg.value = {
      text: data?.message || 'Platform settings saved and applied system-wide!',
      isError: false,
    }
  } catch (error) {
    statusMsg.value = {
      text: error?.response?.data?.error || 'Failed to update system settings.',
      isError: true,
    }
  } finally {
    saving.value = false
    setTimeout(() => {
      statusMsg.value.text = ''
    }, 4500)
  }
}

const sendBroadcast = async () => {
  broadcastMsg.value = { text: '', isError: false }
  if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
    broadcastMsg.value = {
      text: 'Please enter both a title and a message for the announcement.',
      isError: true,
    }
    return
  }

  broadcasting.value = true
  try {
    const { data } = await api.post('/admin/settings/broadcast', {
      title: broadcastForm.title.trim(),
      message: broadcastForm.message.trim(),
      targetRole: broadcastForm.targetRole,
    })
    broadcastMsg.value = {
      text: data?.message || 'Announcement sent to users!',
      isError: false,
    }
    broadcastForm.title = ''
    broadcastForm.message = ''
    window.dispatchEvent(new Event('auth-changed'))
  } catch (error) {
    broadcastMsg.value = {
      text: error?.response?.data?.error || 'Failed to broadcast announcement.',
      isError: true,
    }
  } finally {
    broadcasting.value = false
    setTimeout(() => {
      broadcastMsg.value.text = ''
    }, 4500)
  }
}

onMounted(() => {
  loadSystemSettings()
})
</script>

<template>
  <section class="admin-section system-settings-workspace">
    <!-- HEADER -->
    <div class="section-heading">
      <div>
        <p class="eyebrow">Platform Governance · Admin Only</p>
        <h2>System & Platform Settings</h2>
      </div>
      <div class="heading-status">
        <span class="sync-badge">
          <span class="dot"></span>
          Last synced: {{ formatUpdatedTime(settingsForm.updatedAt) }}
        </span>
      </div>
    </div>

    <!-- ROLE SEPARATION SHORTCUT BANNER -->
    <div class="personal-profile-callout">
      <div class="callout-copy">
        <span class="callout-icon">👤</span>
        <div>
          <strong>Looking for your personal account settings (Name, Email, Avatar, Password)?</strong>
          <p>
            Personal profile management is unified under <strong>My Profile</strong> for all roles
            (Learner, Instructor, Admin). This page controls global platform behavior.
          </p>
        </div>
      </div>
      <RouterLink to="/profile/settings" class="btn-goto-profile">
        Open My Profile Settings ➔
      </RouterLink>
    </div>

    <p v-if="loading" class="state-text">Loading platform configuration...</p>

    <form v-else class="system-settings-form" @submit.prevent="saveSystemSettings">
      <div class="settings-grid">
        <!-- CARD 01: REGISTRATION & ACCESS CONTROL -->
        <div class="settings-card">
          <div class="card-top">
            <div>
              <span class="card-kicker">01 · ACCESS CONTROL</span>
              <h3>User Registration & Onboarding</h3>
              <p class="settings-desc">
                Control whether new visitors can create learner accounts on the platform.
              </p>
            </div>
            <span
              class="status-pill"
              :class="settingsForm.allowRegistration ? 'pill-active' : 'pill-disabled'"
            >
              {{ settingsForm.allowRegistration ? 'OPEN' : 'CLOSED' }}
            </span>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <strong>Allow New Account Registrations</strong>
              <small>
                When turned off, the <code>/register</code> page and registration API will reject
                new sign-ups while existing users can still sign in normally.
              </small>
            </div>
            <label class="switch" aria-label="Toggle new user registration">
              <input v-model="settingsForm.allowRegistration" type="checkbox" />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <!-- CARD 02: AI TUTOR & GEMINI MODEL CONFIGURATION -->
        <div class="settings-card">
          <div class="card-top">
            <div>
              <span class="card-kicker">02 · ARTIFICIAL INTELLIGENCE</span>
              <h3>AI Tutor & Default Gemini Model</h3>
              <p class="settings-desc">
                Manage AI Mentor chat, live code review, and automatic 503/429 model fallback.
              </p>
            </div>
            <span
              class="status-pill"
              :class="settingsForm.aiTutorEnabled ? 'pill-active' : 'pill-disabled'"
            >
              {{ settingsForm.aiTutorEnabled ? 'AI ONLINE' : 'AI PAUSED' }}
            </span>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <strong>Enable AI Tutor System-Wide</strong>
              <small>
                Controls AI Chat Widget, W3Schools Code Review, and personalized AI learning
                insights for all learners.
              </small>
            </div>
            <label class="switch" aria-label="Toggle AI Tutor system-wide">
              <input v-model="settingsForm.aiTutorEnabled" type="checkbox" />
              <span class="slider"></span>
            </label>
          </div>

          <div class="form-group">
            <label for="default-ai-model">Default Primary Gemini Model</label>
            <select
              id="default-ai-model"
              v-model="settingsForm.defaultAiModel"
              class="admin-select"
              :disabled="!settingsForm.aiTutorEnabled"
            >
              <option v-for="model in aiModelOptions" :key="model.id" :value="model.id">
                {{ model.label }}
              </option>
            </select>
            <small class="field-hint">
              Active Fallback Chain (anti-503/429):
              <code>{{ fallbackOrderPreview.join(' ➔ ') }}</code>
            </small>
          </div>
        </div>

        <!-- CARD 03: MAINTENANCE MODE & GLOBAL BANNER -->
        <div class="settings-card full-span">
          <div class="card-top">
            <div>
              <span class="card-kicker">03 · PLATFORM STATUS & MAINTENANCE</span>
              <h3>Global Maintenance Notice Banner</h3>
              <p class="settings-desc">
                Display a real-time maintenance or system announcement banner across the top of the
                application for all active users.
              </p>
            </div>
            <span
              class="status-pill"
              :class="settingsForm.maintenanceMode ? 'pill-warning' : 'pill-neutral'"
            >
              {{ settingsForm.maintenanceMode ? 'BANNER ACTIVE' : 'NORMAL OPERATION' }}
            </span>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <strong>Activate Maintenance Announcement Banner</strong>
              <small>
                When enabled, a high-visibility banner appears at the top of the navigation bar on
                every page.
              </small>
            </div>
            <label class="switch" aria-label="Toggle maintenance mode banner">
              <input v-model="settingsForm.maintenanceMode" type="checkbox" />
              <span class="slider warning-slider"></span>
            </label>
          </div>

          <div class="form-group">
            <label for="maintenance-msg">Maintenance / System Banner Message</label>
            <input
              id="maintenance-msg"
              v-model="settingsForm.maintenanceMessage"
              type="text"
              class="admin-input"
              maxlength="240"
              placeholder="e.g. Scheduled maintenance tonight from 22:00 to 23:00 UTC+7."
            />
          </div>

          <div v-if="settingsForm.maintenanceMode" class="banner-preview">
            <span class="preview-badge">LIVE PREVIEW</span>
            <span>⚠️ {{ settingsForm.maintenanceMessage }}</span>
          </div>
        </div>
      </div>

      <!-- SAVE BAR -->
      <div class="save-bar">
        <span
          v-if="statusMsg.text"
          class="status-msg"
          :class="statusMsg.isError ? 'error-msg' : 'success-msg'"
        >
          {{ statusMsg.text }}
        </span>
        <button type="submit" class="btn-save-settings" :disabled="saving">
          {{ saving ? 'Applying Changes...' : 'Save Platform Settings' }}
        </button>
      </div>
    </form>

    <!-- CARD 04: BROADCAST SYSTEM NOTIFICATION -->
    <div class="settings-card broadcast-card">
      <div class="card-top">
        <div>
          <span class="card-kicker">04 · SYSTEM ANNOUNCEMENT</span>
          <h3>Broadcast Notification to User Bell</h3>
          <p class="settings-desc">
            Send an instant notification directly to the notification bell dropdown of all users or
            a specific role.
          </p>
        </div>
      </div>

      <form class="broadcast-form" @submit.prevent="sendBroadcast">
        <div class="broadcast-row">
          <div class="form-group">
            <label>Announcement Title</label>
            <input
              v-model="broadcastForm.title"
              type="text"
              class="admin-input"
              maxlength="90"
              placeholder="e.g. New JavaScript Module Released!"
              required
            />
          </div>
          <div class="form-group target-role-group">
            <label>Target Audience</label>
            <select v-model="broadcastForm.targetRole" class="admin-select">
              <option value="all">All Users (Learners, Instructors, Admins)</option>
              <option value="learner">Learners Only</option>
              <option value="instructor">Instructors Only</option>
              <option value="admin">Admins Only</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Notification Message</label>
          <input
            v-model="broadcastForm.message"
            type="text"
            class="admin-input"
            maxlength="220"
            placeholder="Write a short message that will appear in their notification bell..."
            required
          />
        </div>

        <div class="save-bar broadcast-actions">
          <span
            v-if="broadcastMsg.text"
            class="status-msg"
            :class="broadcastMsg.isError ? 'error-msg' : 'success-msg'"
          >
            {{ broadcastMsg.text }}
          </span>
          <button type="submit" class="btn-broadcast" :disabled="broadcasting">
            {{ broadcasting ? 'Sending...' : '📢 Send Announcement' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.system-settings-workspace {
  background: #111827;
  padding: 1.5rem;
  border-radius: 14px;
  box-shadow: 0 16px 35px rgba(15, 23, 42, 0.15);
  margin-bottom: 2rem;
  border: 1px solid #263449;
  color: #f8fafc;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #263449;
}

.section-heading h2 {
  margin: 0.2rem 0 0;
  color: #f8fafc;
  font-size: 1.3rem;
  font-weight: 750;
}

.eyebrow {
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.68rem;
  font-weight: 800;
  margin: 0;
}

.sync-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: #172033;
  border: 1px solid #263449;
  color: #94a3b8;
  font-size: 0.76rem;
  font-weight: 600;
}

.sync-badge .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
}

/* ROLE SEPARATION BANNER */
.personal-profile-callout {
  margin-top: 1.25rem;
  padding: 1rem 1.25rem;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(15, 118, 110, 0.18), rgba(29, 78, 216, 0.16));
  border: 1px solid rgba(45, 212, 191, 0.3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.callout-copy {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  flex: 1;
  min-width: 260px;
}

.callout-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(20, 184, 166, 0.2);
  display: grid;
  place-items: center;
  font-size: 1.15rem;
  flex-shrink: 0;
}

.callout-copy strong {
  display: block;
  color: #f8fafc;
  font-size: 0.92rem;
}

.callout-copy p {
  margin: 0.25rem 0 0;
  color: #cbd5e1;
  font-size: 0.8rem;
  line-height: 1.45;
}

.btn-goto-profile {
  padding: 0.55rem 1rem;
  border-radius: 8px;
  background: #0f766e;
  color: #ffffff;
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.2s, transform 0.15s;
}

.btn-goto-profile:hover {
  background: #0d9488;
  transform: translateY(-1px);
}

.state-text {
  color: #94a3b8;
  padding: 2rem 0;
}

/* SETTINGS GRID */
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  margin-top: 1.25rem;
}

.settings-card {
  background: #172033;
  border: 1px solid #263449;
  border-radius: 12px;
  padding: 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.settings-card.full-span {
  grid-column: 1 / -1;
}

.broadcast-card {
  margin-top: 1.5rem;
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.card-kicker {
  display: block;
  color: #2dd4bf;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.settings-card h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #f8fafc;
}

.settings-desc {
  margin: 0.3rem 0 0;
  font-size: 0.82rem;
  color: #94a3b8;
  line-height: 1.45;
}

.status-pill {
  padding: 0.22rem 0.65rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.pill-active {
  background: rgba(16, 185, 129, 0.16);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.35);
}

.pill-disabled {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.35);
}

.pill-warning {
  background: rgba(245, 158, 11, 0.18);
  color: #fcd34d;
  border: 1px solid rgba(245, 158, 11, 0.4);
}

.pill-neutral {
  background: rgba(148, 163, 184, 0.14);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.28);
}

/* TOGGLE SWITCH ROW */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 10px;
  background: #111827;
  border: 1px solid #263449;
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.toggle-info strong {
  color: #e2e8f0;
  font-size: 0.88rem;
}

.toggle-info small {
  color: #94a3b8;
  font-size: 0.76rem;
  line-height: 1.45;
}

.toggle-info code,
.field-hint code {
  color: #5eead4;
  background: rgba(15, 118, 110, 0.2);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-size: 0.73rem;
}

/* SWITCH */
.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: #334155;
  transition: 0.22s;
  border-radius: 999px;
}

.slider::before {
  position: absolute;
  content: '';
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: #ffffff;
  transition: 0.22s;
  border-radius: 50%;
}

.switch input:checked + .slider {
  background-color: #10b981;
}

.switch input:checked + .warning-slider {
  background-color: #f59e0b;
}

.switch input:checked + .slider::before {
  transform: translateX(22px);
}

/* INPUTS & SELECTS */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  font-weight: 700;
  color: #cbd5e1;
  font-size: 0.82rem;
}

.admin-input,
.admin-select {
  width: 100%;
  padding: 0.7rem 0.9rem;
  border: 1px solid #334155;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.88rem;
  background: #0f172a;
  color: #f8fafc;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.admin-input:focus,
.admin-select:focus {
  outline: none;
  border-color: #2dd4bf;
  box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.15);
}

.admin-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.field-hint {
  color: #94a3b8;
  font-size: 0.75rem;
  line-height: 1.45;
}

.banner-preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: rgba(245, 158, 11, 0.14);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: #fde68a;
  font-size: 0.84rem;
  font-weight: 600;
}

.preview-badge {
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  background: #f59e0b;
  color: #0f172a;
  font-size: 0.65rem;
  font-weight: 800;
}

/* SAVE BAR */
.save-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid #263449;
}

.status-msg {
  font-size: 0.85rem;
  font-weight: 600;
  flex: 1;
}

.success-msg {
  color: #34d399;
}

.error-msg {
  color: #fca5a5;
}

.btn-save-settings,
.btn-broadcast {
  background: #0f766e;
  color: #ffffff;
  border: 1px solid rgba(45, 212, 191, 0.35);
  padding: 0.7rem 1.3rem;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.86rem;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
}

.btn-save-settings:hover:not(:disabled),
.btn-broadcast:hover:not(:disabled) {
  background: #0d9488;
  transform: translateY(-1px);
}

.btn-broadcast {
  background: #1d4ed8;
  border-color: rgba(96, 165, 250, 0.4);
}

.btn-broadcast:hover:not(:disabled) {
  background: #2563eb;
}

.btn-save-settings:disabled,
.btn-broadcast:disabled {
  opacity: 0.6;
  cursor: wait;
}

.broadcast-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.broadcast-row {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 1rem;
}

.broadcast-actions {
  margin-top: 0.25rem;
}

@media (max-width: 850px) {
  .settings-grid,
  .broadcast-row {
    grid-template-columns: 1fr;
  }
}
</style>
