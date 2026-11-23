<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Swal from 'sweetalert2'
import api from '@/services/api'

const router = useRouter()
const route = useRoute()
const authUser = ref(null)
const showUserMenu = ref(false)
const userMenuRef = ref(null)

// === ADMIN LOGIN NOTIFICATION STATES ===
const notifications = ref([])
const showNotificationMenu = ref(false)
const notificationRef = ref(null)

const unreadCount = computed(() => notifications.value.filter(item => !item.isRead).length)

// Hàm lấy thông tin user từ SessionStorage
const loadAuthUser = () => {
  const storedUser = sessionStorage.getItem('auth_user')
  authUser.value = storedUser ? JSON.parse(storedUser) : null
  if (authUser.value && sessionStorage.getItem('auth_token')) {
    loadNotifications()
  } else {
    notifications.value = []
  }
}

const loadNotifications = async () => {
  if (!sessionStorage.getItem('auth_token')) return
  try {
    const { data } = await api.get('/notifications')
    notifications.value = Array.isArray(data) ? data : []
  } catch (_error) {
    // Bỏ qua lỗi nếu chưa đăng nhập hoặc token hết hạn
  }
}

const getNotificationIcon = item => {
  if (item?.title?.includes('Signed In') || item?.title?.includes('Registered')) return '👤'
  if (item?.type === 'ai_report') return '✨'
  if (item?.type === 'reminder') return '🔥'
  return '📢'
}

const toggleNotificationMenu = () => {
  showNotificationMenu.value = !showNotificationMenu.value
  if (showNotificationMenu.value) {
    showUserMenu.value = false
    loadNotifications()
  }
}

const handleNotificationClick = async item => {
  if (!item.isRead) {
    item.isRead = true
    try {
      await api.patch(`/notifications/${item._id}/read`)
    } catch (_error) {
      // Giữ trạng thái UI mượt mà
    }
  }
  showNotificationMenu.value = false
  if (item.link) {
    router.push(item.link)
  }
}

const markAllAsRead = async () => {
  notifications.value.forEach(item => { item.isRead = true })
  try {
    await api.patch('/notifications/read-all')
  } catch (_error) {
    // Giữ trạng thái UI mượt mà
  }
}

const formatNotifTime = value => {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

// Lắng nghe sự kiện đăng nhập/đăng xuất từ các component khác
const handleAuthChanged = () => {
  loadAuthUser()
  showUserMenu.value = false
  showNotificationMenu.value = false
}

const handleClickOutside = event => {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target)) {
    showUserMenu.value = false
  }
  if (notificationRef.value && !notificationRef.value.contains(event.target)) {
    showNotificationMenu.value = false
  }
}

onMounted(() => {
  loadAuthUser()
  window.addEventListener('auth-changed', handleAuthChanged)
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  window.removeEventListener('auth-changed', handleAuthChanged)
  document.removeEventListener('click', handleClickOutside)
})

const isAdmin = computed(() => authUser.value?.role === 'admin')
const isInstructor = computed(() => authUser.value?.role === 'instructor')
const isStaff = computed(() => ['admin', 'instructor'].includes(authUser.value?.role))
const displayName = computed(() => authUser.value?.name || authUser.value?.username || 'Learner')

const handleUserButtonClick = () => {
  if (isStaff.value) {
    showUserMenu.value = !showUserMenu.value
    if (showUserMenu.value) showNotificationMenu.value = false
  } else {
    router.push('/profile/overview')
  }
}

const handleLogout = async () => {
  const result = await Swal.fire({
    title: 'Sign out?',
    text: 'Are you sure you want to sign out?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'Yes, sign out'
  })
  
  if (result.isConfirmed) {
    sessionStorage.removeItem('auth_user')
    sessionStorage.removeItem('auth_token')
    window.dispatchEvent(new Event('auth-changed'))
    router.push('/login')
  }
}
</script>

