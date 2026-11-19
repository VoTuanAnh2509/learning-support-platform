<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LanguageShowcase from '@/components/LanguageShowcase.vue'
import api from '@/services/api'

const router = useRouter()
const authUser = ref(null)
const heroSearch = ref('')
const searchResults = ref([])
const searching = ref(false)
const showSearchDropdown = ref(false)
const heroSearchRef = ref(null)
let searchDebounceTimer = null
const activeSnippetTab = ref('html')
const courseCount = ref(3)
const totalLessonsCount = ref(24)
const recentBookmark = ref(null)

const loadAuthUser = async () => {
  const storedUser = sessionStorage.getItem('auth_user')
  authUser.value = storedUser ? JSON.parse(storedUser) : null

  const userId = authUser.value?._id || authUser.value?.id || ''
  if (userId && sessionStorage.getItem('auth_token')) {
    try {
      const { data: userProfile } = await api.get(`/users/${userId}/profile`)
      if (Array.isArray(userProfile?.bookmarkedLessons) && userProfile.bookmarkedLessons.length > 0) {
        recentBookmark.value = userProfile.bookmarkedLessons[0]
      } else {
        recentBookmark.value = null
      }
    } catch (_err) {
      recentBookmark.value = null
    }
  } else {
    recentBookmark.value = null
  }
}

const loadPlatformStats = async () => {
  try {
    const { data } = await api.get('/courses')
    if (Array.isArray(data) && data.length > 0) {
      const published = data.filter(c => c.isPublished !== false)
      courseCount.value = published.length
      const lessons = published.reduce(
        (sum, c) =>
          sum +
          (Array.isArray(c.modules)
            ? c.modules.reduce((mSum, m) => mSum + (Array.isArray(m.lessons) ? m.lessons.length : 0), 0)
            : 0),
        0
      )
      if (lessons > 0) totalLessonsCount.value = lessons
    }
  } catch (_err) {
    // fallback defaults
  }
}

const handleAuthChanged = () => loadAuthUser()

const handleClickOutside = event => {
  if (heroSearchRef.value && !heroSearchRef.value.contains(event.target)) {
    showSearchDropdown.value = false
  }
}

watch(heroSearch, value => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  const trimmed = value.trim()
  if (!trimmed) {
    searchResults.value = []
    searching.value = false
    return
  }

  searching.value = true
  showSearchDropdown.value = true
  searchDebounceTimer = setTimeout(async () => {
    try {
      const { data } = await api.get('/search', { params: { q: trimmed } })
      searchResults.value = Array.isArray(data?.results) ? data.results : []
    } catch (_error) {
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }, 250)
})

const selectSearchResult = item => {
  showSearchDropdown.value = false
  heroSearch.value = ''
  searchResults.value = []
  if (item?.path) {
    router.push(item.path)
  }
}

onMounted(() => {
  loadAuthUser()
  loadPlatformStats()
  window.addEventListener('auth-changed', handleAuthChanged)
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  window.removeEventListener('auth-changed', handleAuthChanged)
  document.removeEventListener('click', handleClickOutside)
})

const displayName = computed(
  () => authUser.value?.name || authUser.value?.username || authUser.value?.email || 'learner'
)

const handleHeroSearch = () => {
  const q = heroSearch.value.trim()
  showSearchDropdown.value = false
  if (q) {
    router.push({ path: '/courses', query: { q } })
  } else {
    router.push('/courses')
  }
}

const quickSearchTopic = topic => {
  router.push({ path: '/courses', query: { q: topic } })
}

const resumeBookmark = () => {
  if (!recentBookmark.value) return
  const slug = String(recentBookmark.value.courseSlug || 'html').replace(/-tutorial$/, '')
  const lessonSlug = recentBookmark.value.lessonSlug || 'home'
  router.push(`/learn/${slug}/${lessonSlug}`)
}

