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
  moduleId: String,
})

const emit = defineEmits(['close', 'saved'])

const decodeHtmlEntities = str =>
  String(str || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

const escapeHtmlEntities = str =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

// Chuyển chuỗi HTML từ MongoDB ("<ul><li><code>&lt;h1&gt;</code>...</li></ul>")
// sang văn bản nhiều dòng dễ đọc (mỗi dòng = 1 ý gạch đầu dòng)
const htmlExplanationToLines = html => {
  const raw = String(html || '').trim()
  if (!raw) return ''

  const liMatches = [...raw.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  const items = liMatches.length
    ? liMatches.map(m => m[1])
    : raw
        .replace(/<\/?(ul|ol|p|div)[^>]*>/gi, '\n')
        .split(/\n+/)

  return items
    .map(item => {
      const withBackticks = item
        .replace(/<(code|strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag, inner) => {
          return `\`${String(inner || '').trim()}\``
        })
        .replace(/<[^>]+>/g, '')
      return decodeHtmlEntities(withBackticks).replace(/\s+/g, ' ').trim()
    })
    .filter(Boolean)
    .join('\n')
}

// Chuyển các dòng văn bản về lại định dạng HTML "<ul><li>...</li></ul>" để lưu vào MongoDB
const linesToHtmlExplanation = text => {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(line => line.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean)

  if (!lines.length) return ''

  const listItems = lines.map(line => {
    const parts = line.split(/`([^`]+)`/g)
    const formatted = parts
      .map((part, idx) => {
        if (idx % 2 === 1) {
          return `<code>${escapeHtmlEntities(part)}</code>`
        }
        return escapeHtmlEntities(part).replace(
          /(&lt;\/?[a-zA-Z0-9!][^&]*?&gt;)/g,
          '<code>$1</code>'
        )
      })
      .join('')
    return `<li>${formatted}</li>`
  })

  return `<ul>${listItems.join('')}</ul>`
}

const form = ref({
  title: '',
  overview: '',
  content: '',
  videoUrl: '',
  videoTitle: '',
  videoIntro: '',
  codeExamples: [],
  codeExplanations: [],
  quizzes: [],
})
const explanationDrafts = ref([])
const isSaving = ref(false)
const activeTab = ref('theory')
const expandedQuizIndex = ref(null)
const previewCodeIndex = ref(null)

// Đồng bộ mảng codeExamples và codeExplanations lấy trực tiếp từ MongoDB
const normalizeCodeArrays = data => {
  const examples = Array.isArray(data?.codeExamples) ? [...data.codeExamples] : []
  const explanations = Array.isArray(data?.codeExplanations) ? [...data.codeExplanations] : []

  while (explanations.length < examples.length) {
    explanations.push('')
  }

  return { examples, explanations }
}

// Lấy dữ liệu bài học từ MongoDB khi mở modal
watch(
  () => props.lessonData,
  newData => {
    if (newData) {
      const cloned = JSON.parse(JSON.stringify(newData))
      const { examples, explanations } = normalizeCodeArrays(cloned)
      form.value = {
        ...cloned,
        title: cloned.title || '',
        overview: cloned.overview || '',
        content: cloned.content || '',
        videoUrl: cloned.videoUrl || '',
        videoTitle: cloned.videoTitle || '',
        videoIntro: cloned.videoIntro || '',
        codeExamples: examples,
        codeExplanations: explanations,
        quizzes: Array.isArray(cloned.quizzes) ? cloned.quizzes : [],
      }
      explanationDrafts.value = explanations.map(exp => htmlExplanationToLines(exp))
      activeTab.value = 'theory'
      expandedQuizIndex.value = null
      previewCodeIndex.value = null
    }
  },
  { immediate: true, deep: true }
)

const onExplanationDraftInput = index => {
  form.value.codeExplanations[index] = linesToHtmlExplanation(explanationDrafts.value[index])
}

// === CODE EXAMPLES MANAGEMENT ===
const addCodeExample = async () => {
  form.value.codeExamples.push('')
  explanationDrafts.value.push('')
  form.value.codeExplanations.push('')
  activeTab.value = 'code'

  await nextTick()
  const cards = document.querySelectorAll('.code-example-editor-card')
  if (cards.length > 0) {
    cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

const removeCodeExample = index => {
  form.value.codeExamples.splice(index, 1)
  form.value.codeExplanations.splice(index, 1)
  explanationDrafts.value.splice(index, 1)
  if (previewCodeIndex.value === index) {
    previewCodeIndex.value = null
  }
}

const moveCodeExample = (index, direction) => {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= form.value.codeExamples.length) return

  const tempCode = form.value.codeExamples[index]
  form.value.codeExamples[index] = form.value.codeExamples[targetIndex]
  form.value.codeExamples[targetIndex] = tempCode

  const tempExp = form.value.codeExplanations[index]
  form.value.codeExplanations[index] = form.value.codeExplanations[targetIndex]
  form.value.codeExplanations[targetIndex] = tempExp

  const tempDraft = explanationDrafts.value[index]
  explanationDrafts.value[index] = explanationDrafts.value[targetIndex]
  explanationDrafts.value[targetIndex] = tempDraft
}

const toggleCodePreview = index => {
  previewCodeIndex.value = previewCodeIndex.value === index ? null : index
}

// === QUIZZES MANAGEMENT ===
const toggleQuiz = index => {
  expandedQuizIndex.value = expandedQuizIndex.value === index ? null : index
}

const addQuiz = async () => {
  form.value.quizzes.push({
    question: '',
    options: ['', '', '', ''],
    answerIndex: 0,
    explanation: '',
    points: 5,
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

const removeQuiz = index => {
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
    const cleanedExamples = []
    const cleanedExplanations = []
    form.value.codeExamples.forEach((code, idx) => {
      if (String(code || '').trim()) {
        cleanedExamples.push(code)
        const htmlExp = linesToHtmlExplanation(explanationDrafts.value[idx])
        cleanedExplanations.push(htmlExp)
      }
    })

    await api.patch(
      `/courses/${props.courseId}/modules/${props.moduleId}/lessons/${form.value._id}`,
      {
        title: form.value.title,
        overview: form.value.overview,
        content: form.value.content,
        videoUrl: form.value.videoUrl,
        videoTitle: form.value.videoTitle,
        videoIntro: form.value.videoIntro,
        codeExamples: cleanedExamples,
        codeExplanations: cleanedExplanations,
        quizzes: form.value.quizzes,
      }
    )
    await Swal.fire({
      icon: 'success',
      title: 'Lesson updated successfully!',
      text: 'Theory, Code Examples, and Quizzes have been saved.',
      confirmButtonColor: '#10b981',
    })
    emit('saved')
    emit('close')
  } catch (error) {
    await Swal.fire({
      icon: 'error',
      title: 'Unable to save lesson',
      text: error.response?.data?.error || error.message,
      confirmButtonColor: '#ef4444',
    })
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => {
  const origNormalized = normalizeCodeArrays(props.lessonData)
  const currentDataStr = JSON.stringify({
    title: form.value.title,
    overview: form.value.overview || '',
    content: form.value.content,
    videoUrl: form.value.videoUrl || '',
    codeExamples: form.value.codeExamples,
    codeExplanations: explanationDrafts.value.map(d => linesToHtmlExplanation(d)),
    quizzes: form.value.quizzes,
  })

  const originalDataStr = JSON.stringify({
    title: props.lessonData?.title || '',
    overview: props.lessonData?.overview || '',
    content: props.lessonData?.content || '',
    videoUrl: props.lessonData?.videoUrl || '',
    codeExamples: origNormalized.examples,
    codeExplanations: origNormalized.explanations.map(e =>
      linesToHtmlExplanation(htmlExplanationToLines(e))
    ),
    quizzes: props.lessonData?.quizzes || [],
  })

  if (currentDataStr === originalDataStr) {
    emit('close')
    return
  }

  Swal.fire({
    title: 'Unsaved Changes!',
    text: 'You have modified this lesson. Are you sure you want to discard these changes?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Yes, discard changes',
    cancelButtonText: 'No, keep editing',
    background: '#ffffff',
    customClass: {
      title: 'swal-title-bold',
    },
  }).then(result => {
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
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'theory' }"
            @click="activeTab = 'theory'"
          >
            📖 Theory & Video
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'code' }"
            @click="activeTab = 'code'"
          >
            💻 Code Examples ({{ form.codeExamples.length }})
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'quizzes' }"
            @click="activeTab = 'quizzes'"
          >
            🎯 Quizzes ({{ form.quizzes.length }})
          </button>
        </div>

        <!-- TAB 1: THEORY & VIDEO -->
        <div v-if="activeTab === 'theory'" class="tab-panel">
          <div class="form-group">
            <label>Lesson Title:</label>
            <input
              v-model="form.title"
              type="text"
              class="form-control"
              placeholder="e.g. HTML Elements & Attributes"
              required
            />
          </div>

          <div class="form-group">
            <label>Short Overview / Highlight (appears above theory):</label>
            <input
              v-model="form.overview"
              type="text"
              class="form-control"
              placeholder="One-line summary shown on course page"
            />
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

        <!-- TAB 2: INTERACTIVE CODE EXAMPLES ("TRY IT YOURSELF") -->
        <div v-else-if="activeTab === 'code'" class="tab-panel">
          <div class="code-examples-header">
            <div>
              <h3>Interactive Code Examples ("Try it Yourself")</h3>
              <p class="quiz-subtitle">
                Manage runnable code snippets and explanations loaded directly
              </p>
            </div>
            <button type="button" class="btn-primary" @click="addCodeExample">
              ➕ Add New Code Example
            </button>
          </div>

          <div v-if="form.codeExamples.length" class="code-examples-list">
            <div
              v-for="(_code, index) in form.codeExamples"
              :key="index"
              class="code-example-editor-card"
            >
              <div class="code-card-top">
                <div class="code-card-title">
                  <span class="code-badge">Example #{{ index + 1 }}</span>
                  <small>Renders with a "Try it Yourself ❯" interactive sandbox button</small>
                </div>
                <div class="code-card-controls">
                  <button
                    type="button"
                    class="btn-preview-code"
                    @click="toggleCodePreview(index)"
                  >
                    {{ previewCodeIndex === index ? '🙈 Hide Preview' : '▶️ Test Live Output' }}
                  </button>
                  <button
                    type="button"
                    class="btn-move-code"
                    :disabled="index === 0"
                    title="Move up"
                    @click="moveCodeExample(index, -1)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="btn-move-code"
                    :disabled="index === form.codeExamples.length - 1"
                    title="Move down"
                    @click="moveCodeExample(index, 1)"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    class="btn-danger-sm"
                    @click="removeCodeExample(index)"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div class="code-editor-split" :class="{ 'with-preview': previewCodeIndex === index }">
                <div class="code-input-column">
                  <label class="code-field-label">
                    Source Code (HTML / CSS / JS snippet):
                  </label>
                  <textarea
                    v-model="form.codeExamples[index]"
                    class="code-editor-textarea"
                    rows="10"
                    spellcheck="false"
                    placeholder="Paste or write your HTML, CSS, or JavaScript code example here..."
                  ></textarea>
                </div>

                <div v-if="previewCodeIndex === index" class="code-preview-column">
                  <label class="code-field-label">Live Sandbox Preview:</label>
                  <div class="code-preview-frame">
                    <iframe
                      :srcdoc="form.codeExamples[index]"
                      sandbox="allow-scripts"
                      frameborder="0"
                    ></iframe>
                  </div>
                </div>
              </div>

              <!-- CLEAN MULTI-LINE EXPLANATION EDITOR + LIVE PREVIEW -->
              <div class="code-explanation-group">
                <div class="explanation-label-row">
                  <div>
                    <label class="code-field-label" style="margin-bottom: 2px;">
                      📝 Code Explanation / Notes (Each line = 1 bullet point •):
                    </label>
                    <small class="explanation-helper-hint">
                      Press Enter for a new bullet point. Wrap tags or keywords in
                      <code>`...`</code> (e.g. <code>`&lt;h1&gt;`</code> or <code>`href`</code>) to highlight them as code.
                    </small>
                  </div>
                </div>

                <textarea
                  v-model="explanationDrafts[index]"
                  class="explanation-clean-textarea"
                  rows="5"
                  placeholder="Write each explanation point on a new line..."
                  @input="onExplanationDraftInput(index)"
                ></textarea>

                <!-- LIVE RENDERED PREVIEW -->
                <div v-if="form.codeExplanations[index]" class="explanation-live-preview">
                  <span class="preview-kicker">👁️ Live Preview (Displayed below "Try it Yourself"):</span>
                  <div
                    class="explanation-preview-content"
                    v-html="form.codeExplanations[index]"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            <p style="margin: 0 0 0.75rem; font-weight: 600; color: #334155;">
              No code examples in this lesson yet.
            </p>
            <button type="button" class="btn-primary" @click="addCodeExample">
              ➕ Add New Code Example
            </button>
          </div>
        </div>

        <!-- TAB 3: PRACTICE QUIZZES -->
        <div v-else class="tab-panel">
          <div class="quiz-section">
            <div class="quiz-header">
              <div>
                <h3>Practice Quizzes</h3>
                <p class="quiz-subtitle">Expand any question to edit its details.</p>
              </div>
              <button type="button" class="btn-primary" @click="addQuiz">
                ➕ Add New Question
              </button>
            </div>

            <div v-if="form.quizzes.length" class="quiz-list">
              <div v-for="(quiz, index) in form.quizzes" :key="index" class="quiz-accordion">
                <button type="button" class="quiz-summary" @click="toggleQuiz(index)">
                  <span>{{ index + 1 }}. {{ quiz.question || 'Untitled question' }}</span>
                  <span class="quiz-summary-icon">{{
                    expandedQuizIndex === index ? '▾' : '▸'
                  }}</span>
                </button>

                <div v-if="expandedQuizIndex === index" class="quiz-panel">
                  <div class="quiz-box">
                    <div class="quiz-box-header">
                      <h4>{{ quiz.question || `Question ${index + 1}` }}</h4>
                      <button
                        type="button"
                        class="btn-danger-sm"
                        @click.stop="removeQuiz(index)"
                      >
                        Remove
                      </button>
                    </div>

                    <div class="grid-form">
                      <div class="grid-left">
                        <label>Question text:</label>
                        <input v-model="quiz.question" type="text" class="form-control" />

                        <div class="options-grid">
                          <div v-for="optIdx in 4" :key="optIdx" class="option-item">
                            <label>Option {{ optIdx }}:</label>
                            <input
                              v-model="quiz.options[optIdx - 1]"
                              type="text"
                              class="form-control"
                            />
                          </div>
                        </div>
                      </div>

                      <div class="grid-right">
                        <div class="answer-picker">
                          <label>Correct Answer</label>
                          <div class="answer-options vertical">
                            <label
                              v-for="optIdx in 4"
                              :key="optIdx"
                              class="answer-option large"
                            >
                              <input
                                v-model.number="quiz.answerIndex"
                                type="radio"
                                :name="`correct-answer-${index}`"
                                :value="optIdx - 1"
                              />
                              <span>Option {{ optIdx }}</span>
                            </label>
                          </div>
                        </div>

                        <div class="flex-grow">
                          <label>Explanation (when wrong):</label>
                          <input v-model="quiz.explanation" type="text" class="form-control" />

                          <label>Points:</label>
                          <input
                            v-model.number="quiz.points"
                            type="number"
                            min="0"
                            class="form-control"
                          />
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
        <button type="button" class="btn-secondary" @click="handleCancel">Cancel</button>
        <button type="button" class="btn-success" :disabled="isSaving" @click="handleSave">
          {{ isSaving ? 'Saving...' : '💾 Save Changes' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background: white;
  width: 940px;
  max-width: 95vw;
  max-height: 90vh;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 50px -15px rgba(15, 23, 42, 0.28);
  overflow: hidden;
}
.modal-header,
.modal-footer {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h2 {
  margin: 0;
  color: #0f172a;
  font-size: 1.25rem;
}
.close-btn {
  background: none;
  border: none;
  font-size: 1.3rem;
  cursor: pointer;
  color: #64748b;
}
.modal-body {
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
  flex-grow: 1;
}
.modal-footer {
  border-top: 1px solid #e2e8f0;
  border-bottom: none;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.tab-switcher {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  padding: 0.35rem;
  margin-bottom: 1.15rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
}
.tab-btn {
  border: none;
  background: transparent;
  color: #475569;
  padding: 0.6rem 1.1rem;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}
.tab-btn.active {
  background: linear-gradient(135deg, #0f766e, #2563eb);
  color: white;
  box-shadow: 0 8px 16px rgba(15, 118, 110, 0.18);
}

.form-group label {
  font-weight: 700;
  color: #334155;
  display: block;
  margin-bottom: 0.5rem;
}
.input-sub-label {
  font-size: 0.95rem;
  color: #475569;
}
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
.form-control {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  margin-bottom: 1rem;
  font-family: inherit;
  background: #fff;
  color: #0f172a;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.form-control:focus {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
}

/* CODE EXAMPLES TAB STYLES */
.code-examples-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  padding-bottom: 0.85rem;
  margin-bottom: 1.1rem;
  border-bottom: 1px solid #e2e8f0;
}
.code-examples-header h3 {
  color: #0f172a;
  font-weight: 700;
  font-size: 1.15rem;
  margin: 0;
}
.code-examples-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.code-example-editor-card {
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  padding: 1.1rem;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
}
.code-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}
.code-card-title {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}
.code-badge {
  background: #0f766e;
  color: #ffffff;
  font-size: 0.76rem;
  font-weight: 800;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
}
.code-card-title small {
  color: #64748b;
  font-size: 0.8rem;
}
.code-card-controls {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.btn-preview-code {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}
.btn-preview-code:hover {
  background: #dbeafe;
}
.btn-move-code {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  font-weight: 800;
  cursor: pointer;
}
.btn-move-code:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.code-editor-split {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-bottom: 0.85rem;
}
.code-editor-split.with-preview {
  grid-template-columns: 1fr 1fr;
}
.code-field-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.4rem;
}
.code-editor-textarea {
  width: 100%;
  min-height: 190px;
  padding: 0.9rem 1rem;
  border-radius: 10px;
  border: 1px solid #1e293b;
  background: #1e293b;
  color: #f8fafc;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  resize: vertical;
  border-left: 4px solid #10b981;
}
.code-editor-textarea:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
}
.code-preview-frame {
  width: 100%;
  height: 190px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  overflow: hidden;
}
.code-preview-frame iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #ffffff;
}

/* CLEAN MULTI-LINE EXPLANATION EDITOR + PREVIEW */
.code-explanation-group {
  margin-top: 0.5rem;
  padding-top: 0.85rem;
  border-top: 1px dashed #cbd5e1;
}
.explanation-label-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.55rem;
}
.explanation-helper-hint {
  display: block;
  color: #64748b;
  font-size: 0.78rem;
  line-height: 1.45;
}
.explanation-helper-hint code {
  background: #e2e8f0;
  color: #0f766e;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-weight: 700;
}
.explanation-clean-textarea {
  width: 100%;
  min-height: 145px;
  padding: 0.9rem 1.05rem;
  border: 1.5px solid #cbd5e1;
  border-radius: 10px;
  background: #ffffff;
  color: #0f172a;
  font-family: inherit;
  font-size: 0.95rem;
  line-height: 1.75;
  resize: vertical;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.explanation-clean-textarea:focus {
  outline: none;
  border-color: #0f766e;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.15);
}
.explanation-live-preview {
  margin-top: 0.75rem;
  padding: 0.85rem 1.15rem;
  border-radius: 10px;
  background: #f1f5f9;
  border-left: 4px solid #10b981;
}
.preview-kicker {
  display: block;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #0f766e;
  margin-bottom: 0.45rem;
}
.explanation-preview-content {
  color: #334155;
  font-size: 0.92rem;
  line-height: 1.65;
}
.explanation-preview-content :deep(ul) {
  margin: 0;
  padding-left: 1.25rem;
}
.explanation-preview-content :deep(li) {
  margin-bottom: 0.4rem;
  color: #1e293b;
}
.explanation-preview-content :deep(code),
.explanation-preview-content :deep(strong) {
  background: #e2e8f0;
  color: #0f766e;
  padding: 0.12rem 0.4rem;
  border-radius: 5px;
  font-family: Consolas, monospace;
  font-size: 0.86rem;
  font-weight: 700;
}

/* QUIZZES TAB STYLES */
.quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
}
.quiz-header h3 {
  color: #0f172a;
  font-weight: 700;
  font-size: 1.2rem;
  margin: 0;
}
.quiz-subtitle {
  color: #64748b;
  margin: 0.2rem 0 0;
  font-size: 0.9rem;
}
.quiz-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.quiz-accordion {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}
.quiz-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  background: #f8fafc;
  border: none;
  padding: 0.95rem 1rem;
  cursor: pointer;
  font-weight: 600;
  color: #0f172a;
  text-align: left;
}
.quiz-summary:hover {
  background: #f1f5f9;
}
.quiz-summary-icon {
  color: #64748b;
  font-size: 1rem;
}
.quiz-panel {
  padding: 0.9rem;
  background: #fcfdff;
}
.quiz-box {
  border: 1px solid #e2e8f0;
  padding: 1rem;
  border-radius: 10px;
  background: #ffffff;
}
.quiz-box-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.quiz-box-header h4 {
  color: #0f172a;
  font-weight: 700;
  font-size: 1rem;
  margin: 0;
}
.quiz-box label {
  color: #334155;
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 0.4rem;
  display: block;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.answer-picker {
  flex-basis: 48%;
}
.answer-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.answer-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  border: 1px solid #dbeafe;
  border-radius: 14px;
  background: #eff6ff;
  color: #1e3a8a;
  font-weight: 700;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.08);
}
.answer-option:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(59, 130, 246, 0.12);
}
.answer-option input {
  accent-color: #2563eb;
}
.flex-grow {
  flex-grow: 1;
}

.grid-form {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: start;
}
.grid-left {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.grid-right {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.answer-options.vertical {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.answer-option.large {
  padding: 0.9rem 1rem;
  border-radius: 12px;
  font-size: 0.98rem;
}
.answer-option.large input {
  transform: scale(1.05);
}

.empty-state {
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  color: #64748b;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  padding: 0.55rem 1rem;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.84rem;
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.16);
}
.btn-danger-sm {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 700;
  transition: all 0.2s ease;
}
.btn-danger-sm:hover {
  background: #fee2e2;
  color: #b91c1c;
}
.btn-success {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
}
.btn-secondary {
  background: #e2e8f0;
  color: #475569;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
}

.editor-wrapper {
  margin-bottom: 1.5rem;
  background: #ffffff;
}
.editor-wrapper :deep(.ql-container) {
  min-height: 220px;
  max-height: 420px;
  overflow-y: auto;
  font-family: inherit;
  font-size: 1rem;
}
.editor-wrapper :deep(.ql-toolbar) {
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  background: #f8fafc;
  border-color: #cbd5e1;
}
.editor-wrapper :deep(.ql-container) {
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
  border-color: #cbd5e1;
}
.editor-wrapper :deep(.ql-editor) {
  color: #1e293b !important;
  opacity: 1 !important;
}
.editor-wrapper :deep(.ql-editor p),
.editor-wrapper :deep(.ql-editor h1),
.editor-wrapper :deep(.ql-editor h2),
.editor-wrapper :deep(.ql-editor h3),
.editor-wrapper :deep(.ql-editor h4),
.editor-wrapper :deep(.ql-editor h5),
.editor-wrapper :deep(.ql-editor h6),
.editor-wrapper :deep(.ql-editor li) {
  color: #1e293b !important;
}

@media (max-width: 880px) {
  .grid-form,
  .code-editor-split.with-preview {
    grid-template-columns: 1fr;
  }
  .answer-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .options-grid,
  .answer-options {
    grid-template-columns: 1fr;
    display: grid;
  }
  .answer-picker {
    flex-basis: 100%;
  }
  .quiz-header,
  .code-examples-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
}
</style>
