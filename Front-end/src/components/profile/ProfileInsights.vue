<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const props = defineProps({
  userId: {
    type: String,
    required: true,
  },
  initialSummary: {
    type: Object,
    default: null,
  },
  initialRecommendations: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['loaded'])

const router = useRouter()
const summary = ref(props.initialSummary)
const recommendations = ref(props.initialRecommendations)
const loadingInsights = ref(false)

const slugify = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const continueCourse = course => {
  const rawSlug = slugify(course?.title || course?.subject)
  const targetCourseSlug = rawSlug.replace(/-tutorial$/, '') || rawSlug
  router.push(`/learn/${targetCourseSlug}`)
}

const loadInsights = async () => {
  if (!props.userId || (summary.value && recommendations.value)) return
  loadingInsights.value = true
  try {
    const [summaryResult, recommendationsResult] = await Promise.allSettled([
      api.get(`/users/${props.userId}/summary`),
      api.get(`/users/${props.userId}/recommendations`),
    ])
    summary.value = summaryResult.status === 'fulfilled' ? summaryResult.value.data : summary.value
    recommendations.value =
      recommendationsResult.status === 'fulfilled' ? recommendationsResult.value.data : recommendations.value
    emit('loaded', { summary: summary.value, recommendations: recommendations.value })
  } finally {
    loadingInsights.value = false
  }
}

onMounted(loadInsights)
</script>

<template>
  <section class="insights-section">
    <div class="section-heading">
      <div>
        <p class="kicker">REFLECT & PLAN</p>
        <h2>AI learning insights</h2>
      </div>
      <span class="insight-tag">{{ loadingInsights ? 'ANALYZING...' : 'WEEKLY REVIEW' }}</span>
    </div>

    <div class="insights-grid">
      <article class="insight-panel summary-panel">
        <div class="insight-heading">
          <span class="insight-icon">✳</span>
          <div>
            <p class="kicker">YOUR WEEK IN REVIEW</p>
            <h3>Learning summary</h3>
          </div>
        </div>
        <template v-if="summary">
          <div class="insight-columns">
            <div>
              <span class="list-label strength-label">STRENGTHS</span>
              <ul>
                <li v-for="item in summary.strengths || []" :key="item">{{ item }}</li>
              </ul>
            </div>
            <div>
              <span class="list-label gap-label">ROOM TO GROW</span>
              <ul>
                <li v-for="item in summary.knowledgeGaps || []" :key="item">{{ item }}</li>
              </ul>
            </div>
          </div>
          <div v-if="summary.nextActions?.length" class="next-step">
            <span>NEXT STEP</span>
            <p>{{ summary.nextActions[0] }}</p>
          </div>
        </template>
        <p v-else class="muted-copy">
          {{ loadingInsights ? 'AI Mentor is preparing your weekly reflection...' : 'Your weekly reflection will appear after learning activity has been recorded.' }}
        </p>
      </article>

      <article class="insight-panel recommendation-panel">
        <div class="insight-heading">
          <span class="insight-icon recommend-icon">↗</span>
          <div>
            <p class="kicker">A PATH THAT FITS YOU</p>
            <h3>Recommended next</h3>
          </div>
        </div>
        <div v-if="recommendations?.recommendedCourses?.length" class="recommendation-list">
          <button
            v-for="course in recommendations.recommendedCourses"
            :key="course.courseId"
            class="recommendation-row"
            type="button"
            @click="continueCourse({ title: course.title, subject: course.subject })"
          >
            <span>
              <strong>{{ course.title }}</strong>
              <small>{{ course.reason }}</small>
            </span>
            <span class="recommend-arrow" aria-hidden="true">→</span>
          </button>
        </div>
        <p v-else class="muted-copy">
          {{ loadingInsights ? 'Generating personalized course recommendations...' : 'Course suggestions will appear as your learning history grows.' }}
        </p>
        <div v-if="recommendations?.reviewSuggestions?.length" class="review-list">
          <span class="list-label gap-label">TOPICS TO REVIEW</span>
          <p v-for="item in recommendations.reviewSuggestions" :key="item.topic">
            <span aria-hidden="true">↻</span> {{ item.topic }}
            <small>{{ item.recommendation }}</small>
          </p>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.kicker {
  margin: 0;
  color: #82928a;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.09em;
}

.insights-section {
  margin-top: 29px;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 13px;
}

.section-heading h2 {
  margin: 4px 0 0;
  color: #17324d;
  font-size: 1.28rem;
}

.insight-tag {
  padding: 6px 9px;
  border-radius: 5px;
  background: #eef4d9;
  color: #637b36;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.insights-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 14px;
}

.insight-panel {
  min-width: 0;
  padding: 20px;
  border: 1px solid #e2e8e0;
  border-radius: 10px;
  background: white;
}

.summary-panel {
  background: linear-gradient(145deg, #fff 50%, #f3f7e9);
}

.insight-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 17px;
}

.insight-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 10px;
  background: #e8f1db;
  color: #5d873b;
  font-size: 1.15rem;
}

