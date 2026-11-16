<script setup>
import { computed, ref, watch } from 'vue'
import { marked } from 'marked'
import api from '@/services/api'

const props = defineProps({
  lesson: {
    type: Object,
    required: true,
  },
  courseSubject: {
    type: String,
    default: 'Programming',
  },
  userId: {
    type: String,
    default: '',
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['open-quiz'])

const activeEditors = ref({})
const editableCodes = ref({})
const editorFeedbacks = ref({})
const isEditorReviewing = ref({})

const currentCodeExamples = computed(() => props.lesson?.codeExamples || [])
const currentCodeExplanations = computed(() => props.lesson?.codeExplanations || [])
const currentQuizzes = computed(() => props.lesson?.quizzes || [])

watch(
  () => props.lesson,
  () => {
    activeEditors.value = {}
    editableCodes.value = {}
    editorFeedbacks.value = {}
  }
)

const openLiveEditor = (index, originalCode) => {
  activeEditors.value[index] = true
  editableCodes.value[index] = originalCode
  editorFeedbacks.value[index] = null
}

const closeLiveEditor = index => {
  activeEditors.value[index] = false
}

const submitCodeForReview = async index => {
  const code = editableCodes.value[index]
  if (!code || isEditorReviewing.value[index]) return

  isEditorReviewing.value[index] = true
  editorFeedbacks.value[index] = null

  try {
    const response = await api.post('/ai/feedback', {
      userId: props.userId,
      submittedAnswer: code,
      subject: props.courseSubject,
    })
    editorFeedbacks.value[index] = response.data.feedback
  } catch (_error) {
    editorFeedbacks.value[index] = 'Sorry, unable to get AI feedback at this time.'
  } finally {
    isEditorReviewing.value[index] = false
  }
}

const renderMarkdown = text => (text ? marked(text) : '')
</script>

<template>
  <div class="tab-content fade-in">
    <p class="lesson-overview">{{ lesson.overview }}</p>
    <div class="lesson-theory" v-html="lesson.content"></div>

    <section v-if="currentCodeExamples.length" class="lesson-block">
      <h2>Code Examples</h2>

      <div v-for="(code, index) in currentCodeExamples" :key="index" class="code-wrapper">
        <div v-if="!activeEditors[index]" class="static-code-view">
          <pre><code>{{ code }}</code></pre>

          <button type="button" class="btn-try-it" @click="openLiveEditor(index, code)">
            Try it Yourself ❯
          </button>

          <div
            v-if="currentCodeExplanations[index]"
            class="code-explanation"
            v-html="currentCodeExplanations[index]"
          ></div>
        </div>

        <div v-else class="live-editor-view">
          <div class="live-editor-header">
            <h3>Interactive Code Playground</h3>
            <div class="editor-actions">
              <button
                type="button"
                class="btn-ask-ai"
                :disabled="isEditorReviewing[index]"
                @click="submitCodeForReview(index)"
              >
                {{ isEditorReviewing[index] ? 'Reviewing...' : '✨ Ask AI to Review' }}
              </button>
              <button type="button" class="btn-close-editor" @click="closeLiveEditor(index)">
                ✖ Close Editor
              </button>
            </div>
          </div>

          <div class="live-editor-split">
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

          <div
            v-if="editorFeedbacks[index]"
            class="editor-ai-feedback markdown-body fade-in"
            v-html="renderMarkdown(editorFeedbacks[index])"
          ></div>
        </div>
      </div>
    </section>

    <div v-if="currentQuizzes.length > 0 && !isCompleted" class="quiz-callout-banner">
      <div class="quiz-callout-copy">
        <strong>🎯 Ready to test what you just read?</strong>
        <p>
          Complete the {{ currentQuizzes.length }}-question Practice Quiz to finish this lesson and unlock the next step.
        </p>
      </div>
      <button type="button" class="btn-start-quiz-callout" @click="emit('open-quiz')">
        Take Practice Quiz ➔
      </button>
    </div>
  </div>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.3s ease-in-out;
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

.lesson-overview {
  color: #1e293b !important;
  font-size: 1.1rem !important;
  font-weight: 600 !important;
  line-height: 1.6 !important;
  margin-top: 1rem !important;
  margin-bottom: 1.5rem !important;
}

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
  line-height: 1.6;
  font-size: 1.05rem;
}

.lesson-block h2 {
  color: #0f172a !important;
  font-size: 1.4rem !important;
  font-weight: 700 !important;
  margin-top: 2rem !important;
  margin-bottom: 1rem !important;
}

.code-wrapper pre {
  background: #1e293b;
  color: #f8fafc;
  padding: 1.2rem;
  border-radius: 8px 8px 0 0;
  margin-bottom: 0;
  overflow-x: auto;
  border-left: 4px solid #10b981;
  font-family: Consolas, monospace;
  line-height: 1.5;
}

.btn-try-it {
  display: block;
  width: 100%;
  background-color: #04aa6d;
  color: white;
  border: none;
  padding: 0.85rem 1.5rem;
  font-size: 1.05rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  border-radius: 0 0 8px 8px;
  transition: background-color 0.2s;
  margin-bottom: 1rem;
}

.btn-try-it:hover {
  background-color: #059862;
}

.code-explanation {
  background-color: #f1f5f9;
  border-left: 4px solid #10b981;
  border-radius: 0 0 8px 8px;
  padding: 1rem 1.5rem;
  color: #334155;
  margin-bottom: 1.25rem;
}

.code-explanation :deep(ul) {
  margin: 0;
  padding-left: 1.2rem;
}

.code-explanation :deep(li) {
  margin-bottom: 0.5rem;
  color: #334155;
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
}

.btn-ask-ai:disabled {
  opacity: 0.6;
  cursor: wait;
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

.live-editor-split {
  display: flex;
  height: 420px;
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

.editor-ai-feedback {
  padding: 1.5rem;
  background: #f8fafc;
  border-top: 1px solid #cbd5e1;
  color: #1e293b;
}

.quiz-callout-banner {
  margin-top: 2rem;
  padding: 1.25rem 1.5rem;
  border-radius: 14px;
  background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
  border: 1px solid #a7f3d0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.quiz-callout-copy strong {
  display: block;
  color: #065f46;
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.quiz-callout-copy p {
  margin: 0;
  color: #047857;
  font-size: 0.9rem;
}

.btn-start-quiz-callout {
  padding: 0.7rem 1.25rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, #10b981, #0f766e);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.22);
}
</style>
