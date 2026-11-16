<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/services/api'

// Import thư viện biểu đồ
import { Bar, Line } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Filler } from 'chart.js'
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Filler)

// === ANALYTICS STATES ===
const analyticsData = ref(null)
const loadingAnalytics = ref(false)
const error = ref('')

const loadAnalytics = async () => {
  loadingAnalytics.value = true
  try {
    const { data } = await api.get('/admin/analytics')
    analyticsData.value = data
  } catch (err) {
    error.value = 'Failed to load analytics.'
  } finally {
    loadingAnalytics.value = false
  }
}

// Lấy dữ liệu ngay khi tab Analytics được bật lên
onMounted(() => {
  loadAnalytics()
})

// === BIỂU ĐỒ HOẠT ĐỘNG (LINE CHART) ===
const activityChartData = computed(() => {
  return {
    labels: analyticsData.value?.progressEvents.map(d => d._id) || [],
    datasets: [{
      label: 'Learning Activities',
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      data: analyticsData.value?.progressEvents.map(d => d.count) || [],
      fill: true,
      tension: 0.4
    }]
  }
})

// === BIỂU ĐỒ GEMINI API (BAR CHART) ===
const aiChartData = computed(() => {
  return {
    labels: analyticsData.value?.aiInteractions.map(d => d._id) || [],
    datasets: [{
      label: 'AI API Calls',
      backgroundColor: '#10b981',
      data: analyticsData.value?.aiInteractions.map(d => d.count) || [],
      borderRadius: 4
    }]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
}
</script>

<template>
  <section class="admin-section analytics-dashboard">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Platform metrics</p>
        <h2>System Analytics</h2>
      </div>
    </div>

    <p v-if="loadingAnalytics" class="state-text">Loading platform data...</p>
    <p v-else-if="error" class="message error">{{ error }}</p>

    <div v-else-if="analyticsData" class="analytics-content">
      <div class="stats-grid">
        <article class="stat-card">
          <span class="stat-icon blue">♙</span>
          <div><strong>{{ analyticsData.userCount }}</strong><span>Total Learners</span></div>
        </article>
        <article class="stat-card">
          <span class="stat-icon amber">▣</span>
          <div><strong>{{ analyticsData.courseCount }}</strong><span>Published Courses</span></div>
        </article>
      </div>

      <div class="charts-grid">
        <div class="chart-container">
          <h3><span class="dot-blue"></span> Learning Activity (Last 7 Days)</h3>
          <p class="chart-desc">Tracks lesson completions, quizzes, and practice submissions.</p>
          <div class="chart-wrapper">
            <Line :data="activityChartData" :options="chartOptions" />
          </div>
        </div>

        <div class="chart-container">
          <h3><span class="dot-green"></span> Gemini API Usage (Last 7 Days)</h3>
          <p class="chart-desc">Tracks AI Chat, Code Reviews, and Recommendations generated.</p>
          <div class="chart-wrapper">
            <Bar :data="aiChartData" :options="chartOptions" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.message { padding: 1rem; border-radius: 8px; margin-bottom: 1rem; font-weight: bold; }
.message.error { background: #fee2e2; color: #991b1b; }
.state-text { color: #94a3b8; }

.stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { display: flex; align-items: center; gap: 0.85rem; padding: 1.1rem; border: 1px solid #263449; border-radius: 12px; background: #172033; }
.stat-icon { display: grid; place-items: center; width: 39px; height: 39px; border-radius: 10px; font-size: 1.1rem; }
.stat-icon.blue { background: rgba(59, 130, 246, 0.14); color: #60a5fa; }
.stat-icon.amber { background: rgba(245, 158, 11, 0.14); color: #fbbf24; }
.stat-card div { display: grid; gap: 0.1rem; }
.stat-card strong { color: #f8fafc; font-size: 1.35rem; }
.stat-card div span { color: #64748b; font-size: 0.75rem; }

.charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem; }
.chart-container { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; }
.chart-container h3 { margin: 0; font-size: 1.05rem; color: #0f172a; display: flex; align-items: center; gap: 8px; }
.chart-desc { margin: 4px 0 16px; font-size: 0.8rem; color: #64748b; }
.chart-wrapper { height: 260px; position: relative; }
.dot-blue { display: block; width: 10px; height: 10px; border-radius: 50%; background: #3b82f6; }
.dot-green { display: block; width: 10px; height: 10px; border-radius: 50%; background: #10b981; }

@media (max-width: 850px) { .charts-grid { grid-template-columns: 1fr; } }
</style>