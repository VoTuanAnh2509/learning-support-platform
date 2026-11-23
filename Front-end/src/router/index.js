import { createRouter, createWebHistory } from 'vue-router'
import Swal from 'sweetalert2'

import HomeView from '@/views/HomeView.vue'
import CoursesView from '@/views/CoursesView.vue'
import AdminView from '@/views/AdminView.vue'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import ProfileView from '@/views/ProfileView.vue'
import AboutView from '@/views/AboutView.vue'

const requireStaff = () => {
  try {
    const storedUser = sessionStorage.getItem('auth_user')
    const authUser = storedUser ? JSON.parse(storedUser) : null
    return ['admin', 'instructor'].includes(authUser?.role)
  } catch (_error) {
    return false
  }
}

const isAuthenticated = () => !!sessionStorage.getItem('auth_token');

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0, behavior: 'smooth' }
    }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/courses',
      name: 'courses',
      component: CoursesView,
    },
    // THÊM ROUTE VÀO ĐÂY:
    {
      path: '/about',
      name: 'about',
      component: AboutView,
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/ForgotPasswordView.vue'),
    },
    {
      path: '/reset-password/:token',
      name: 'reset-password',
      component: () => import('@/views/ResetPasswordView.vue'),
    },
    {
      path: '/profile',
      redirect: '/profile/overview',
      beforeEnter: () => (isAuthenticated() ? true : '/login'),
    },
    {
      path: '/profile/:section(overview|courses|insights|settings)',
      name: 'profile-section',
      component: ProfileView,
      beforeEnter: () => (isAuthenticated() ? true : '/login'),
    },
    // ==========================================
    // ROUTE TOÀN NĂNG CHO MỌI MÔN HỌC (DYNAMIC ROUTING)
    // ==========================================
    {
      path: '/learn/:courseSlug/:sectionSlug?',
      name: 'learn-course',
      component: () => import('@/views/LearnCourseView.vue'),
      // CHỐT CHẶN Ở ĐÂY
      beforeEnter: async (to) => {
        if (isAuthenticated()) return true

        const result = await Swal.fire({
          icon: 'warning',
          title: 'Login Required',
          text: 'You need an account to access this lesson.',
          showCancelButton: true,
          confirmButtonText: 'Login',
          cancelButtonText: 'Go Back'
        })

        return result.isConfirmed ? '/login' : '/'
      }
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      beforeEnter: () => (requireStaff() ? true : '/login'),
    },
    {
      path: '/admin/:section(dashboard|courses|users|analytics|settings)',
      name: 'admin-section',
      component: AdminView,
      beforeEnter: () => (requireStaff() ? true : '/login'),
    },
  ],
})

export default router