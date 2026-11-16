<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api'
import Swal from 'sweetalert2'
import LessonEditorModal from '@/components/admin/LessonEditorModal.vue'
import AdminSettings from '@/components/admin/AdminSettings.vue'
import AdminAnalytics from '@/components/admin/AdminAnalytics.vue'
import AdminUsers from '@/components/admin/AdminUsers.vue'
import AdminCourses from '@/components/admin/AdminCourses.vue'
import AdminDashboard from '@/components/admin/AdminDashboard.vue'

const router = useRouter()
const route = useRoute()

const getCurrentUserRole = () => {
  try {
    const storedUser = sessionStorage.getItem('auth_user')
    const parsed = storedUser ? JSON.parse(storedUser) : null
    return parsed?.role || 'learner'
  } catch (_err) {
    return 'learner'
  }
}

const userRole = ref(getCurrentUserRole())
const isAdmin = computed(() => userRole.value === 'admin')

const currentSection = computed(() => route.params.section || 'dashboard')

watch(
  currentSection,
  section => {
    userRole.value = getCurrentUserRole()
    if (!isAdmin.value && ['users', 'analytics'].includes(section)) {
      router.replace('/admin/dashboard')
    }
  },
  { immediate: true }
)
const sectionTitle = computed(() => ({
  dashboard: 'Dashboard',
  courses: 'Courses',
  users: 'Users',
  analytics: 'Analytics',
  settings: 'Settings'
}[currentSection.value] || 'Dashboard'))

const sectionMarker = computed(() => ({
  dashboard: '01',
  courses: '02',
  users: '03',
  analytics: '04',
  settings: '05'
}[currentSection.value] || '01'))

const logout = async () => {
  const result = await Swal.fire({
    title: 'Sign out?',
    text: 'You will need to sign in again to access the admin workspace.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sign out',
    cancelButtonText: 'Stay',
    confirmButtonColor: '#d34c3c',
  })
  if (!result.isConfirmed) return

  sessionStorage.removeItem('auth_user')
  sessionStorage.removeItem('auth_token')
  window.dispatchEvent(new Event('auth-changed'))
  await router.push('/login')
}

// === USER MANAGEMENT STATES ===


// === COURSE MANAGEMENT STATES ===

// === ANALYTICS STATES ===


// === SETTINGS STATES & METHODS ===

</script>

<template>
  <main class="admin-page">
    <aside class="admin-sidebar">
      <div class="sidebar-brand"><span class="sidebar-logo">LS</span><span>Learning Support</span></div>
      <p class="sidebar-label">Workspace</p>
      <nav class="sidebar-nav" aria-label="Admin navigation">
        <RouterLink class="sidebar-link" :class="{ active: currentSection === 'dashboard' }" to="/admin/dashboard">
          <span>▦</span> Dashboard
        </RouterLink>
        <RouterLink class="sidebar-link" :class="{ active: currentSection === 'courses' }" to="/admin/courses">
          <span>▤</span> Courses
        </RouterLink>
        <RouterLink v-if="isAdmin" class="sidebar-link" :class="{ active: currentSection === 'users' }" to="/admin/users">
          <span>♙</span> Users
        </RouterLink>
        <RouterLink v-if="isAdmin" class="sidebar-link" :class="{ active: currentSection === 'analytics' }" to="/admin/analytics">
          <span>⌁</span> Analytics
        </RouterLink>
        <RouterLink class="sidebar-link" :class="{ active: currentSection === 'settings' }" to="/admin/settings">
          <span>◎</span> Settings
        </RouterLink>
        <RouterLink class="sidebar-link sidebar-switch-link" to="/profile/overview">
          <span>👤</span> My Profile
        </RouterLink>
      </nav>
      <div class="sidebar-footer"><span class="status-dot"></span> System operational</div>
    </aside>

    <div class="admin-content">
      <header class="admin-header">
        <div>
          <p class="eyebrow">{{ isAdmin ? 'ADMIN' : 'INSTRUCTOR' }} / {{ sectionTitle.toUpperCase() }}</p>
          <h1>{{ sectionTitle }}</h1>
          <p class="supporting-text">Manage your learning platform from one place.</p>
        </div>
        <div class="heading-actions">
          <span class="mode-indicator"><span>{{ sectionMarker }}</span> {{ sectionTitle }}</span>
          <button class="signout-button" type="button" @click="logout"><span aria-hidden="true">↗</span> Sign out</button>
        </div>
      </header>

      <p v-if="message" class="message success">{{ message }}</p>
      <p v-if="error" class="message error">{{ error }}</p>

      <!-- KHU VỰC TỔNG QUAN -->
      <AdminDashboard v-if="currentSection === 'dashboard'" />

      <!-- KHU VỰC QUẢN LÝ KHÓA HỌC -->
      <AdminCourses v-if="currentSection === 'courses'" />

      <!-- KHU VỰC QUẢN LÝ NGƯỜI DÙNG -->
      <AdminUsers v-if="currentSection === 'users' && isAdmin" />

      <!-- KHU VỰC ANALYTICS (Đã chuyển sang component riêng) -->
      <AdminAnalytics v-if="currentSection === 'analytics' && isAdmin" />

      <!-- KHU VỰC CÀI ĐẶT TÀI KHOẢN (Đã chuyển sang component riêng) -->
      <AdminSettings v-if="currentSection === 'settings'" />
    </div>

    <LessonEditorModal :show="showEditor" :courseId="selectedCourseId" :moduleId="selectedModuleId"
      :lessonData="selectedLesson" @close="showEditor = false" @saved="loadCourses" />
  </main>