const heroCodeSnippets = {
  html: {
    file: 'index.html',
    code: `<!-- Build semantic structure -->
<article class="dev-card">
  <span class="badge">HTML5</span>
  <h2>Hello, Developer!</h2>
  <p>Start coding interactively today.</p>
</article>`,
  },
  css: {
    file: 'styles.css',
    code: `.dev-card {
  display: grid;
  gap: 12px;
  padding: 20px;
  border-radius: 16px;
  background: #f0fdf4;
  border-left: 4px solid #10b981;
}`,
  },
  js: {
    file: 'app.js',
    code: `const skills = ['HTML5', 'CSS3', 'JavaScript'];

skills.forEach((skill, index) => {
  console.log(\`Step \${index + 1}: Master \${skill} 🚀\`);
});`,
  },
}

const roadmapSteps = [
  {
    step: 'STEP 01',
    icon: '🧱',
    title: 'HTML5 Structure',
    desc: 'Build semantic web pages, headings, links, tables, and interactive forms.',
    to: '/learn/html',
  },
  {
    step: 'STEP 02',
    icon: '🎨',
    title: 'CSS3 Styling & Layout',
    desc: 'Design responsive interfaces with selectors, Box Model, Flexbox, and Grid.',
    to: '/learn/css',
  },
  {
    step: 'STEP 03',
    icon: '⚡',
    title: 'JavaScript Logic',
    desc: 'Write functions, manipulate the DOM, and build dynamic user experiences.',
    to: '/learn/javascript',
  },
]

const languageShowcases = [
  {
    title: 'HTML',
    badge: '01 · MARKUP & STRUCTURE',
    topics: ['<!DOCTYPE>', '<header>', '<form>', '<table>', 'Semantic Tags'],
    subtitle: 'The standard markup language for building web pages',
    learnLabel: 'Learn HTML',
    learnTo: '/learn/html',
    exampleTitle: 'HTML Example:',
    exampleCode: `<!DOCTYPE html>
<html>
<head>
  <title>HTML Tutorial</title>
</head>
<body>

  <h1>This is a heading</h1>
  <p>This is a paragraph.</p>

</body>
</html>`,
    previewHtml: `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; padding: 16px; color: #0f172a;">
  <h1 style="color: #0f766e; margin-top: 0;">This is a heading</h1>
  <p>This is a paragraph rendered live in your browser!</p>
</body>
</html>`,
  },
  {
    title: 'CSS',
    badge: '02 · DESIGN & LAYOUT',
    topics: ['Selectors', 'Box Model', 'Flexbox', 'CSS Grid', 'Animations'],
    subtitle: 'Style and layout for modern responsive web pages',
    learnLabel: 'Learn CSS',
    learnTo: '/learn/css',
    exampleTitle: 'CSS Example:',
    exampleCode: `body {
  font-family: Arial, sans-serif;
  background: #f4f7fb;
}

h1 {
  color: #0f766e;
}`,
    previewHtml: `<!DOCTYPE html>
<html>
<head>
<style>
  body {
    font-family: Arial, sans-serif;
    background: #f0fdf4;
    padding: 16px;
  }
  h1 {
    color: #0f766e;
    margin-top: 0;
  }
  .card {
    padding: 12px 16px;
    background: white;
    border-left: 4px solid #10b981;
    border-radius: 8px;
  }
</style>
</head>
<body>
  <div class="card">
    <h1>Styled with CSS3</h1>
    <p>Edit the CSS rules on the left to see instant changes!</p>
  </div>
</body>
</html>`,
  },
  {
    title: 'JavaScript',
    badge: '03 · INTERACTIVITY & LOGIC',
    topics: ['Variables', 'Functions', 'Arrays', 'DOM Events', 'Async / Await'],
    subtitle: 'Add behavior, logic, and interactivity to web pages',
    learnLabel: 'Learn JavaScript',
    learnTo: '/learn/javascript',
    exampleTitle: 'JavaScript Example:',
    exampleCode: `function greet(name) {
  return \`Hello, \${name}!\`
}

console.log(greet('world'))`,
    previewHtml: `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; padding: 16px; color: #0f172a;">
  <h3 id="output" style="color: #0f766e; margin-top: 0;">Click the button below:</h3>
  <button onclick="sayHello()" style="background: #10b981; color: white; border: none; padding: 10px 16px; border-radius: 999px; font-weight: 700; cursor: pointer;">
    Run greet('Developer')
  </button>
  <script>
    function greet(name) {
      return 'Hello, ' + name + '! 🚀';
    }
    function sayHello() {
      document.getElementById('output').textContent = greet('Developer');
    }
  <\/script>
</body>
</html>`,
  },
]

