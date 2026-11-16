<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked';
import api from '@/services/api'

const route = useRoute()
const router = useRouter()

// 1. DYNAMIC STATES: Tự động lấy tên môn học từ URL
const courseSlug = computed(() => route.params.courseSlug)
const courseData = ref(null)
const loading = ref(true)
const loadError = ref('')

// 2. UI STATES: Quản lý Tab & Accordion Sidebar
const activeTab = ref('theory')
const expandedModules = ref([]) // Lưu danh sách các Module đang được mở ở Sidebar

// 3. QUIZ STATES (Giữ nguyên logic cũ của cậu)
const quizDeck = ref([])
const currentQuizIndex = ref(0)
const selectedQuizAnswer = ref(null)
const quizSubmitted = ref(false)
const quizScore = ref(0)
const progressError = ref('')
const savingProgress = ref(false)
let quizAdvanceTimer = null

// 4. COMPLETION & BOOKMARK STATES: Theo dõi bài học đã hoàn thành, tiến độ module và bài học đã lưu
const completedLessons = ref([])
const bookmarkedLessons = ref([])
const savingBookmark = ref(false)

const isLessonCompleted = lesson => Boolean(lesson?.slug && completedLessons.value.includes(lesson.slug))
const isLessonBookmarked = lesson =>
  Boolean(
    lesson?._id &&
      lesson._id !== 'final-review' &&
      bookmarkedLessons.value.some(
        item =>
          String(item.lessonId) === String(lesson._id) ||
          (item.lessonSlug === lesson.slug && String(item.course) === String(normalizedCourse.value?._id))
      )
  )
const getCurrentUserId = () => {
  const storedUser = sessionStorage.getItem('auth_user')
  if (!storedUser) return ''

  const user = JSON.parse(storedUser)
  return user?._id || user?.id || ''
}

const getCurrentLessonProgressPayload = () => {
  const lesson = currentLesson.value
  const course = normalizedCourse.value
  const userId = getCurrentUserId()

  if (!userId || !course?._id || !lesson?.moduleId || !lesson?._id || lesson._id === 'final-review') {
    throw new Error('Unable to identify the signed-in user, course, module, or lesson.')
  }

  return {
    userId,
    courseId: course._id,
    moduleId: lesson.moduleId,
    lessonId: lesson._id
  }
}

const getQuizResultPayload = () => {
  const lesson = currentLesson.value
  const course = normalizedCourse.value
  const userId = getCurrentUserId()

  if (!userId || !course?._id) {
    throw new Error('Unable to identify the signed-in user or course.')
  }

  if (lesson?._id === 'final-review') {
    return { userId, courseId: course._id }
  }

  return getCurrentLessonProgressPayload()
}

const markLessonAsCompleted = async ({ quizResultSaved = false } = {}) => {
  const lesson = currentLesson.value
  if (!lesson?.slug) return

  progressError.value = ''
  savingProgress.value = true
  try {
    if (!quizResultSaved) {
      const { userId, courseId, moduleId, lessonId } = getCurrentLessonProgressPayload()
      // THÊM: Truyền thêm trạng thái completed để BE ghi nhận tỷ lệ
      await api.post(`/users/${userId}/progress`, {
        courseId,
        moduleId,
        lessonId,
        status: 'completed'
      })
    }
    if (!completedLessons.value.includes(lesson.slug)) {
      completedLessons.value.push(lesson.slug)
    }
  } catch (error) {
    progressError.value = error?.response?.data?.error || error.message || 'Unable to save lesson progress.'
  } finally {
    savingProgress.value = false
  }
}


const getEmbedUrl = (url) => {
  if (!url) return ''
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11)
    ? `https://www.youtube.com/embed/${match[2]}`
    : url
}

// Hàm tính % hoàn thành module (Giữ nguyên)
const getModuleProgress = (module) => {
  if (!module.lessons || module.lessons.length === 0) return 0
  const completedInModule = module.lessons.filter(lesson =>
    completedLessons.value.includes(lesson.slug)
  ).length
  return Math.round((completedInModule / module.lessons.length) * 100)
}

// THÊM HÀM NÀY: Để hiển thị dạng "2/5 lessons"
const getCompletedLessonsCount = (module) => {
  if (!module.lessons) return 0
  return module.lessons.filter(lesson => completedLessons.value.includes(lesson.slug)).length
}

// Hàm tiện ích
const slugify = value =>
  String(value || '').trim().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const buildLessonSlug = lessonTitle => slugify(lessonTitle) || 'home'

// ==============================================================
// XỬ LÝ DỮ LIỆU KHÓA HỌC (Chuẩn hóa data từ API)
// ==============================================================
const normalizedCourse = computed(() => {
  const course = courseData.value
  if (!course) return null

  const modules = Array.isArray(course.modules) ? [...course.modules].sort((l, r) => (l.order || 0) - (r.order || 0)) : []
  const lessons = modules.flatMap(module => {
    const sortedLessons = Array.isArray(module.lessons) ? [...module.lessons].sort((l, r) => (l.order || 0) - (r.order || 0)) : []
    return sortedLessons.map(lesson => ({
      ...lesson,
      moduleId: module._id,
      moduleTitle: module.title,
      slug: buildLessonSlug(lesson.title),
    }))
  })
  return { ...course, modules, lessons }
})

const sidebarSections = computed(() => {
  const lessons = normalizedCourse.value?.lessons || []
  const modules = normalizedCourse.value?.modules || []
  return modules.map(module => ({
    ...module,
    lessons: lessons.filter(lesson => lesson.moduleTitle === module.title),
  }))
})

const sidebarLessons = computed(() => sidebarSections.value.flatMap(section => section.lessons))
const activeSection = computed(() => route.params.sectionSlug || sidebarLessons.value[0]?.slug)

