<script setup>
import { computed, ref, watch } from 'vue'
import { Bar } from 'vue-chartjs'
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip } from 'chart.js'
import ProfileCoursesSection from '@/components/profile/ProfileCoursesSection.vue'
import { getAvatarPreset } from '@/utils/avatarPresets'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const props = defineProps({
  profile: {
    type: Object,
    required: true,
  },
  progress: {
    type: Object,
    default: null,
  },
  userId: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update-bookmarks'])

const displayName = computed(() => props.profile?.name || props.profile?.email?.split('@')[0] || 'Learner')
const avatarInitials = computed(() =>
  displayName.value
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
)
const activePreset = computed(() => getAvatarPreset(props.profile?.avatarPreset))
const avatarImgFailed = ref(false)
watch(
  () => props.profile?.avatarUrl,
  () => {
    avatarImgFailed.value = false
  }
)
const progressSummary = computed(() => props.progress?.progressSummary || {})

const statItems = computed(() => [
  { label: 'Courses completed', value: progressSummary.value.completedCourses || 0, detail: 'Course milestones' },
  { label: 'Lessons completed', value: progressSummary.value.completedLessons || 0, detail: 'Learning milestones' },
  { label: 'Quiz average', value: `${progressSummary.value.quiz?.averageScore || 0}%`, detail: `${progressSummary.value.quiz?.attempts || 0} attempts` },
  { label: 'Exercise average', value: `${progressSummary.value.exercises?.averageScore || 0}%`, detail: `${progressSummary.value.exercises?.attempts || 0} attempts` },
  { label: 'Practice attempts', value: progressSummary.value.practiceAttempts || 0, detail: `${progressSummary.value.accuracy || 0}% overall accuracy` },
])

const studyChartData = computed(() => {
  const studyTime = progressSummary.value.studyTime || []
  return {
    labels: studyTime.map(item => item.courseName || item.courseSlug.toUpperCase()),
    datasets: [
      {
        label: 'Study time (minutes)',
        data: studyTime.map(item => item.minutes),
        backgroundColor: studyTime.map((_, index) => ['#10b981', '#3b82f6', '#f59e0b'][index % 3]),
        borderRadius: 5,
      },
    ],
  }
})

const studyChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: context => `${context.parsed.y} minutes` } },
  },
  scales: {
    y: { beginAtZero: true, title: { display: true, text: 'Minutes' } },
  },
}

const formatDate = value =>
  value ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value)) : ''
</script>

