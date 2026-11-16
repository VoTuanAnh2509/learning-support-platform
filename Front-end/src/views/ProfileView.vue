<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import api from '@/services/api'

import ProfileOverview from '@/components/profile/ProfileOverview.vue'
import ProfileCoursesSection from '@/components/profile/ProfileCoursesSection.vue'
import ProfileInsights from '@/components/profile/ProfileInsights.vue'
import ProfileSettings from '@/components/profile/ProfileSettings.vue'

const router = useRouter()
const route = useRoute()

const userId = ref('')
const profile = ref(null)
const progress = ref(null)
const summary = ref(null)
const recommendations = ref(null)
const loading = ref(true)
const pageError = ref('')

const activeSection = computed(() => route.params.section || 'overview')
const sectionDetails = {
  overview: { title: 'Overview', subtitle: 'A clear view of your learning, progress, and next steps.', marker: '01' },
  courses: { title: 'My courses', subtitle: 'Pick up a course and continue where you left off.', marker: '02' },
  insights: { title: 'Learning insights', subtitle: 'Reflect on your progress and choose a useful next step.', marker: '03' },
  settings: { title: 'Account settings', subtitle: 'Manage your personal information and account access.', marker: '04' },
}
const activePage = computed(() => sectionDetails[activeSection.value] || sectionDetails.overview)

const loadDashboard = async () => {
  const storedUser = sessionStorage.getItem('auth_user')
  const user = storedUser ? JSON.parse(storedUser) : null
  userId.value = user?._id || user?.id || ''
  if (!userId.value || !sessionStorage.getItem('auth_token')) {
    router.replace('/login')
    return
  }

  loading.value = true
  pageError.value = ''
  try {
    const [profileResult, progressResult] = await Promise.allSettled([
      api.get(`/users/${userId.value}/profile`),
      api.get(`/users/${userId.value}/progress`),
    ])
    if (profileResult.status !== 'fulfilled') throw profileResult.reason

    profile.value = profileResult.value.data
    progress.value = progressResult.status === 'fulfilled' ? progressResult.value.data : null
  } catch (error) {
    pageError.value = error?.response?.data?.error || 'Your profile could not be loaded.'
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      sessionStorage.removeItem('auth_user')
      sessionStorage.removeItem('auth_token')
      window.dispatchEvent(new Event('auth-changed'))
      router.replace('/login')
    }
  } finally {
    loading.value = false
  }
}

const handleBookmarksUpdated = newBookmarks => {
  if (profile.value) {
    profile.value.bookmarkedLessons = newBookmarks
  }
}

const handleProfileUpdated = updatedData => {
  if (profile.value) {
    profile.value = { ...profile.value, ...updatedData }
  }
}

const handleInsightsLoaded = ({ summary: loadedSummary, recommendations: loadedRecommendations }) => {
  summary.value = loadedSummary
  recommendations.value = loadedRecommendations
}

