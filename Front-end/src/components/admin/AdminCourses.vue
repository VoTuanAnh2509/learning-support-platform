<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api'
import Swal from 'sweetalert2'
import LessonEditorModal from '@/components/admin/LessonEditorModal.vue'

// === COURSE MANAGEMENT STATES ===
const courses = ref([])
const loadingCourses = ref(false)
const courseError = ref('')
const activeModuleByCourse = ref({})

// === MODAL STATES ===
const showEditor = ref(false)
const selectedLesson = ref(null)
const selectedCourseId = ref('')
const selectedModuleId = ref('')

const setActiveModule = (courseId, moduleId) => {
  activeModuleByCourse.value[courseId] = moduleId
}

const isModuleVisible = (courseId, moduleId) => {
  const activeModuleId = activeModuleByCourse.value[courseId]
  return !activeModuleId || activeModuleId === moduleId
}

// === COURSE METHODS ===
const loadCourses = async () => {
  loadingCourses.value = true
  courseError.value = ''
  try {
    const response = await api.get('/courses')
    courses.value = Array.isArray(response.data) ? response.data : []
  } catch (err) {
    courseError.value = 'Unable to load courses from database.'
  } finally {
    loadingCourses.value = false
  }
}

onMounted(() => {
  loadCourses()
})

const openEditModal = (courseId, moduleId, lesson) => {
  selectedCourseId.value = courseId
  selectedModuleId.value = moduleId
  selectedLesson.value = lesson
  showEditor.value = true
}

const handleEditModule = async (courseId, module) => {
  const { value: newTitle } = await Swal.fire({
    title: 'Edit Module Title',
    input: 'text',
    inputLabel: 'Module title:',
    inputValue: module.title || '',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    inputValidator: (value) => {
      if (!value || !value.trim()) return 'Module title cannot be empty.'
    }
  })

  if (!newTitle || newTitle === module.title) return

  try {
    await api.patch(`/courses/${courseId}/modules/${module._id}`, { title: newTitle.trim() })
    await loadCourses()
    Swal.fire('Saved', 'Module title updated.', 'success')
  } catch (err) {
    Swal.fire('Error', 'Failed to update module: ' + (err.response?.data?.error || err.message), 'error')
  }
}

const handleDeleteModule = async (courseId, moduleId, moduleTitle) => {
  Swal.fire({
    title: 'Delete Module?',
    text: `This will permanently delete module "${moduleTitle}" and all its lessons. Continue?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Yes, delete module'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await api.delete(`/courses/${courseId}/modules/${moduleId}`)
        Swal.fire('Deleted', 'Module removed.', 'success')
        await loadCourses()
      } catch (err) {
        Swal.fire('Error', 'Failed to delete module: ' + (err.response?.data?.error || err.message), 'error')
      }
    }
  })
}

const handleAddCourse = async () => {
  const { value: formValues } = await Swal.fire({
    title: 'Create New Course',
    html: `
      <input id="swal-course-title" class="swal2-input" style="width: 80%; margin-bottom: 10px;" placeholder="Course Title (e.g., Master CSS)">
      <input id="swal-course-subject" class="swal2-input" style="width: 80%;" placeholder="Subject/Slug (e.g., CSS)">
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#64748b',
    preConfirm: () => {
      const title = document.getElementById('swal-course-title').value.trim()
      const subject = document.getElementById('swal-course-subject').value.trim()
      if (!title || !subject) {
        Swal.showValidationMessage('Both Title and Subject are required!')
        return false
      }
      return { title, subject }
    }
  })

  if (!formValues) return

  try {
    await api.post('/courses', {
      title: formValues.title,
      subject: formValues.subject,
      difficulty: 'beginner',
      modules: []
    })
    Swal.fire('Created!', 'New course has been added.', 'success')
    await loadCourses()
  } catch (err) {
    Swal.fire('Error', 'Failed to add course: ' + (err.response?.data?.error || err.message), 'error')
  }
}