<template>
  <header class="app-header">
    <div class="header-container">
      <!-- 1. LOGO -->
      <RouterLink to="/" class="brand-logo">
        <span class="logo-icon">LS</span>
        <span class="brand-text">Learning Support</span>
      </RouterLink>

      <!-- 2. MAIN NAVIGATION -->
      <div class="center-nav-group">
        <nav class="main-nav">
          <RouterLink to="/" class="nav-link">Home</RouterLink>
          <RouterLink to="/courses" class="nav-link">Courses</RouterLink>
          <RouterLink to="/about" class="nav-link">About Us</RouterLink>
        </nav>
      </div>

      <!-- 3. USER ACTIONS (Góc phải) -->
      <div class="auth-actions">
        <!-- Khi chưa đăng nhập -->
        <template v-if="!authUser">
          <RouterLink to="/login" class="btn-login">Sign in</RouterLink>
          <RouterLink to="/register" class="btn-register">Get Started</RouterLink>
        </template>

        <!-- Khi đã đăng nhập: Tất cả các role (Learner, Instructor, Admin) đều có chuông thông báo -->
        <template v-else>
          <!-- NOTIFICATION BELL ICON + BADGE -->
          <div ref="notificationRef" class="notification-wrapper">
            <button
              type="button"
              class="bell-button"
              :class="{ active: showNotificationMenu }"
              aria-label="Notifications"
              :title="isAdmin ? 'User Login Alerts (Admin Only)' : 'Notifications'"
              @click="toggleNotificationMenu"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }}</span>
            </button>

            <!-- NOTIFICATION DROPDOWN -->
            <div v-if="showNotificationMenu" class="notification-dropdown" role="menu">
              <div class="notification-header">
                <div>
                  <strong>{{ isAdmin ? 'User Sign-In Activity' : 'Notifications' }}</strong>
                  <span v-if="unreadCount > 0" class="unread-pill">{{ unreadCount }} unread</span>
                </div>
                <button
                  v-if="unreadCount > 0"
                  type="button"
                  class="mark-all-btn"
                  @click="markAllAsRead"
                >
                  Mark all as read
                </button>
              </div>

              <div v-if="notifications.length === 0" class="notification-empty">
                {{ isAdmin ? 'No recent user sign-in alerts right now.' : "You're all caught up! No notifications right now." }}
              </div>
              <div v-else class="notification-list">
                <button
                  v-for="item in notifications"
                  :key="item._id"
                  type="button"
                  class="notification-item"
                  :class="{ unread: !item.isRead }"
                  @click="handleNotificationClick(item)"
                >
                  <span class="notif-icon" :class="item.type">{{ getNotificationIcon(item) }}</span>
                  <div class="notif-content">
                    <div class="notif-title-row">
                      <strong>{{ item.title }}</strong>
                      <span v-if="!item.isRead" class="notif-dot" aria-label="Unread"></span>
                    </div>
                    <p>{{ item.message }}</p>
                    <small v-if="item.createdAt" style="color: #94a3b8; font-size: 0.72rem;">
                      {{ formatNotifTime(item.createdAt) }}
                    </small>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div ref="userMenuRef" class="user-menu-wrapper">
            <button
              type="button"
              class="user-profile-menu"
              :class="{ 'is-active': route.path.startsWith('/profile') || route.path.startsWith('/admin') }"
              @click="handleUserButtonClick"
            >
              <span class="user-icon-badge" :class="{ 'admin-badge': isStaff }" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <span class="greeting">Hi, {{ displayName }}</span>
              <span v-if="isStaff" class="dropdown-caret" :class="{ open: showUserMenu }" aria-hidden="true">▾</span>
            </button>

            <!-- Dropdown chọn giữa Profile View & Admin/Instructor View -->
            <div v-if="isStaff && showUserMenu" class="user-dropdown" role="menu">
              <div class="dropdown-header">
                <span class="dropdown-role">{{ isAdmin ? 'Administrator' : 'Instructor' }}</span>
                <small>{{ authUser?.email }}</small>
              </div>
              <RouterLink
                to="/profile/overview"
                class="dropdown-item"
                :class="{ active: route.path.startsWith('/profile') }"
                @click="showUserMenu = false"
              >
                <span class="dropdown-icon">👤</span>
                <div>
                  <strong>My Profile</strong>
                  <small>/profile/overview</small>
                </div>
              </RouterLink>
              <RouterLink
                to="/admin/dashboard"
                class="dropdown-item"
                :class="{ active: route.path.startsWith('/admin') }"
                @click="showUserMenu = false"
              >
                <span class="dropdown-icon">{{ isAdmin ? '🛡️' : '🎓' }}</span>
                <div>
                  <strong>{{ isAdmin ? 'Admin Panel' : 'Instructor Panel' }}</strong>
                  <small>/admin/dashboard</small>
                </div>
              </RouterLink>
            </div>
          </div>
        </template>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 1.5rem;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* LOGO */
