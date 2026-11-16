<script setup>
import { ref, watch, nextTick } from 'vue'
import api from '@/services/api'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import Swal from 'sweetalert2'

const props = defineProps({
  show: Boolean,
  lessonData: Object,
  courseId: String,
  moduleId: String
})

const emit = defineEmits(['close', 'saved'])

const form = ref({ quizzes: [] })
const isSaving = ref(false)
const activeTab = ref('theory')
const expandedQuizIndex = ref(null)

// Deep copy data when modal opens
watch(() => props.lessonData, (newData) => {
  if (newData) {
    form.value = JSON.parse(JSON.stringify(newData))
    if (!form.value.quizzes) form.value.quizzes = []
    activeTab.value = 'theory'
    expandedQuizIndex.value = null
  }
}, { immediate: true, deep: true })

const toggleQuiz = (index) => {
  expandedQuizIndex.value = expandedQuizIndex.value === index ? null : index
}

const addQuiz = async () => {
  form.value.quizzes.push({
    question: '',
    options: ['', '', '', ''],
    answerIndex: 0,
    explanation: '',
    points: 5
  })

  activeTab.value = 'quizzes'
  expandedQuizIndex.value = form.value.quizzes.length - 1

  await nextTick()

  const quizItems = document.querySelectorAll('.quiz-accordion')
  if (quizItems.length > 0) {
    const lastQuizItem = quizItems[quizItems.length - 1]
    lastQuizItem.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

const removeQuiz = (index) => {
  form.value.quizzes.splice(index, 1)

  if (expandedQuizIndex.value === index) {
    expandedQuizIndex.value = null
  } else if (expandedQuizIndex.value > index) {
    expandedQuizIndex.value -= 1
  }
}

const handleSave = async () => {
  isSaving.value = true
  try {
    await api.patch(`/courses/${props.courseId}/modules/${props.moduleId}/lessons/${form.value._id}`, {
      title: form.value.title,
      overview: form.value.overview,
      content: form.value.content,
      videoUrl: form.value.videoUrl,
      videoTitle: form.value.videoTitle,
      videoIntro: form.value.videoIntro,
      quizzes: form.value.quizzes
    })
    await Swal.fire({
      icon: 'success',
      title: 'Lesson updated successfully!',
      text: 'Your changes have been saved.',
      confirmButtonColor: '#10b981'
    })
    emit('saved')
    emit('close')
  } catch (error) {
    await Swal.fire({
      icon: 'error',
      title: 'Unable to save lesson',
      text: error.response?.data?.error || error.message,
      confirmButtonColor: '#ef4444'
    })
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => {
  // So sánh chuỗi JSON của dữ liệu hiện tại trên Form và dữ liệu gốc ban đầu được truyền từ props
  const currentDataStr = JSON.stringify({
    title: form.value.title,
    content: form.value.content,
    quizzes: form.value.quizzes
  })
  
  const originalDataStr = JSON.stringify({
    title: props.lessonData?.title || '',
    content: props.lessonData?.content || '',
    quizzes: props.lessonData?.quizzes || []
  })

  // Nếu dữ liệu hoàn toàn giống nhau (Chưa sửa gì), đóng thẳng luôn
  if (currentDataStr === originalDataStr) {
    emit('close')
    return
  }

  // Nếu phát hiện có sự thay đổi dữ liệu, bật cấu hình SweetAlert2 tiếng Anh siêu đẹp
  Swal.fire({
    title: 'Unsaved Changes!',
    text: 'You have modified this lesson. Are you sure you want to discard these changes?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444', // Màu đỏ cho hành động hủy bỏ dữ liệu
    cancelButtonColor: '#64748b',  // Màu xám giữ lại
    confirmButtonText: 'Yes, discard changes',
    cancelButtonText: 'No, keep editing',
    background: '#ffffff',
    customClass: {
      title: 'swal-title-bold'
    }
  }).then((result) => {
    // Nếu Admin quyết định hủy bỏ (bấm nút đỏ)
    if (result.isConfirmed) {
      emit('close')
    }
  })
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="handleCancel">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Edit Lesson: {{ form.title }}</h2>
        <button class="close-btn" @click="handleCancel">✖</button>
      </div>

      <div class="modal-body">
        <div class="tab-switcher" role="tablist" aria-label="Lesson editor tabs">
          <button class="tab-btn" :class="{ active: activeTab === 'theory' }" @click="activeTab = 'theory'">Theory</button>
          <button class="tab-btn" :class="{ active: activeTab === 'quizzes' }" @click="activeTab = 'quizzes'">Quizzes ({{ form.quizzes.length }})</button>
        </div>

        <div v-if="activeTab === 'theory'" class="tab-panel">
          <div class="form-group">
            <label>Short Overview / Highlight (appears above theory):</label>
            <input v-model="form.overview" type="text" class="form-control" placeholder="One-line summary shown on course page" />
          </div>

          <div class="video-admin-card">
            <h4>📹 Video Lecture Settings</h4>

            <div class="form-group">
              <label class="input-sub-label">YouTube Video URL:</label>
              <input
                v-model="form.videoUrl"
                type="text"
                class="form-control"
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>

            <div class="form-group">
              <label class="input-sub-label">Video Title:</label>
              <input
                v-model="form.videoTitle"
                type="text"
                class="form-control"
                placeholder="e.g. Lecture 1.1: Introduction to Web Development"
              />
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="input-sub-label">Video Overview / Intro:</label>
              <textarea
                v-model="form.videoIntro"
                rows="2"
                class="form-control"
                placeholder="Brief summary of what students will learn in this video..."
              ></textarea>
            </div>
          </div>

          <div class="form-group">
            <label>Theory Content (HTML supported):</label>
            <div class="editor-wrapper">
              <QuillEditor 
                v-model:content="form.content" 
                content-type="html" 
                theme="snow"
                placeholder="Compose your awesome lesson theory here... format texts freely!"
              />
            </div>
          </div>
        </div>

        <div v-else class="tab-panel">
          <div class="quiz-section">
            <div class="quiz-header">
              <div>
                <h3>Practice Quizzes</h3>
                <p class="quiz-subtitle">Expand any question to edit its details.</p>
              </div>
              <button class="btn-primary" @click="addQuiz">➕ Add New Question</button>
            </div>

            <div v-if="form.quizzes.length" class="quiz-list">
              <div v-for="(quiz, index) in form.quizzes" :key="index" class="quiz-accordion">
                <button class="quiz-summary" @click="toggleQuiz(index)">
                  <span>{{ index + 1 }}. {{ quiz.question || 'Untitled question' }}</span>
                  <span class="quiz-summary-icon">{{ expandedQuizIndex === index ? '▾' : '▸' }}</span>
                </button>

                <div v-if="expandedQuizIndex === index" class="quiz-panel">
                  <div class="quiz-box">
                    <div class="quiz-box-header">
                      <h4>{{ quiz.question || `Question ${index + 1}` }}</h4>
                      <button class="btn-danger-sm" @click.stop="removeQuiz(index)">Remove</button>
                    </div>

                    <div class="grid-form">
                      <div class="grid-left">
                        <label>Question text:</label>
                        <input v-model="quiz.question" type="text" class="form-control" />

                        <div class="options-grid">
                          <div v-for="optIdx in 4" :key="optIdx" class="option-item">
                            <label>Option {{ optIdx }}:</label>
                            <input v-model="quiz.options[optIdx - 1]" type="text" class="form-control" />
                          </div>
                        </div>
                      </div>

                      <div class="grid-right">
                        <div class="answer-picker">
                          <label>Correct Answer</label>
                          <div class="answer-options vertical">
                            <label v-for="optIdx in 4" :key="optIdx" class="answer-option large">
                              <input type="radio" :name="`correct-answer-${index}`" :value="optIdx - 1" v-model.number="quiz.answerIndex" />
                              <span>Option {{ optIdx }}</span>
                            </label>
                          </div>
                        </div>

                        <div class="flex-grow">
                          <label>Explanation (when wrong):</label>
                          <input v-model="quiz.explanation" type="text" class="form-control" />

                          <label>Points:</label>
                          <input v-model.number="quiz.points" type="number" min="0" class="form-control" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="empty-state">
              No questions yet. Add one to build your first quiz.
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="handleCancel">Cancel</button>
        <button class="btn-success" :disabled="isSaving" @click="handleSave">
          {{ isSaving ? 'Saving...' : '💾 Save Changes' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.7);
  display: flex; justify-content: center; align-items: center;
  z-index: 1000;
}
.modal-content {
  background: white; width: 860px; max-width: 95vw; max-height: 90vh;
  border-radius: 16px; display: flex; flex-direction: column;
  box-shadow: 0 24px 50px -15px rgba(15, 23, 42, 0.28);
  overflow: hidden;
}
.modal-header, .modal-footer { padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; }
.modal-header { display: flex; justify-content: space-between; align-items: center; }
.modal-header h2 { margin: 0; color: #0f172a; font-size: 1.25rem; }
.close-btn { background: none; border: none; font-size: 1.3rem; cursor: pointer; color: #64748b; }
.modal-body { padding: 1.25rem 1.5rem; overflow-y: auto; flex-grow: 1; }
.modal-footer { border-top: 1px solid #e2e8f0; border-bottom: none; display: flex; justify-content: flex-end; gap: 1rem; }

.tab-switcher {
  display: inline-flex;
  gap: 0.5rem;
  padding: 0.35rem;
  margin-bottom: 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
}
.tab-btn {
  border: none;
  background: transparent;
  color: #475569;
  padding: 0.6rem 1rem;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
}
.tab-btn.active {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.18);
}

.form-group label { font-weight: 700; color: #334155; display: block; margin-bottom: 0.5rem; }
.input-sub-label { font-size: 0.95rem; color: #475569; }
.video-admin-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 1.2rem;
  border-radius: 10px;
  margin-bottom: 1.5rem;
}
.video-admin-card h4 {
  margin: 0 0 1rem 0;
  color: #0f172a;
}
.form-control { width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 10px; margin-bottom: 1rem; font-family: inherit; background: #fff; transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.form-control:focus { outline: none; border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2); }

.quiz-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 0.75rem; margin-bottom: 1rem; }
.quiz-header h3 { color: #0f172a; font-weight: 700; font-size: 1.2rem; margin: 0; }
.quiz-subtitle { color: #64748b; margin: 0.2rem 0 0; font-size: 0.9rem; }
.quiz-list { display: flex; flex-direction: column; gap: 0.75rem; }
.quiz-accordion { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04); }
.quiz-summary { display: flex; justify-content: space-between; align-items: center; width: 100%; background: #f8fafc; border: none; padding: 0.95rem 1rem; cursor: pointer; font-weight: 600; color: #0f172a; text-align: left; }
.quiz-summary:hover { background: #f1f5f9; }
.quiz-summary-icon { color: #64748b; font-size: 1rem; }
.quiz-panel { padding: 0.9rem; background: #fcfdff; }
.quiz-box { border: 1px solid #e2e8f0; padding: 1rem; border-radius: 10px; background: #ffffff; }
.quiz-box-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.quiz-box-header h4 { color: #0f172a; font-weight: 700; font-size: 1rem; margin: 0; }
.quiz-box label { color: #334155; font-weight: 700; font-size: 0.95rem; margin-bottom: 0.4rem; display: block; }

.options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.answer-config { display: flex; gap: 1.5rem; margin-top: 1.25rem; align-items: flex-start; }
.answer-picker { flex-basis: 48%; }
.answer-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.answer-option { display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 1rem; border: 1px solid #dbeafe; border-radius: 14px; background: #eff6ff; color: #1e3a8a; font-weight: 700; transition: transform 0.2s ease, box-shadow 0.2s ease; box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.08); }
.answer-option:hover { transform: translateY(-1px); box-shadow: 0 10px 20px rgba(59, 130, 246, 0.12); }
.answer-option input { accent-color: #2563eb; }
.flex-grow { flex-grow: 1; }
.empty-state {

/* Two-column grid for quiz edit form */
.grid-form { display: grid; grid-template-columns: 1fr 320px; gap: 1.25rem; align-items: start; }
.grid-left { display: flex; flex-direction: column; gap: 0.6rem; }
.grid-right { display: flex; flex-direction: column; gap: 0.8rem; }
.answer-options.vertical { display: flex; flex-direction: column; gap: 0.6rem; }
.answer-option.large { padding: 0.9rem 1rem; border-radius: 12px; font-size: 0.98rem; }
.answer-option.large input { transform: scale(1.05); }

@media (max-width: 880px) {
  .grid-form { grid-template-columns: 1fr; }
  .answer-options { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  padding: 1.2rem;
  text-align: center;
  color: #64748b;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
}

.btn-primary { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; padding: 0.7rem 1rem; border-radius: 999px; cursor: pointer; font-weight: 700; box-shadow: 0 10px 20px rgba(37, 99, 235, 0.16); }
.btn-danger-sm { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 0.35rem 0.7rem; border-radius: 999px; cursor: pointer; font-size: 0.85rem; font-weight: 700; transition: all 0.2s ease; }
.btn-danger-sm:hover { background: #fee2e2; color: #b91c1c; }
.btn-success { background: #10b981; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer; font-weight: 700; }
.btn-secondary { background: #e2e8f0; color: #475569; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer; font-weight: 700; }

.editor-wrapper { margin-bottom: 1.5rem; background: #ffffff; }
.editor-wrapper :deep(.ql-container) { min-height: 220px; max-height: 420px; overflow-y: auto; font-family: inherit; font-size: 1rem; }
.editor-wrapper :deep(.ql-toolbar) { border-top-left-radius: 10px; border-top-right-radius: 10px; background: #f8fafc; border-color: #cbd5e1; }
.editor-wrapper :deep(.ql-container) { border-bottom-left-radius: 10px; border-bottom-right-radius: 10px; border-color: #cbd5e1; }
.editor-wrapper :deep(.ql-editor) { color: #1e293b !important; opacity: 1 !important; }
.editor-wrapper :deep(.ql-editor p),
.editor-wrapper :deep(.ql-editor h1),
.editor-wrapper :deep(.ql-editor h2),
.editor-wrapper :deep(.ql-editor h3),
.editor-wrapper :deep(.ql-editor h4),
.editor-wrapper :deep(.ql-editor h5),
.editor-wrapper :deep(.ql-editor h6),
.editor-wrapper :deep(.ql-editor li) { color: #1e293b !important; }

@media (max-width: 720px) {
  .options-grid, .answer-config, .answer-options { grid-template-columns: 1fr; display: grid; }
  .answer-picker { flex-basis: 100%; }
  .quiz-header { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
}
</style>