<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  courseTitle: {
    type: String,
    default: 'Loading Course...',
  },
  courseSlug: {
    type: String,
    required: true,
  },
  sidebarSections: {
    type: Array,
    default: () => [],
  },
  completedLessons: {
    type: Array,
    default: () => [],
  },
  courseBookmarkedLessons: {
    type: Array,
    default: () => [],
  },
  bookmarkedLessonIds: {
    type: Array,
    default: () => [],
  },
  activeSection: {
    type: String,
    default: '',
  },
  currentModuleTitle: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  loadError: {
    type: String,
    default: '',
  },
})

const expandedModules = ref([])

watch(
  () => props.currentModuleTitle,
  moduleTitle => {
    if (moduleTitle && !expandedModules.value.includes(moduleTitle)) {
      expandedModules.value.push(moduleTitle)
    }
  },
  { immediate: true }
)

const totalLessonsCount = computed(() =>
  props.sidebarSections.reduce((sum, mod) => sum + (mod.lessons?.length || 0), 0)
)

const courseOverallProgress = computed(() => {
  if (!totalLessonsCount.value) return 0
  return Math.round((props.completedLessons.length / totalLessonsCount.value) * 100)
})

const toggleModule = moduleTitle => {
  if (expandedModules.value.includes(moduleTitle)) {
    expandedModules.value = expandedModules.value.filter(m => m !== moduleTitle)
  } else {
    expandedModules.value.push(moduleTitle)
  }
}

const getModuleProgress = module => {
  if (!module.lessons || module.lessons.length === 0) return 0
  const completedInModule = module.lessons.filter(lesson =>
    props.completedLessons.includes(lesson.slug)
  ).length
  return Math.round((completedInModule / module.lessons.length) * 100)
}

const getCompletedLessonsCount = module => {
  if (!module.lessons) return 0
  return module.lessons.filter(lesson => props.completedLessons.includes(lesson.slug)).length
}

const isLessonBookmarked = lesson =>
  Boolean(lesson?._id && props.bookmarkedLessonIds.includes(String(lesson._id)))
</script>

<template>
  <aside class="learn-sidebar">
    <div class="sidebar-header-block">
      <RouterLink to="/courses" class="back-catalog-link">← All Courses</RouterLink>
      <h2 class="sidebar-title">{{ courseTitle || 'Loading Course...' }}</h2>
      <div v-if="totalLessonsCount" class="sidebar-overall-progress">
        <div class="sidebar-overall-row">
          <span>Course Progress</span>
          <strong>{{ courseOverallProgress }}% ({{ completedLessons.length }}/{{ totalLessonsCount }})</strong>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" :style="{ width: `${courseOverallProgress}%` }"></div>
        </div>
      </div>
    </div>

    <nav class="sidebar-nav timeline-nav">
      <template v-if="sidebarSections.length">
        <div v-if="courseBookmarkedLessons.length" class="sidebar-bookmarks-box">
          <div class="sidebar-bookmarks-title">
            <span>🔖 Saved Bookmarks ({{ courseBookmarkedLessons.length }})</span>
          </div>
          <div class="sidebar-bookmarks-list">
            <RouterLink
              v-for="savedLesson in courseBookmarkedLessons"
              :key="`saved-${savedLesson._id || savedLesson.slug}`"
              :to="`/learn/${courseSlug}/${savedLesson.slug}`"
              class="sidebar-bookmark-link"
              :class="{ active: savedLesson.slug === activeSection }"
            >
              <span>{{ savedLesson.title }}</span>
            </RouterLink>
          </div>
        </div>

        <section
          v-for="(module, index) in sidebarSections"
          :key="module._id || module.title"
          class="timeline-module"
        >
          <div class="timeline-track">
            <div
              class="timeline-node"
              :class="{
                completed: getModuleProgress(module) === 100,
                'in-progress': getModuleProgress(module) > 0 && getModuleProgress(module) < 100,
              }"
            ></div>
            <div v-if="index !== sidebarSections.length - 1" class="timeline-line"></div>
          </div>

          <div class="timeline-content">
            <button
              type="button"
              class="sidebar-module-toggle timeline-toggle"
              @click="toggleModule(module.title)"
            >
              <div class="module-info-wrapper">
                <span class="module-title-text">{{ module.title }}</span>
                <span class="timeline-meta">
                  {{ getModuleProgress(module) }}% • {{ getCompletedLessonsCount(module) }}/{{ module.lessons.length }} lessons
                </span>
              </div>
              <span class="toggle-icon" :class="{ rotated: expandedModules.includes(module.title) }">▼</span>
            </button>

            <div v-show="expandedModules.includes(module.title)" class="module-lessons">
              <RouterLink
                v-for="lesson in module.lessons"
                :key="lesson._id || lesson.slug"
                :to="`/learn/${courseSlug}/${lesson.slug}`"
                :class="{ active: lesson.slug === activeSection }"
              >
                <span class="lesson-link-content">
                  <span v-if="completedLessons.includes(lesson.slug)" class="done-check">✓</span>
                  <span v-else class="bullet-dot">○</span>
                  <span class="lesson-link-title">{{ lesson.title }}</span>
                  <span v-if="isLessonBookmarked(lesson)" class="bookmark-mini-badge" title="Bookmarked">🔖</span>
                </span>
              </RouterLink>
            </div>
          </div>
        </section>

        <div class="sidebar-final-review">
          <RouterLink
            :to="`/learn/${courseSlug}/final-review`"
            class="final-review-link"
            :class="{ active: activeSection === 'final-review' }"
          >
            🏆 Final Course Review
          </RouterLink>
        </div>
      </template>
      <p v-else class="sidebar-empty">{{ loading ? 'Loading data...' : loadError }}</p>
    </nav>
  </aside>