</template>

<style scoped>
.admin-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

.admin-header h1 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(2rem, 4vw, 2.5rem);
}

.supporting-text {
  margin: 0.5rem 0 2rem;
  color: #475569;
}

.message {
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-weight: bold;
}

.message.success {
  background: #d1fae5;
  color: #065f46;
}

.message.error {
  background: #fee2e2;
  color: #991b1b;
}

.admin-section {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
  border: 1px solid #e2e8f0;
}

.admin-section h2 {
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.5rem;
  margin-top: 0;
  color: #1e293b;
}

/* USER CSS */


/* COURSE CSS */

/* Dashboard layout */
.admin-page {
  flex: 1;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 0;
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
}

.admin-sidebar {
  position: relative;
  align-self: stretch;
  width: 220px;
  border-radius: 0;
  padding: 1.25rem 0;
  background: #171921;
  border: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: none;
  display: flex;
  flex-direction: column;
}

.sidebar-brand,
.sidebar-label,
.sidebar-footer {
  display: none;
}

.eyebrow,
.course-kicker,
.module-label {
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.68rem;
  font-weight: 800;
}

.sidebar-nav {
  position: sticky;
  top: calc(var(--app-navbar-height, 70px) + 1.25rem);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sidebar-link {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0;
  color: #e2e8f0;
  font-size: 0.92rem;
  font-weight: 500;
  transition: background 0.18s ease, color 0.18s ease;
}

.sidebar-link span {
  width: 1.25rem;
  color: #cbd5e1;
  font-size: 1.15rem;
  text-align: center;
  transition: color 0.18s ease;
}

.sidebar-link:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
}

.sidebar-link:hover span {
  color: #ffffff;
}

.sidebar-link.active {
  background: transparent;
  color: #10b981;
  font-weight: 600;
  box-shadow: none;
}

.sidebar-link.active span {
  color: #10b981;
}

.sidebar-switch-link {
  margin-top: 0.75rem;
  padding-top: 0.95rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: #93c5fd;
}

/* .admin-content {
  min-width: 0;
} */

.admin-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.6rem;
}