.recommend-icon {
  background: #e2f1e9;
  color: #0f9f88;
}

.insight-heading h3 {
  margin: 3px 0 0;
  color: #17324d;
  font-size: 1.15rem;
}

.insight-heading .kicker {
  font-size: 0.7rem;
}

.insight-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.list-label {
  font-size: 0.75rem;
  font-weight: 850;
  letter-spacing: 0.05em;
}

.strength-label {
  color: #398269;
}

.gap-label {
  color: #b27935;
}

.insight-columns ul {
  display: grid;
  gap: 10px;
  margin: 10px 0 0;
  padding-left: 18px;
  color: #374151;
  font-size: 0.9rem;
  line-height: 1.55;
}

.insight-columns li::marker {
  color: #7eaa71;
}

.next-step {
  margin-top: 20px;
  padding: 14px 16px;
  border-left: 4px solid #d7e978;
  background: rgba(236, 244, 211, 0.56);
}

.next-step span {
  color: #657a35;
  font-size: 0.75rem;
  font-weight: 850;
  letter-spacing: 0.06em;
}

.next-step p {
  margin: 6px 0 0;
  color: #374151;
  font-size: 0.9rem;
  line-height: 1.55;
}

.muted-copy {
  margin: 0;
  color: #6b7280;
  font-size: 0.85rem;
  line-height: 1.55;
}

.recommendation-list {
  display: grid;
  gap: 4px;
}

.recommendation-row {
  display: flex;
  width: 100%;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border: 0;
  border-top: 1px solid #edf1ed;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.recommendation-row:first-child {
  border-top: 0;
  padding-top: 0;
}

.recommendation-row > span:first-child {
  display: grid;
  gap: 6px;
}

.recommendation-row strong {
  color: #17324d;
  font-size: 1rem;
}

.recommendation-row small {
  display: block;
  color: #4b5563;
  font-size: 0.85rem;
  line-height: 1.5;
}

.recommend-arrow {
  color: #0f9f88;
  font-size: 1.2rem;
  margin-top: 2px;
}

.review-list {
  display: grid;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e2e8e0;
}

.review-list p {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 4px 8px;
  margin: 0;
  color: #374151;
  font-size: 0.9rem;
  font-weight: 750;
  line-height: 1.4;
}

.review-list p > span {
  grid-row: span 2;
  color: #c58b3c;
  margin-top: 2px;
}

.review-list p small {
  display: block;
  color: #6b7280;
  font-size: 0.85rem;
  font-weight: 400;
  line-height: 1.5;
  margin-top: 2px;
}

@media (max-width: 900px) {
  .insights-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .insight-panel {
    padding: 15px;
  }
  .insight-columns {
    gap: 9px;
  }
}
</style>
