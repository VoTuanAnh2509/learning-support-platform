<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api'

const route = useRoute()
const router = useRouter()

const courses = ref([])
const loading = ref(true)
const error = ref('')
const searchQuery = ref(String(route.query.q || ''))
const selectedSubject = ref('all')
const enrollmentsByCourseId = ref({})

const slugify = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const getCourseSlug = course => {
  const rawSlug = slugify(course?.title || course?.subject)
  return rawSlug.replace(/-tutorial$/, '') || rawSlug
}

const getCourseBadge = course => {
  const normalized = slugify(course?.title || course?.subject)
  if (normalized.includes('html')) return { text: '5', sub: 'HTML', tone: 'html' }
  if (normalized.includes('css')) return { text: '3', sub: 'CSS', tone: 'css' }
  if (normalized.includes('javascript') || normalized.includes('js')) return { text: 'JS', sub: '', tone: 'js' }
  const initials = String(course?.title || course?.subject || 'LS').trim().slice(0, 2).toUpperCase()
  return { text: initials, sub: '', tone: 'default' }
}

const getModuleCount = course => (Array.isArray(course?.modules) ? course.modules.length : 0)

const getLessonCount = course => {
  if (!Array.isArray(course?.modules)) return 0
  return course.modules.reduce(
    (sum, mod) => sum + (Array.isArray(mod.lessons) ? mod.lessons.length : 0),
    0
  )
}

const getEstimatedMinutes = course => {
  if (!Array.isArray(course?.modules)) return 0
  return course.modules.reduce((sum, mod) => {
    const lessons = Array.isArray(mod.lessons) ? mod.lessons : []
    return sum + lessons.reduce((lessonSum, lesson) => lessonSum + (Number(lesson.estimatedMinutes) || 10), 0)
  }, 0)
}

const getEnrollment = course => enrollmentsByCourseId.value[String(course?._id)] || null

const getCourseCompletion = course => {
  const enrollment = getEnrollment(course)
  if (!enrollment) return 0
  return Math.min(100, Math.max(0, Math.round(Number(enrollment.completionRate) || 0)))
}

const getCompletedLessonCount = course => {
  const enrollment = getEnrollment(course)
  if (!Array.isArray(enrollment?.completedLessons)) return 0
  return new Set(enrollment.completedLessons.map(id => String(id?._id || id))).size
}

const subjects = computed(() => {
  const set = new Set()
  courses.value.forEach(course => {
    if (course.subject) set.add(course.subject)
  })
  return ['all', ...Array.from(set)]
})

const filteredCourses = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return courses.value.filter(course => {
    const matchesSubject =
      selectedSubject.value === 'all' || course.subject === selectedSubject.value

    if (!matchesSubject) return false
    if (!q) return true

    const inTitle = (course.title || '').toLowerCase().includes(q)
    const inSubject = (course.subject || '').toLowerCase().includes(q)
    const inDesc = (course.description || '').toLowerCase().includes(q)
    const inTags = Array.isArray(course.tags) && course.tags.some(tag => String(tag).toLowerCase().includes(q))
    const inLessons =
      Array.isArray(course.modules) &&
      course.modules.some(
        mod =>
          (mod.title || '').toLowerCase().includes(q) ||
          (Array.isArray(mod.lessons) &&
            mod.lessons.some(lesson => (lesson.title || '').toLowerCase().includes(q)))
      )

    return inTitle || inSubject || inDesc || inTags || inLessons
  })
})

const openCourse = course => {
  const courseSlug = getCourseSlug(course)
  const enrollment = getEnrollment(course)
  if (enrollment?.lastLessonSlug) {
    router.push(`/learn/${courseSlug}/${enrollment.lastLessonSlug}`)
  } else {
    router.push(`/learn/${courseSlug}`)
  }
}

const clearFilters = () => {
  searchQuery.value = ''
  selectedSubject.value = 'all'
  if (route.query.q) {
    router.replace({ path: '/courses' })
  }
}

