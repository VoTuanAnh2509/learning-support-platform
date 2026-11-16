<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const authUser = ref(null)

const loadAuthUser = () => {
  const storedUser = sessionStorage.getItem('auth_user')
  authUser.value = storedUser ? JSON.parse(storedUser) : null
}

const handleAuthChanged = () => loadAuthUser()

onMounted(() => {
  loadAuthUser()
  window.addEventListener('auth-changed', handleAuthChanged)
})

onBeforeUnmount(() => {
  window.removeEventListener('auth-changed', handleAuthChanged)
})
</script>
<template>
  <footer class="footer">
    <div class="footer-content">

      <div class="footer-brand">
        <h2>Learning Support</h2>
        <p>
          A learning platform designed to help students
          master web development through tutorials,
          examples and quizzes.
        </p>
      </div>

      <div class="footer-links">
        <h3>Quick Links</h3>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">About Us</RouterLink>
        <template v-if="!authUser">
          <RouterLink to="/login">Login</RouterLink>
          <RouterLink to="/register">Register</RouterLink>
        </template>
      </div>

      <div class="footer-links">
        <h3>Learning Paths</h3>
        <RouterLink to="/learn/html/html-home">HTML</RouterLink>
        <a href="#">CSS</a>
        <a href="#">JavaScript</a>
        <a href="#">Quizzes</a>
      </div>

      <div class="footer-links">
        <h3>Contact</h3>
        <a href="mailto:your-email@gmail.com">Email</a>
        <a href="#">GitHub</a>
        <a href="#">University</a>
      </div>

    </div>

    <div class="footer-bottom">
      <p>
        © 2026 Learning Support Platform.
        Built with Vue.js and Node.js.
      </p>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  background: #1e293b;
  color: white;
  width: 100%;
  margin: 4rem -1.25rem 0;
  width: calc(100% + 2.5rem);
}

.footer-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 4rem 2rem;

  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 3rem;
}

.footer-brand h2 {
  margin-bottom: 1rem;
}

.footer-brand p {
  color: #cbd5e1;
  line-height: 1.8;
}

.footer-links {
  display: flex;
  flex-direction: column;
}

.footer-links h3 {
  margin-bottom: 1rem;
  color: #10b981;
}

.footer-links a {
  color: #cbd5e1;
  text-decoration: none;
  margin-bottom: 0.75rem;
}

.footer-links a:hover {
  color: white;
}

.footer-bottom {
  border-top: 1px solid #334155;
  text-align: center;
  padding: 1.25rem;
  color: #94a3b8;
}

@media (max-width: 900px) {
  .footer-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .footer {
    margin-left: -0.75rem;
    margin-right: -0.75rem;
    width: calc(100% + 1.5rem);
  }
}
</style>