const features = [
  {
    icon: '💻',
    tag: 'HANDS-ON SANDBOX',
    title: 'Live Code Playground',
    description:
      'Edit and run HTML, CSS, and JavaScript directly inside every lesson with instant visual output.',
  },
  {
    icon: '✨',
    tag: '24/7 AI TUTOR',
    title: 'AI Coding Mentor',
    description:
      'Ask questions, get line-by-line code reviews, and receive personalized study recommendations.',
  },
  {
    icon: '🎯',
    tag: 'ACTIVE RECALL',
    title: 'Interactive Quizzes',
    description:
      'Reinforce concepts after every lesson with shuffled practice quizzes and detailed explanations.',
  },
  {
    icon: '🔖',
    tag: 'SMART TRACKING',
    title: 'Bookmarks & Progress',
    description:
      'Save key lessons with one click and pick up right where you left off across all your courses.',
  },
]
</script>

<template>
  <main class="home-page">
    <!-- 1. CODING PLATFORM HERO -->
    <section class="hero-card">
      <div class="hero-split">
        <div class="hero-left">
          <div class="eyebrow-pill">
            <span class="pulse-dot"></span>
            <span>INTERACTIVE CODING PLATFORM</span>
          </div>

          <h1 v-if="authUser">Welcome back, {{ displayName }}</h1>
          <h1 v-else>Learn to Code with Interactive Tutorials & AI Feedback</h1>

          <p class="lede" v-if="authUser">
            Your coding workspace is ready. Search for any web development topic below, test code in the live playground, or jump right back into your saved lessons.
          </p>
          <p class="lede" v-else>
            Master HTML, CSS, and JavaScript step by step with live browser code editors, practice quizzes, smart bookmarks, and an AI coding assistant.
          </p>

          <!-- HERO SEARCH BAR WITH LIVE AUTO-SUGGEST -->
          <div ref="heroSearchRef" class="hero-search-wrapper">
            <form class="hero-search-bar" @submit.prevent="handleHeroSearch">
              <svg class="hero-search-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                v-model="heroSearch"
                type="search"
                placeholder="Search tutorials, e.g. HTML Elements, CSS Flexbox, Forms..."
                aria-label="Search coding tutorials"
                @focus="heroSearch.trim() && (showSearchDropdown = true)"
              />
              <button type="submit" class="hero-search-btn">Explore ➔</button>
            </form>

            <!-- AUTO-SUGGEST DROPDOWN -->
            <div
              v-if="showSearchDropdown && heroSearch.trim()"
              class="hero-suggest-dropdown"
              role="listbox"
            >
              <div v-if="searching" class="hero-search-state">Searching courses & lessons...</div>
              <div v-else-if="searchResults.length === 0" class="hero-search-state">
                No lessons or courses found for "{{ heroSearch }}".
              </div>
              <template v-else>
                <button
                  v-for="item in searchResults"
                  :key="item.id"
                  type="button"
                  class="hero-suggest-item"
                  @click="selectSearchResult(item)"
                >
                  <span class="hero-suggest-badge" :class="item.type.toLowerCase()">
                    {{ item.type }}
                  </span>
                  <div class="hero-suggest-copy">
                    <strong>{{ item.type }}: {{ item.title }}</strong>
                    <small>{{ item.subtitle }}</small>
                  </div>
                  <span class="hero-suggest-arrow" aria-hidden="true">→</span>
                </button>
              </template>
            </div>
          </div>

          <div class="popular-topics-row">
            <span class="popular-label">Popular:</span>
            <button type="button" class="topic-quick-tag" @click="quickSearchTopic('HTML')">HTML5</button>
            <button type="button" class="topic-quick-tag" @click="quickSearchTopic('CSS')">CSS3</button>
            <button type="button" class="topic-quick-tag" @click="quickSearchTopic('Flexbox')">Flexbox</button>
            <button type="button" class="topic-quick-tag" @click="quickSearchTopic('JavaScript')">JavaScript</button>
          </div>

          <div class="actions">
            <template v-if="authUser">
              <RouterLink class="primary-button" to="/courses">Browse Course Catalog ➔</RouterLink>
              <RouterLink class="secondary-button" to="/profile/overview">My Learning Workspace</RouterLink>
              <button v-if="recentBookmark" type="button" class="resume-pill-btn" @click="resumeBookmark">
                🔖 Resume: {{ recentBookmark.lessonTitle }}
              </button>
            </template>
            <template v-else>
              <RouterLink class="primary-button" to="/register">Start Learning Free ➔</RouterLink>
              <RouterLink class="secondary-button" to="/courses">Explore Courses</RouterLink>
              <RouterLink class="secondary-button" to="/login">Sign in</RouterLink>
            </template>
          </div>
        </div>

        <!-- RIGHT SIDE: INTERACTIVE CODE IDE PREVIEW + PLATFORM STATS -->
        <div class="hero-right">
          <div class="ide-window">
            <div class="ide-header">
              <div class="ide-dots">
                <span class="dot red"></span>
                <span class="dot amber"></span>
                <span class="dot green"></span>
              </div>
              <div class="ide-tabs">
                <button
                  v-for="(snippet, key) in heroCodeSnippets"
                  :key="key"
                  type="button"
                  class="ide-tab"
                  :class="{ active: activeSnippetTab === key }"
                  @click="activeSnippetTab = key"
                >
                  {{ snippet.file }}
                </button>
              </div>
              <span class="ide-status">● Live Sandbox</span>
            </div>

            <pre class="ide-code-area"><code>{{ heroCodeSnippets[activeSnippetTab].code }}</code></pre>

            <div class="ide-footer">
              <div class="ide-preview-pill">
                <span class="preview-badge">OUTPUT</span>
                <span>Interactive tutorials with <strong>Try it Yourself</strong> editor</span>
              </div>
              <RouterLink class="ide-try-link" :to="`/learn/${activeSnippetTab === 'js' ? 'javascript' : activeSnippetTab}`">
                Open {{ activeSnippetTab.toUpperCase() }} ➔
              </RouterLink>
            </div>
          </div>

          <div class="hero-stats-strip">
            <div class="hero-stat-item">
              <strong>{{ courseCount }}+</strong>
              <span>Core Tracks</span>
            </div>
            <div class="stat-divider"></div>
            <div class="hero-stat-item">
              <strong>{{ totalLessonsCount }}+</strong>
              <span>Interactive Lessons</span>
            </div>
            <div class="stat-divider"></div>
            <div class="hero-stat-item">
              <strong>AI 2.5</strong>
              <span>Code Reviewer</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. LEARNING PATH ROADMAP STRIP -->
    <section class="roadmap-section">
      <div class="roadmap-header">
        <div>
          <p class="eyebrow">STRUCTURED LEARNING PATH</p>
          <h2>Follow the Web Developer Roadmap</h2>
        </div>
        <RouterLink class="view-all-link" to="/courses">View Full Catalog ➔</RouterLink>
      </div>

      <div class="roadmap-grid">
        <RouterLink
          v-for="item in roadmapSteps"
          :key="item.step"
          :to="item.to"
          class="roadmap-card"
        >
          <div class="roadmap-top">
            <span class="roadmap-step-tag">{{ item.step }}</span>
            <span class="roadmap-icon">{{ item.icon }}</span>
          </div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.desc }}</p>
          <span class="roadmap-cta">Start Track ➔</span>
        </RouterLink>
      </div>
    </section>

    <!-- 3. INTERACTIVE LANGUAGE SHOWCASES -->
    <LanguageShowcase
      v-for="language in languageShowcases"
      :key="language.title"
      v-bind="language"
    />

    <!-- 4. PLATFORM FEATURES GRID -->
    <section class="feature-section">
      <div class="roadmap-header">
        <div>
          <p class="eyebrow">BUILT FOR HANDS-ON PRACTICE</p>
          <h2>Everything You Need to Master Coding</h2>
        </div>
      </div>

      <div class="feature-grid">
        <article v-for="feature in features" :key="feature.title" class="feature-card">
          <div class="feature-top">
            <span class="feature-icon-box">{{ feature.icon }}</span>
            <span class="feature-tag">{{ feature.tag }}</span>
          </div>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.description }}</p>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.home-page {
  display: grid;
  gap: 1.75rem;
}

