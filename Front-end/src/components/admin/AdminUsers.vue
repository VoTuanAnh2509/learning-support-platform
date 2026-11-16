<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import api from '@/services/api'

const router = useRouter()

// Tự tính toán ID của Admin từ sessionStorage để ngăn admin tự khóa/xóa tài khoản của mình
const currentUserId = computed(() => {
    try {
        const storedUser = sessionStorage.getItem('auth_user')
        const authUser = storedUser ? JSON.parse(storedUser) : null
        return authUser?._id || authUser?.id || ''
    } catch (_error) {
        return ''
    }
})

// === USER MANAGEMENT STATES ===
const users = ref([])
const searchQuery = ref('')
const loadingUsers = ref(false)
const savingUserId = ref('')
const deletingUserId = ref('')
const message = ref('')
const error = ref('')

// === PAGINATION STATES ===
const currentPage = ref(1)
const pageSize = ref(10)

// === ADD USER MODAL STATES ===
const showAddModal = ref(false)
const creatingUser = ref(false)
const addError = ref('')
const newUserForm = reactive({
    name: '',
    email: '',
    password: '',
    role: 'learner',
})

// === VIEW USER DETAILS / PROGRESS MODAL STATES ===
const showDetailModal = ref(false)
const selectedUser = ref(null)
const detailLoading = ref(false)
const detailError = ref('')
const userProfileDetail = ref(null)
const userProgressDetail = ref(null)

const providerMap = {
    local: { label: 'Email', icon: '✉', className: 'provider-local' },
    google: { label: 'Google', icon: 'G', className: 'provider-google' },
    facebook: { label: 'Facebook', icon: 'f', className: 'provider-facebook' },
    github: { label: 'GitHub', icon: '🐙', className: 'provider-github' },
}

const getProviderInfo = user => {
    const key = (user?.authProvider || 'local').toLowerCase()
    return providerMap[key] || providerMap.local
}

const formatDate = value => {
    if (!value) return 'Never'
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(value))
}

// Lọc danh sách người dùng theo từ khóa tìm kiếm (tên, username, email, role, phương thức đăng nhập)
const filteredUsers = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    if (!query) return users.value
    return users.value.filter(user => {
        const name = (user.username || user.name || '').toLowerCase()
        const email = (user.email || '').toLowerCase()
        const role = (user.role || '').toLowerCase()
        const provider = getProviderInfo(user).label.toLowerCase()
        const rawProvider = (user.authProvider || 'local').toLowerCase()
        return (
            name.includes(query) ||
            email.includes(query) ||
            role.includes(query) ||
            provider.includes(query) ||
            rawProvider.includes(query)
        )
    })
})

// Reset về trang 1 khi tìm kiếm hoặc đổi số lượng hiển thị mỗi trang
watch([searchQuery, pageSize], () => {
    currentPage.value = 1
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / pageSize.value)))

const paginatedUsers = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    return filteredUsers.value.slice(start, start + pageSize.value)
})

const paginationRange = computed(() => {
    const total = totalPages.value
    const current = currentPage.value
    const pages = []
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - 2 && i <= current + 2)) {
            pages.push(i)
        }
    }
    return pages
})

const goToPage = page => {
    if (page < 1 || page > totalPages.value) return
    currentPage.value = page
}

const loadUsers = async () => {
    loadingUsers.value = true
    error.value = ''
    try {
        const { data } = await api.get('/admin/users')
        users.value = Array.isArray(data) ? data : []
    } catch (requestError) {
        error.value = requestError?.response?.data?.error || 'Unable to load users.'
        if (requestError?.response?.status === 401 || requestError?.response?.status === 403) {
            router.push('/login')
        }
    } finally {
        loadingUsers.value = false
    }
}

// Gọi API lấy danh sách ngay khi component được bật lên
onMounted(() => {
    loadUsers()
})

