<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
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

const emit = defineEmits(['update-bookmarks'])

const router = useRouter()
const cardSort = ref('newest')
const togglingBookmarkId = ref('')

const enrolledCourses = computed(() => (props.profile?.enrolledCourses || []).filter(entry => entry.course))
const savedBookmarks = computed(() => props.profile?.bookmarkedLessons || [])

const formatFullDate = value =>
  value
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
    : 'Recently'

const slugify = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const courseProgress = course => Math.min(100, Math.max(0, Number(course?.completionRate) || 0))

const getCourseBadge = text => {
  const normalized = slugify(text)
  if (normalized.includes('html')) return { text: '5', sub: 'HTML', tone: 'html' }
  if (normalized.includes('css')) return { text: '3', sub: 'CSS', tone: 'css' }
  if (normalized.includes('javascript') || normalized.includes('js')) return { text: 'JS', sub: '', tone: 'js' }
  const initials = String(text || 'LS').trim().slice(0, 2).toUpperCase()
  return { text: initials, sub: '', tone: 'default' }
}

const unifiedLearningCards = computed(() => {
  const enrollmentByCourseId = new Map(
    enrolledCourses.value.map(entry => [String(entry.course?._id || entry.course), entry])
  )
  const cards = []
  const coursesWithBookmarks = new Set()

  for (const item of savedBookmarks.value) {
    const courseId = String(item.course?._id || item.course || '')
    const enrollment = enrollmentByCourseId.get(courseId)
    if (courseId) coursesWithBookmarks.add(courseId)

    const completedSet = new Set(
      (enrollment?.completedLessons || []).map(id => String(id?._id || id))
    )
    const isLessonDone =
      Boolean(item.lessonId && completedSet.has(String(item.lessonId))) ||
      courseProgress(enrollment) === 100

    const rawCourseSlug = item.courseSlug || slugify(item.courseTitle || enrollment?.course?.title)
    const cleanCourseSlug = rawCourseSlug.replace(/-tutorial$/, '') || rawCourseSlug
    const courseTitle = item.courseTitle || enrollment?.course?.title || 'Course'
    const shortCoursePrefix = courseTitle.replace(/\s*Tutorial$/i, '').trim()
    const displayLessonTitle =
      item.lessonTitle?.toLowerCase().startsWith(shortCoursePrefix.toLowerCase())
        ? item.lessonTitle.replace(new RegExp(`^${shortCoursePrefix}\\s*[-:]?\\s*`, 'i'), `${shortCoursePrefix} - `)
        : `${shortCoursePrefix} - ${item.lessonTitle}`

    cards.push({
      id: `bm-${item.lessonId}`,
      courseId,
      lessonId: String(item.lessonId || ''),
      moduleId: item.moduleId || null,
      moduleTitle: item.moduleTitle || '',
      isBookmarked: true,
      kicker: 'LESSON',
      title: displayLessonTitle,
      rawLessonTitle: item.lessonTitle,
      courseTitle,
      courseSlug: cleanCourseSlug,
      lessonSlug: item.lessonSlug || slugify(item.lessonTitle),
      isCompleted: isLessonDone,
      completionRate: courseProgress(enrollment),
      date: item.savedAt || enrollment?.lastAccessedAt || enrollment?.enrolledAt || new Date().toISOString(),
      badge: getCourseBadge(courseTitle || cleanCourseSlug),
    })
  }

  for (const enrollment of enrolledCourses.value) {
    const course = enrollment.course
    const courseId = String(course?._id || '')
    if (!courseId || coursesWithBookmarks.has(courseId)) continue

    const rawCourseSlug = slugify(course.title || course.subject)
    const cleanCourseSlug = rawCourseSlug.replace(/-tutorial$/, '') || rawCourseSlug
    const shortCoursePrefix = (course.title || 'Course').replace(/\s*Tutorial$/i, '').trim()
    const lastLessonTitle = enrollment.lastLessonTitle || `${shortCoursePrefix} Home`
    const displayTitle = lastLessonTitle.toLowerCase().startsWith(shortCoursePrefix.toLowerCase())
      ? lastLessonTitle.replace(new RegExp(`^${shortCoursePrefix}\\s*[-:]?\\s*`, 'i'), `${shortCoursePrefix} - `)
      : `${shortCoursePrefix} - ${lastLessonTitle}`

    cards.push({
      id: `course-${courseId}`,
      courseId,
      lessonId: enrollment.lastLessonId ? String(enrollment.lastLessonId) : '',
      moduleId: null,
      moduleTitle: '',
      isBookmarked: false,
      kicker: enrollment.lastLessonTitle ? 'LAST STUDIED' : 'COURSE',
      title: displayTitle,
      rawLessonTitle: lastLessonTitle,
      courseTitle: course.title,
      courseSlug: cleanCourseSlug,
      lessonSlug: enrollment.lastLessonSlug || '',
      isCompleted: courseProgress(enrollment) === 100,
      completionRate: courseProgress(enrollment),
      date: enrollment.lastAccessedAt || enrollment.enrolledAt || new Date().toISOString(),
      badge: getCourseBadge(course.title || course.subject),
    })
  }

  return cards.sort((a, b) => {
    if (cardSort.value === 'oldest') {
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    }
    if (cardSort.value === 'completed') {
      return Number(b.isCompleted) - Number(a.isCompleted) || b.completionRate - a.completionRate
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })
})

const openLearningCard = card => {
  if (card.lessonSlug) {
    router.push(`/learn/${card.courseSlug}/${card.lessonSlug}`)
  } else {
    router.push(`/learn/${card.courseSlug}`)
  }
}

const toggleCardBookmark = async card => {
  if (!card.courseId || !card.lessonId || togglingBookmarkId.value) return
  togglingBookmarkId.value = card.id
  try {
    const { data } = await api.post(`/users/${props.userId}/bookmarks`, {
      courseId: card.courseId,
      courseTitle: card.courseTitle,
      courseSlug: card.courseSlug,
      moduleId: card.moduleId,
      moduleTitle: card.moduleTitle,
      lessonId: card.lessonId,
      lessonTitle: card.rawLessonTitle || card.title,
      lessonSlug: card.lessonSlug,
    })
    emit('update-bookmarks', Array.isArray(data.bookmarkedLessons) ? data.bookmarkedLessons : [])
  } catch (_err) {
    // ignore
  } finally {
    togglingBookmarkId.value = ''
  }
}
</script>

<template>
  <section class="profile-panel courses-panel">
    <div class="section-heading compact-heading bookmarks-header-bar">
      <div>
        <p class="kicker">BOOKMARKS & ACTIVE COURSES</p>
        <h2>My courses & saved lessons</h2>
        <p class="panel-subcopy">Access your bookmarked lessons and continue right where you left off.</p>
      </div>
      <div class="bookmarks-header-controls">
        <select
          v-if="unifiedLearningCards.length > 1"
          v-model="cardSort"
          class="w3-sort-select"
          aria-label="Sort courses and bookmarks"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="completed">Completed</option>
        </select>
        <RouterLink class="text-link" to="/courses">Explore courses <span aria-hidden="true">→</span></RouterLink>
      </div>
    </div>

    <div v-if="unifiedLearningCards.length" class="w3-bookmark-grid">
      <article
        v-for="card in unifiedLearningCards"
        :key="card.id"
        class="w3-bookmark-card"
        tabindex="0"
        role="button"
        :aria-label="`Continue ${card.title}`"
        @click="openLearningCard(card)"
        @keydown.enter="openLearningCard(card)"
      >
        <div class="w3-card-top">
          <div class="w3-lang-circle">
            <span class="w3-lang-shield" :class="`shield-${card.badge.tone}`">
              <small v-if="card.badge.sub">{{ card.badge.sub }}</small>
              <strong>{{ card.badge.text }}</strong>
            </span>
          </div>

          <button
            v-if="card.lessonId"
            type="button"
            class="w3-ribbon-btn"
            :class="{ active: card.isBookmarked }"
            :disabled="togglingBookmarkId === card.id"
            :title="card.isBookmarked ? 'Remove bookmark' : 'Bookmark this lesson'"
            @click.stop="toggleCardBookmark(card)"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
            </svg>
          </button>
        </div>

        <div class="w3-card-body">
          <span class="w3-card-kicker">{{ card.kicker }}</span>
          <h3 class="w3-card-title">{{ card.title }}</h3>
          <p class="w3-card-subtitle">{{ card.courseTitle }}</p>

          <div class="w3-mini-progress" :title="`Course completion: ${card.completionRate}%`">
            <div class="w3-mini-track">
              <span :style="{ width: `${card.completionRate}%` }"></span>
            </div>
            <small>{{ card.completionRate }}% course progress</small>
          </div>
        </div>

        <div class="w3-card-footer">
          <span class="w3-status-pill" :class="{ completed: card.isCompleted }">
            <span class="status-dot-icon">{{ card.isCompleted ? '✓' : '●' }}</span>
            {{ card.isCompleted ? 'Completed' : 'In Progress' }}
          </span>
          <span class="w3-date-meta">
            <svg class="calendar-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {{ formatFullDate(card.date) }}
          </span>
        </div>
      </article>
    </div>

    <div v-else class="empty-state course-empty">
      <span class="empty-mark">🔖</span>
      <div>
        <strong>No courses or bookmarks yet</strong>
        <p>Bookmark any lesson while studying to add the course here and remember your exact spot.</p>
      </div>
      <RouterLink class="outline-link" to="/courses">Browse courses</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.profile-panel {
  border: 1px solid #e2e8e0;
  border-radius: 10px;
  background: #fff;
}

.courses-panel {
  padding: 20px;
}

.kicker {
  margin: 0;
  color: #82928a;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.09em;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.compact-heading h2 {
  margin: 4px 0 0;
  color: #17324d;
  font-size: 1.1rem;
}

.bookmarks-header-bar {
  align-items: flex-start;
  margin-bottom: 18px;
}

.panel-subcopy {
  margin: 4px 0 0;
  font-size: 0.84rem;
  color: #60726c;
}

.bookmarks-header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.text-link {
  color: #0f9f88;
  font-size: 0.72rem;
  font-weight: 750;
  white-space: nowrap;
}

.w3-sort-select {
  padding: 7px 28px 7px 12px;
  border-radius: 9px;
  border: 1px solid rgba(19, 34, 31, 0.14);
  background: #ffffff;
  color: #13221f;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  outline: none;
}

.w3-sort-select:focus {
  border-color: #10b981;
}

.w3-bookmark-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(265px, 1fr));
  gap: 16px;
}