</template>

<style scoped>
.learn-sidebar {
  position: sticky;
  top: 20px;
  height: calc(100vh - 40px);
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  border: 1px solid #e2e8f0;
}

.sidebar-header-block {
  padding: 1.1rem 1.2rem;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
}

.back-catalog-link {
  display: inline-block;
  margin-bottom: 0.4rem;
  font-size: 0.76rem;
  font-weight: 700;
  color: #0f766e;
  text-decoration: none;
}

.back-catalog-link:hover {
  text-decoration: underline;
}

.sidebar-title {
  padding: 0;
  margin: 0 0 0.65rem;
  font-size: 1.1rem;
  font-weight: 800;
  color: #1e293b;
}

.sidebar-overall-progress {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.sidebar-overall-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.74rem;
  color: #64748b;
}

.sidebar-overall-row strong {
  color: #0f766e;
}

.progress-bar-track {
  width: 100%;
  height: 7px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #10b981, #34d399);
  transition: width 0.2s ease;
}

.sidebar-bookmarks-box {
  margin: 0.75rem 0.85rem;
  padding: 0.75rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
}

.sidebar-bookmarks-title {
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #92400e;
  margin-bottom: 0.45rem;
}

.sidebar-bookmarks-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sidebar-bookmark-link {
  display: block;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  font-size: 0.84rem;
  font-weight: 600;
  color: #78350f;
  text-decoration: none;
  transition: background 0.15s ease;
}

.sidebar-bookmark-link:hover,
.sidebar-bookmark-link.active {
  background: #fef3c7;
  color: #b45309;
  font-weight: 700;
}

.sidebar-module-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.2rem;
  background: #f1f5f9;
  border: none;
  border-bottom: 1px solid #e2e8f0;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  font-size: 0.85rem;
  text-align: left;
}

.sidebar-module-toggle:hover {
  background: #e2e8f0;
}

.module-info-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.module-title-text {
  font-weight: 700;
  color: #334155;
}

.timeline-meta {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 600;
}

.toggle-icon {
  font-size: 0.7rem;
  transition: transform 0.3s ease;
}

.toggle-icon.rotated {
  transform: rotate(180deg);
}

.module-lessons a {
  display: block;
  padding: 0.8rem 1.2rem 0.8rem 1.6rem;
  color: #475569;
  text-decoration: none;
  font-size: 0.92rem;
  border-left: 3px solid transparent;
}

.module-lessons a:hover {
  background: #f8fafc;
  color: #0f766e;
}

.module-lessons a.active {
  background: #f0fdfa;
  border-left-color: #0f766e;
  font-weight: 700;
  color: #0f766e;
}

.lesson-link-content {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.done-check {
  color: #10b981;
  font-weight: 800;
}

.bullet-dot {
  color: #94a3b8;
}

.lesson-link-title {
  flex: 1;
}

.bookmark-mini-badge {
  font-size: 0.78rem;
  line-height: 1;
}

.sidebar-final-review {
  display: block;
  margin: 1rem 1rem 0.75rem;
}

.final-review-link {
  display: block;
  padding: 0.9rem 1rem;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
  border-radius: 12px;
  font-weight: 800;
  text-align: center;
  text-decoration: none;
  box-shadow: 0 12px 24px rgba(217, 119, 6, 0.22);
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.final-review-link:hover {
  transform: translateY(-1px);
  opacity: 0.95;
}

.final-review-link.active {
  background: linear-gradient(135deg, #facc15, #ca8a04);
}

.sidebar-empty {
  padding: 1.2rem;
  color: #64748b;
  font-size: 0.9rem;
}
</style>