.admin-header h1 {
  margin: 0.25rem 0 0.15rem;
  color: #f8fafc;
  font-size: clamp(2rem, 4vw, 2.8rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.supporting-text {
  margin: 0;
  color: #94a3b8;
}

.admin-date {
  padding: 0.55rem 0.8rem;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #94a3b8;
  font-size: 0.78rem;
  white-space: nowrap;
}



.admin-section {
  margin-bottom: 1.5rem;
  padding: 1.4rem;
  border: 1px solid #263449;
  border-radius: 14px;
  background: #111827;
  box-shadow: 0 16px 35px rgba(15, 23, 42, 0.15);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #263449;
}

.section-heading h2 {
  margin: 0.2rem 0 0;
  color: #f8fafc;
  font-size: 1.25rem;
  font-weight: 750;
}

.section-count {
  color: #64748b;
  font-size: 0.78rem;
}

.course-list {
  margin-top: 1rem;
}

.course-card {
  padding: 1.2rem;
  border: 1px solid #263449;
  border-radius: 11px;
  background: #172033;
}

.course-card+.course-card {
  margin-top: 1rem;
}

.course-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.1rem;
}

.course-header h3 {
  margin: 0.2rem 0 0.4rem;
  color: #f8fafc;
  font-size: 1.05rem;
}

.course-subject {
  display: inline-block;
  padding: 0.25rem 0.55rem;
  border-radius: 5px;
  background: rgba(20, 184, 166, 0.13);
  color: #5eead4;
  font-size: 0.7rem;
  font-weight: 700;
}

.btn-add-module,
.btn-add-lesson {
  border: 1px solid rgba(45, 212, 191, 0.25);
  border-radius: 7px;
  background: #0f766e;
  color: #ecfeff;
  padding: 0.5rem 0.7rem;
  font-size: 0.76rem;
  font-weight: 700;
}

.btn-add-module:hover,
.btn-add-lesson:hover {
  background: #0d9488;
}

.course-workspace {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 1rem;
}

.module-index {
  padding: 0.8rem;
  border: 1px solid #263449;
  border-radius: 8px;
  background: #111827;
}

.module-index-title {
  display: block;
  margin-bottom: 0.65rem;
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.module-index-item {
  display: block;
  width: 100%;
  padding: 0.6rem 0.45rem;
  border: 0;
  border-left: 2px solid #334155;
  background: transparent;
  color: #cbd5e1;
  font: inherit;
  font-size: 0.75rem;
  text-align: left;
  cursor: pointer;
}

.module-index-item:hover,
.module-index-item.active {
  border-left-color: #14b8a6;
  background: #172033;
  color: #f8fafc;
}

.module-index-item small {
  display: block;
  margin-top: 0.15rem;
  color: #64748b;
  font-size: 0.68rem;
}

.module-index-item.active small {
  color: #5eead4;
}

.all-modules {
  margin-bottom: 0.35rem;
  color: #94a3b8;
  font-weight: 700;
}

.module-stack {
  min-width: 0;
}

.module-block {
  margin: 0;
  padding: 0.95rem;
  border: 1px solid #263449;
  border-radius: 8px;
  background: #111827;
}

.module-block+.module-block {
  margin-top: 0.7rem;
}

.module-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #263449;
}

.admin-module-title {
  margin: 0.15rem 0 0 !important;
  color: #e2e8f0 !important;
  font-size: 0.9rem !important;
  font-weight: 700 !important;
}

.module-header-actions,
.lesson-action-buttons {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.icon-action {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border: 1px solid #334155;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}

.icon-action:hover {
  background: #1f2937;
  color: white;
}

.icon-action.danger:hover {
  color: #fda4af;
}

.lesson-list {
  gap: 0;
  margin: 0;
}

.lesson-item {
  padding: 0.7rem 0.2rem;
  border: 0;
  border-bottom: 1px solid #1f2937;
  border-radius: 0;
  background: transparent;
}

.lesson-item:last-child {
  border-bottom: 0;
}

.lesson-item:hover {
  transform: none;
  box-shadow: none;
}

.lesson-item .lesson-item-title {
  color: #cbd5e1;
  font-size: 0.78rem;
  font-weight: 500;
}

.lesson-bullet {
  margin-right: 0.5rem;
  color: #14b8a6;
}

.action-btn {
  padding: 0.3rem 0.5rem;
  border-radius: 5px;
  font-size: 0.68rem;
}

.btn-edit {
  border-color: #334155;
  background: transparent;
  color: #94a3b8;
}

.btn-edit:hover {
  background: #1f2937;
}

.text-delete {
  border: 0;
  background: transparent;
  color: #f87171;
  font-size: 0.68rem;
  cursor: pointer;
}

.user-list {
  gap: 0.5rem;
}

.user-row {
  padding: 0.7rem;
  border-color: #263449;
  background: #172033;
}

.user-avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-right: 0.7rem;
  border-radius: 50%;
  background: #1d4ed8;
  color: white;
  font-size: 0.75rem;
  font-weight: 800;
}

.user-meta strong {
  color: #e2e8f0;
}

.user-meta span {
  color: #64748b;
}

.role-select {
  border-color: #334155;
  background: #111827;
  color: #cbd5e1;
}

.saving-text {
  color: #2dd4bf;
}

.message {
  border: 1px solid transparent;
}

.message.success {
  border-color: #115e59;
  background: #042f2e;
  color: #99f6e4;
}

.message.error {
  border-color: #7f1d1d;
  background: #450a0a;
  color: #fecaca;
}

.state-text {
  color: #94a3b8;
}

.anchor-target {
  scroll-margin-top: 7rem;
}

@media (max-width: 650px) {

  .stats-grid,
  .course-workspace {
    grid-template-columns: 1fr;
  }

  .admin-header,
  .course-header,
  .module-block-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .admin-date {
    align-self: stretch;
    text-align: center;
  }

  .admin-section {
    padding: 1rem;
  }

  .lesson-item {
    align-items: flex-start;
    gap: 0.55rem;
  }

  .lesson-action-buttons {
    width: 100%;
  }

  .module-header-actions {
    flex-wrap: wrap;
  }
}

/* Full-width admin shell and dashboard-only summary */
.admin-page {
  flex: 1;
  width: 100%;
  max-width: none;
  min-height: 0;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 0;
}

.admin-sidebar {
  position: relative;
  top: auto;
  align-self: stretch;
  width: 220px;
  height: auto !important;
  min-height: 0 !important;
  max-height: none;
  overflow: visible;
  border-radius: 0;
  padding: 1.25rem 0;
}

.admin-content {
  width: 100%;
  max-width: 1200px;
  min-width: 0;
  padding: 2rem 2.5rem 4rem;
}

.admin-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin: 8px 0 23px;
}

.admin-header h1 {
  margin: 5px 0 4px;
  color: #17324d;
  font-size: clamp(1.8rem, 3vw, 2.45rem);
  line-height: 1.1;
  text-shadow: none;
}

.admin-header .eyebrow {
  margin: 0;
  color: #82928a;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.09em;
}

.supporting-text {
  margin: 0;
  color: #52708a;
  font-size: 0.9rem;
}

.heading-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mode-indicator {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid #dce8da;
  border-radius: 6px;
  background: #f5f8ee;
  color: #40694f;
  font-size: 0.68rem;
  font-weight: 750;
  white-space: nowrap;
}

.mode-indicator span {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 5px;
  background: #dcebbd;
  color: #466a3e;
  font-size: 0.59rem;
}

.signout-button {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  padding: 0 13px;
  border: 1px solid #eddbd6;
  border-radius: 7px;
  background: #fffaf8;
  color: #a34638;
  font-size: 0.8rem;
  font-weight: 750;
  cursor: pointer;
}

.signout-button:hover {
  background: #fff0eb;
}

.signout-button span {
  font-size: 1rem;
}

.admin-date {
  border-color: #7b9aa5;
  background: rgba(255, 255, 255, 0.38);
  color: #56758b;
  padding: 0.75rem 1rem;
}


.stats-grid {
  margin: 1.5rem 0 0;
  gap: 1.5rem;
}

.stat-card {
  min-height: 155px;
  padding: 1.65rem;
  border-radius: 15px;
  border-color: #233454;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.1);
}

.stat-icon {
  width: 52px;
  height: 52px;
  font-size: 1.35rem;
}

.stat-card strong {
  font-size: 2rem;
}

.stat-card div span {
  font-size: 0.88rem;
}

.empty-section {
  min-height: 300px;
  display: grid;
  place-items: center;
  align-content: center;
  text-align: center;
}

.empty-section h2 {
  color: #17324d;
}

.empty-section p:last-child {
  color: #52708a;
}

.empty-icon {
  color: #0f766e;
  font-size: 2.5rem;
}

@media (max-width: 900px) {
  .admin-page {
    grid-template-columns: 1fr;
    padding: 0;
  }
  .admin-sidebar {
    position: static;
    width: 100%;
    height: auto !important;
    min-height: auto !important;
    padding: 0.5rem 1rem;
    border-right: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 0;
  }
  .sidebar-nav {
    position: static;
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    gap: 4px;
  }
  .sidebar-link {
    min-height: 38px;
    flex: 0 0 auto;
    justify-content: center;
    padding: 0 12px;
    font-size: 0.82rem;
  }
  .sidebar-link.active {
    box-shadow: inset 0 -2px #10b981;
  }

  .admin-content {
    max-width: none;
    padding: 1.5rem 1.25rem 3rem;
  }
}

@media (max-width: 650px) {
  .dashboard-overview {
    padding: 1rem;
  }

 

  .stat-card {
    min-height: 125px;
  }

  .admin-header h1 {
    font-size: 2.5rem;
  }
}
</style>