// === ADD USER HANDLERS ===
const openAddModal = () => {
    newUserForm.name = ''
    newUserForm.email = ''
    newUserForm.password = ''
    newUserForm.role = 'learner'
    addError.value = ''
    showAddModal.value = true
}

const closeAddModal = () => {
    showAddModal.value = false
    addError.value = ''
}

const submitAddUser = async () => {
    addError.value = ''
    if (newUserForm.password.length < 8) {
        addError.value = 'Password must be at least 8 characters.'
        return
    }

    creatingUser.value = true
    try {
        const { data } = await api.post('/admin/users', {
            name: newUserForm.name.trim(),
            email: newUserForm.email.trim(),
            password: newUserForm.password,
            role: newUserForm.role,
        })
        if (data?.user) {
            users.value.unshift(data.user)
        } else {
            await loadUsers()
        }
        message.value = `Created account for "${newUserForm.name.trim()}" successfully.`
        closeAddModal()
        setTimeout(() => { message.value = '' }, 3000)
    } catch (requestError) {
        addError.value = requestError?.response?.data?.error || 'Failed to create user.'
    } finally {
        creatingUser.value = false
    }
}

// === VIEW USER DETAILS / PROGRESS HANDLERS ===
const openUserDetails = async user => {
    selectedUser.value = user
    userProfileDetail.value = null
    userProgressDetail.value = null
    detailError.value = ''
    detailLoading.value = true
    showDetailModal.value = true

    try {
        const [profileRes, progressRes] = await Promise.all([
            api.get(`/users/${user._id}/profile`),
            api.get(`/users/${user._id}/progress`),
        ])
        userProfileDetail.value = profileRes.data
        userProgressDetail.value = progressRes.data?.progressSummary || {}
    } catch (requestError) {
        detailError.value = requestError?.response?.data?.error || 'Unable to load user learning progress.'
    } finally {
        detailLoading.value = false
    }
}

const closeDetailModal = () => {
    showDetailModal.value = false
    selectedUser.value = null
}

const enrolledCoursesList = computed(() => {
    return (userProfileDetail.value?.enrolledCourses || []).filter(entry => entry.course)
})

const updateRole = async user => {
    savingUserId.value = user._id
    message.value = ''
    error.value = ''
    try {
        await api.patch(`/admin/users/${user._id}/role`, { role: user.role })
        message.value = `Successfully updated role for ${user.username || user.name}`
    } catch (requestError) {
        error.value = requestError?.response?.data?.error || 'Failed to update user role.'
        await loadUsers()
    } finally {
        savingUserId.value = ''
        setTimeout(() => { message.value = '' }, 3000)
    }
}

