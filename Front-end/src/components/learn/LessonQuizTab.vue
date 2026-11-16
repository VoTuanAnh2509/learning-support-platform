<script setup>
import { computed, ref, watch } from 'vue'
import api from '@/services/api'

const props = defineProps({
  lesson: {
    type: Object,
    required: true,
  },
  courseId: {
    type: String,
    default: '',
  },
  userId: {
    type: String,
    default: '',
  },
  nextLessonTitle: {
    type: String,
    default: '',
  },
  isFinalReview: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['quiz-completed', 'continue-next'])

const quizDeck = ref([])
const currentQuizIndex = ref(0)
const selectedQuizAnswer = ref(null)
const quizSubmitted = ref(false)
const quizScore = ref(0)
const savingProgress = ref(false)
const quizError = ref('')

const shuffleArray = items => {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
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

const initializeQuizState = () => {
  const quizzes = Array.isArray(props.lesson?.quizzes) ? props.lesson.quizzes : []
  quizDeck.value = buildQuizDeck(quizzes)
  currentQuizIndex.value = 0
  selectedQuizAnswer.value = null
  quizSubmitted.value = false
  quizScore.value = 0
  quizError.value = ''
}

watch(
  () => props.lesson,
  () => {
    initializeQuizState()
  },
  { immediate: true }
)

const currentQuiz = computed(() => quizDeck.value[currentQuizIndex.value] || null)
const quizCompleted = computed(
  () => quizDeck.value.length > 0 && currentQuizIndex.value >= quizDeck.value.length
)
const isQuizCorrect = computed(() =>
  currentQuiz.value ? selectedQuizAnswer.value === currentQuiz.value.shuffledAnswerIndex : false
)

const selectCurrentQuizAnswer = index => {
  if (!quizSubmitted.value) selectedQuizAnswer.value = index
}

const submitQuiz = () => {
  quizError.value = ''
  if (quizSubmitted.value || selectedQuizAnswer.value === null || !currentQuiz.value) return
  quizSubmitted.value = true

  if (selectedQuizAnswer.value === currentQuiz.value.shuffledAnswerIndex) {
    quizScore.value += 1
  }
}

const nextQuestion = async () => {
  if (currentQuizIndex.value < quizDeck.value.length - 1) {
    currentQuizIndex.value += 1
    selectedQuizAnswer.value = null
    quizSubmitted.value = false
    return
  }

  quizError.value = ''
  savingProgress.value = true
  try {
    if (!props.userId || !props.courseId) {
      throw new Error('Unable to identify the signed-in user or course.')
    }

    const payload = {
      courseId: props.courseId,
      correctAnswers: quizScore.value,
      totalQuestions: quizDeck.value.length,
    }
    if (!props.isFinalReview && props.lesson?._id && props.lesson?.moduleId) {
      payload.moduleId = props.lesson.moduleId
      payload.lessonId = props.lesson._id
    }

    await api.post(`/users/${props.userId}/quiz-results`, payload)
    currentQuizIndex.value = quizDeck.value.length
    emit('quiz-completed', { score: quizScore.value, total: quizDeck.value.length })
  } catch (error) {
    quizError.value = error?.response?.data?.error || error.message || 'Unable to save quiz results.'
  } finally {
    savingProgress.value = false
  }
}
</script>

<template>
  <div class="tab-content fade-in quiz-shell">
    <p v-if="quizError" class="progress-error" role="alert">{{ quizError }}</p>

    <article v-if="quizDeck.length" class="quiz-card">
      <template v-if="currentQuiz">
        <div class="quiz-header">
          <p class="quiz-progress">Question {{ currentQuizIndex + 1 }} of {{ quizDeck.length }}</p>
          <p class="quiz-score">Score {{ quizScore }}</p>
        </div>

        <h3>{{ currentQuiz.question }}</h3>
        <div class="quiz-options">
          <label
            v-for="(option, index) in currentQuiz.shuffledOptions"
            :key="`${currentQuiz.quizKey}-${index}`"
            class="quiz-option"
            :class="{
              selected: selectedQuizAnswer === index,
              correct: quizSubmitted && index === currentQuiz.shuffledAnswerIndex,
              incorrect:
                quizSubmitted &&
                selectedQuizAnswer === index &&
                index !== currentQuiz.shuffledAnswerIndex,
            }"
          >
            <input
              type="radio"
              :name="currentQuiz.quizKey"
              :value="index"
              :checked="selectedQuizAnswer === index"
              :disabled="quizSubmitted"
              @change="selectCurrentQuizAnswer(index)"
            />
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
          <button
            v-if="!quizSubmitted"
            type="button"
            class="primary-button"
            :disabled="selectedQuizAnswer === null"
            @click="submitQuiz"
          >
            Submit Answer
          </button>
          <button
            v-else
            type="button"
            class="primary-button next-button"
            :disabled="savingProgress"
            @click="nextQuestion"
          >
            {{ currentQuizIndex < quizDeck.length - 1 ? 'Next Question ❯' : 'Finish Quiz' }}
          </button>
        </div>
      </template>

      <div v-else-if="quizCompleted" class="quiz-complete">
        <h3>🎉 Quiz Completed!</h3>
        <p>You scored {{ quizScore }} / {{ quizDeck.length }}. This lesson is now marked as completed.</p>

        <div class="quiz-actions quiz-complete-actions">
          <button type="button" class="secondary-quiz-btn" @click="initializeQuizState">
            Restart Quiz
          </button>
          <button
            v-if="!isFinalReview"
            type="button"
            class="primary-button"
            @click="emit('continue-next')"
          >
            {{ nextLessonTitle ? `Continue to ${nextLessonTitle} ❯` : 'Final Course Review 🏆' }}
          </button>
        </div>
      </div>
    </article>

    <article v-else class="quiz-card quiz-empty">
      <h3>No quiz available for this lesson</h3>
      <p>Please check other lessons or return to the reading material tab.</p>
    </article>
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

.progress-error {
  color: #f87171;
  margin: 0 0 1rem;
}

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

.quiz-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
  width: 100%;
  gap: 0.75rem;
}

.primary-button {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
}

.primary-button.next-button {
  background: #3b82f6;
}

.primary-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-quiz-btn {
  padding: 0.8rem 1.3rem;
  border-radius: 8px;
  border: 1px solid #475569;
  background: #334155;
  color: #f8fafc;
  font-weight: 700;
  cursor: pointer;
}

.secondary-quiz-btn:hover {
  background: #475569;
}
</style>
