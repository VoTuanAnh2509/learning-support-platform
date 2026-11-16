<script setup>
// Nhập 2 component Header và Footer vào Layout chính
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
</script>

<template>
  <!-- Giao diện bọc toàn bộ ứng dụng -->
  <div class="app-shell">
    <!-- 1. Thanh Navbar mới thông minh -->
    <AppHeader />
    
    <!-- 2. Nội dung các trang (Home, About, Learn, Admin...) sẽ hiển thị ở đây -->
    <RouterView />
  </div>
  
  <!-- 3. Thanh Footer -->
  <AppFooter />
</template>

<style scoped>
:global(:root) {
  --app-navbar-height: 70px;
}

.app-shell {
  width: 100%;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 100vh;
}
</style>