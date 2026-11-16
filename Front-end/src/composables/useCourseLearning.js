import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import api from '@/services/api'

export function useCourseLearning() {
  const route = useRoute()
  const router = useRouter()

  // 1. DYNAMIC STATES
  const courseSlug = computed(() => route.params.courseSlug)
  const courseData = ref(null)
  const loading = ref(true)
  const loadError = ref('')
  const activeTab = ref('theory')

  // 2. COMPLETION & BOOKMARK STATES
  const completedLessons = ref([])
  const bookmarkedLessons = ref([])
  const savingBookmark = ref(false)
  const savingProgress = ref(false)
  const progressError = ref('')

  const getCurrentUserId = () => {
    try {
      const storedUser = sessionStorage.getItem('auth_user')
      if (!storedUser) return ''
      const user = JSON.parse(storedUser)
      return user?._id || user?.id || ''
    } catch (_err) {
      return ''
    }
  }

  const slugify = value =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  const buildLessonSlug = lessonTitle => slugify(lessonTitle) || 'home'

  // 3. COURSE & LESSON COMPUTEDS
  const normalizedCourse = computed(() => {
    const course = courseData.value
    if (!course) return null

    const modules = Array.isArray(course.modules)
      ? [...course.modules].sort((l, r) => (l.order || 0) - (r.order || 0))
      : []
    const lessons = modules.flatMap(module => {
      const sortedLessons = Array.isArray(module.lessons)
        ? [...module.lessons].sort((l, r) => (l.order || 0) - (r.order || 0))
        : []
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

  const allCourseQuizzes = computed(
    () =>
      normalizedCourse.value?.lessons.flatMap(lesson =>
        Array.isArray(lesson.quizzes) ? lesson.quizzes : []
      ) || []
  )

  const currentLesson = computed(() => {
    if (activeSection.value === 'final-review') {
      return {
        _id: 'final-review',
        title: 'Final Course Review',
        moduleTitle: 'Final Review',
        overview: 'Ready for the final challenge?',
        content: '<p>Practice with all the quizzes collected from the entire course.</p>',
        quizzes: allCourseQuizzes.value,
      }
    }

    const lessons = sidebarLessons.value
    return lessons.find(lesson => lesson.slug === activeSection.value) || lessons[0] || null
  })

  const currentQuizzes = computed(() => currentLesson.value?.quizzes || [])
  const isLessonCompleted = lesson =>
    Boolean(lesson?.slug && completedLessons.value.includes(lesson.slug))
  const isCurrentLessonCompleted = computed(() => isLessonCompleted(currentLesson.value))

  const isLessonBookmarked = lesson =>
    Boolean(
      lesson?._id &&
        lesson._id !== 'final-review' &&
        bookmarkedLessons.value.some(
          item =>
            String(item.lessonId) === String(lesson._id) ||
            (item.lessonSlug === lesson.slug &&
              String(item.course) === String(normalizedCourse.value?._id))
        )
    )

  const isCurrentLessonBookmarked = computed(() => isLessonBookmarked(currentLesson.value))
  const courseBookmarkedLessons = computed(() =>
    sidebarLessons.value.filter(lesson => isLessonBookmarked(lesson))
  )
  const bookmarkedLessonIds = computed(() =>
    courseBookmarkedLessons.value.map(lesson => String(lesson._id))
  )

  // 4. PREVIOUS / NEXT NAVIGATION COMPUTEDS
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
    if (
      currentLessonIndex.value >= 0 &&
      currentLessonIndex.value < sidebarLessons.value.length - 1
    ) {
      return sidebarLessons.value[currentLessonIndex.value + 1]
    }
    return null
  })

  watch(
    currentLesson,
    newLesson => {
      if (!newLesson) return
      if (newLesson._id === 'final-review') {
        activeTab.value = 'quiz'
      } else {
        activeTab.value = newLesson.videoUrl ? 'video' : 'theory'
      }
    },
    { immediate: true }
  )

  // 5. API ACTIONS & PROGRESS HANDLERS
  const markLessonAsCompleted = async ({ quizResultSaved = false } = {}) => {
    const lesson = currentLesson.value
    const course = normalizedCourse.value
    const userId = getCurrentUserId()
    if (!lesson?.slug || lesson._id === 'final-review') return

    progressError.value = ''
    savingProgress.value = true
    try {
      if (!quizResultSaved) {
        if (!userId || !course?._id || !lesson?.moduleId || !lesson?._id) {
          throw new Error('Unable to identify the signed-in user, course, module, or lesson.')
        }
        await api.post(`/users/${userId}/progress`, {
          courseId: course._id,
          moduleId: lesson.moduleId,
          lessonId: lesson._id,
          status: 'completed',
        })
      }
      if (!completedLessons.value.includes(lesson.slug)) {
        completedLessons.value.push(lesson.slug)
      }
    } catch (error) {
      progressError.value =
        error?.response?.data?.error || error.message || 'Unable to save lesson progress.'
    } finally {
      savingProgress.value = false
    }
  }

  const handleQuizCompleted = async () => {
    if (currentLesson.value?._id !== 'final-review') {
      await markLessonAsCompleted({ quizResultSaved: true })
    }
  }

  const toggleLessonBookmark = async () => {
    const lesson = currentLesson.value
    const course = normalizedCourse.value
    const userId = getCurrentUserId()

    if (
      !userId ||
      !course?._id ||
      !lesson?._id ||
      lesson._id === 'final-review' ||
      savingBookmark.value
    ) {
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
      progressError.value =
        error?.response?.data?.error || error.message || 'Unable to update bookmark.'
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

    if (
      currentLesson.value &&
      currentLesson.value._id !== 'final-review' &&
      !isCurrentLessonCompleted.value
    ) {
      if (currentQuizzes.value.length > 0) {
        activeTab.value = 'quiz'
        await Swal.fire({
          icon: 'warning',
          title: 'Quiz Required to Complete',
          text: `Please finish the Practice Quiz (${currentQuizzes.value.length} questions) before completing "${currentLesson.value.title}".`,
          confirmButtonText: 'Start Quiz Now',
          confirmButtonColor: '#10b981',
        })
        return
      }

      await markLessonAsCompleted()
    }

    if (nextLesson.value) {
      router.push(`/learn/${courseSlug.value}/${nextLesson.value.slug}`)
    } else if (activeSection.value !== 'final-review') {
      router.push(`/learn/${courseSlug.value}/final-review`)
    }
  }

  const loadCourse = async () => {
    loading.value = true
    loadError.value = ''
    progressError.value = ''
    completedLessons.value = []
    try {
      const response = await api.get('/courses')
      const courses = Array.isArray(response.data) ? response.data : []

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
          return (
            titleSlug.includes(targetSlug) ||
            (shortTitleSlug && targetSlug.includes(shortTitleSlug))
          )
        }) ||
        courses.find(
          course =>
            slugify(course.subject) === targetSlug || slugify(course.subject).includes(targetSlug)
        )

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
        const enrollment = user.enrolledCourses?.find(
          entry => String(entry.course?._id || entry.course) === String(matchedCourse._id)
        )
        const completedLessonIds = new Set(
          (enrollment?.completedLessons || []).map(lessonId => String(lessonId?._id || lessonId))
        )
        completedLessons.value = (normalizedCourse.value?.lessons || [])
          .filter(lesson => completedLessonIds.has(String(lesson._id)))
          .map(lesson => lesson.slug)
        bookmarkedLessons.value = Array.isArray(user.bookmarkedLessons)
          ? user.bookmarkedLessons
          : []
      } catch (error) {
        progressError.value =
          error?.response?.data?.error || error.message || 'Unable to load saved lesson progress.'
      }

      if (!route.params.sectionSlug && sidebarLessons.value.length > 0) {
        router.replace(`/learn/${courseSlug.value}/${sidebarLessons.value[0].slug}`)
      }
    } catch (_e) {
      loadError.value = 'Không tải được dữ liệu khóa học từ hệ thống.'
      courseData.value = null
    } finally {
      loading.value = false
    }
  }

  onMounted(loadCourse)
  watch(courseSlug, (newSlug, oldSlug) => {
    if (newSlug !== oldSlug) loadCourse()
  })

  return {
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
  }
}