.hero-card,
.roadmap-card,
.feature-card {
  border: 1px solid rgba(16, 24, 40, 0.08);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.12);
}

.hero-card {
  border-radius: 28px;
  padding: clamp(1.5rem, 3.8vw, 3rem);
  position: relative;
  overflow: visible;
  z-index: 5;
}

.hero-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 28px;
  background:
    radial-gradient(circle at top right, rgba(17, 183, 122, 0.14), transparent 40%),
    radial-gradient(circle at bottom left, rgba(15, 118, 110, 0.08), transparent 35%);
  pointer-events: none;
}

.hero-split {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.95fr);
  gap: clamp(1.5rem, 3.5vw, 3rem);
  align-items: center;
}

.eyebrow-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.38rem 0.9rem;
  border-radius: 999px;
  background: rgba(15, 118, 110, 0.1);
  border: 1px solid rgba(15, 118, 110, 0.22);
  color: #0f766e;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  margin-bottom: 1rem;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
}

.eyebrow {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.76rem;
  font-weight: 800;
  color: #0f766e;
}

h1 {
  margin: 0;
  font-size: clamp(2.15rem, 4.4vw, 3.75rem);
  line-height: 1.04;
  letter-spacing: -0.03em;
  color: #0f172a;
}

.lede {
  max-width: 58ch;
  margin: 1rem 0 0;
  color: #334155;
  font-size: 1.02rem;
  line-height: 1.65;
}

