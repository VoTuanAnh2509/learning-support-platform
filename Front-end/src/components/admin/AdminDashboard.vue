<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/services/api'

const courses = ref([])
const users = ref([])
const isLoading = ref(true)

const isAdmin = computed(() => {
    try {
        const storedUser = sessionStorage.getItem('auth_user')
        const parsed = storedUser ? JSON.parse(storedUser) : null
        return parsed?.role === 'admin'
    } catch (_err) {
        return false
    }
})

const loadData = async () => {
    isLoading.value = true
    try {
        const coursesRes = await api.get('/courses')
        courses.value = Array.isArray(coursesRes.data) ? coursesRes.data : []

        if (isAdmin.value) {
            const usersRes = await api.get('/admin/users')
            users.value = Array.isArray(usersRes.data) ? usersRes.data : []
        } else {
            users.value = []
        }
    } catch (error) {
        console.error('Failed to load dashboard data', error)
    } finally {
        isLoading.value = false
    }
}

onMounted(() => {
    loadData()
})

const totalModules = computed(() => {
    return courses.value.reduce((total, course) => total + (course.modules?.length || 0), 0)
})

const totalLessons = computed(() => {
    return courses.value.reduce((total, course) => {
        const courseLessons = (course.modules || []).reduce((mTotal, mod) => mTotal + (mod.lessons?.length || 0), 0)
        return total + courseLessons
    }, 0)
})

// Lấy 5 người dùng đăng ký gần nhất
const newestUsers = computed(() => {
    return [...users.value]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 5)
})

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

const formatJoinDate = value => {
    if (!value) return 'Recently'
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(value))
}

const allQuickActions = [
    {
        title: 'Manage Courses',
        description: 'Create courses, organize modules, and edit interactive lessons.',
        icon: '▣',
        tone: 'teal',
        to: '/admin/courses',
        cta: 'Open Courses →',
        adminOnly: false,
    },
    {
        title: 'User Directory',
        description: 'Add new users, inspect learning progress, or assign admin roles.',
        icon: '♙',
        tone: 'blue',
        to: '/admin/users',
        cta: 'Manage Users →',
        adminOnly: true,
    },
    {
        title: 'Platform Analytics',
        description: 'Review course enrollments, quiz scores, and learner engagement.',
        icon: '⌁',
        tone: 'purple',
        to: '/admin/analytics',
        cta: 'View Reports →',
        adminOnly: true,
    },
    {
        title: 'Account Settings',
        description: 'Update your profile information and password.',
        icon: '◎',
        tone: 'amber',
        to: '/admin/settings',
        cta: 'Configure →',
        adminOnly: false,
    },
]

const quickActions = computed(() =>
    allQuickActions.filter(item => !item.adminOnly || isAdmin.value)
)
</script>