.brand-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
}
.logo-icon {
  background: #0f766e;
  color: white;
  font-weight: 800;
  font-size: 0.9rem;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 10px;
}
.brand-text {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
}

/* NAVIGATION & GLOBAL SEARCH */
.center-nav-group {
  display: flex;
  align-items: center;
  gap: 2rem;
}
.main-nav {
  display: flex;
  gap: 1.75rem;
  align-items: center;
}
.nav-link {
  text-decoration: none;
  color: #475569;
  font-weight: 600;
  font-size: 0.95rem;
  transition: color 0.2s;
  outline: none;
}
.nav-link:hover, .nav-link.router-link-active, .nav-link.active-link {
  color: #0f766e;
}

.global-search-wrapper {
  position: relative;
}
.global-search-box {
  position: relative;
  display: flex;
  align-items: center;
}
.search-svg {
  position: absolute;
  left: 0.85rem;
  color: #64748b;
  pointer-events: none;
}
.global-search-input {
  width: 280px;
  height: 38px;
  padding: 0 0.9rem 0 2.35rem;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.global-search-input::placeholder {
  color: #94a3b8;
}
.global-search-input:focus {
  background: #ffffff;
  border-color: #0f766e;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
}

.search-suggest-dropdown {
  position: absolute;
  left: 0;
  top: calc(100% + 0.5rem);
  width: 360px;
  max-height: 380px;
  overflow-y: auto;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
  padding: 0.45rem;
  z-index: 110;
  display: grid;
  gap: 0.25rem;
}
.search-state-msg {
  padding: 1rem;
  text-align: center;
  color: #64748b;
  font-size: 0.85rem;
}
.search-suggest-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 0;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}
.search-suggest-item:hover {
  background: #f1f5f9;
}
.suggest-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  flex-shrink: 0;
}
.suggest-badge.course {
  background: #dcfce7;
  color: #15803d;
}
.suggest-badge.lesson {
  background: #dbeafe;
  color: #1d4ed8;
}
.suggest-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.suggest-copy strong {
  color: #0f172a;
  font-size: 0.86rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.suggest-copy small {
  color: #64748b;
  font-size: 0.74rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.suggest-arrow {
  color: #0f766e;
  font-weight: 700;
  font-size: 0.9rem;
}

/* NOTIFICATION BELL & DROPDOWN */
.notification-wrapper {
  position: relative;
}
.bell-button {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #334155;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.bell-button:hover,
.bell-button.active {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #0f766e;
}
.unread-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #ef4444;
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 800;
  display: grid;
  place-items: center;
  border: 2px solid #ffffff;
}
.notification-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 0.6rem);
  width: 340px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
  padding: 0.5rem;
  z-index: 110;
}
.notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 0.75rem 0.65rem;
  border-bottom: 1px solid #f1f5f9;
}
.notification-header div {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.notification-header strong {
  color: #0f172a;
  font-size: 0.92rem;
  font-weight: 800;
}
.unread-pill {
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  background: #fee2e2;
  color: #dc2626;
  font-size: 0.68rem;
  font-weight: 700;
}
.mark-all-btn {
  border: 0;
  background: transparent;
  color: #0f766e;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}
.mark-all-btn:hover {
  text-decoration: underline;
}
.notification-empty {
  padding: 1.5rem 1rem;
  text-align: center;
  color: #64748b;
  font-size: 0.85rem;
}
.notification-list {
  display: grid;
  gap: 0.25rem;
  margin-top: 0.3rem;
  max-height: 320px;
  overflow-y: auto;
}
.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
  padding: 0.7rem 0.75rem;
  border: 0;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}
.notification-item:hover {
  background: #f8fafc;
}
.notification-item.unread {
  background: #f0fdf4;
}
.notification-item.unread:hover {
  background: #dcfce7;
}
.notif-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #f1f5f9;
  display: grid;
  place-items: center;
  font-size: 1rem;
  flex-shrink: 0;
}
.notif-content {
  flex: 1;
  min-width: 0;
}
.notif-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.notif-title-row strong {
  color: #0f172a;
  font-size: 0.84rem;
  font-weight: 750;
}
.notif-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  flex-shrink: 0;
}
.notif-content p {
  margin: 0.2rem 0 0;
  color: #475569;
  font-size: 0.78rem;
  line-height: 1.45;
}