const logout = async () => {
  const result = await Swal.fire({
    title: 'Sign out?',
    text: 'You will need to sign in again to access your learning data.',
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

onMounted(loadDashboard)
</script>

<template>
  <main class="profile-page">
    <aside class="profile-rail">
      <nav class="rail-nav" aria-label="Profile sections">
        <RouterLink
          v-for="item in Object.entries(sectionDetails)"
          :key="item[0]"
          class="rail-link"
          :class="{ active: activeSection === item[0] }"
          :to="{ name: 'profile-section', params: { section: item[0] } }"
          :aria-current="activeSection === item[0] ? 'page' : undefined"
        >
          <span class="rail-glyph">{{ { overview: '▦', courses: '▤', insights: '⌁', settings: '◎' }[item[0]] }}</span>
          {{ item[1].title }}
        </RouterLink>
        <RouterLink
          v-if="['admin', 'instructor'].includes(profile?.role)"
          class="rail-link rail-switch-link"
          to="/admin/dashboard"
        >
          <span class="rail-glyph">{{ profile?.role === 'admin' ? '🛡️' : '🎓' }}</span>
          {{ profile?.role === 'admin' ? 'Admin Panel' : 'Instructor Panel' }}
        </RouterLink>
      </nav>
    </aside>

    <div class="profile-content">
      <header class="page-heading">
        <div>
          <p class="kicker">PROFILE / {{ activePage.title.toUpperCase() }}</p>
          <h1>{{ activePage.title }}</h1>
          <p class="heading-copy">{{ activePage.subtitle }}</p>
        </div>
        <div class="heading-actions">
          <span class="mode-indicator">
            <span>{{ activePage.marker }}</span> {{ activePage.title }}
          </span>
          <button class="signout-button" type="button" @click="logout">
            <span aria-hidden="true">↗</span> Sign out
          </button>
        </div>
      </header>

      <p v-if="pageError" class="notice error-notice" role="alert">{{ pageError }}</p>
      <div v-if="loading" class="loading-state" role="status">Loading your learning profile...</div>

      <template v-else-if="profile">
        <ProfileOverview
          v-if="activeSection === 'overview'"
          :profile="profile"
          :progress="progress"
          :userId="userId"
          @update-bookmarks="handleBookmarksUpdated"
        />

        <div v-else-if="activeSection === 'courses'" class="courses-only-wrapper">
          <ProfileCoursesSection
            :profile="profile"
            :userId="userId"
            @update-bookmarks="handleBookmarksUpdated"
          />
        </div>

        <ProfileInsights
          v-else-if="activeSection === 'insights'"
          :userId="userId"
          :initialSummary="summary"
          :initialRecommendations="recommendations"
          @loaded="handleInsightsLoaded"
        />

        <ProfileSettings
          v-else-if="activeSection === 'settings'"
          :profile="profile"
          :userId="userId"
          @profile-updated="handleProfileUpdated"
        />

        <footer class="profile-footer">
          <span>LEARNING SUPPORT</span>
          <span>{{ activePage.title }} · {{ activePage.marker }} / 04</span>
        </footer>
      </template>
    </div>
  </main>
</template>

<style scoped>
.profile-page {
  --ink: #17324d;
  --muted: #52708a;
  --deep-green: #0f766e;
  --green: #0f9f88;
  --line: #e2e8e0;
  color: var(--ink);
  flex: 1;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 0;
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
}

.profile-rail {
  position: relative;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  width: 220px;
  padding: 1.25rem 0;
  border: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0;
  background: #171921;
  box-shadow: none;
}

.kicker {
  margin: 0;
  color: #82928a;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.09em;
}

.rail-nav {
  position: sticky;
  top: calc(var(--app-navbar-height, 70px) + 1.25rem);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.rail-link {
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

.rail-link:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
}

.rail-link.active {
  background: transparent;
  color: #10b981;
  font-weight: 600;
  box-shadow: none;
}

.rail-glyph {
  width: 1.25rem;
  color: #cbd5e1;
  font-size: 1.15rem;
  text-align: center;
  transition: color 0.18s ease;
}

.rail-link:hover .rail-glyph {
  color: #ffffff;
}

.rail-link.active .rail-glyph {
  color: #10b981;
}

.rail-switch-link {
  margin-top: 0.75rem;
  padding-top: 0.95rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: #fcd34d;
}

.profile-content {
  min-width: 0;
  width: 100%;
  max-width: 1200px;
  padding: 2rem 2.5rem 4rem;
}

.page-heading,
.profile-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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

.page-heading {
  margin: 8px 0 23px;
  align-items: flex-end;
}

.page-heading h1 {
  margin: 5px 0 4px;
  color: var(--ink);
  font-size: clamp(1.8rem, 3vw, 2.45rem);
  line-height: 1.1;
}

.heading-copy {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
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

.courses-only-wrapper {
  margin-top: 15px;
}

.profile-footer {
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  color: #84938b;
  font-size: 0.61rem;
}

.profile-footer span:first-child {
  font-weight: 850;
  letter-spacing: 0.08em;
}

.notice {
  padding: 11px 13px;
  border-radius: 7px;
  font-size: 0.76rem;
}

.error-notice {
  border: 1px solid #f0c9c1;
  background: #fff4f1;
  color: #9a483b;
}

.loading-state {
  display: grid;
  min-height: 320px;
  place-items: center;
  color: #71837d;
  font-size: 0.85rem;
}

@media (max-width: 900px) {
  .profile-page {
    grid-template-columns: 1fr;
    padding: 0;
  }
  .profile-rail {
    position: static;
    width: 100%;
    height: auto;
    padding: 0.5rem 1rem;
    border-right: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .rail-nav {
    position: static;
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    gap: 4px;
  }
  .rail-link {
    min-height: 38px;
    flex: 0 0 auto;
    gap: 6px;
    padding: 0 12px;
    font-size: 0.82rem;
  }
  .rail-link.active {
    box-shadow: inset 0 -2px #10b981;
  }
  .rail-glyph {
    width: auto;
  }
  .profile-content {
    padding: 1.5rem 1.25rem 3rem;
  }
  .page-heading {
    align-items: flex-start;
  }
  .heading-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .page-heading h1 {
    font-size: 1.7rem;
  }
  .heading-copy {
    max-width: 40ch;
    font-size: 0.79rem;
  }
  .signout-button {
    min-height: 36px;
    padding: 0 9px;
    font-size: 0.69rem;
  }
}

@media (max-width: 480px) {
  .page-heading {
    gap: 8px;
  }
  .page-heading h1 {
    font-size: 1.48rem;
  }
  .mode-indicator {
    min-height: 32px;
    font-size: 0.62rem;
  }
  .heading-copy {
    font-size: 0.72rem;
  }
  .signout-button {
    font-size: 0;
  }
  .signout-button span {
    font-size: 1rem;
  }
  .profile-footer {
    font-size: 0.55rem;
  }
}
</style>