const allCourseQuizzes = computed(() => {
  return normalizedCourse.value?.lessons.flatMap(lesson => Array.isArray(lesson.quizzes) ? lesson.quizzes : []) || []
})

const currentLesson = computed(() => {
  if (activeSection.value === 'final-review') {
    return {
      _id: 'final-review',
      title: 'Final Course Review',
      moduleTitle: 'Final Review',
      overview: 'Ready for the final challenge?',
      content: '<p>Practice with all the quizzes collected from the entire course.</p>',
      quizzes: allCourseQuizzes.value
    }
  }

  const lessons = sidebarLessons.value
  return lessons.find(lesson => lesson.slug === activeSection.value) || lessons[0] || null
})

const isCurrentLessonCompleted = computed(() => isLessonCompleted(currentLesson.value))
const isCurrentLessonBookmarked = computed(() => isLessonBookmarked(currentLesson.value))
const courseBookmarkedLessons = computed(() =>
  sidebarLessons.value.filter(lesson => isLessonBookmarked(lesson))
)

const currentLessonIndex = computed(() =>
  sidebarLessons.value.findIndex(lesson => lesson.slug === currentLesson.value?.slug)
)

const previousLesson = computed(() => {
  if (activeSection.value === 'final-review') {
    return sidebarLessons.value[sidebarLessons.value.length - 1] || null
  }
  if (currentLessonIndex.value > 0) {
    return sidebarLessons.value[currentLessonIndex.value - 1]
  }
  return null
})

const nextLesson = computed(() => {
  if (activeSection.value === 'final-review') return null
  if (currentLessonIndex.value >= 0 && currentLessonIndex.value < sidebarLessons.value.length - 1) {
    return sidebarLessons.value[currentLessonIndex.value + 1]
  }
  return null
})

const toggleLessonBookmark = async () => {
  const lesson = currentLesson.value
  const course = normalizedCourse.value
  const userId = getCurrentUserId()

  if (!userId || !course?._id || !lesson?._id || lesson._id === 'final-review' || savingBookmark.value) {
    return
  }

  savingBookmark.value = true
  progressError.value = ''
  try {
    const { data } = await api.post(`/users/${userId}/bookmarks`, {
      courseId: course._id,
      courseTitle: course.title,
      courseSlug: courseSlug.value,
      moduleId: lesson.moduleId,
      moduleTitle: lesson.moduleTitle,
      lessonId: lesson._id,
      lessonTitle: lesson.title,
      lessonSlug: lesson.slug,
    })
    bookmarkedLessons.value = Array.isArray(data.bookmarkedLessons) ? data.bookmarkedLessons : []
  } catch (error) {
    progressError.value = error?.response?.data?.error || error.message || 'Unable to update bookmark.'
  } finally {
    savingBookmark.value = false
  }
}

const goToPreviousLesson = () => {
  if (!previousLesson.value) return
  router.push(`/learn/${courseSlug.value}/${previousLesson.value.slug}`)
}

const goToNextLesson = async () => {
  if (savingProgress.value) return

  // Tự động đánh dấu hoàn thành bài học hiện tại trước khi chuyển sang bài tiếp theo
  if (currentLesson.value && currentLesson.value._id !== 'final-review' && !isCurrentLessonCompleted.value) {
    await markLessonAsCompleted()
  }

  if (nextLesson.value) {
    router.push(`/learn/${courseSlug.value}/${nextLesson.value.slug}`)
  } else if (activeSection.value !== 'final-review') {
    router.push(`/learn/${courseSlug.value}/final-review`)
  }
}

const toggleModule = (moduleTitle) => {
  if (expandedModules.value.includes(moduleTitle)) {
    expandedModules.value = expandedModules.value.filter(m => m !== moduleTitle)
  } else {
    expandedModules.value.push(moduleTitle)
  }
}

// ==============================================================
// XỬ LÝ QUIZ (Logic xáo trộn mảng của cậu)
// ==============================================================
const currentQuizzes = computed(() => currentLesson.value?.quizzes || [])
const currentCodeExamples = computed(() => currentLesson.value?.codeExamples || [])
const currentCodeExplanations = computed(() => currentLesson.value?.codeExplanations || [])

// ==============================================================
// TRẠNG THÁI "TRY IT YOURSELF" (LIVE CODE EDITOR)
// ==============================================================
// Lưu trạng thái Đóng/Mở editor cho từng đoạn code (theo index)
// TRẠNG THÁI "TRY IT YOURSELF" (LIVE CODE EDITOR)
const activeEditors = ref({})
const editableCodes = ref({})
// Thêm 2 state mới để quản lý AI Feedback cho từng editor
const editorFeedbacks = ref({})
const isEditorReviewing = ref({})

const openLiveEditor = (index, originalCode) => {
  activeEditors.value[index] = true
  editableCodes.value[index] = originalCode
  // Xóa feedback cũ khi mở lại
  editorFeedbacks.value[index] = null
}

const closeLiveEditor = (index) => {
  activeEditors.value[index] = false
}

// Hàm gửi code lên AI để review
const submitCodeForReview = async (index) => {
  const code = editableCodes.value[index]
  if (!code || isEditorReviewing.value[index]) return

  isEditorReviewing.value[index] = true
  editorFeedbacks.value[index] = null

  try {
    const userId = getCurrentUserId()
    const subject = normalizedCourse.value?.subject || normalizedCourse.value?.title || 'Programming'

    const response = await api.post('/ai/feedback', {
      userId,
      submittedAnswer: code,
      subject
    })

    editorFeedbacks.value[index] = response.data.feedback
  } catch (error) {
    editorFeedbacks.value[index] = 'Sorry, unable to get AI feedback at this time.'
  } finally {
    isEditorReviewing.value[index] = false
  }
}