const handleEditCourse = async (course) => {
  const { value: formValues } = await Swal.fire({
    title: 'Course Settings',
    html: `
      <div style="text-align: left; margin-top: 10px;">
        <label style="font-size: 14px; font-weight: bold; color: #334155;">Course Title</label>
        <input id="swal-edit-title" class="swal2-input" style="width: 100%; margin: 5px 0 15px;" value="${course.title || ''}">
        
        <label style="font-size: 14px; font-weight: bold; color: #334155;">Subject / Tech Stack</label>
        <input id="swal-edit-subject" class="swal2-input" style="width: 100%; margin: 5px 0 15px;" value="${course.subject || ''}">
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Save Settings',
    preConfirm: () => {
      const title = document.getElementById('swal-edit-title').value.trim()
      const subject = document.getElementById('swal-edit-subject').value.trim()

      if (!title || !subject) {
        Swal.showValidationMessage('Title and Subject are required!')
        return false
      }
      return { title, subject }
    }
  })

  if (!formValues) return

  try {
    await api.patch(`/courses/${course._id}`, formValues)
    Swal.fire('Saved!', 'Course settings updated.', 'success')
    await loadCourses()
  } catch (err) {
    Swal.fire('Error', 'Failed to update course: ' + (err.response?.data?.error || err.message), 'error')
  }
}

const handleDeleteCourse = async (courseId, courseTitle) => {
  const result = await Swal.fire({
    title: 'Delete Entire Course?',
    text: `WARNING: Are you sure you want to permanently delete "${courseTitle}"? All modules, lessons, and quizzes inside will be wiped out!`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Yes, permanently delete!'
  })

  if (!result.isConfirmed) return

  try {
    await api.delete(`/courses/${courseId}`)
    Swal.fire('Deleted!', 'The course has been completely removed.', 'success')
    await loadCourses()
  } catch (err) {
    Swal.fire('Error', 'Failed to delete course: ' + (err.response?.data?.error || err.message), 'error')
  }
}

const handleAddLesson = async (courseId, moduleId) => {
  const { value: lessonTitle } = await Swal.fire({
    title: 'Create New Lesson',
    input: 'text',
    inputLabel: 'Enter the title for the new lesson:',
    inputPlaceholder: 'e.g., HTML Lists',
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#64748b',
    inputValidator: (value) => {
      if (!value || !value.trim()) return 'Lesson title cannot be empty!'
    }
  })

  if (!lessonTitle) return

  try {
    await api.post(`/courses/${courseId}/modules/${moduleId}/lessons`, {
      title: lessonTitle.trim(),
      overview: 'Welcome to this new lesson.',
      content: '<p>Start composing your material here...</p>',
      quizzes: []
    })
    Swal.fire('Created!', 'New lesson has been added.', 'success')
    await loadCourses()
  } catch (err) {
    Swal.fire('Error', 'Failed to add lesson: ' + (err.response?.data?.error || err.message), 'error')
  }
}

const handleAddModule = async (courseId) => {
  const { value: moduleTitle } = await Swal.fire({
    title: 'Create New Module',
    input: 'text',
    inputLabel: 'Module title:',
    inputPlaceholder: 'e.g., HTML Basics',
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#64748b',
    inputValidator: (value) => {
      if (!value || !value.trim()) return 'Module title cannot be empty.'
    }
  })

  if (!moduleTitle) return

  try {
    await api.post(`/courses/${courseId}/modules`, {
      title: moduleTitle.trim(),
      description: '',
      lessons: []
    })
    Swal.fire('Created!', 'New module has been added.', 'success')
    await loadCourses()
  } catch (err) {
    Swal.fire('Error', 'Failed to add module: ' + (err.response?.data?.error || err.message), 'error')
  }
}

const handleDeleteLesson = async (courseId, moduleId, lessonId, lessonTitle) => {
  Swal.fire({
    title: 'Delete Lesson?',
    text: `Are you sure you want to completely erase "${lessonTitle}"? This cannot be undone!`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Yes, permanently delete'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await api.delete(`/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`)
        Swal.fire('Deleted!', 'The lesson has been removed.', 'success')
        await loadCourses()
      } catch (err) {
        Swal.fire('Error', 'Failed to delete lesson: ' + (err.response?.data?.error || err.message), 'error')
      }
    }
  })
}
</script>

<template>
  <div class="admin-courses-wrapper">
    <section class="admin-section course-management">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Content library</p>
          <h2>Course Management</h2>
        </div>
        <div class="course-section-actions">
          <span class="section-count">{{ courses.length }} courses</span>
          <button class="btn-add-module" type="button" @click="handleAddCourse">+ Add New Course</button>
        </div>
      </div>
      
      <p v-if="loadingCourses" class="state-text">Loading courses...</p>
      <p v-if="courseError" class="message error">{{ courseError }}</p>
      
      <div v-else class="course-list">
        <div v-for="course in courses" :key="course._id" class="course-card">
          <div class="course-header">
            <div>
              <span class="course-kicker">Course • {{ course.subject || 'Uncategorized' }}</span>
              <h3>{{ course.title }}</h3>
            </div>
            <div class="course-header-right">
              <button class="action-btn btn-edit" type="button" @click="handleEditCourse(course)">⚙ Settings</button>
              <button class="btn-delete" type="button" @click="handleDeleteCourse(course._id, course.title)">Delete</button>
              <button class="btn-add-module" type="button" @click="handleAddModule(course._id)">+ Add module</button>
            </div>
          </div>
          
          <div class="course-workspace">
            <div class="module-index">
              <span class="module-index-title">Modules</span>
              <button class="module-index-item all-modules" :class="{ active: !activeModuleByCourse[course._id] }" type="button" @click="setActiveModule(course._id, '')">All modules</button>
              <button v-for="module in course.modules" :key="module._id" class="module-index-item" :class="{ active: activeModuleByCourse[course._id] === module._id }" type="button" @click="setActiveModule(course._id, module._id)">
                <span>{{ module.title }}</span><small>{{ module.lessons?.length || 0 }} lessons</small>
              </button>
            </div>
            
            <div class="module-stack">
              <div v-for="module in course.modules" v-show="isModuleVisible(course._id, module._id)" :key="module._id" class="module-block">
                <div class="module-block-header">
                  <div>
                    <span class="module-label">Module</span>
                    <h4 class="admin-module-title">{{ module.title }}</h4>
                  </div>
                  <div class="module-header-actions">
                    <button class="action-btn btn-add-lesson" @click="handleAddLesson(course._id, module._id)">+ Add lesson</button>
                    <button class="icon-action" title="Edit module" @click="handleEditModule(course._id, module)">✎</button>
                    <button class="icon-action danger" title="Delete module" @click="handleDeleteModule(course._id, module._id, module.title)">×</button>
                  </div>
                </div>
                
                <ul class="lesson-list">
                  <li v-for="lesson in module.lessons" :key="lesson._id" class="lesson-item">
                    <div class="lesson-item-info">
                      <span class="lesson-item-title"><span class="lesson-bullet">•</span>{{ lesson.title }}</span>
                      <div class="lesson-meta-badges">
                        <span v-if="lesson.videoUrl" class="lesson-meta-pill">📹 Video</span>
                        <span v-if="lesson.codeExamples?.length" class="lesson-meta-pill code-pill">
                          💻 {{ lesson.codeExamples.length }} Code {{ lesson.codeExamples.length === 1 ? 'Example' : 'Examples' }}
                        </span>
                        <span v-if="lesson.quizzes?.length" class="lesson-meta-pill quiz-pill">
                          🎯 {{ lesson.quizzes.length }} {{ lesson.quizzes.length === 1 ? 'Quiz' : 'Quizzes' }}
                        </span>
                      </div>
                    </div>
                    <div class="lesson-action-buttons">
                      <button class="action-btn btn-edit" @click="openEditModal(course._id, module._id, lesson)">Edit lesson</button>
                      <button class="text-delete" @click="handleDeleteLesson(course._id, module._id, lesson._id, lesson.title)">Delete</button>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Modal chỉnh sửa bài học (Chỉ gọi trong component Courses) -->
    <LessonEditorModal 
      :show="showEditor" 
      :courseId="selectedCourseId" 
      :moduleId="selectedModuleId"
      :lessonData="selectedLesson" 
      @close="showEditor = false" 
      @saved="loadCourses" 
    />
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
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #263449; }
.section-heading h2 { margin: 0.2rem 0 0; color: #f8fafc; font-size: 1.25rem; font-weight: 750; }
.section-count { color: #64748b; font-size: 0.78rem; }
.eyebrow { color: #64748b; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.68rem; font-weight: 800; margin: 0; }
.message { padding: 1rem; border-radius: 8px; margin-bottom: 1rem; font-weight: bold; }
.message.error { background: #450a0a; color: #fecaca; border: 1px solid #7f1d1d; }
.state-text { color: #94a3b8; }

.course-list { display: grid; gap: 1.5rem; margin-top: 1rem; }
.course-card { padding: 1.2rem; border: 1px solid #263449; border-radius: 11px; background: #172033; }
.course-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.1rem; }
.course-header h3 { margin: 0.2rem 0 0.4rem; color: #f8fafc; font-size: 1.05rem; }
.course-kicker { color: #64748b; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.68rem; font-weight: 800; }
.course-header-right { display: flex; gap: 0.6rem; align-items: center; }
.course-section-actions { display: flex; align-items: center; gap: 0.8rem; }

.btn-add-module { background: linear-gradient(180deg, #06b6d4, #0891b2); color: white; border: none; padding: 0.45rem 0.85rem; border-radius: 10px; cursor: pointer; font-weight: 800; }
.btn-add-module:hover { filter: brightness(0.95); }

.course-workspace { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 1rem; }
.module-index { padding: 0.8rem; border: 1px solid #263449; border-radius: 8px; background: #111827; }
.module-index-title { display: block; margin-bottom: 0.65rem; color: #94a3b8; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; }
.module-index-item { display: block; width: 100%; padding: 0.6rem 0.45rem; border: 0; border-left: 2px solid #334155; background: transparent; color: #cbd5e1; font: inherit; font-size: 0.75rem; text-align: left; cursor: pointer; }
.module-index-item:hover, .module-index-item.active { border-left-color: #14b8a6; background: #172033; color: #f8fafc; }
.module-index-item small { display: block; margin-top: 0.15rem; color: #64748b; font-size: 0.68rem; }
.module-index-item.active small { color: #5eead4; }
.all-modules { margin-bottom: 0.35rem; color: #94a3b8; font-weight: 700; }

.module-stack { min-width: 0; }
.module-block { margin: 0; padding: 0.95rem; border: 1px solid #263449; border-radius: 8px; background: #111827; margin-bottom: 0.7rem; }
.module-block-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #263449; }
.module-label { color: #64748b; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.68rem; font-weight: 800; }
.admin-module-title { margin: 0.15rem 0 0 !important; color: #e2e8f0 !important; font-size: 0.9rem !important; font-weight: 700 !important; }

.module-header-actions, .lesson-action-buttons { display: flex; align-items: center; gap: 0.4rem; }
.icon-action { display: grid; place-items: center; width: 27px; height: 27px; border: 1px solid #334155; border-radius: 6px; background: transparent; color: #94a3b8; cursor: pointer; }
.icon-action:hover { background: #1f2937; color: white; }
.icon-action.danger:hover { color: #fda4af; }

.lesson-list { gap: 0; margin: 0; list-style: none; padding: 0; display: flex; flex-direction: column; }
.lesson-item { display: flex; flex-direction: row; justify-content: space-between; align-items: center; padding: 0.9rem; background: transparent; border-bottom: 1px solid #1f2937; transition: transform 0.14s ease, box-shadow 0.14s ease; }
.lesson-item:hover { background: #172033; }
.lesson-item:last-child { border-bottom: none; }
.lesson-item .lesson-item-title { color: #cbd5e1; font-size: 0.78rem; font-weight: 500; }
.lesson-bullet { margin-right: 0.5rem; color: #14b8a6; }
.lesson-item-info { display: flex; align-items: center; flex-wrap: wrap; gap: 0.6rem; }
.lesson-meta-badges { display: inline-flex; flex-wrap: wrap; gap: 0.35rem; }
.lesson-meta-pill { padding: 0.14rem 0.5rem; border-radius: 999px; background: rgba(148, 163, 184, 0.14); color: #cbd5e1; font-size: 0.66rem; font-weight: 700; }
.lesson-meta-pill.code-pill { background: rgba(16, 185, 129, 0.16); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.3); }
.lesson-meta-pill.quiz-pill { background: rgba(59, 130, 246, 0.16); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.3); }

.action-btn { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.32rem 0.7rem; font-size: 0.92rem; border-radius: 8px; border: 1px solid transparent; cursor: pointer; font-weight: 700; transition: transform 120ms ease; }
.action-btn:hover { transform: translateY(-1px); }
.btn-edit { border-color: #334155; background: transparent; color: #94a3b8; font-size: 0.68rem; }
.btn-edit:hover { background: #1f2937; }
.btn-add-lesson { background: #0f766e; color: #ecfeff; border: 1px solid rgba(45, 212, 191, 0.25); padding: 0.5rem 0.7rem; font-size: 0.76rem; }
.btn-add-lesson:hover { background: #0d9488; }
.btn-delete { background: transparent; border: 1px solid #7f1d1d; color: #f87171; padding: 0.32rem 0.7rem; border-radius: 8px; font-weight: 700; cursor: pointer; }
.btn-delete:hover { background: #450a0a; }
.text-delete { border: 0; background: transparent; color: #f87171; font-size: 0.68rem; cursor: pointer; padding: 0.3rem 0.5rem; }

@media (max-width: 720px) {
  .course-workspace { grid-template-columns: 1fr; }
  .module-header-actions { flex-wrap: wrap; }
  .lesson-item { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
  .lesson-action-buttons { width: 100%; justify-content: flex-start; }
}
</style>