.w3-bookmark-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fcf9 100%);
  border: 1px solid rgba(19, 34, 31, 0.1);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.w3-bookmark-card:hover {
  transform: translateY(-3px);
  border-color: rgba(16, 185, 129, 0.45);
  box-shadow: 0 14px 32px rgba(16, 185, 129, 0.12);
}

.w3-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 18px;
}

.w3-lang-circle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #f1f5f9;
  border: 1px solid rgba(15, 23, 42, 0.06);
  display: grid;
  place-items: center;
  box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.8);
}

.w3-lang-shield {
  width: 36px;
  height: 40px;
  border-radius: 7px 7px 12px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 800;
  line-height: 1;
}

.w3-lang-shield small {
  font-size: 0.48rem;
  letter-spacing: 0.04em;
  opacity: 0.92;
  margin-bottom: 1px;
}

.w3-lang-shield strong {
  font-size: 0.95rem;
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

.w3-ribbon-btn {
  background: transparent;
  border: none;
  padding: 4px;
  color: #cbd5e1;
  cursor: pointer;
  transition: transform 0.16s ease, color 0.16s ease;
}

.w3-ribbon-btn svg {
  width: 22px;
  height: 22px;
}

.w3-ribbon-btn.active {
  color: #10b981;
}

.w3-ribbon-btn:hover:not(:disabled) {
  transform: scale(1.12);
  color: #059669;
}

.w3-card-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-bottom: 16px;
}