const loadCatalog = async () => {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/courses')
    courses.value = (Array.isArray(data) ? data : []).filter(course => course.isPublished !== false)

    const storedUser = sessionStorage.getItem('auth_user')
    const authUser = storedUser ? JSON.parse(storedUser) : null
    const userId = authUser?._id || authUser?.id || ''

    if (userId && sessionStorage.getItem('auth_token')) {
      try {
        const { data: userProfile } = await api.get(`/users/${userId}/profile`)
        const map = {}
        ;(userProfile?.enrolledCourses || []).forEach(entry => {
          const cId = String(entry.course?._id || entry.course || '')
          if (cId) map[cId] = entry
        })
        enrollmentsByCourseId.value = map
      } catch (_err) {
        enrollmentsByCourseId.value = {}
      }
    }
  } catch (err) {
    error.value = err?.response?.data?.error || 'Unable to load courses from the server.'
  } finally {
    loading.value = false
  }
}

watch(
  () => route.query.q,
  newQuery => {
    searchQuery.value = String(newQuery || '')
  }
)

onMounted(loadCatalog)
</script>

<template>
  <main class="catalog-page">
    <section class="catalog-hero">
      <div class="catalog-hero-copy">
        <p class="eyebrow">COURSE CATALOG</p>
        <h1>Explore Interactive Coding Courses</h1>
        <p class="hero-subtitle">
          Structured tutorials with step-by-step modules, live code playgrounds, practice quizzes, and automatic progress tracking.
        </p>
      </div>

      <div class="catalog-controls">
        <div class="catalog-search-box">
          <svg class="search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Filter courses or lessons (e.g., HTML, CSS, Flexbox)..."
            aria-label="Filter courses"
          />
        </div>

        <div v-if="subjects.length > 2" class="subject-pills">
          <button
            v-for="subject in subjects"
            :key="subject"
            type="button"
            class="subject-pill"
            :class="{ active: selectedSubject === subject }"
            @click="selectedSubject = subject"
          >
            {{ subject === 'all' ? 'All Topics' : subject }}
          </button>
        </div>
      </div>
    </section>

    <section class="catalog-body">
      <div v-if="loading" class="catalog-state">Loading course catalog...</div>
      <div v-else-if="error" class="catalog-state error-state" role="alert">{{ error }}</div>

      <div v-else-if="filteredCourses.length === 0" class="catalog-state empty-catalog">
        <h3>No matching courses found</h3>
        <p>We couldn't find any course matching "{{ searchQuery }}".</p>
        <button type="button" class="btn-reset-filter" @click="clearFilters">Show All Courses</button>
      </div>

      <div v-else class="catalog-grid">
        <article
          v-for="course in filteredCourses"
          :key="course._id"
          class="catalog-card"
          @click="openCourse(course)"
        >
          <div class="catalog-card-top">
            <div class="lang-badge-circle">
              <span class="lang-shield" :class="`shield-${getCourseBadge(course).tone}`">
                <small v-if="getCourseBadge(course).sub">{{ getCourseBadge(course).sub }}</small>
                <strong>{{ getCourseBadge(course).text }}</strong>
              </span>
            </div>
            <span class="subject-tag">{{ course.subject || 'Programming' }}</span>
          </div>

          <div class="catalog-card-content">
            <h2>{{ course.title }}</h2>
            <p class="course-desc">
              {{ course.description || 'Learn core concepts, practice with interactive examples, and test your knowledge.' }}
            </p>

            <div class="course-structure-metrics">
              <div class="metric-pill">
                <span class="metric-icon">📦</span>
                <span><strong>{{ getModuleCount(course) }}</strong> Modules</span>
              </div>
              <div class="metric-pill">
                <span class="metric-icon">📖</span>
                <span><strong>{{ getLessonCount(course) }}</strong> Lessons</span>
              </div>
              <div class="metric-pill">
                <span class="metric-icon">⏱</span>
                <span><strong>{{ getEstimatedMinutes(course) }}</strong> mins</span>
              </div>
            </div>
          </div>

          <div class="catalog-card-footer">
            <div class="catalog-progress-box">
              <div class="progress-label-row">
                <span>Learning Progress</span>
                <strong>
                  {{ getCourseCompletion(course) }}%
                  <small>({{ getCompletedLessonCount(course) }}/{{ getLessonCount(course) }} lessons)</small>
                </strong>
              </div>
              <div class="catalog-progress-track">
                <span :style="{ width: `${getCourseCompletion(course)}%` }"></span>
              </div>
            </div>

            <button type="button" class="btn-open-course" @click.stop="openCourse(course)">
              <span v-if="getCourseCompletion(course) === 100">Review Course ➔</span>
              <span v-else-if="getCourseCompletion(course) > 0 || getEnrollment(course)">Continue Learning ➔</span>
              <span v-else>Start Course ➔</span>
            </button>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.catalog-page {
  width: min(1240px, calc(100% - 2rem));
  margin: 0 auto;
  padding: 2rem 0 4rem;
  display: grid;
  gap: 2rem;
}

