<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  badge: {
    type: String,
    default: 'WEB DEVELOPMENT',
  },
  topics: {
    type: Array,
    default: () => [],
  },
  subtitle: {
    type: String,
    required: true,
  },
  learnLabel: {
    type: String,
    required: true,
  },
  learnTo: {
    type: String,
    default: '',
  },
  learnUrl: {
    type: String,
    default: '',
  },
  exampleTitle: {
    type: String,
    required: true,
  },
  exampleCode: {
    type: String,
    required: true,
  },
  previewHtml: {
    type: String,
    default: '',
  },
})

const showLiveRunner = ref(false)
const editableCode = ref(props.previewHtml || props.exampleCode)
const copied = ref(false)

watch(
  () => props.exampleCode,
  newVal => {
    editableCode.value = props.previewHtml || newVal
  }
)

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(props.exampleCode)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1800)
  } catch (_err) {
    // ignore
  }
}

const toggleLiveRunner = () => {
  if (!showLiveRunner.value) {
    editableCode.value = props.previewHtml || props.exampleCode
  }
  showLiveRunner.value = !showLiveRunner.value
}
</script>

<template>
  <section class="language-showcase">
    <div class="language-left">
      <span class="language-step-pill">{{ badge }}</span>
      <h2 class="language-title">{{ title }}</h2>
      <p class="language-subtitle">{{ subtitle }}</p>

      <div v-if="topics.length" class="topic-Sys-pills">
        <span v-for="topic in topics" :key="topic" class="topic-chip">{{ topic }}</span>
      </div>

      <div class="showcase-cta-group">
        <RouterLink v-if="learnTo" class="learn-button" :to="learnTo">
          {{ learnLabel }} ➔
        </RouterLink>
        <a v-else class="learn-button" :href="learnUrl" target="_blank" rel="noopener noreferrer">
          {{ learnLabel }} ➔
        </a>

        <button type="button" class="try-button" @click="toggleLiveRunner">
          {{ showLiveRunner ? 'Hide Live Output' : '⚡ Try it Yourself' }}
        </button>
      </div>
    </div>

    <aside class="language-example-card" :aria-label="`${title} example preview`">
      <div class="example-card-header">
        <div class="window-title-group">
          <span class="win-dot red"></span>
          <span class="win-dot amber"></span>
          <span class="win-dot green"></span>
          <h3>{{ exampleTitle }}</h3>
        </div>
        <div class="example-header-actions">
          <button type="button" class="code-action-btn" @click="copyCode">
            {{ copied ? '✓ Copied' : '📋 Copy' }}
          </button>
          <button type="button" class="code-action-btn run-toggle-btn" @click="toggleLiveRunner">
            {{ showLiveRunner ? 'Code View' : '▶ Run Code' }}
          </button>
        </div>
      </div>

      <div v-if="!showLiveRunner" class="code-block-wrapper">
        <pre class="code-block"><code>{{ exampleCode }}</code></pre>
      </div>

      <div v-else class="live-playground-mini">
        <div class="mini-pane">
          <span class="mini-pane-label">Editable Code:</span>
          <textarea v-model="editableCode" class="mini-code-input" spellcheck="false"></textarea>
        </div>
        <div class="mini-pane">
          <span class="mini-pane-label">Live Browser Output:</span>
          <iframe class="mini-preview-frame" :srcdoc="editableCode" sandbox="allow-scripts" title="Live code preview"></iframe>
        </div>
      </div>
    </aside>
  </section>
</template>

<style scoped>
.language-showcase {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 1.15fr);
  align-items: center;
  gap: clamp(1.25rem, 4vw, 3rem);
  padding: clamp(1.5rem, 4vw, 2.75rem);
  border: 1px solid rgba(16, 24, 40, 0.08);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.12);
  position: relative;
  overflow: hidden;
}

.language-showcase::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.05)),
    radial-gradient(circle at top left, rgba(17, 183, 122, 0.14), transparent 34%);
  pointer-events: none;
}