.w3-card-kicker {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.w3-card-title {
  margin: 0;
  font-size: 1.12rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.3;
}

.w3-card-subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
}

.w3-mini-progress {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.w3-mini-track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}

.w3-mini-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #10b981, #34d399);
}

.w3-mini-progress small {
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 600;
}

.w3-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  font-size: 0.78rem;
}

.w3-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  color: #475569;
}

.w3-status-pill .status-dot-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  font-size: 0.68rem;
  background: #e2e8f0;
  color: #475569;
}

.w3-status-pill.completed {
  color: #047857;
}

.w3-status-pill.completed .status-dot-icon {
  background: #10b981;
  color: #ffffff;
}

.w3-date-meta {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #64748b;
  font-weight: 600;
}

.calendar-svg {
  width: 14px;
  height: 14px;
}

.empty-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 17px 0 4px;
}

.empty-mark {
  display: grid;
  width: 35px;
  height: 35px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 10px;
  background: #e8f2e5;
  color: #0f9f88;
  font-size: 1.2rem;
}

.empty-state strong {
  color: #17324d;
  font-size: 0.77rem;
}

.empty-state p {
  margin: 4px 0 0;
  color: #52708a;
  font-size: 0.68rem;
}

.outline-link {
  margin-left: auto;
  padding: 7px 9px;
  border: 1px solid #dce9df;
  border-radius: 6px;
  color: #0f766e;
  font-size: 0.68rem;
  font-weight: 750;
  white-space: nowrap;
}

@media (max-width: 480px) {
  .courses-panel {
    padding: 15px;
  }
  .empty-state {
    flex-wrap: wrap;
  }
  .outline-link {
    margin-left: 47px;
  }
}
</style>
