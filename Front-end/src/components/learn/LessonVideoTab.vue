<script setup>
defineProps({
  lesson: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['continue-reading'])

const getEmbedUrl = url => {
  if (!url) return ''
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11
    ? `https://www.youtube.com/embed/${match[2]}`
    : url
}
</script>

<template>
  <div class="tab-content fade-in">
    <div class="video-lecture-container">
      <h2
        v-if="lesson.videoTitle && lesson.videoTitle !== lesson.title"
        class="video-title"
      >
        {{ lesson.videoTitle }}
      </h2>

      <p v-if="lesson.videoIntro || lesson.overview" class="video-intro-text">
        {{ lesson.videoIntro || lesson.overview }}
      </p>

      <div class="coursera-video-player">
        <iframe
          :src="getEmbedUrl(lesson.videoUrl)"
          title="Video Lecture"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>

      
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

.video-lecture-container {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.video-title {
  margin: 0;
  color: #0f172a;
  font-size: 1.25rem;
  font-weight: 800;
}

.video-intro-text {
  margin: 0;
  color: #334155;
  font-size: 0.98rem;
  line-height: 1.6;
  padding: 0.85rem 1.1rem;
  background: linear-gradient(135deg, #f8fafc, #f0fdf4);
  border-left: 4px solid #10b981;
  border-radius: 10px;
}

.coursera-video-player {
  position: relative;
  width: 100%;
  max-width: 640px;
  aspect-ratio: 16 / 9;
  margin: 0.35rem auto 1rem;
  background: #0f172a;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 12px 28px -6px rgba(0, 0, 0, 0.2);
  border: 1px solid #1e293b;
}

.coursera-video-player iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
}

.video-footer-action {
  display: flex;
  justify-content: center;
  margin-top: 0.25rem;
}

.btn-continue-reading {
  border: none;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: white;
  padding: 0.8rem 1.25rem;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.16);
  transition: transform 0.18s ease;
}

.btn-continue-reading:hover {
  transform: translateY(-1px);
}
</style>