/* HERO SEARCH BAR & AUTO-SUGGEST */
.hero-search-wrapper {
  position: relative;
  margin-top: 1.4rem;
  max-width: 560px;
  z-index: 20;
}

.hero-search-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.45rem 0.4rem 1.1rem;
  border-radius: 999px;
  background: #ffffff;
  border: 1.5px solid rgba(15, 118, 110, 0.25);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
}

.hero-suggest-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.16);
  max-height: 360px;
  overflow-y: auto;
  padding: 0.5rem;
  z-index: 100;
}

.hero-search-state {
  padding: 1rem;
  text-align: center;
  color: #64748b;
  font-size: 0.88rem;
}

.hero-suggest-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  border: none;
  border-radius: 11px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
}

.hero-suggest-item:hover {
  background: #f0fdf4;
}

.hero-suggest-badge {
  padding: 0.24rem 0.6rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.hero-suggest-badge.course {
  background: #dcfce7;
  color: #047857;
}

.hero-suggest-badge.lesson {
  background: #e0f2fe;
  color: #0369a1;
}

.hero-suggest-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hero-suggest-copy strong {
  font-size: 0.9rem;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-suggest-copy small {
  font-size: 0.76rem;
  color: #64748b;
}

.hero-suggest-arrow {
  color: #10b981;
  font-weight: 800;
}

.hero-search-bar:focus-within {
  border-color: #11b77a;
  box-shadow: 0 0 0 4px rgba(17, 183, 122, 0.14);
}

.hero-search-icon {
  color: #0f766e;
  flex-shrink: 0;
}

.hero-search-bar input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: #0f172a;
  font-size: 0.95rem;
}

.hero-search-btn {
  padding: 0.65rem 1.25rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, #11b77a, #0f766e);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.hero-search-btn:hover {
  transform: translateY(-1px);
  opacity: 0.95;
}

.popular-topics-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.85rem;
}

.popular-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: #64748b;
}

.topic-quick-tag {
  padding: 0.28rem 0.72rem;
  border-radius: 999px;
  border: 1px solid rgba(15, 118, 110, 0.2);
  background: rgba(255, 255, 255, 0.85);
  color: #0f766e;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.topic-quick-tag:hover {
  background: #11b77a;
  border-color: #11b77a;
  color: #ffffff;
}

.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1.5rem;
}

.primary-button,
.secondary-button,
.resume-pill-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0.75rem 1.25rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.92rem;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.primary-button {
  background: linear-gradient(135deg, #11b77a, #0f766e);
  color: #fff;
  box-shadow: 0 10px 24px rgba(15, 118, 110, 0.25);
}

.secondary-button {
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
}

.resume-pill-btn {
  border: 1px solid rgba(17, 183, 122, 0.35);
  background: #f0fdf4;
  color: #0f766e;
  cursor: pointer;
}

.primary-button:hover,
.secondary-button:hover,
.resume-pill-btn:hover {
  transform: translateY(-1px);
}

/* HERO RIGHT IDE WINDOW */
.hero-right {
  display: grid;
  gap: 1rem;
}

.ide-window {
  border-radius: 18px;
  background: #e8e8eb;
  border: 1px solid rgba(15, 23, 42, 0.1);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.14);
  padding: 1rem;
  display: grid;
  gap: 0.85rem;
}

