<script setup>
import LearnSidebar from '@/components/learn/LearnSidebar.vue'
import LessonVideoTab from '@/components/learn/LessonVideoTab.vue'
import LessonTheoryTab from '@/components/learn/LessonTheoryTab.vue'
import LessonQuizTab from '@/components/learn/LessonQuizTab.vue'
import AiChatWidget from '@/components/learn/AiChatWidget.vue'
import { useCourseLearning } from '@/composables/useCourseLearning'

const {
  courseSlug,
  loading,
  loadError,
  activeTab,
  completedLessons,
  savingBookmark,
  savingProgress,
  progressError,
  normalizedCourse,
  sidebarSections,
  activeSection,
  currentLesson,
  currentQuizzes,
  isCurrentLessonCompleted,
  isCurrentLessonBookmarked,
  courseBookmarkedLessons,
  bookmarkedLessonIds,
  previousLesson,
  nextLesson,
  getCurrentUserId,
  handleQuizCompleted,
  toggleLessonBookmark,
  goToPreviousLesson,
  goToNextLesson,
} = useCourseLearning()
</script>

<template>
  <main class="learn-course-page">
    <LearnSidebar
      :courseTitle="normalizedCourse?.title"
      :courseSlug="courseSlug"
      :sidebarSections="sidebarSections"
      :completedLessons="completedLessons"
      :courseBookmarkedLessons="courseBookmarkedLessons"
      :bookmarkedLessonIds="bookmarkedLessonIds"
      :activeSection="activeSection"
      :currentModuleTitle="currentLesson?.moduleTitle || ''"
      :loading="loading"
      :loadError="loadError"
    />

    <section class="learn-content">
      <article v-if="currentLesson" class="content-section">
        <p v-if="progressError" class="progress-error" role="alert">{{ progressError }}</p>

        <div class="lesson-header">
          <div class="lesson-top-meta">
            <div class="lesson-breadcrumb-group">
              <p class="lesson-module">{{ currentLesson.moduleTitle }}</p>
              <span
                v-if="currentLesson._id !== 'final-review'"
                class="lesson-status-pill"
                :class="{
                  done: isCurrentLessonCompleted,
                  quiz: !isCurrentLessonCompleted && currentQuizzes.length > 0,
                }"
              >
                <template v-if="isCurrentLessonCompleted">✓ Completed</template>
                <template v-else-if="currentQuizzes.length > 0">
                  🎯 Quiz Required ({{ currentQuizzes.length }})
                </template>
                <template v-else>● Reading Lesson</template>
              </span>
            </div>

            <button
              v-if="currentLesson._id !== 'final-review'"
              type="button"
              class="bookmark-btn"
              :class="{ bookmarked: isCurrentLessonBookmarked }"
              :disabled="savingBookmark"
              :title="isCurrentLessonBookmarked ? 'Remove bookmark' : 'Bookmark this lesson for later'"
              @click="toggleLessonBookmark"
            >
              <svg
                class="bookmark-svg"
                viewBox="0 0 24 24"
                :fill="isCurrentLessonBookmarked ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              <span>{{
                savingBookmark ? 'Saving...' : isCurrentLessonBookmarked ? 'Saved' : 'Bookmark'
              }}</span>
            </button>
          </div>

          <h1>{{ currentLesson.title }}</h1>

          <div class="tabs-container">
            <button
              v-if="currentLesson.videoUrl"
              type="button"
              class="tab-btn"
              :class="{ active: activeTab === 'video' }"
              @click="activeTab = 'video'"
            >
              📹 Video Lecture
            </button>

            <button
              type="button"
              class="tab-btn"
              :class="{ active: activeTab === 'theory' }"
              @click="activeTab = 'theory'"
            >
              📖 Reading Material
            </button>

            <button
              type="button"
              class="tab-btn"
              :class="{ active: activeTab === 'quiz' }"
              @click="activeTab = 'quiz'"
            >
              🎯 Practice Quiz ({{ currentQuizzes.length }})
              <span v-if="isCurrentLessonCompleted && currentQuizzes.length > 0" class="tab-done-tick">✓</span>
            </button>
          </div>
        </div>

        <LessonVideoTab
          v-if="activeTab === 'video' && currentLesson.videoUrl"
          :lesson="currentLesson"
          @continue-reading="activeTab = 'theory'"
        />

        <LessonTheoryTab
          v-else-if="activeTab === 'theory'"
          :lesson="currentLesson"
          :courseSubject="normalizedCourse?.subject || normalizedCourse?.title || 'Programming'"
          :userId="getCurrentUserId()"
          :isCompleted="isCurrentLessonCompleted"
          @open-quiz="activeTab = 'quiz'"
        />

        <LessonQuizTab
          v-if="activeTab === 'quiz'"
          :lesson="currentLesson"
          :courseId="normalizedCourse?._id || ''"
          :userId="getCurrentUserId()"
          :nextLessonTitle="nextLesson?.title || ''"
          :isFinalReview="activeSection === 'final-review'"
          @quiz-completed="handleQuizCompleted"
          @continue-next="goToNextLesson"
        />

        <!-- THANH ĐIỀU HƯỚNG BÀI HỌC (PREVIOUS / NEXT & COMPLETE) -->
        <footer class="lesson-nav-footer">
          <button
            type="button"
            class="nav-step-btn prev-step-btn"
            :disabled="!previousLesson"
            @click="goToPreviousLesson"
          >
            <span class="nav-step-arrow">❮</span>
            <span class="nav-step-copy">
              <small>Previous</small>
              <strong>{{ previousLesson ? previousLesson.title : 'First Lesson' }}</strong>
            </span>
          </button>

          <button
            v-if="activeSection !== 'final-review'"
            type="button"
            class="nav-step-btn next-step-btn"
            :disabled="savingProgress"
            @click="goToNextLesson"
          >
            <span class="nav-step-copy align-right">
              <small>
                <template v-if="savingProgress">Saving Progress...</template>
                <template v-else-if="!isCurrentLessonCompleted && currentQuizzes.length > 0">
                  Quiz Required • Next & Complete
                </template>
                <template v-else-if="isCurrentLessonCompleted">
                  {{ nextLesson ? 'Completed • Next Lesson' : 'Completed • Finish Course' }}
                </template>
                <template v-else>
                  {{ nextLesson ? 'Next & Complete' : 'Finish Course' }}
                </template>
              </small>
              <strong>{{ nextLesson ? nextLesson.title : 'Final Course Review 🏆' }}</strong>
            </span>
            <span class="nav-step-arrow">❯</span>
          </button>
        </footer>
      </article>

      <article v-else class="content-section">
        <h1>{{ loading ? 'Loading Content...' : 'Course Content' }}</h1>
        <p>{{ loadError || 'Đang chờ dữ liệu từ database.' }}</p>
      </article>
    </section>

    <AiChatWidget
      :userId="getCurrentUserId()"
      :subject="normalizedCourse?.subject || normalizedCourse?.title || 'Programming'"
      :lessonTitle="currentLesson?.title || 'this course'"
    />
  </main>