// Khi đổi bài học, tự động đóng toàn bộ các Live Editor đang mở
watch(currentLesson, () => {
  activeEditors.value = {}
  editableCodes.value = {}
})
const shuffleArray = items => {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const buildQuizDeck = quizzes =>
  shuffleArray(quizzes).map(quiz => {
    const shuffledOptions = shuffleArray(quiz.options || [])
    const correctAnswerText = quiz.options?.[quiz.answerIndex]
    return {
      ...quiz,
      quizKey: quiz._id || quiz.question,
      shuffledOptions,
      shuffledAnswerIndex: shuffledOptions.indexOf(correctAnswerText),
    }
  })

const clearQuizAdvanceTimer = () => { if (quizAdvanceTimer) { clearTimeout(quizAdvanceTimer); quizAdvanceTimer = null } }
const resetQuizState = () => { clearQuizAdvanceTimer(); quizDeck.value = []; currentQuizIndex.value = 0; selectedQuizAnswer.value = null; quizSubmitted.value = false; quizScore.value = 0 }
const initializeQuizState = () => { clearQuizAdvanceTimer(); quizDeck.value = buildQuizDeck(Array.isArray(currentQuizzes.value) ? currentQuizzes.value : []); currentQuizIndex.value = 0; selectedQuizAnswer.value = null; quizSubmitted.value = false; quizScore.value = 0 }

// Khi bài học thay đổi, ưu tiên mở Tab Video nếu có link, ngược lại mở Tab Theory
watch(currentLesson, (newLesson) => {
  if (newLesson) {
    activeTab.value = newLesson.videoUrl ? 'video' : 'theory'
    initializeQuizState()

    if (!expandedModules.value.includes(newLesson.moduleTitle)) {
      expandedModules.value.push(newLesson.moduleTitle)
    }
  } else {
    resetQuizState()
  }
}, { immediate: true })

onBeforeUnmount(() => clearQuizAdvanceTimer())

const currentQuiz = computed(() => quizDeck.value[currentQuizIndex.value] || null)
const quizCompleted = computed(() => quizDeck.value.length > 0 && currentQuizIndex.value >= quizDeck.value.length)
const isQuizCorrect = computed(() => currentQuiz.value ? selectedQuizAnswer.value === currentQuiz.value.shuffledAnswerIndex : false)

const selectCurrentQuizAnswer = index => { if (!quizSubmitted.value) selectedQuizAnswer.value = index }

// Thay thế hàm submitQuiz cũ
const submitQuiz = () => {
  progressError.value = ''
  if (quizSubmitted.value || selectedQuizAnswer.value === null || !currentQuiz.value) return
  quizSubmitted.value = true

  if (selectedQuizAnswer.value === currentQuiz.value.shuffledAnswerIndex) {
    quizScore.value += 1
  }
  // Đã XÓA phần setTimeout tự động chuyển câu ở đây
}

// Thêm hàm bấm chuyển câu thủ công
const nextQuestion = async () => {
  // 1. Nếu chưa đến câu cuối cùng -> Chỉ chuyển câu
  if (currentQuizIndex.value < quizDeck.value.length - 1) {
    currentQuizIndex.value += 1
    selectedQuizAnswer.value = null
    quizSubmitted.value = false
  }
  // 2. Nếu đã làm xong câu cuối cùng
  else {
    progressError.value = ''

    savingProgress.value = true
    try {
      const { userId, courseId, moduleId, lessonId } = getQuizResultPayload()

      await api.post(`/users/${userId}/quiz-results`, {
        courseId,
        moduleId,
        lessonId,
        correctAnswers: quizScore.value,
        totalQuestions: quizDeck.value.length,
      })
      if (currentLesson.value?._id !== 'final-review') {
        await markLessonAsCompleted({ quizResultSaved: true })
      }

      if (!progressError.value) currentQuizIndex.value = quizDeck.value.length
    } catch (error) {
      progressError.value = error?.response?.data?.error || error.message || 'Unable to save quiz results.'
    } finally {
      savingProgress.value = false
    }
  }
}

// ==============================================================
// GỌI API THEO DYNAMIC ROUTING
// ==============================================================
const loadCourse = async () => {
  loading.value = true
  loadError.value = ''
  progressError.value = ''
  completedLessons.value = []
  try {
    const response = await api.get('/courses')
    const courses = Array.isArray(response.data) ? response.data : []

    // Tìm khóa học trùng với courseSlug trên URL (Ưu tiên khớp theo title trước để tránh trùng subject "Web Development")
    const targetSlug = slugify(courseSlug.value)
    const matchedCourse =
      courses.find(course => {
        const titleSlug = slugify(course.title)
        return (
          String(course._id) === courseSlug.value ||
          titleSlug === targetSlug ||
          titleSlug.replace(/-tutorial$/, '') === targetSlug
        )
      }) ||
      courses.find(course => {
        const titleSlug = slugify(course.title)
        const shortTitleSlug = titleSlug.replace(/-tutorial$/, '')
        return titleSlug.includes(targetSlug) || (shortTitleSlug && targetSlug.includes(shortTitleSlug))
      }) ||
      courses.find(course => slugify(course.subject) === targetSlug || slugify(course.subject).includes(targetSlug))

    if (!matchedCourse) {
      loadError.value = `Không tìm thấy khóa học cho mã: ${courseSlug.value.toUpperCase()}`
      courseData.value = null
      return
    }
    courseData.value = matchedCourse

    try {
      const userId = getCurrentUserId()
      if (!userId) {
        throw new Error('Unable to identify the signed-in user.')
      }

      const { data: user } = await api.get(`/users/${userId}/profile`)
      const enrollment = user.enrolledCourses?.find(entry =>
        String(entry.course?._id || entry.course) === String(matchedCourse._id)
      )
      const completedLessonIds = new Set(
        (enrollment?.completedLessons || []).map(lessonId => String(lessonId?._id || lessonId))
      )
      completedLessons.value = (normalizedCourse.value?.lessons || [])
        .filter(lesson => completedLessonIds.has(String(lesson._id)))
        .map(lesson => lesson.slug)
      bookmarkedLessons.value = Array.isArray(user.bookmarkedLessons) ? user.bookmarkedLessons : []
    } catch (error) {
      progressError.value = error?.response?.data?.error || error.message || 'Unable to load saved lesson progress.'
    }

    // Nếu đường dẫn chưa có bài học, tự động redirect vào bài đầu tiên
    if (!route.params.sectionSlug && sidebarLessons.value.length > 0) {
      router.replace(`/learn/${courseSlug.value}/${sidebarLessons.value[0].slug}`)
    }
  } catch (e) {
    loadError.value = 'Không tải được dữ liệu khóa học từ hệ thống.'
    courseData.value = null
  } finally {
    loading.value = false
  }
}

// Chạy hàm loadCourse khi vào component, và khi đổi môn học (Từ HTML sang CSS)
onMounted(() => {
  loadCourse()
})
watch(courseSlug, (newSlug, oldSlug) => { if (newSlug !== oldSlug) loadCourse() })

// ==============================================================
// 5. AI CHATBOT STATES & METHODS
// ==============================================================
const isChatOpen = ref(false)
const chatInput = ref('')
const chatMessages = ref([
  { role: 'assistant', text: 'Hi there! I am your AI learning assistant. Ask me anything about this lesson!' }
])
const isChatLoading = ref(false)
const chatMessagesContainer = ref(null)


const toggleChat = () => {
  isChatOpen.value = !isChatOpen.value
  if (isChatOpen.value) {
    scrollToChatBottom()
  }
}

const scrollToChatBottom = async () => {
  await nextTick()
  if (chatMessagesContainer.value) {
    chatMessagesContainer.value.scrollTop = chatMessagesContainer.value.scrollHeight
  }
}

const sendMessage = async () => {
  if (!chatInput.value.trim() || isChatLoading.value) return

  const question = chatInput.value.trim()
  chatInput.value = ''

  chatMessages.value.push({ role: 'user', text: question })
  scrollToChatBottom()
  isChatLoading.value = true

  try {
    const userId = getCurrentUserId()
    const subject = normalizedCourse.value?.subject || normalizedCourse.value?.title || 'Programming'
    const lessonTitle = currentLesson.value?.title || 'General'

    const response = await api.post('/ai/chat', {
      userId,
      question,
      subject,
      lesson: lessonTitle
    })

    chatMessages.value.push({ role: 'assistant', text: response.data.answer })
  } catch (error) {
    chatMessages.value.push({
      role: 'assistant',
      text: 'Sorry, I encountered an error connecting to the server. Please try again.',
      isError: true
    })
  } finally {
    isChatLoading.value = false
    scrollToChatBottom()
  }
}

const renderMarkdown = (text) => {
  if (!text) return '';
  return marked(text);
}

</script>

<template>
  <main class="learn-course-page">
    <aside class="learn-sidebar">
      <h2 class="sidebar-title">{{ normalizedCourse?.title || 'Loading Course...' }}</h2>

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

          <section v-for="(module, index) in sidebarSections" :key="module._id || module.title" class="timeline-module">

            <div class="timeline-track">
              <div class="timeline-node" :class="{
                'completed': getModuleProgress(module) === 100,
                'in-progress': getModuleProgress(module) > 0 && getModuleProgress(module) < 100
              }">
              </div>
              <div class="timeline-line" v-if="index !== sidebarSections.length - 1"></div>
            </div>

            <div class="timeline-content">
              <button class="sidebar-module-toggle timeline-toggle" @click="toggleModule(module.title)">
                <div class="module-info-wrapper">
                  <span class="module-title-text">{{ module.title }}</span>
                  <span class="timeline-meta">
                    {{ getModuleProgress(module) }}% • {{ getCompletedLessonsCount(module) }}/{{ module.lessons.length
                    }} lessons
                  </span>
                </div>
                <span class="toggle-icon" :class="{ rotated: expandedModules.includes(module.title) }">▼</span>
              </button>

              <div v-show="expandedModules.includes(module.title)" class="module-lessons">
                <RouterLink v-for="lesson in module.lessons" :key="lesson._id || lesson.slug"
                  :to="`/learn/${courseSlug}/${lesson.slug}`" :class="{ active: lesson.slug === activeSection }">
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
            <RouterLink :to="`/learn/${courseSlug}/final-review`" class="final-review-link"
              :class="{ active: activeSection === 'final-review' }">
              🏆 Final Course Review
            </RouterLink>
          </div>

        </template>
        <p v-else class="sidebar-empty">{{ loading ? 'Loading data...' : loadError }}</p>
      </nav>
    </aside>

    <section class="learn-content">
      <article v-if="currentLesson" class="content-section">
        <p v-if="progressError" class="progress-error" role="alert">{{ progressError }}</p>

        <div class="lesson-header">
          <div class="lesson-top-meta">
            <p class="lesson-module">{{ currentLesson.moduleTitle }}</p>
            <button
              v-if="currentLesson._id !== 'final-review'"
              type="button"
              class="bookmark-btn"
              :class="{ bookmarked: isCurrentLessonBookmarked }"
              :disabled="savingBookmark"
              @click="toggleLessonBookmark"
              :title="isCurrentLessonBookmarked ? 'Remove bookmark' : 'Bookmark this lesson for later'"
            >
              <svg class="bookmark-svg" viewBox="0 0 24 24" :fill="isCurrentLessonBookmarked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span>{{ savingBookmark ? 'Saving...' : isCurrentLessonBookmarked ? 'Saved' : 'Bookmark' }}</span>
            </button>
          </div>
          <h1>{{ currentLesson.title }}</h1>

          <div class="tabs-container">
            <button v-if="currentLesson.videoUrl" class="tab-btn" :class="{ active: activeTab === 'video' }"
              @click="activeTab = 'video'">
              📹 Video Lecture
            </button>

            <button class="tab-btn" :class="{ active: activeTab === 'theory' }" @click="activeTab = 'theory'">
              📖 Reading Material
            </button>
            <button class="tab-btn" :class="{ active: activeTab === 'quiz' }"
              @click="activeTab = 'quiz'; initializeQuizState()">
              🎯 Practice Quiz ({{ currentQuizzes.length }})
            </button>
          </div>
        </div>

        <div v-if="activeTab === 'video' && currentLesson.videoUrl" class="tab-content fade-in">
          <div class="video-lecture-container">
            <h2 class="video-title">{{ currentLesson.videoTitle || currentLesson.title }}</h2>

            <p v-if="currentLesson.videoIntro || currentLesson.overview" class="video-intro-text">
              {{ currentLesson.videoIntro || currentLesson.overview }}
            </p>

            <div class="coursera-video-player">
              <iframe :src="getEmbedUrl(currentLesson.videoUrl)" title="Video Lecture" frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen></iframe>
            </div>

            <div class="video-footer-action">
              <button class="btn-continue-reading" @click="activeTab = 'theory'">
                Continue to Reading Material ➔
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'theory'" class="tab-content fade-in">
          <p class="lesson-overview">{{ currentLesson.overview }}</p>
          <div class="lesson-theory" v-html="currentLesson.content"></div>

          <section v-if="currentCodeExamples.length" class="lesson-block">
            <h2>Code Examples</h2>

            <div v-for="(code, index) in currentCodeExamples" :key="index" class="code-wrapper">

              <div v-if="!activeEditors[index]" class="static-code-view">
                <pre><code>{{ code }}</code></pre>

                <button class="btn-try-it" @click="openLiveEditor(index, code)">
                  Try it Yourself ❯
                </button>

                <div v-if="currentCodeExplanations[index]" class="code-explanation"
                  v-html="currentCodeExplanations[index]">
                </div>
              </div>

              <div v-else class="live-editor-view">

                <div class="live-editor-header">
                  <h3>Interactive Code Playground</h3>


                  <div class="editor-actions">
                    <button class="btn-ask-ai" @click="submitCodeForReview(index)" :disabled="isEditorReviewing[index]">
                      {{ isEditorReviewing[index] ? 'Reviewing...' : '✨ Ask AI to Review' }}
                    </button>
                    <button class="btn-close-editor" @click="closeLiveEditor(index)">✖ Close Editor</button>
                  </div>
                </div>

                <div class="live-editor-split">
                  <!-- ... Giữ nguyên editor-pane và result-pane cũ ... -->
                  <div class="editor-pane">
                    <div class="pane-label">Source Code (Editable):</div>
                    <textarea v-model="editableCodes[index]" class="code-textarea" spellcheck="false"></textarea>
                  </div>
                  <div class="result-pane">
                    <div class="pane-label">Live Result:</div>
                    <div class="iframe-container">
                      <iframe :srcdoc="editableCodes[index]" sandbox="allow-scripts" frameborder="0"></iframe>
                    </div>
                  </div>
                </div>

                <!-- THÊM KHU VỰC HIỂN THỊ FEEDBACK CỦA AI BÊN DƯỚI -->
                <div v-if="editorFeedbacks[index]" class="editor-ai-feedback markdown-body fade-in"
                  v-html="renderMarkdown(editorFeedbacks[index])"></div>
              </div>
            </div>
          </section>
        </div>

        <div v-if="activeTab === 'quiz'" class="tab-content fade-in quiz-shell">
          <p v-if="progressError" class="progress-error" role="alert">{{ progressError }}</p>
          <article v-if="quizDeck.length" class="quiz-card">
            <template v-if="currentQuiz">
              <div class="quiz-header">
                <p class="quiz-progress">Question {{ currentQuizIndex + 1 }} of {{ quizDeck.length }}</p>
                <p class="quiz-score">Score {{ quizScore }}</p>
              </div>

              <h3>{{ currentQuiz.question }}</h3>
              <div class="quiz-options">
                <label v-for="(option, index) in currentQuiz.shuffledOptions" :key="`${currentQuiz.quizKey}-${index}`"
                  class="quiz-option" :class="{
                    selected: selectedQuizAnswer === index,
                    correct: quizSubmitted && index === currentQuiz.shuffledAnswerIndex,
                    incorrect: quizSubmitted && selectedQuizAnswer === index && index !== currentQuiz.shuffledAnswerIndex
                  }">
                  <input type="radio" :name="currentQuiz.quizKey" :value="index" :checked="selectedQuizAnswer === index"
                    :disabled="quizSubmitted" @change="selectCurrentQuizAnswer(index)">
                  <span class="quiz-option-text">{{ option }}</span>
                </label>
              </div>

              <div v-if="quizSubmitted" class="quiz-feedback-box">
                <p class="quiz-feedback" :class="isQuizCorrect ? 'correct' : 'incorrect'">
                  {{ isQuizCorrect ? '✅ Correct answer!' : '❌ Incorrect answer.' }}
                </p>
                <p class="quiz-explanation">{{ currentQuiz.explanation }}</p>
              </div>

              <div class="quiz-actions">
                <button v-if="!quizSubmitted" class="primary-button" :disabled="selectedQuizAnswer === null"
                  @click="submitQuiz">
                  Submit Answer
                </button>
                <button v-else class="primary-button next-button" @click="nextQuestion" :disabled="savingProgress">
                  {{ currentQuizIndex < quizDeck.length - 1 ? 'Next Question ❯' : 'Finish Quiz' }} </button>
              </div>
            </template>

            <div v-else-if="quizCompleted" class="quiz-complete">
              <h3>Quiz Completed!</h3>
              <p>You scored {{ quizScore }} / {{ quizDeck.length }}.</p>

              <div class="quiz-actions">
                <button class="primary-button" @click="initializeQuizState">Restart Quiz</button>
              </div>
            </div>
          </article>

          <article v-else class="quiz-card quiz-empty">
            <h3>No quiz available for this lesson</h3>
            <p>Please check other lessons or return to the theory tab.</p>
          </article>
        </div>

        <!-- THANH ĐIỀU HƯỚNG BÀI HỌC (PREVIOUS / MARK COMPLETED / NEXT) -->
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
            v-if="currentLesson._id !== 'final-review'"
            type="button"
            class="nav-complete-pill"
            :class="{ completed: isCurrentLessonCompleted }"
            :disabled="isCurrentLessonCompleted || savingProgress"
            @click="markLessonAsCompleted"
          >
            {{ savingProgress ? 'Saving...' : isCurrentLessonCompleted ? '✓ Lesson Completed' : 'Mark as Completed' }}
          </button>

          <button
            v-if="activeSection !== 'final-review'"
            type="button"
            class="nav-step-btn next-step-btn"
            :disabled="savingProgress"
            @click="goToNextLesson"
          >
            <span class="nav-step-copy align-right">
              <small>{{ nextLesson ? 'Next & Complete' : 'Finish Course' }}</small>
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

    <!-- AI CHATBOT WIDGET -->
    <div class="ai-chat-widget" :class="{ 'is-open': isChatOpen }">
      <div v-show="isChatOpen" class="chat-window fade-in">
        <div class="chat-header">
          <div class="chat-title">
            <span class="chat-avatar">✨</span>
            <div>
              <h3>AI Assistant</h3>
              <p>Ask about {{ currentLesson?.title || 'this course' }}</p>
            </div>
          </div>
          <button class="btn-close-chat" @click="toggleChat">✖</button>
        </div>


        <div class="chat-messages" ref="chatMessagesContainer">
          <div v-for="(msg, index) in chatMessages" :key="index" class="chat-bubble-wrapper"
            :class="msg.role === 'user' ? 'user-message' : 'ai-message'">
            <!-- 1. DÀNH CHO USER: Dùng {{ }} để escape mã HTML, tránh bị ẩn text -->
            <div v-if="msg.role === 'user'" class="chat-bubble" :class="{ 'error-bubble': msg.isError }">
              {{ msg.text }}
            </div>

            <!-- 2. DÀNH CHO AI: Dùng v-html để render Markdown (tiêu đề, bôi đậm, code block) -->
            <div v-else class="chat-bubble markdown-body" :class="{ 'error-bubble': msg.isError }"
              v-html="renderMarkdown(msg.text)">
            </div>
          </div>

          <div v-if="isChatLoading" class="chat-bubble-wrapper ai-message">
            <div class="chat-bubble loading-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        </div>

        <div class="chat-input-area">
          <input v-model="chatInput" type="text" placeholder="Type your question..." @keyup.enter="sendMessage"
            :disabled="isChatLoading" />
          <button class="btn-send" @click="sendMessage" :disabled="isChatLoading || !chatInput.trim()">
            ➤
          </button>
        </div>
      </div>

      <button class="chat-fab" @click="toggleChat" aria-label="Toggle AI Chat">
        <span v-if="!isChatOpen">✨ Ask AI</span>
        <span v-else>✖ Close</span>
      </button>
    </div>
  </main>
