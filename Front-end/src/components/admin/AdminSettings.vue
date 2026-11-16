<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/services/api'

// Tự tính toán ID của Admin từ sessionStorage (để component tự chủ hoàn toàn)
const currentUserId = computed(() => {
    try {
        const storedUser = sessionStorage.getItem('auth_user')
        const authUser = storedUser ? JSON.parse(storedUser) : null
        return authUser?._id || authUser?.id || ''
    } catch (_error) {
        return ''
    }
})

// === SETTINGS STATES & METHODS ===
const adminProfileForm = ref({ name: '', email: '', bio: '' })
const adminPasswordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
const savingAdminProfile = ref(false)
const savingAdminPassword = ref(false)
const profileMsg = ref({ text: '', isError: false })
const passwordMsg = ref({ text: '', isError: false })

const loadAdminProfile = async () => {
    if (!currentUserId.value) return
    try {
        const { data } = await api.get(`/users/${currentUserId.value}/profile`)
        adminProfileForm.value = { name: data.name || '', email: data.email || '', bio: data.bio || '' }
    } catch (err) {
        console.error('Failed to load admin profile', err)
    }
}

// Gọi data ngay khi component được render
onMounted(() => {
    loadAdminProfile()
})

const saveAdminProfile = async () => {
    savingAdminProfile.value = true
    profileMsg.value = { text: '', isError: false }
    try {
        const { data } = await api.patch(`/users/${currentUserId.value}/profile`, adminProfileForm.value)
        profileMsg.value = { text: 'Profile updated successfully!', isError: false }

        const storedUser = JSON.parse(sessionStorage.getItem('auth_user') || '{}')
        sessionStorage.setItem('auth_user', JSON.stringify({ ...storedUser, ...data }))
        window.dispatchEvent(new Event('auth-changed'))
    } catch (error) {
        profileMsg.value = { text: error?.response?.data?.error || 'Failed to update profile.', isError: true }
    } finally {
        savingAdminProfile.value = false
        setTimeout(() => profileMsg.value.text = '', 4000)
    }
}

const changeAdminPassword = async () => {
    if (adminPasswordForm.value.newPassword !== adminPasswordForm.value.confirmPassword) {
        passwordMsg.value = { text: 'New passwords do not match.', isError: true }
        return
    }

    savingAdminPassword.value = true
    passwordMsg.value = { text: '', isError: false }
    try {
        await api.patch(`/users/${currentUserId.value}/password`, {
            currentPassword: adminPasswordForm.value.currentPassword,
            newPassword: adminPasswordForm.value.newPassword
        })
        passwordMsg.value = { text: 'Password changed successfully!', isError: false }
        adminPasswordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
    } catch (error) {
        passwordMsg.value = { text: error?.response?.data?.error || 'Failed to change password.', isError: true }
    } finally {
        savingAdminPassword.value = false
        setTimeout(() => passwordMsg.value.text = '', 4000)
    }
}
</script>

<template>
    <section class="admin-section settings-workspace">
        <div class="section-heading">
            <div>
                <p class="eyebrow">Admin Profile</p>
                <h2>Account Settings</h2>
            </div>
        </div>

        <div class="settings-grid">
            <div class="settings-card">
                <h3>Personal Information</h3>
                <p class="settings-desc">Update your admin account details here.</p>

                <form @submit.prevent="saveAdminProfile" class="settings-form">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input v-model="adminProfileForm.name" type="text" class="admin-input" required />
                    </div>
                    <div class="form-group">
                        <label>Email Address</label>
                        <input v-model="adminProfileForm.email" type="email" class="admin-input" required />
                    </div>
                    <div class="form-group">
                        <label>Bio / Role</label>
                        <input v-model="adminProfileForm.bio" type="text" class="admin-input"
                            placeholder="e.g. Lead Instructor" />
                    </div>

                    <div class="form-actions">
                        <span v-if="profileMsg.text" class="status-msg"
                            :class="{ 'error-msg': profileMsg.isError, 'success-msg': !profileMsg.isError }">
                            {{ profileMsg.text }}
                        </span>
                        <button type="submit" class="btn-save-settings" :disabled="savingAdminProfile">
                            {{ savingAdminProfile ? 'Saving...' : 'Save Profile' }}
                        </button>
                    </div>
                </form>
            </div>

            <div class="settings-card password-card">
                <h3>Change Password</h3>
                <p class="settings-desc">Ensure your admin account stays secure.</p>

                <form @submit.prevent="changeAdminPassword" class="settings-form">
                    <div class="form-group">
                        <label>Current Password</label>
                        <input v-model="adminPasswordForm.currentPassword" type="password" class="admin-input"
                            required />
                    </div>
                    <div class="form-group">
                        <label>New Password (min 8 chars)</label>
                        <input v-model="adminPasswordForm.newPassword" type="password" class="admin-input" minlength="8"
                            required />
                    </div>
                    <div class="form-group">
                        <label>Confirm New Password</label>
                        <input v-model="adminPasswordForm.confirmPassword" type="password" class="admin-input"
                            minlength="8" required />
                    </div>

                    <div class="form-actions">
                        <span v-if="passwordMsg.text" class="status-msg"
                            :class="{ 'error-msg': passwordMsg.isError, 'success-msg': !passwordMsg.isError }">
                            {{ passwordMsg.text }}
                        </span>
                        <button type="submit" class="btn-save-settings secondary" :disabled="savingAdminPassword">
                            {{ savingAdminPassword ? 'Updating...' : 'Update Password' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </section>
</template>

<style scoped>
.settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-top: 1.5rem;
}

.settings-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
}

.settings-card h3 {
    margin: 0;
    font-size: 1.15rem;
    color: #0f172a;
}

.settings-desc {
    margin: 5px 0 1.25rem;
    font-size: 0.85rem;
    color: #64748b;
}

.settings-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
}

.form-group label {
    display: block;
    font-weight: 700;
    color: #334155;
    font-size: 0.85rem;
    margin-bottom: 0.4rem;
}

.admin-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.95rem;
    background: #fff;
    transition: border-color 0.2s;
}

.admin-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.form-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    margin-top: auto;
    padding-top: 1.5rem;
}

.status-msg {
    font-size: 0.85rem;
    font-weight: 600;
    flex: 1;
}

.success-msg {
    color: #10b981;
}

.error-msg {
    color: #ef4444;
}

.btn-save-settings {
    background: #0f766e;
    color: white;
    border: none;
    padding: 0.7rem 1.25rem;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s;
}

.btn-save-settings:hover:not(:disabled) {
    background: #0d9488;
}

.btn-save-settings.secondary {
    background: #475569;
}

.btn-save-settings.secondary:hover:not(:disabled) {
    background: #334155;
}

.btn-save-settings:disabled {
    opacity: 0.6;
    cursor: wait;
}

@media (max-width: 850px) {
    .settings-grid {
        grid-template-columns: 1fr;
        gap: 1.5rem;
    }
}
</style>