<template>
  <div>
    <section class="profile-panel identity-panel">
      <div class="identity-main">
        <div
          class="avatar"
          :style="{ background: activePreset?.bg || '#d8ed91' }"
          aria-hidden="true"
        >
          <img
            v-if="profile.avatarUrl && !avatarImgFailed"
            :src="profile.avatarUrl"
            alt="User avatar"
            class="avatar-img"
            @error="avatarImgFailed = true"
          />
          <span v-else-if="activePreset?.emoji" class="avatar-emoji">{{ activePreset.emoji }}</span>
          <span v-else>{{ avatarInitials }}</span>
        </div>
        <div class="identity-copy">
          <div class="identity-title-row">
            <h2>{{ displayName }}</h2>
            <span class="role-pill">
              {{ profile.role === 'admin' ? 'Admin' : profile.role === 'instructor' ? 'Instructor' : 'Learner' }}
            </span>
          </div>
          <p>{{ profile.email }}</p>
          <span class="member-meta">Learning since {{ formatDate(profile.createdAt) || 'today' }}</span>
        </div>
      </div>
      <div class="identity-aside">
        <span class="aside-label">ACTIVE COURSES</span>
        <strong>{{ (profile.enrolledCourses || []).filter(entry => entry.course).length }} Courses</strong>
        <span>Keep building one lesson at a time.</span>
      </div>
    </section>

    <section class="stats-section" aria-labelledby="progress-title">
      <div class="section-heading">
        <div>
          <p class="kicker">YOUR ACTIVITY</p>
          <h2 id="progress-title">Learning progress</h2>
        </div>
        <span class="live-label"><span></span> System records</span>
      </div>
      <div class="stats-grid">
        <article
          v-for="(stat, index) in statItems"
          :key="stat.label"
          class="stat-card"
          :class="`stat-tone-${index % 3}`"
        >
          <span class="stat-index">0{{ index + 1 }}</span>
          <strong>{{ stat.value }}</strong>
          <span class="stat-label">{{ stat.label }}</span>
          <small>{{ stat.detail }}</small>
        </article>
      </div>
    </section>

    <section class="profile-panel study-chart-panel" aria-labelledby="study-chart-title">
      <div class="section-heading compact-heading">
        <div>
          <p class="kicker">TIME INVESTED</p>
          <h2 id="study-chart-title">Study time by course</h2>
        </div>
        <small class="chart-note">Based on estimated durations of completed lessons</small>
      </div>
      <div v-if="studyChartData.labels.length" class="study-chart">
        <Bar
          :data="studyChartData"
          :options="studyChartOptions"
          aria-label="Bar chart showing study minutes by course"
        />
      </div>
      <p v-else class="chart-empty">Complete lessons to see study time for each course.</p>
    </section>

    <div class="main-grid">
      <ProfileCoursesSection
        :profile="profile"
        :userId="userId"
        @update-bookmarks="emit('update-bookmarks', $event)"
      />

      <section class="profile-panel score-panel" aria-labelledby="scores-title">
        <div class="section-heading compact-heading">
          <div>
            <p class="kicker">PRACTICE & RETENTION</p>
            <h2 id="scores-title">Score snapshot</h2>
          </div>
        </div>
        <div class="score-bars">
          <div class="score-item">
            <div class="score-meta">
              <span>Quizzes</span>
              <strong>{{ progressSummary.quiz?.averageScore || 0 }}%</strong>
            </div>
            <div class="score-track">
              <span class="quiz-fill" :style="{ width: `${progressSummary.quiz?.averageScore || 0}%` }"></span>
            </div>
            <small>{{ progressSummary.quiz?.attempts || 0 }} recorded attempts</small>
          </div>
          <div class="score-item">
            <div class="score-meta">
              <span>Exercises</span>
              <strong>{{ progressSummary.exercises?.averageScore || 0 }}%</strong>
            </div>
            <div class="score-track">
              <span class="exercise-fill" :style="{ width: `${progressSummary.exercises?.averageScore || 0}%` }"></span>
            </div>
            <small>{{ progressSummary.exercises?.attempts || 0 }} recorded attempts</small>
          </div>
        </div>
        <div class="score-foot">
          <span>OVERALL ACCURACY</span>
          <strong>{{ progressSummary.accuracy || 0 }}<small>%</small></strong>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.kicker,
.aside-label {
  margin: 0;
  color: #82928a;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.09em;
}

.profile-panel {
  border: 1px solid #e2e8e0;
  border-radius: 10px;
  background: #fff;
}

.section-heading,
.identity-main,
.identity-title-row,
.score-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.identity-panel {
  display: flex;
  min-height: 144px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 26px;
  background: linear-gradient(110deg, #fff 65%, #f1f8eb);
}

.identity-main {
  justify-content: flex-start;
}

.avatar {
  display: grid;
  width: 82px;
  height: 82px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 25px;
  background: #d8ed91;
  color: #315e47;
  font-size: 1.45rem;
  font-weight: 850;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-emoji {
  font-size: 2.3rem;
  line-height: 1;
}

.identity-copy h2 {
  margin: 0;
  color: #17324d;
  font-size: 1.55rem;
}

.identity-copy p {
  margin: 5px 0;
  color: #647870;
  font-size: 0.87rem;
}

.role-pill {
  padding: 5px 10px;
  border: 1px solid #cfe8dc;
  border-radius: 999px;
  background: #eaf6ef;
  color: #197a60;
  font-size: 0.68rem;
  font-weight: 800;
}

.member-meta {
  color: #8a9992;
  font-size: 0.7rem;
}

.identity-aside {
  display: grid;
  min-width: 174px;
  gap: 5px;
  padding-left: 22px;
  border-left: 1px solid #e2e8e0;
}

.identity-aside strong {
  color: #0f766e;
  font-size: 1.05rem;
  text-transform: capitalize;
}

.identity-aside > span:last-child {
  color: #52708a;
  font-size: 0.7rem;
}

.stats-section {
  margin-top: 29px;
}

.section-heading {
  margin-bottom: 13px;
  align-items: flex-end;
}

.section-heading h2 {
  margin: 4px 0 0;
  color: #17324d;
  font-size: 1.28rem;
}

.live-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #798a82;
  font-size: 0.68rem;
}

.live-label span {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #31a77d;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.stat-card {
  position: relative;
  display: grid;
  min-height: 126px;
  align-content: center;
  gap: 2px;
  overflow: hidden;
  padding: 16px 18px;
  border: 1px solid #e2e8e0;
  border-radius: 9px;
  background: white;
}

.stat-card::after {
  position: absolute;
  right: -20px;
  bottom: -29px;
  width: 86px;
  height: 86px;
  border: 1px solid rgba(20, 95, 80, 0.1);
  border-radius: 50%;
  content: '';
}

.stat-index {
  color: #9aaa9f;
  font-size: 0.63rem;
  font-weight: 800;
}

.stat-card > strong {
  margin-top: 3px;
  color: #17324d;
  font-size: 1.55rem;
  line-height: 1.15;
}

.stat-label {
  color: #52675e;
  font-size: 0.78rem;
  font-weight: 750;
}

.stat-card small {
  color: #8a9992;
  font-size: 0.66rem;
}

.stat-tone-0 {
  border-top: 3px solid #43a989;
}

.stat-tone-1 {
  border-top: 3px solid #b4cf51;
}

.stat-tone-2 {
  border-top: 3px solid #e7a75a;
}

.study-chart-panel {
  margin-top: 15px;
  padding: 20px;
}

.study-chart {
  position: relative;
  height: 260px;
}

.chart-note {
  color: #8a9992;
  font-size: 0.68rem;
}

.chart-empty {
  display: grid;
  min-height: 120px;
  place-items: center;
  margin: 0;
  color: #52708a;
  font-size: 0.82rem;
  text-align: center;
}

.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(270px, 0.8fr);
  gap: 14px;
  margin-top: 15px;
}