</template>

<style scoped>
.learn-course-page {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
  min-height: calc(100vh - 80px);
  background-color: #f8fafc;
}

.content-section {
  background: #ffffff;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
}

.progress-error {
  color: #f87171;
  margin: 0 0 1rem;
}

.lesson-top-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.lesson-breadcrumb-group {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.lesson-module {
  color: #475569;
  font-weight: 800;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.lesson-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
}

.lesson-status-pill.done {
  background: #ecfdf5;
  color: #047857;
  border-color: #a7f3d0;
}

.lesson-status-pill.quiz {
  background: #fffbeb;
  color: #b45309;
  border-color: #fde68a;
}

.bookmark-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.95rem;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #475569;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
}

.bookmark-btn:hover:not(:disabled) {
  border-color: #f59e0b;
  color: #b45309;
  background: #fffbeb;
  transform: translateY(-1px);
}

.bookmark-btn.bookmarked {
  border-color: #f59e0b;
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  color: #92400e;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
}

.bookmark-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.bookmark-svg {
  width: 16px;
  height: 16px;
}

.lesson-header h1 {
  margin: 0 0 1.5rem 0;
  color: #0f172a;
  font-size: 2.2rem;
  font-weight: 800;
}

.tabs-container {
  display: flex;
  gap: 1rem;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.tab-btn {
  background: none;
  border: none;
  padding: 0.75rem 1.5rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #0f766e;
}

.tab-btn.active {
  color: #0f766e;
  border-bottom-color: #0f766e;
}

.tab-done-tick {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  margin-left: 0.35rem;
  border-radius: 50%;
  background: #10b981;
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 800;
}

.lesson-nav-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: 2.5rem;
  padding-top: 1.5rem;
  border-top: 2px solid #e2e8f0;
  flex-wrap: wrap;
}

.nav-step-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.8rem 1.25rem;
  border-radius: 12px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  cursor: pointer;
  transition: all 0.18s ease;
  min-width: 190px;
  max-width: 280px;
}

.nav-step-btn:hover:not(:disabled) {
  border-color: #0f766e;
  background: #f0fdfa;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(15, 118, 110, 0.1);
}

.nav-step-btn.next-step-btn {
  background: linear-gradient(135deg, #10b981, #0f766e);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(16, 185, 129, 0.24);
}

.nav-step-btn.next-step-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669, #0d9488);
  box-shadow: 0 10px 24px rgba(16, 185, 129, 0.32);
}

.nav-step-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.nav-step-arrow {
  font-size: 1.1rem;
  font-weight: 800;
}

.nav-step-copy {
  display: flex;
  flex-direction: column;
  text-align: left;
  overflow: hidden;
}

.nav-step-copy.align-right {
  text-align: right;
  flex: 1;
}

.nav-step-copy small {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.85;
}

.nav-step-copy strong {
  font-size: 0.95rem;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 900px) {
  .learn-course-page {
    grid-template-columns: 1fr;
  }
}
</style>