.catalog-hero {
  padding: 2.25rem;
  border-radius: 22px;
  background: linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%);
  border: 1px solid rgba(16, 185, 129, 0.22);
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.05);
  display: grid;
  gap: 1.5rem;
}

.eyebrow {
  margin: 0 0 0.4rem;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #0f766e;
}

.catalog-hero h1 {
  margin: 0;
  font-size: clamp(1.85rem, 3.2vw, 2.6rem);
  color: #0f172a;
  line-height: 1.15;
}

.hero-subtitle {
  margin: 0.6rem 0 0;
  max-width: 68ch;
  color: #475569;
  font-size: 1rem;
  line-height: 1.6;
}

.catalog-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.catalog-search-box {
  position: relative;
  flex: 1 1 320px;
  max-width: 520px;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 1rem;
  color: #64748b;
  pointer-events: none;
}

.catalog-search-box input {
  width: 100%;
  padding: 0.8rem 1rem 0.8rem 2.75rem;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.catalog-search-box input:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.14);
}

.subject-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.subject-pill {
  padding: 0.5rem 1rem;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
}

.subject-pill:hover {
  border-color: #10b981;
  color: #0f766e;
}

.subject-pill.active {
  background: #10b981;
  border-color: #10b981;
  color: #ffffff;
}

.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 1.5rem;
}

.catalog-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.75rem;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.catalog-card:hover {
  transform: translateY(-4px);
  border-color: rgba(16, 185, 129, 0.45);
  box-shadow: 0 18px 36px rgba(16, 185, 129, 0.12);
}

.catalog-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.lang-badge-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: grid;
  place-items: center;
}

.lang-shield {
  width: 38px;
  height: 42px;
  border-radius: 8px 8px 13px 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 800;
  line-height: 1;
}

.lang-shield small {
  font-size: 0.5rem;
  letter-spacing: 0.04em;
  margin-bottom: 1px;
}

.lang-shield strong {
  font-size: 1rem;
}

.shield-html {
  background: linear-gradient(135deg, #e34f26, #f06529);
}

.shield-css {
  background: linear-gradient(135deg, #264de4, #2965f1);
}

.shield-js {
  background: linear-gradient(135deg, #f7df1e, #eab308);
  color: #1e293b;
}

.shield-default {
  background: linear-gradient(135deg, #10b981, #0f766e);
}

.subject-tag {
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #047857;
  font-size: 0.78rem;
  font-weight: 700;
}

.catalog-card-content h2 {
  margin: 0 0 0.55rem;
  font-size: 1.35rem;
  color: #0f172a;
}

.course-desc {
  margin: 0 0 1.25rem;
  color: #475569;
  font-size: 0.92rem;
  line-height: 1.6;
}

.course-structure-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-bottom: 1.5rem;
}

.metric-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #334155;
  font-size: 0.82rem;
}

.metric-pill strong {
  color: #0f172a;
}

.catalog-card-footer {
  padding-top: 1.2rem;
  border-top: 1px solid #f1f5f9;
  display: grid;
  gap: 1rem;
}

.catalog-progress-box {
  display: grid;
  gap: 0.45rem;
}

.progress-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: #64748b;
}

.progress-label-row strong {
  color: #0f766e;
}

.progress-label-row small {
  color: #94a3b8;
  font-weight: 500;
  margin-left: 3px;
}

.catalog-progress-track {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}

.catalog-progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #10b981, #059669);
  transition: width 0.3s ease;
}

.btn-open-course {
  width: 100%;
  padding: 0.8rem 1.2rem;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #10b981, #0f766e);
  color: #ffffff;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
}

.btn-open-course:hover {
  opacity: 0.95;
  transform: translateY(-1px);
}

.catalog-state {
  padding: 3rem 1.5rem;
  text-align: center;
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  color: #475569;
}

.error-state {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.btn-reset-filter {
  margin-top: 0.75rem;
  padding: 0.65rem 1.2rem;
  border-radius: 999px;
  border: none;
  background: #10b981;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
}
</style>