/* ACTIONS */
.auth-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.btn-login {
  text-decoration: none;
  color: #0f172a;
  font-weight: 700;
  font-size: 0.95rem;
}
.btn-register {
  background: #10b981;
  color: white;
  text-decoration: none;
  padding: 0.6rem 1.25rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.95rem;
  transition: transform 0.2s;
}
.btn-register:hover {
  transform: translateY(-1px);
  background: #059669;
}

.user-menu-wrapper {
  position: relative;
}
.user-profile-menu {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.35rem 0.9rem 0.35rem 0.4rem;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.user-profile-menu:hover,
.user-profile-menu.is-active {
  background: #f1f5f9;
  border-color: #cbd5e1;
}
.user-icon-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #0f766e;
  color: #ffffff;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.user-icon-badge.admin-badge {
  background: linear-gradient(135deg, #0f766e, #0d9488);
}
.greeting {
  font-weight: 600;
  color: #334155;
  font-size: 0.95rem;
}
.dropdown-caret {
  color: #64748b;
  font-size: 0.8rem;
  transition: transform 0.2s ease;
}
.dropdown-caret.open {
  transform: rotate(180deg);
}

.user-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 0.6rem);
  width: 235px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
  padding: 0.45rem;
  z-index: 100;
  display: grid;
  gap: 0.25rem;
}
.dropdown-header {
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 0.2rem;
  display: flex;
  flex-direction: column;
}
.dropdown-role {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #0f766e;
}
.dropdown-header small {
  color: #64748b;
  font-size: 0.78rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  text-decoration: none;
  color: #334155;
  transition: background 0.15s, color 0.15s;
}
.dropdown-item:hover {
  background: #f8fafc;
  color: #0f172a;
}
.dropdown-item.active {
  background: #f0fdf4;
  color: #0f766e;
}
.dropdown-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #f1f5f9;
  display: grid;
  place-items: center;
  font-size: 0.95rem;
  flex-shrink: 0;
}
.dropdown-item.active .dropdown-icon {
  background: #dcfce7;
}
.dropdown-item div {
  display: flex;
  flex-direction: column;
}
.dropdown-item strong {
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.2;
}
.dropdown-item small {
  font-size: 0.72rem;
  color: #94a3b8;
}

@media (max-width: 768px) {
  .main-nav { display: none; } /* Có thể làm menu hamburger cho mobile sau */
}
</style>