.language-left,
.language-example-card {
  position: relative;
  z-index: 1;
}

.language-left {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 1.15rem;
}

.language-step-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.32rem 0.85rem;
  border-radius: 999px;
  background: rgba(17, 183, 122, 0.12);
  border: 1px solid rgba(17, 183, 122, 0.28);
  color: #0f766e;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.language-title {
  margin: 0;
  color: #0f172a;
  font-size: clamp(3.6rem, 8vw, 5.4rem);
  line-height: 0.92;
  font-weight: 800;
  letter-spacing: -0.05em;
}

.language-subtitle {
  margin: 0;
  color: #1e293b;
  font-size: clamp(1.1rem, 2vw, 1.38rem);
  font-weight: 700;
  max-width: 32ch;
}

.topic-Sys-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.45rem;
}

.topic-chip {
  padding: 0.3rem 0.7rem;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.05);
  color: #334155;
  font-size: 0.78rem;
  font-weight: 600;
  font-family: Consolas, 'Courier New', monospace;
}

.showcase-cta-group {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.35rem;
}

.learn-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 50px;
  padding: 0.75rem 1.45rem;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #11b77a, #0b9e74);
  box-shadow: 0 14px 28px rgba(17, 183, 122, 0.28);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.learn-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 32px rgba(17, 183, 122, 0.34);
}

.try-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 50px;
  padding: 0.75rem 1.3rem;
  border-radius: 999px;
  border: 1px solid rgba(15, 118, 110, 0.28);
  background: #ffffff;
  color: #0f766e;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
}

.try-button:hover {
  background: #f0fdf4;
  transform: translateY(-1px);
}

.language-example-card {
  padding: 1.2rem 1.25rem 1.15rem;
  border-radius: 14px;
  background: #e8e8eb;
  box-shadow: 0 8px 24px rgba(17, 24, 39, 0.14);
}

.example-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
  flex-wrap: wrap;
}

.window-title-group {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.win-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}

.win-dot.red {
  background: #ef4444;
}

.win-dot.amber {
  background: #f59e0b;
}

.win-dot.green {
  background: #10b981;
}

.example-card-header h3 {
  margin: 0 0 0 0.35rem;
  color: #111827;
  font-size: 1.3rem;
  font-weight: 800;
}

.example-header-actions {
  display: flex;
  gap: 0.45rem;
}

.code-action-btn {
  padding: 0.35rem 0.7rem;
  border-radius: 7px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #ffffff;
  color: #334155;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.code-action-btn:hover {
  border-color: #11b77a;
  color: #0f766e;
}

.code-action-btn.run-toggle-btn {
  background: #11b77a;
  border-color: #11b77a;
  color: #ffffff;
}

.code-action-btn.run-toggle-btn:hover {
  background: #0b9e74;
}

.code-block {
  margin: 0;
  padding: 1rem 1.1rem 1.2rem 1rem;
  border-left: 5px solid #11b77a;
  border-radius: 0 8px 8px 0;
  background: #fff;
  overflow: auto;
  color: #ab47bc;
  font-size: 0.95rem;
  line-height: 1.7;
  white-space: pre-wrap;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.04);
}

.code-block code {
  font-family: Consolas, 'Courier New', monospace;
}

.live-playground-mini {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.mini-pane {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.mini-pane-label {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #475569;
}

.mini-code-input {
  width: 100%;
  height: 210px;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  border-left: 4px solid #11b77a;
  background: #ffffff;
  color: #0f172a;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.84rem;
  line-height: 1.5;
  resize: none;
  outline: none;
}

.mini-preview-frame {
  width: 100%;
  height: 210px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
}

@media (max-width: 980px) {
  .language-showcase {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .language-title {
    font-size: clamp(3.2rem, 18vw, 4.5rem);
  }
  .live-playground-mini {
    grid-template-columns: 1fr;
  }
}
</style>