<template>
    <div class="dashboard-stack">
        <!-- 1. PLATFORM OVERVIEW STATS -->
        <section class="admin-section dashboard-overview" aria-label="Platform overview">
            <div class="overview-heading">
                <div>
                    <p class="eyebrow">At a glance</p>
                    <h2>Platform Overview</h2>
                </div>
                <span class="overview-note">Live summary</span>
            </div>

            <p v-if="isLoading" class="state-text">Loading dashboard metrics...</p>

            <div v-else class="stats-grid">
                <article class="stat-card">
                    <span class="stat-icon teal">▣</span>
                    <div>
                        <strong>{{ courses.length }}</strong>
                        <span>Total courses</span>
                    </div>
                </article>
                <article v-if="isAdmin" class="stat-card">
                    <span class="stat-icon blue">♙</span>
                    <div>
                        <strong>{{ users.length }}</strong>
                        <span>Registered users</span>
                    </div>
                </article>
                <article class="stat-card">
                    <span class="stat-icon amber">▤</span>
                    <div>
                        <strong>{{ totalModules }} <small class="stat-sub">({{ totalLessons }} lessons)</small></strong>
                        <span>Learning modules</span>
                    </div>
                </article>
            </div>
        </section>

        <!-- 2. QUICK ACTIONS & NEWEST USERS GRID -->
        <div class="dashboard-lower-grid">
            <!-- LỐI TẮT THAO TÁC (QUICK ACTIONS) -->
            <section class="admin-section quick-actions-section" aria-label="Quick actions">
                <div class="overview-heading compact-heading">
                    <div>
                        <p class="eyebrow">Shortcuts</p>
                        <h2>Quick Actions</h2>
                    </div>
                </div>

                <div class="quick-actions-grid">
                    <RouterLink
                        v-for="action in quickActions"
                        :key="action.title"
                        :to="action.to"
                        class="quick-action-card"
                    >
                        <div class="quick-action-top">
                            <span class="stat-icon" :class="action.tone">{{ action.icon }}</span>
                            <span class="quick-action-cta">{{ action.cta }}</span>
                        </div>
                        <h3>{{ action.title }}</h3>
                        <p>{{ action.description }}</p>
                    </RouterLink>
                </div>
            </section>

            <!-- HOẠT ĐỘNG MỚI NHẤT (5 NEWEST USERS - CHỈ ADMIN) -->
            <section v-if="isAdmin" class="admin-section recent-users-section" aria-label="Newest users">
                <div class="overview-heading compact-heading">
                    <div>
                        <p class="eyebrow">Recent activity</p>
                        <h2>Newest Members</h2>
                    </div>
                    <RouterLink to="/admin/users" class="view-all-link">View all →</RouterLink>
                </div>

                <p v-if="isLoading" class="state-text">Loading recent registrations...</p>
                <p v-else-if="newestUsers.length === 0" class="state-text">No registered users yet.</p>

                <div v-else class="recent-user-list">
                    <div v-for="user in newestUsers" :key="user._id" class="recent-user-row">
                        <div class="recent-avatar">
                            {{ (user.name || user.username || 'U').charAt(0).toUpperCase() }}
                        </div>
                        <div class="recent-meta">
                            <div class="recent-name-line">
                                <strong>{{ user.name || user.username }}</strong>
                                <span class="provider-badge" :class="getProviderInfo(user).className">
                                    {{ getProviderInfo(user).icon }} {{ getProviderInfo(user).label }}
                                </span>
                                <span v-if="user.role === 'admin'" class="admin-pill">Admin</span>
                            </div>
                            <span class="recent-email">{{ user.email }}</span>
                        </div>
                        <div class="recent-date">
                            <span>Joined</span>
                            <strong>{{ formatJoinDate(user.createdAt) }}</strong>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<style scoped>
.admin-section {
    background: #111827;
    padding: 1.5rem;
    border-radius: 14px;
    box-shadow: 0 16px 35px rgba(15, 23, 42, 0.15);
    margin-bottom: 2rem;
    border: 1px solid #263449;
}

.overview-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid #263449;
}

.overview-heading h2 {
    margin: 0.3rem 0 0;
    color: #f8fafc;
    font-size: clamp(1.4rem, 2.5vw, 2rem);
    font-weight: 800;
}

.eyebrow {
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.68rem;
    font-weight: 800;
    margin: 0;
}

.overview-note {
    padding: 0.45rem 0.7rem;
    border: 1px solid #3b82f6;
    border-radius: 999px;
    color: #60a5fa;
    background: rgba(59, 130, 246, 0.1);
    font-size: 0.75rem;
    font-weight: 700;
}

.state-text {
    color: #94a3b8;
    margin-top: 1rem;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
    margin-top: 1.5rem;
}

.stat-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-height: 120px;
    padding: 1.5rem;
    border-radius: 12px;
    border: 1px solid #263449;
    background: #172033;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s ease, box-shadow 0.2s;
}

.stat-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 16px 32px rgba(0, 0, 0, 0.2);
    border-color: #3b82f6;
}

