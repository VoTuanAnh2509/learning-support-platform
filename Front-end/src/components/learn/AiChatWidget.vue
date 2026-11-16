<script setup>
import { nextTick, ref } from 'vue'
import { marked } from 'marked'
import api from '@/services/api'

const props = defineProps({
  userId: {
    type: String,
    default: '',
  },
  subject: {
    type: String,
    default: 'Programming',
  },
  lessonTitle: {
    type: String,
    default: 'this course',
  },
})

const isChatOpen = ref(false)
const chatInput = ref('')
const chatMessages = ref([
  {
    role: 'assistant',
    text: 'Hi there! I am your AI learning assistant. Ask me anything about this lesson!',
  },
])
const isChatLoading = ref(false)
const chatMessagesContainer = ref(null)

const scrollToChatBottom = async () => {
  await nextTick()
  if (chatMessagesContainer.value) {
    chatMessagesContainer.value.scrollTop = chatMessagesContainer.value.scrollHeight
  }
}

const toggleChat = () => {
  isChatOpen.value = !isChatOpen.value
  if (isChatOpen.value) {
    scrollToChatBottom()
  }
}

const sendMessage = async () => {
  if (!chatInput.value.trim() || isChatLoading.value) return

  const question = chatInput.value.trim()
  chatInput.value = ''

  chatMessages.value.push({ role: 'user', text: question })
  scrollToChatBottom()
  isChatLoading.value = true

  try {
    const response = await api.post('/ai/chat', {
      userId: props.userId,
      question,
      subject: props.subject,
      lesson: props.lessonTitle,
    })

    chatMessages.value.push({ role: 'assistant', text: response.data.answer })
  } catch (_error) {
    chatMessages.value.push({
      role: 'assistant',
      text: 'Sorry, I encountered an error connecting to the server. Please try again.',
      isError: true,
    })
  } finally {
    isChatLoading.value = false
    scrollToChatBottom()
  }
}

const renderMarkdown = text => (text ? marked(text) : '')
</script>

<template>
  <div class="ai-chat-widget" :class="{ 'is-open': isChatOpen }">
    <div v-show="isChatOpen" class="chat-window fade-in">
      <div class="chat-header">
        <div class="chat-title">
          <span class="chat-avatar">✨</span>
          <div>
            <h3>AI Assistant</h3>
            <p>Ask about {{ lessonTitle || 'this course' }}</p>
          </div>
        </div>
        <button type="button" class="btn-close-chat" @click="toggleChat">✖</button>
      </div>

      <div ref="chatMessagesContainer" class="chat-messages">
        <div
          v-for="(msg, index) in chatMessages"
          :key="index"
          class="chat-bubble-wrapper"
          :class="msg.role === 'user' ? 'user-message' : 'ai-message'"
        >
          <div v-if="msg.role === 'user'" class="chat-bubble" :class="{ 'error-bubble': msg.isError }">
            {{ msg.text }}
          </div>
          <div
            v-else
            class="chat-bubble markdown-body"
            :class="{ 'error-bubble': msg.isError }"
            v-html="renderMarkdown(msg.text)"
          ></div>
        </div>

        <div v-if="isChatLoading" class="chat-bubble-wrapper ai-message">
          <div class="chat-bubble loading-dots">
            <span>.</span><span>.</span><span>.</span>
          </div>
        </div>
      </div>

      <div class="chat-input-area">
        <input
          v-model="chatInput"
          type="text"
          placeholder="Type your question..."
          :disabled="isChatLoading"
          @keyup.enter="sendMessage"
        />
        <button
          type="button"
          class="btn-send"
          :disabled="isChatLoading || !chatInput.trim()"
          @click="sendMessage"
        >
          ➤
        </button>
      </div>
    </div>

    <button type="button" class="chat-fab" aria-label="Toggle AI Chat" @click="toggleChat">
      <span v-if="!isChatOpen">✨ Ask AI</span>
      <span v-else>✖ Close</span>
    </button>
  </div>
</template>

<style scoped>
.ai-chat-widget {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1rem;
}

.chat-fab {
  background: linear-gradient(135deg, #10b981, #0f766e);
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 10px 25px rgba(15, 118, 110, 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chat-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(15, 118, 110, 0.4);
}

.chat-window {
  width: 360px;
  height: 500px;
  max-height: 70vh;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 15px 40px rgba(15, 23, 42, 0.15);
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  background: #0f172a;
  color: white;
  padding: 1rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.chat-avatar {
  font-size: 1.5rem;
}

.chat-title h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.chat-title p {
  margin: 0;
  font-size: 0.75rem;
  color: #94a3b8;
}

.btn-close-chat {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 1.2rem;
}

.btn-close-chat:hover {
  color: white;
}

.chat-messages {
  flex: 1;
  padding: 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: #f8fafc;
}

.chat-bubble-wrapper {
  display: flex;
  width: 100%;
}

.user-message {
  justify-content: flex-end;
}

.ai-message {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 85%;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font-size: 0.95rem;
  line-height: 1.5;
  word-wrap: break-word;
}

.user-message .chat-bubble {
  background: #3b82f6;
  color: white;
  border-bottom-right-radius: 4px;
}

.ai-message .chat-bubble {
  background: white;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  border-bottom-left-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.02);
}

.error-bubble {
  color: #dc2626 !important;
  border-color: #fca5a5 !important;
  background: #fef2f2 !important;
}

.chat-input-area {
  padding: 1rem;
  background: white;
  border-top: 1px solid #e2e8f0;
  display: flex;
  gap: 0.5rem;
}

.chat-input-area input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  outline: none;
  font-size: 0.95rem;
}

.chat-input-area input:focus {
  border-color: #3b82f6;
}

.btn-send {
  background: #10b981;
  color: white;
  border: none;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-dots span {
  animation: blink 1.4s infinite both;
  font-size: 1.5rem;
  line-height: 0.5;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0% {
    opacity: 0.2;
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0.2;
  }
}

.markdown-body :deep(pre) {
  background-color: #1e293b;
  color: #f8fafc;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.5rem 0;
}

.markdown-body :deep(code) {
  font-family: Consolas, monospace;
  background-color: rgba(0, 0, 0, 0.1);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
}

.markdown-body :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

@media (max-width: 640px) {
  .ai-chat-widget {
    bottom: 1rem;
    right: 1rem;
    left: 1rem;
  }
  .chat-window {
    width: 100%;
    height: 60vh;
  }
}
</style>