.score-panel {
  padding: 20px;
}

.compact-heading {
  align-items: center;
  margin-bottom: 16px;
}

.compact-heading h2 {
  font-size: 1.1rem;
}

.score-bars {
  display: grid;
  gap: 20px;
  padding: 6px 0 19px;
}

.score-item {
  display: grid;
  gap: 7px;
}

.score-meta {
  color: #566c62;
  font-size: 0.75rem;
}

.score-meta strong {
  color: #17324d;
  font-size: 0.8rem;
}

.score-track {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: #eaf0e9;
}

.score-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width 0.35s ease;
}

.quiz-fill {
  background: #d1a849 !important;
}

.exercise-fill {
  background: #6b9f5d !important;
}

.score-item small {
  color: #899890;
  font-size: 0.64rem;
}

.score-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 13px;
  border-top: 1px solid #e2e8e0;
}

.score-foot > span {
  color: #809087;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.score-foot strong {
  color: #0f766e;
  font-size: 1.15rem;
}

.score-foot small {
  font-size: 0.68rem;
}

@media (max-width: 1060px) {
  .main-grid {
    grid-template-columns: 1fr;
  }
  .score-panel {
    display: grid;
    grid-template-columns: 1fr 1.6fr auto;
    align-items: center;
    gap: 16px;
  }
  .score-panel .compact-heading {
    margin: 0;
  }
  .score-bars {
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding: 0;
  }
  .score-foot {
    min-width: 105px;
    gap: 8px;
    padding: 0 0 0 14px;
    border-top: 0;
    border-left: 1px solid #e2e8e0;
  }
}

@media (max-width: 900px) {
  .identity-panel {
    align-items: flex-start;
    padding: 18px;
  }
  .identity-aside {
    display: none;
  }
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .score-panel {
    display: block;
  }
  .score-panel .compact-heading {
    margin-bottom: 16px;
  }
  .score-bars {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 13px;
    padding: 0 0 14px;
  }
  .score-foot {
    padding: 11px 0 0;
    border-top: 1px solid #e2e8e0;
    border-left: 0;
  }
  .study-chart-panel {
    padding: 16px;
  }
  .study-chart-panel .compact-heading {
    align-items: flex-start;
  }
  .study-chart {
    height: 230px;
  }
}

@media (max-width: 480px) {
  .identity-panel {
    min-height: 112px;
    padding: 14px;
  }
  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 19px;
    font-size: 1.2rem;
  }
  .identity-copy h2 {
    font-size: 1.2rem;
  }
  .identity-copy p {
    overflow-wrap: anywhere;
    font-size: 0.74rem;
  }
  .member-meta {
    font-size: 0.63rem;
  }
  .stats-grid {
    gap: 7px;
  }
  .stat-card {
    min-height: 111px;
    padding: 12px;
  }
  .stat-card > strong {
    font-size: 1.3rem;
  }
  .stat-label {
    font-size: 0.68rem;
  }
  .stat-card small {
    font-size: 0.6rem;
  }
  .score-panel {
    padding: 15px;
  }
  .study-chart-panel {
    padding: 13px;
  }
  .study-chart {
    height: 210px;
  }
}
</style>