.stat-icon {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    font-size: 1.5rem;
}

.stat-icon.teal {
    background: rgba(20, 184, 166, 0.14);
    color: #2dd4bf;
}

.stat-icon.blue {
    background: rgba(59, 130, 246, 0.14);
    color: #60a5fa;
}

.stat-icon.amber {
    background: rgba(245, 158, 11, 0.14);
    color: #fbbf24;
}

.stat-icon.purple {
    background: rgba(168, 85, 247, 0.14);
    color: #c084fc;
}

.stat-sub {
    font-size: 0.9rem;
    font-weight: 600;
    color: #94a3b8;
}

.stat-card div {
    display: grid;
    gap: 0.2rem;
}

.stat-card strong {
    color: #f8fafc;
    font-size: 2rem;
    line-height: 1;
}

.stat-card div span {
    color: #94a3b8;
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

/* LOWER GRID: QUICK ACTIONS + NEWEST USERS */
.dashboard-lower-grid {
    display: grid;
    grid-template-columns: 1.05fr 0.95fr;
    gap: 1.5rem;
    align-items: start;
}

.compact-heading h2 {
    font-size: 1.35rem;
}

.view-all-link {
    color: #2dd4bf;
    font-size: 0.85rem;
    font-weight: 700;
    text-decoration: none;
    transition: color 0.2s;
}
.view-all-link:hover {
    color: #5eead4;
}

/* QUICK ACTIONS */
.quick-actions-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-top: 1.25rem;
}

.quick-action-card {
    display: flex;
    flex-direction: column;
    padding: 1.25rem;
    border-radius: 12px;
    border: 1px solid #263449;
    background: #172033;
    text-decoration: none;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.quick-action-card:hover {
    transform: translateY(-3px);
    border-color: #14b8a6;
    box-shadow: 0 14px 28px rgba(0, 0, 0, 0.22);
}

.quick-action-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.9rem;
}

.quick-action-top .stat-icon {
    width: 44px;
    height: 44px;
    font-size: 1.25rem;
}

.quick-action-cta {
    color: #2dd4bf;
    font-size: 0.78rem;
    font-weight: 700;
}

.quick-action-card h3 {
    margin: 0 0 0.35rem;
    color: #f8fafc;
    font-size: 1.02rem;
    font-weight: 750;
}

.quick-action-card p {
    margin: 0;
    color: #94a3b8;
    font-size: 0.82rem;
    line-height: 1.5;
}

/* NEWEST USERS LIST */
.recent-user-list {
    display: grid;
    gap: 0.75rem;
    margin-top: 1.25rem;
}

.recent-user-row {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.85rem 1rem;
    border-radius: 10px;
    background: #172033;
    border: 1px solid #263449;
    transition: border-color 0.15s ease;
}

.recent-user-row:hover {
    border-color: #3b82f6;
}

.recent-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0f766e, #0d9488);
    color: #ffffff;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 0.95rem;
    flex-shrink: 0;
}

.recent-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}

.recent-name-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.45rem;
}

.recent-name-line strong {
    color: #f8fafc;
    font-size: 0.92rem;
    font-weight: 700;
}

.recent-email {
    color: #94a3b8;
    font-size: 0.78rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.provider-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    font-size: 0.66rem;
    font-weight: 700;
    border: 1px solid transparent;
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

.admin-pill {
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    background: rgba(245, 158, 11, 0.18);
    color: #fcd34d;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
}

.recent-date {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    text-align: right;
    flex-shrink: 0;
}

.recent-date span {
    color: #64748b;
    font-size: 0.68rem;
    text-transform: uppercase;
}

.recent-date strong {
    color: #cbd5e1;
    font-size: 0.78rem;
}

@media (max-width: 1024px) {
    .dashboard-lower-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 900px) {
    .stats-grid {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    }
}

@media (max-width: 600px) {
    .quick-actions-grid {
        grid-template-columns: 1fr;
    }
}
</style>