const deleteUser = async user => {
    if (user._id === currentUserId.value) return

    const displayName = user.username || user.name || user.email
    const result = await Swal.fire({
        title: 'Delete user?',
        text: `Are you sure you want to permanently delete "${displayName}"? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#475569',
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel'
    })

    if (!result.isConfirmed) return

    deletingUserId.value = user._id
    message.value = ''
    error.value = ''
    try {
        await api.delete(`/admin/users/${user._id}`)
        users.value = users.value.filter(u => u._id !== user._id)
        if (currentPage.value > totalPages.value) {
            currentPage.value = totalPages.value
        }
        message.value = `Deleted user "${displayName}" successfully.`
    } catch (requestError) {
        error.value = requestError?.response?.data?.error || 'Failed to delete user.'
    } finally {
        deletingUserId.value = ''
        setTimeout(() => { message.value = '' }, 3000)
    }
}
</script>

<template>
    <section class="admin-section user-management">
        <div class="section-heading">
            <div>
                <p class="eyebrow">Access control</p>
                <h2>User Management</h2>
            </div>
            <div class="heading-tools">
                <div class="search-box">
                    <span class="search-icon" aria-hidden="true">🔍</span>
                    <input
                        v-model="searchQuery"
                        type="search"
                        placeholder="Search by name, email, provider..."
                        class="search-input"
                        aria-label="Search users"
                    />
                </div>
                <select v-model.number="pageSize" class="page-size-select" aria-label="Users per page">
                    <option :value="5">5 / page</option>
                    <option :value="10">10 / page</option>
                    <option :value="20">20 / page</option>
                    <option :value="50">50 / page</option>
                </select>
                <span class="section-count">{{ filteredUsers.length }} / {{ users.length }} accounts</span>
                <button type="button" class="btn-add-user" @click="openAddModal">+ Add User</button>
            </div>
        </div>

        <p v-if="message" class="message success">{{ message }}</p>
        <p v-if="error" class="message error">{{ error }}</p>

        <p v-if="loadingUsers" class="state-text">Loading users...</p>
        <p v-else-if="filteredUsers.length === 0" class="state-text empty-search">
            No users found matching "{{ searchQuery }}".
        </p>

        <template v-else>
            <div class="user-list">
                <div v-for="user in paginatedUsers" :key="user._id" class="user-row">
                    <div class="user-avatar">{{ (user.username || user.name || 'U').charAt(0).toUpperCase() }}</div>
                    <div class="user-meta">
                        <div class="user-name-row">
                            <strong>{{ user.username || user.name }}</strong>
                            <span v-if="user._id === currentUserId" class="you-badge">You</span>
                            <span class="provider-badge" :class="getProviderInfo(user).className" :title="`Signed in via ${getProviderInfo(user).label}`">
                                <span class="provider-icon" aria-hidden="true">{{ getProviderInfo(user).icon }}</span>
                                {{ getProviderInfo(user).label }}
                            </span>
                        </div>
                        <span>{{ user.email }}</span>
                    </div>
                    <div class="user-actions">
                        <button type="button" class="btn-view-details" @click="openUserDetails(user)">
                            View Details
                        </button>
                        <select v-model="user.role" :disabled="user._id === currentUserId || savingUserId === user._id || deletingUserId === user._id"
                            @change="updateRole(user)" class="role-select">
                            <option value="learner">Learner</option>
                            <option value="instructor">Instructor</option>
                            <option value="admin">Admin</option>
                        </select>
                        <button
                            type="button"
                            class="btn-delete-user"
                            :disabled="user._id === currentUserId || deletingUserId === user._id"
                            :title="user._id === currentUserId ? 'You cannot delete your own account' : 'Delete user'"
                            @click="deleteUser(user)"
                        >
                            {{ deletingUserId === user._id ? 'Deleting...' : 'Delete' }}
                        </button>
                        <span v-if="savingUserId === user._id" class="saving-text">Saving...</span>
                    </div>
                </div>
            </div>

            <!-- PAGINATION BAR -->
            <div v-if="filteredUsers.length > 0" class="pagination-bar" aria-label="User list pagination">
                <span class="pagination-summary">
                    Showing {{ (currentPage - 1) * pageSize + 1 }}–{{ Math.min(currentPage * pageSize, filteredUsers.length) }} of {{ filteredUsers.length }}
                </span>
                <div class="pagination-controls">
                    <button
                        type="button"
                        class="page-btn"
                        :disabled="currentPage === 1"
                        @click="goToPage(currentPage - 1)"
                    >
                        ‹ Previous
                    </button>
                    <button
                        v-for="page in paginationRange"
                        :key="page"
                        type="button"
                        class="page-btn page-number"
                        :class="{ active: currentPage === page }"
                        @click="goToPage(page)"
                    >
                        {{ page }}
                    </button>
                    <button
                        type="button"
                        class="page-btn"
                        :disabled="currentPage === totalPages"
                        @click="goToPage(currentPage + 1)"
                    >
                        Next ›
                    </button>
                </div>
            </div>
        </template>

        <!-- MODAL 1: ADD NEW USER -->
        <div v-if="showAddModal" class="modal-backdrop" @click.self="closeAddModal">
            <div class="modal-card add-user-modal" role="dialog" aria-modal="true" aria-labelledby="add-user-title">
                <div class="modal-header">
                    <div>
                        <p class="eyebrow">Create Account</p>
                        <h3 id="add-user-title">Add New User</h3>
                    </div>
                    <button type="button" class="modal-close-btn" @click="closeAddModal" aria-label="Close modal">✕</button>
                </div>

                <form class="modal-form" @submit.prevent="submitAddUser">
                    <p v-if="addError" class="message error">{{ addError }}</p>

                    <label class="modal-field">
                        <span>Full Name</span>
                        <input v-model="newUserForm.name" type="text" placeholder="e.g. Nguyen Van A" required />
                    </label>

                    <label class="modal-field">
                        <span>Email Address</span>
                        <input v-model="newUserForm.email" type="email" placeholder="learner@example.com" required />
                    </label>

                    <label class="modal-field">
                        <span>Password (min 8 chars)</span>
                        <input v-model="newUserForm.password" type="password" placeholder="At least 8 characters" minlength="8" required />
                    </label>

                    <label class="modal-field">
                        <span>Account Role</span>
                        <select v-model="newUserForm.role">
                            <option value="learner">Learner</option>
                            <option value="instructor">Instructor</option>
                            <option value="admin">Admin</option>
                        </select>
                    </label>

                    <div class="modal-actions">
                        <button type="button" class="btn-cancel-modal" @click="closeAddModal">Cancel</button>
                        <button type="submit" class="btn-submit-modal" :disabled="creatingUser">
                            {{ creatingUser ? 'Creating...' : 'Create User' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- MODAL 2: VIEW USER DETAILS & PROGRESS -->
        <div v-if="showDetailModal" class="modal-backdrop" @click.self="closeDetailModal">
            <div class="modal-card detail-user-modal" role="dialog" aria-modal="true" aria-labelledby="detail-user-title">
                <div class="modal-header">
                    <div>
                        <p class="eyebrow">Learner Insights & Progress</p>
                        <h3 id="detail-user-title">{{ selectedUser?.name || selectedUser?.username || 'User Details' }}</h3>
                    </div>
                    <button type="button" class="modal-close-btn" @click="closeDetailModal" aria-label="Close modal">✕</button>
                </div>

                <div v-if="detailLoading" class="modal-loading">Loading learning progress...</div>
                <p v-else-if="detailError" class="message error">{{ detailError }}</p>

                <div v-else-if="userProfileDetail" class="detail-body">
                    <!-- Identity Banner -->
                    <div class="detail-identity">
                        <div class="user-avatar large-avatar">
                            {{ (userProfileDetail.name || 'U').charAt(0).toUpperCase() }}
                        </div>
                        <div class="detail-identity-info">
                            <div class="user-name-row">
                                <h4>{{ userProfileDetail.name }}</h4>
                                <span class="role-badge" :class="userProfileDetail.role">{{ userProfileDetail.role }}</span>
                                <span class="provider-badge" :class="getProviderInfo(userProfileDetail).className">
                                    <span class="provider-icon">{{ getProviderInfo(userProfileDetail).icon }}</span>
                                    {{ getProviderInfo(userProfileDetail).label }}
                                </span>
                            </div>
                            <p class="detail-email">{{ userProfileDetail.email }}</p>
                            <div class="detail-dates">
                                <span>Joined: <strong>{{ formatDate(userProfileDetail.createdAt) }}</strong></span>
                                <span>·</span>
                                <span>Last Login: <strong>{{ formatDate(userProfileDetail.lastLoginAt) }}</strong></span>
                            </div>
                        </div>
                    </div>

                    <!-- 6 Progress Stat Cards -->
                    <div class="detail-stats-grid">
                        <div class="detail-stat-card">
                            <span class="detail-stat-label">Study Time</span>
                            <strong>{{ userProgressDetail?.studyMinutes || 0 }} <small>mins</small></strong>
                        </div>
                        <div class="detail-stat-card">
                            <span class="detail-stat-label">Courses Completed</span>
                            <strong>{{ userProgressDetail?.completedCourses || 0 }}</strong>
                        </div>
                        <div class="detail-stat-card">
                            <span class="detail-stat-label">Lessons Completed</span>
                            <strong>{{ userProgressDetail?.completedLessons || 0 }}</strong>
                        </div>
                        <div class="detail-stat-card">
                            <span class="detail-stat-label">Quiz Average</span>
                            <strong>{{ userProgressDetail?.quiz?.averageScore || 0 }}%</strong>
                            <small>{{ userProgressDetail?.quiz?.attempts || 0 }} attempts</small>
                        </div>
                        <div class="detail-stat-card">
                            <span class="detail-stat-label">Exercise Average</span>
                            <strong>{{ userProgressDetail?.exercises?.averageScore || 0 }}%</strong>
                            <small>{{ userProgressDetail?.exercises?.attempts || 0 }} attempts</small>
                        </div>
                        <div class="detail-stat-card">
                            <span class="detail-stat-label">Overall Accuracy</span>
                            <strong>{{ userProgressDetail?.accuracy || 0 }}%</strong>
                            <small>{{ userProgressDetail?.practiceAttempts || 0 }} total submissions</small>
                        </div>
                    </div>

                    <!-- Enrolled Courses & Progress Bars -->
                    <div class="detail-section">
                        <h5>Enrolled Courses ({{ enrolledCoursesList.length }})</h5>
                        <div v-if="enrolledCoursesList.length" class="detail-course-list">
                            <div v-for="item in enrolledCoursesList" :key="item.course._id" class="detail-course-row">
                                <div class="detail-course-top">
                                    <strong>{{ item.course.title }}</strong>
                                    <span class="detail-course-percent">{{ Math.round(item.completionRate || 0) }}%</span>
                                </div>
                                <div class="detail-progress-bar">
                                    <span :style="{ width: `${Math.min(100, Math.max(0, item.completionRate || 0))}%` }"></span>
                                </div>
                                <small class="detail-course-meta">
                                    {{ item.course.subject }} · {{ (item.completedLessons || []).length }} lessons completed · Last active {{ formatDate(item.lastAccessedAt) }}
                                </small>
                            </div>
                        </div>
                        <p v-else class="detail-empty">This user has not enrolled in any courses yet.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.admin-section {
  background: #111827; /* Đồng bộ nền đen navy với hệ thống */
  padding: 1.5rem;
  border-radius: 14px;
  box-shadow: 0 16px 35px rgba(15, 23, 42, 0.15);
  margin-bottom: 2rem;
  border: 1px solid #263449; /* Viền tối màu */
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
.section-heading h2 { margin: 0.2rem 0 0; color: #f8fafc; font-size: 1.25rem; font-weight: 750; }
.heading-tools {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.search-box {
  position: relative;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 0.75rem;
  font-size: 0.85rem;
  pointer-events: none;
}
.search-input {
  width: 250px;
  padding: 0.5rem 0.85rem 0.5rem 2.2rem;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #f8fafc;
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.search-input::placeholder {
  color: #64748b;
}
.search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}
.page-size-select {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #cbd5e1;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-add-user {
  padding: 0.52rem 1rem;
  border-radius: 8px;
  border: 1px solid rgba(16, 185, 129, 0.4);
  background: #0f766e;
  color: #ecfeff;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
}
.btn-add-user:hover {
  background: #0d9488;
  transform: translateY(-1px);
}
.section-count { color: #64748b; font-size: 0.78rem; white-space: nowrap; }
.eyebrow { color: #64748b; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.68rem; font-weight: 800; margin: 0; }

.message { padding: 1rem; border-radius: 8px; margin-bottom: 1rem; font-weight: bold; border: 1px solid transparent; }
.message.success { border-color: #115e59; background: #042f2e; color: #99f6e4; }
.message.error { border-color: #7f1d1d; background: #450a0a; color: #fecaca; }
.state-text { color: #94a3b8; }
.empty-search { padding: 2rem 0; text-align: center; }

.you-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  font-size: 0.7rem;
  font-weight: 700;
}

.user-name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.provider-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  border: 1px solid transparent;
}

.provider-icon {
  font-weight: 800;
  font-size: 0.72rem;
}

.provider-local {
  background: rgba(148, 163, 184, 0.14);
  border-color: rgba(148, 163, 184, 0.28);
  color: #cbd5e1;
}

.provider-google {
  background: rgba(234, 67, 53, 0.14);
  border-color: rgba(234, 67, 53, 0.35);
  color: #fca5a5;
}

.provider-facebook {
  background: rgba(24, 119, 242, 0.16);
  border-color: rgba(59, 130, 246, 0.4);
  color: #93c5fd;
}

.provider-github {
  background: rgba(168, 85, 247, 0.16);
  border-color: rgba(168, 85, 247, 0.38);
  color: #d8b4fe;
}

/* USER CSS - DARK THEME ĐỒNG BỘ */
.user-list { 
  display: grid; 
  gap: 0.85rem; 
  margin-top: 1rem; 
}
.user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.25rem;
  border-radius: 10px;
  background: #172033; /* Màu nền thẻ tối */
  border: 1px solid #263449;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.user-row:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  border-color: #3b82f6; /* Viền sáng lên màu xanh khi hover */
}

.user-meta { 
  display: flex; 
  flex-direction: column; 
  gap: 0.3rem; 
  flex: 1; /* Đẩy dropdown ra sát lề phải */
}
.user-meta strong { 
  color: #e2e8f0; 
  font-size: 1.05rem;
  font-weight: 700;
}
.user-meta span { 
  color: #94a3b8; 
  font-size: 0.85rem; 
}

.user-avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-right: 1.2rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  font-size: 1.1rem;
  font-weight: 800;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.user-actions { 
  display: flex; 
  align-items: center; 
  gap: 0.75rem; 
}
.btn-view-details {
  padding: 0.5rem 0.85rem;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #93c5fd;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.btn-view-details:hover {
  background: #1e293b;
  border-color: #3b82f6;
  color: #ffffff;
}
.role-select {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid #334155;
  outline: none;
  background: #0f172a; /* Nền tối cho thẻ select */
  color: #e2e8f0;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.2s;
}
.role-select:hover:not(:disabled) {
  border-color: #3b82f6;
}
.role-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-delete-user {
  padding: 0.5rem 0.9rem;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.btn-delete-user:hover:not(:disabled) {
  background: #ef4444;
  border-color: #ef4444;
  color: #ffffff;
}
.btn-delete-user:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.saving-text { 
  font-size: 0.85rem; 
  color: #2dd4bf; 
  font-weight: 700;
}

/* PAGINATION BAR */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.2rem;
  border-top: 1px solid #263449;
}
.pagination-summary {
  color: #94a3b8;
  font-size: 0.85rem;
}
.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.page-btn {
  min-width: 36px;
  height: 36px;
  padding: 0 0.75rem;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #cbd5e1;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.page-btn:hover:not(:disabled) {
  background: #1e293b;
  border-color: #3b82f6;
  color: #ffffff;
}
.page-btn.active {
  background: #0f766e;
  border-color: #14b8a6;
  color: #ffffff;
}
.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* MODALS */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(2, 6, 23, 0.75);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  padding: 1.5rem;
}
.modal-card {
  width: 100%;
  background: #111827;
  border: 1px solid #263449;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  max-height: 90vh;
  overflow-y: auto;
}
.add-user-modal {
  max-width: 460px;
}
.detail-user-modal {
  max-width: 720px;
}
.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #263449;
  margin-bottom: 1.25rem;
}
.modal-header h3 {
  margin: 0.2rem 0 0;
  color: #f8fafc;
  font-size: 1.3rem;
  font-weight: 800;
}
.modal-close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #1e293b;
  color: #94a3b8;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.modal-close-btn:hover {
  color: #ffffff;
  border-color: #475569;
}
.modal-form {
  display: grid;
  gap: 1rem;
}
.modal-field {
  display: grid;
  gap: 0.4rem;
}
.modal-field span {
  color: #cbd5e1;
  font-size: 0.85rem;
  font-weight: 600;
}
.modal-field input,
.modal-field select {
  width: 100%;
  padding: 0.7rem 0.9rem;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #f8fafc;
  font-size: 0.92rem;
  outline: none;
}
.modal-field input:focus,
.modal-field select:focus {
  border-color: #3b82f6;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
.btn-cancel-modal {
  padding: 0.6rem 1.1rem;
  border-radius: 8px;
  border: 1px solid #334155;
  background: transparent;
  color: #cbd5e1;
  font-weight: 600;
  cursor: pointer;
}
.btn-submit-modal {
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  border: 0;
  background: #0f766e;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
}
.btn-submit-modal:hover:not(:disabled) {
  background: #0d9488;
}

/* USER DETAIL PROGRESS MODAL */
.modal-loading {
  padding: 3rem 1rem;
  text-align: center;
  color: #94a3b8;
}
.detail-body {
  display: grid;
  gap: 1.5rem;
}
.detail-identity {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem;
  border-radius: 12px;
  background: #172033;
  border: 1px solid #263449;
}
.large-avatar {
  width: 56px;
  height: 56px;
  font-size: 1.35rem;
  margin-right: 0;
  flex-shrink: 0;
}
.detail-identity-info h4 {
  margin: 0;
  color: #f8fafc;
  font-size: 1.15rem;
}
.detail-email {
  margin: 0.2rem 0 0.4rem;
  color: #94a3b8;
  font-size: 0.88rem;
}
.detail-dates {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  color: #64748b;
  font-size: 0.78rem;
}
.detail-dates strong {
  color: #cbd5e1;
  text-transform: capitalize;
}
.role-badge {
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
}
.role-badge.admin {
  background: rgba(245, 158, 11, 0.18);
  color: #fcd34d;
}
.detail-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.85rem;
}
.detail-stat-card {
  padding: 1rem;
  border-radius: 10px;
  background: #172033;
  border: 1px solid #263449;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.detail-stat-label {
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}
.detail-stat-card strong {
  color: #f8fafc;
  font-size: 1.45rem;
}
.detail-stat-card small {
  color: #64748b;
  font-size: 0.75rem;
}
.detail-section h5 {
  margin: 0 0 0.75rem;
  color: #e2e8f0;
  font-size: 0.95rem;
  font-weight: 700;
}
.detail-course-list {
  display: grid;
  gap: 0.75rem;
}
.detail-course-row {
  padding: 0.9rem 1rem;
  border-radius: 10px;
  background: #172033;
  border: 1px solid #263449;
}
.detail-course-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.45rem;
}
.detail-course-top strong {
  color: #f8fafc;
  font-size: 0.92rem;
}
.detail-course-percent {
  color: #34d399;
  font-size: 0.85rem;
  font-weight: 700;
}
.detail-progress-bar {
  height: 6px;
  border-radius: 999px;
  background: #0f172a;
  overflow: hidden;
  margin-bottom: 0.45rem;
}
.detail-progress-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #10b981, #34d399);
}
.detail-course-meta {
  color: #94a3b8;
  font-size: 0.78rem;
}
.detail-empty {
  color: #64748b;
  font-size: 0.88rem;
  margin: 0;
}

@media (max-width: 600px) {
  .user-row { flex-direction: column; align-items: flex-start; gap: 1rem; }
  .user-avatar { margin-bottom: 0.5rem; }
  .user-actions { width: 100%; flex-wrap: wrap; justify-content: flex-end; }
  .detail-stats-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>