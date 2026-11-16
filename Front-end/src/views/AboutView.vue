<script setup>
// Trang About thường tĩnh nên script rất nhẹ gọn
</script>

<template>
  <main class="about-page">
    <!-- Hero Section -->
    <section class="hero-card fade-in">
      <p class="eyebrow">Our Mission</p>
      <h1>Empowering the next generation of developers with AI</h1>
      <p class="lede">
        Learning Support is not just another tutorial site. It is an intelligent, interactive 
        platform designed to help you master Web Development through personalized guidance, 
        real-time AI feedback, and hands-on coding practice.
      </p>
    </section>

    <!-- Core Values Section -->
    <section class="features-section">
      <div class="section-header">
        <h2>Why learn with us?</h2>
        <p>We blend traditional curriculum with cutting-edge artificial intelligence.</p>
      </div>

      <div class="feature-grid">
        <article class="feature-card">
          <div class="icon-box">🤖</div>
          <h3>24/7 AI Mentor</h3>
          <p>Stuck on a bug? Our Gemini-powered AI assistant is always available to review your code, explain concepts, and guide you without just giving away the answers.</p>
        </article>

        <article class="feature-card">
          <div class="icon-box">💻</div>
          <h3 class="feature-title">Interactive Live Editor</h3>
          <p>Practice what you learn instantly. Write HTML, CSS, and JavaScript directly in your browser and see the results live in our built-in coding playground.</p>
        </article>

        <article class="feature-card">
          <div class="icon-box">📈</div>
          <h3>Personalized Insights</h3>
          <p>Stop guessing what to study next. Our system tracks your progress, identifies your weak areas, and generates a tailored weekly summary and course recommendations.</p>
        </article>
      </div>
    </section>

    <!-- Technology / Team Section -->
    <section class="tech-card fade-in-delay">
      <h2>Built with modern technologies</h2>
      <p>This platform is a Full-Stack application engineered for performance and scalability.</p>
      <div class="tech-tags">
        <span class="tech-tag vue">Vue.js 3</span>
        <span class="tech-tag node">Node.js / Express</span>
        <span class="tech-tag mongo">MongoDB Atlas</span>
        <span class="tech-tag gemini">Google Gemini AI</span>
      </div>
    </section>

    <!-- Call to Action -->
    <section class="cta-section">
      <h2>Ready to start your coding journey?</h2>
      <div class="actions">
        <RouterLink class="primary-button" to="/register">Create free account</RouterLink>
        <RouterLink class="secondary-button" to="/">Browse courses</RouterLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.about-page {
  display: grid;
  gap: 2.5rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 0 4rem;
}

/* Animations */
.fade-in { animation: fadeIn 0.6s ease-out forwards; }
.fade-in-delay { opacity: 0; animation: fadeIn 0.6s ease-out 0.3s forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

/* Hero Section */
.hero-card {
  border: 1px solid rgba(16, 24, 40, 0.08);
  border-radius: 28px;
  padding: clamp(2rem, 5vw, 4rem);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.6));
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.eyebrow { margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.16em; font-size: 0.85rem; font-weight: 800; color: #0f766e; }
.hero-card h1 { margin: 0; max-width: 22ch; font-size: clamp(2.2rem, 5vw, 4rem); line-height: 1.1; color: #0f172a; letter-spacing: -0.02em; }
.lede { max-width: 70ch; margin: 1.5rem auto 0; color: #475569; font-size: 1.15rem; line-height: 1.7; }

/* Features Section */
.section-header { text-align: center; margin-bottom: 2rem; }
.section-header h2 { font-size: 2rem; color: #0f172a; margin-bottom: 0.5rem; }
.section-header p { color: #64748b; font-size: 1.1rem; margin: 0; }

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}
.feature-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 10px 25px rgba(0,0,0,0.03);
  transition: transform 0.2s, box-shadow 0.2s;
}
.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 35px rgba(15, 118, 110, 0.1);
  border-color: #99f6e4;
}
.icon-box {
  width: 50px;
  height: 50px;
  background: #f0fdfa;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  margin-bottom: 1.25rem;
}
.feature-card h3 { margin: 0 0 0.75rem; color: #0f172a; font-size: 1.25rem; }
.feature-card p { margin: 0; color: #475569; line-height: 1.6; }

/* Tech Stack Section */
.tech-card {
  text-align: center;
  background: #0f172a;
  color: white;
  border-radius: 24px;
  padding: 3rem 2rem;
}
.tech-card h2 { margin: 0 0 0.5rem; font-size: 1.8rem; }
.tech-card p { color: #94a3b8; margin: 0 0 2rem; }
.tech-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
}
.tech-tag {
  padding: 0.6rem 1.2rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.9rem;
}
.tech-tag.vue { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
.tech-tag.node { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
.tech-tag.mongo { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
.tech-tag.gemini { background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.2)); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.3); }

/* CTA Section */
.cta-section { text-align: center; padding: 2rem 0; }
.cta-section h2 { font-size: 1.8rem; color: #0f172a; margin-bottom: 1.5rem; }
.actions { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; }

.primary-button, .secondary-button {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 48px; padding: 0.8rem 1.5rem; border-radius: 999px;
  font-weight: 700; text-decoration: none; transition: transform 0.2s, box-shadow 0.2s;
}
.primary-button {
  background: linear-gradient(135deg, #0f766e, #1d4ed8);
  color: #fff; box-shadow: 0 10px 24px rgba(15, 118, 110, 0.25);
}
.secondary-button {
  background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0;
}
.primary-button:hover, .secondary-button:hover { transform: translateY(-2px); }
.secondary-button:hover { background: #e2e8f0; }

@media (max-width: 768px) {
  .tech-tags { flex-direction: column; align-items: center; }
  .tech-tag { width: 80%; text-align: center; }
}
</style>