.ide-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.ide-dots {
  display: flex;
  gap: 0.38rem;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot.red {
  background: #ef4444;
}

.dot.amber {
  background: #f59e0b;
}

.dot.green {
  background: #10b981;
}

.ide-tabs {
  display: flex;
  gap: 0.35rem;
  background: rgba(15, 23, 42, 0.06);
  padding: 0.22rem;
  border-radius: 9px;
}

.ide-tab {
  border: none;
  background: transparent;
  padding: 0.32rem 0.7rem;
  border-radius: 7px;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.78rem;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ide-tab.active {
  background: #ffffff;
  color: #0f766e;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
}

.ide-status {
  font-size: 0.74rem;
  font-weight: 800;
  color: #0f766e;
}

.ide-code-area {
  margin: 0;
  padding: 1rem 1.1rem;
  border-left: 5px solid #11b77a;
  border-radius: 0 10px 10px 0;
  background: #ffffff;
  color: #ab47bc;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.88rem;
  line-height: 1.65;
  min-height: 155px;
  overflow-x: auto;
}

.ide-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.ide-preview-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: #334155;
}

.preview-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 5px;
  background: #11b77a;
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 800;
}

.ide-try-link {
  font-size: 0.82rem;
  font-weight: 800;
  color: #0f766e;
}

.hero-stats-strip {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0.9rem 1.25rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(15, 118, 110, 0.16);
}

.hero-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.hero-stat-item strong {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f766e;
}

.hero-stat-item span {
  font-size: 0.76rem;
  font-weight: 600;
  color: #475569;
}

.stat-divider {
  width: 1px;
  height: 28px;
  background: rgba(15, 23, 42, 0.1);
}

/* ROADMAP SECTION */
.roadmap-section,
.feature-section {
  display: grid;
  gap: 1rem;
}

.roadmap-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 0.25rem;
}

.roadmap-header h2 {
  margin: 0;
  font-size: clamp(1.35rem, 2.4vw, 1.75rem);
  color: #0f172a;
}

.view-all-link {
  font-size: 0.9rem;
  font-weight: 800;
  color: #0f766e;
  white-space: nowrap;
}

.roadmap-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.15rem;
}

.roadmap-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.5rem;
  border-radius: 22px;
  text-decoration: none;
  transition: transform 0.18s ease, border-color 0.18s ease;
}

.roadmap-card:hover {
  transform: translateY(-3px);
  border-color: rgba(17, 183, 122, 0.45);
}

.roadmap-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.85rem;
}

.roadmap-step-tag {
  padding: 0.28rem 0.7rem;
  border-radius: 999px;
  background: rgba(17, 183, 122, 0.12);
  color: #0f766e;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.roadmap-icon {
  font-size: 1.6rem;
}

.roadmap-card h3 {
  margin: 0 0 0.45rem;
  font-size: 1.2rem;
  color: #0f172a;
}

.roadmap-card p {
  margin: 0 0 1.1rem;
  color: #475569;
  font-size: 0.92rem;
  line-height: 1.55;
}

.roadmap-cta {
  font-size: 0.86rem;
  font-weight: 800;
  color: #11b77a;
}

/* FEATURE GRID */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.15rem;
}

.feature-card {
  border-radius: 22px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.feature-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}

.feature-icon-box {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(17, 183, 122, 0.12);
  display: grid;
  place-items: center;
  font-size: 1.3rem;
}

.feature-tag {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #0f766e;
}

.feature-card h3 {
  margin: 0;
  color: #0f172a;
  font-size: 1.12rem;
}

.feature-card p {
  margin: 0;
  color: #475569;
  font-size: 0.9rem;
  line-height: 1.55;
}

@media (max-width: 980px) {
  .hero-split {
    grid-template-columns: 1fr;
  }
}
</style>