</template>

<style scoped>
/* BỐ CỤC CHUNG */
.learn-course-page {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
  min-height: calc(100vh - 80px);
  background-color: #f8fafc;
}

/* SIDEBAR & ACCORDION */
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

.sidebar-title {
  padding: 1.2rem;
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  border-bottom: 1px solid #e2e8f0;
  color: #1e293b;
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
  gap: 0.45rem;
}

.module-title-text {
  font-weight: 700;
  color: #334155;
}

.module-progress-container {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
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

.progress-percentage-text {
  font-size: 0.75rem;
  color: #64748b;
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
  padding: 0.8rem 1.2rem 0.8rem 2rem;
  color: #475569;
  text-decoration: none;
  font-size: 0.95rem;
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

/* VÙNG NỘI DUNG & TABS */
.content-section {
  background: #ffffff;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
}

.lesson-module {
  color: #64748b;
  font-weight: 700;
  font-size: 0.9rem;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}

.lesson-header h1 {
  margin: 0 0 1.5rem 0;
  color: #0f172a;
  font-size: 2.2rem;
}

.tabs-container {
  display: flex;
  gap: 1rem;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 1.5rem;
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

.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

.sidebar-final-review {
  display: block;
  margin: 1rem 1rem 0.5rem;
  padding: 0.95rem 1rem;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
  border-radius: 12px;
  font-weight: 800;
  text-align: center;
  text-decoration: none;
  box-shadow: 0 14px 30px rgba(217, 119, 6, 0.24);
  transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}

.sidebar-final-review:hover {
  transform: translateY(-1px);
  opacity: 0.95;
}

.sidebar-final-review.active {
  background: linear-gradient(135deg, #facc15, #ca8a04);
  box-shadow: 0 18px 34px rgba(168, 85, 0, 0.28);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* THEORY CONTENT */
/* Sửa lỗi chữ bị mờ/màu trắng trong phần Lý thuyết */
.lesson-theory :deep(h1),
.lesson-theory :deep(h2),
.lesson-theory :deep(h3) {
  color: #0f172a !important;
  margin: 1.5rem 0 0.8rem;
}

.lesson-theory :deep(p),
.lesson-theory :deep(li),
.lesson-theory :deep(span) {
  color: #334155 !important;
  /* Ép màu xám đậm dễ đọc */
  line-height: 1.6;
  font-size: 1.05rem;
}

.lesson-block h2 {
  color: #0f172a !important;
  /* Ép màu chữ đen Slate đậm sắc nét trên nền trắng */
  font-size: 1.4rem !important;
  font-weight: 700 !important;
  margin-top: 2rem !important;
  margin-bottom: 1rem !important;
}

.lesson-module {
  color: #475569 !important;
  /* Đổi từ xám nhạt sang màu xám Slate đậm, cực kỳ sắc nét */
  font-weight: 800 !important;
  /* Tăng độ đậm lên mức tối đa để chữ không bị mờ */
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  /* Giãn cách các ký tự một chút cho dễ nhìn */
  margin-bottom: 0.5rem;
}

/* 2. Sửa dòng chữ giới thiệu tổng quan (Lesson Overview) nằm ngay dưới thanh Tabs */
.lesson-overview {
  color: #1e293b !important;
  /* Ép chữ thành màu xám đen đậm đà, tương phản cực cao trên nền trắng */
  font-size: 1.1rem !important;
  /* Tăng nhẹ font chữ lên cho thoáng mắt */
  font-weight: 600 !important;
  /* Làm chữ dày dặn hơn để loại bỏ cảm giác bị mờ nét */
  line-height: 1.6 !important;
  /* Giãn dòng chuẩn học thuật */
  margin-top: 1rem !important;
  margin-bottom: 1.5rem !important;
}

/* 3. Đảm bảo tiêu đề chính h1 (Tên bài học) luôn nét căng */
.lesson-header h1 {
  color: #0f172a !important;
  /* Màu đen Slate đậm nhất */
  font-weight: 800 !important;
  margin-top: 0;
  margin-bottom: 1.5rem;
}

.code-wrapper pre {
  background: #1e293b;
  color: #f8fafc;
  padding: 1.2rem;
  border-radius: 8px;
  overflow-x: auto;
  border-left: 4px solid #10b981;
  font-family: Consolas, monospace;
  line-height: 1.5;
}

.code-wrapper pre {
  border-radius: 8px 8px 0 0;
  /* Chỉ bo góc phần trên */
  margin-bottom: 0;
}

.code-explanation {
  background-color: #f1f5f9;
  border-left: 4px solid #10b981;
  border-radius: 0 0 8px 8px;
  /* Bo góc phần dưới */
  padding: 1rem 1.5rem;
  color: #334155;
}

.code-explanation :deep(ul) {
  margin: 0;
  padding-left: 1.2rem;
}

.code-explanation :deep(li) {
  margin-bottom: 0.5rem;
  color: #334155;
}

/* ==============================================================
   COURSERA VIDEO PLAYER STYLE
   ============================================================== */
.coursera-video-player {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%;
  margin-bottom: 2rem;
  background: #0f172a;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
  border: 1px solid #1e293b;
}

.coursera-video-player iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
}

/* ==============================================================
   VIDEO LECTURE / COURSERA STYLE
   ============================================================== */
.video-lecture-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.video-title {
  margin: 0;
  color: #0f172a;
  font-size: 1.5rem;
  font-weight: 800;
}

.video-intro-text {
  margin: 0;
  color: #475569;
  font-size: 1.02rem;
  line-height: 1.7;
  padding: 1rem 1.1rem;
  background: linear-gradient(135deg, #f8fafc, #eef2ff);
  border-left: 4px solid #3b82f6;
  border-radius: 10px;
}

.video-footer-action {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn-continue-reading {
  border: none;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: white;
  padding: 0.8rem 1.1rem;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.16);
}

.btn-continue-reading:hover {
  transform: translateY(-1px);
}

/* QUIZ STYLES TỪ FILE CŨ CỦA CẬU */
.quiz-card {
  background: #1e293b;
  padding: 2rem;
  border-radius: 12px;
  color: #f8fafc;
}

.quiz-header {
  display: flex;
  justify-content: space-between;
  font-weight: bold;
  margin-bottom: 1rem;
  color: #94a3b8;
}

.quiz-options {
  display: grid;
  gap: 0.8rem;
  margin: 1.5rem 0;
}

.quiz-option {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  background: #334155;
  border: 1px solid #475569;
  border-radius: 8px;
  cursor: pointer;
}

.quiz-option:hover {
  background: #475569;
}

.quiz-option.selected {
  border-color: #3b82f6;
  background: #1e3a8a;
}

.quiz-option.correct {
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.2);
}

.quiz-option.incorrect {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.2);
}

.primary-button {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
  float: right;
}

.primary-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quiz-feedback-box {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

.quiz-feedback.correct {
  color: #4ade80;
  font-weight: bold;
}

.quiz-feedback.incorrect {
  color: #f87171;
  font-weight: bold;
}

.progress-error {
  color: #f87171;
  flex-basis: 100%;
  margin: 0 0 1rem;
}

.completion-action {
  display: flex;
  justify-content: flex-end;
  margin-top: 2rem;
}

.complete-button {
  min-width: 180px;
}

.complete-button:disabled {
  opacity: 0.8;
  cursor: default;
}

.quiz-actions {
  display: flex;
  justify-content: flex-end;
  /* Căn nút sang phải bằng Flexbox thay vì dùng float */
  margin-top: 1.5rem;
  width: 100%;
  /* Đảm bảo không tràn khỏi thẻ cha */
}

.primary-button {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
  /* Nếu có chữ float: right; ở đây thì XÓA nó đi nhé */
}

.primary-button.next-button {
  background: #3b82f6;
  /* Đổi màu xanh dương cho nút Next dễ nhận biết */
}

/* ==============================================================
   LIVE CODE EDITOR (TRY IT YOURSELF) STYLES
   ============================================================== */
/* Nút bấm xanh lá mướt mắt */
.btn-try-it {
  display: block;
  width: 100%;
  background-color: #04AA6D;
  /* Màu xanh W3Schools */
  color: white;
  border: none;
  padding: 0.85rem;
  font-size: 1.1rem;
  font-weight: 700;
  text-align: left;
  padding-left: 1.5rem;
  cursor: pointer;
  border-radius: 0 0 8px 8px;
  /* Bo tròn viền dưới ăn khớp với thẻ pre ở trên */
  transition: background-color 0.2s;
  margin-bottom: 1rem;
}

.btn-try-it:hover {
  background-color: #059862;
}

.static-code-view pre {
  border-radius: 8px 8px 0 0 !important;
  margin-bottom: 0 !important;
}

.live-editor-view {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.live-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1e293b;
  padding: 0.75rem 1.5rem;
}

.live-editor-header h3 {
  color: #f8fafc !important;
  margin: 0 !important;
  font-size: 1.1rem !important;
}

.btn-close-editor {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
}

.btn-close-editor:hover {
  background: #dc2626;
}

.live-editor-split {
  display: flex;
  height: 450px;
  background: #f1f5f9;
}

.editor-pane,
.result-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 50%;
}

.editor-pane {
  border-right: 2px solid #cbd5e1;
}

.pane-label {
  background: #e2e8f0;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  border-bottom: 1px solid #cbd5e1;
}

.code-textarea {
  flex: 1;
  width: 100%;
  resize: none;
  border: none;
  background: #282c34;
  color: #abb2bf;
  padding: 1rem;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 1rem;
  line-height: 1.5;
  outline: none;
}

.iframe-container {
  flex: 1;
  background: #ffffff;
}

.iframe-container iframe {
  width: 100%;
  height: 100%;
  background: #ffffff;
  border: none;
}

/* ==============================================================
   AI CHATBOT WIDGET STYLES
   ============================================================== */
.ai-chat-widget {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1rem;
}

.chat-fab {
  background: linear-gradient(135deg, #10b981, #0f766e);
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 10px 25px rgba(15, 118, 110, 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chat-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(15, 118, 110, 0.4);
}

.chat-window {
  width: 360px;
  height: 500px;
  max-height: 70vh;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 15px 40px rgba(15, 23, 42, 0.15);
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  background: #0f172a;
  color: white;
  padding: 1rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.chat-avatar {
  font-size: 1.5rem;
}

.chat-title h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.chat-title p {
  margin: 0;
  font-size: 0.75rem;
  color: #94a3b8;
}

.btn-close-chat {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 1.2rem;
}

.btn-close-chat:hover {
  color: white;
}

.chat-messages {
  flex: 1;
  padding: 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: #f8fafc;
}

.chat-bubble-wrapper {
  display: flex;
  width: 100%;
}

.user-message {
  justify-content: flex-end;
}

.ai-message {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 85%;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font-size: 0.95rem;
  line-height: 1.5;
  word-wrap: break-word;
}

.user-message .chat-bubble {
  background: #3b82f6;
  color: white;
  border-bottom-right-radius: 4px;
}

.ai-message .chat-bubble {
  background: white;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  border-bottom-left-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.02);
}

.error-bubble {
  color: #dc2626 !important;
  border-color: #fca5a5 !important;
  background: #fef2f2 !important;
}

.chat-input-area {
  padding: 1rem;
  background: white;
  border-top: 1px solid #e2e8f0;
  display: flex;
  gap: 0.5rem;
}

.chat-input-area input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  outline: none;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.chat-input-area input:focus {
  border-color: #3b82f6;
}

.btn-send {
  background: #10b981;
  color: white;
  border: none;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s;
}

.btn-send:hover:not(:disabled) {
  background: #059669;
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-dots span {
  animation: blink 1.4s infinite both;
  font-size: 1.5rem;
  line-height: 0.5;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0% {
    opacity: 0.2;
  }

  20% {
    opacity: 1;
  }

  100% {
    opacity: 0.2;
  }
}

@media (max-width: 640px) {
  .ai-chat-widget {
    bottom: 1rem;
    right: 1rem;
    left: 1rem;
    align-items: flex-end;
  }

  .chat-window {
    width: 100%;
    height: 60vh;
  }
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
}

.markdown-body :deep(pre) {
  background-color: #1e293b;
  color: #f8fafc;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.5rem 0;
}

.markdown-body :deep(code) {
  font-family: Consolas, monospace;
  background-color: rgba(0, 0, 0, 0.1);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
}

.markdown-body :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5rem;
  margin-top: 0.5rem;
}

.markdown-body :deep(p) {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.editor-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.btn-ask-ai {
  background: linear-gradient(135deg, #10b981, #0f766e);
  color: white;
  border: none;
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
}
.btn-ask-ai:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}
.btn-ask-ai:disabled {
  opacity: 0.6;
  cursor: wait;
}

.editor-ai-feedback {
  padding: 1.5rem;
  background: #f8fafc;
  border-top: 1px solid #cbd5e1;
  color: #1e293b;
}

/* ==============================================================
   BOOKMARK & LESSON NAVIGATION FOOTER STYLES
   ============================================================== */
.lesson-top-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.4rem;
}

.lesson-top-meta .lesson-module {
  margin-bottom: 0;
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

.lesson-link-content {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.lesson-link-title {
  flex: 1;
}

.bookmark-mini-badge {
  font-size: 0.78rem;
  line-height: 1;
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
  opacity: 0.8;
}

.nav-step-copy strong {
  font-size: 0.95rem;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-complete-pill {
  padding: 0.65rem 1.2rem;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #334155;
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
  transition: all 0.18s ease;
}

.nav-complete-pill:hover:not(:disabled) {
  border-color: #10b981;
  color: #0f766e;
  background: #ecfdf5;
}

.nav-complete-pill.completed {
  border-color: #a7f3d0;
  background: #ecfdf5;
  color: #047857;
  cursor: default;
}
</style>