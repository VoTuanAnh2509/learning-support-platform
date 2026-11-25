const controller = require('../controllers/projectController');

module.exports = app => {
    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok', service: 'learning-support-backend' });
    });

    app.get('/api/search', controller.globalSearch);
    app.get('/api/system/settings', controller.getSystemSettings);
    app.get('/api/notifications', controller.listNotifications);
    app.patch('/api/notifications/read-all', controller.markAllNotificationsRead);
    app.patch('/api/notifications/:id/read', controller.markNotificationRead);

    app.route('/api/courses')
        .get(controller.listCourses)
        .post(controller.requireStaff, controller.createCourse);

    app.route('/api/courses/:courseId')
        .get(controller.getCourse)
        .patch(controller.requireStaff, controller.updateCourse)
        .delete(controller.requireStaff, controller.deleteCourse);

    app.post('/api/courses/:courseId/modules', controller.requireStaff, controller.addModule);
    app.patch('/api/courses/:courseId/modules/:moduleId', controller.requireStaff, controller.updateModule);
    app.delete('/api/courses/:courseId/modules/:moduleId', controller.requireStaff, controller.deleteModule);
    app.post('/api/courses/:courseId/modules/:moduleId/lessons', controller.requireStaff, controller.addLesson);
    app.patch('/api/courses/:courseId/modules/:moduleId/lessons/:lessonId', controller.requireStaff, controller.updateLesson);
    app.delete('/api/courses/:courseId/modules/:moduleId/lessons/:lessonId', controller.requireStaff, controller.deleteLesson);

    app.get('/api/users/check-email', controller.checkEmailAvailability);
    app.post('/api/users/register', controller.registerUser);
    app.post('/api/admin/bootstrap', controller.bootstrapAdminUser);
    app.post('/api/users/login', controller.loginUser);
    app.post('/api/users/forgot-password', controller.forgotPassword);
    app.post('/api/users/reset-password/:token', controller.resetPassword);
    app.get('/api/users/:userId/profile', controller.requireOwnAccount, controller.getUserProfile);
    app.patch('/api/users/:userId/profile', controller.requireOwnAccount, controller.updateUserProfile);
    app.patch('/api/users/:userId/password', controller.requireOwnAccount, controller.changeUserPassword);
    app.delete('/api/users/:userId/progress/:courseId', controller.requireOwnAccount, controller.resetCourseProgress);
    app.get('/api/users/:userId/export', controller.requireOwnAccount, controller.exportUserData);
    app.delete('/api/users/:userId/account', controller.requireOwnAccount, controller.deleteOwnAccount);
    app.post('/api/users/:userId/enroll/:courseId', controller.requireOwnAccount, controller.enrollCourse);

    app.get('/api/admin/users', controller.requireAdmin, controller.listUsers);
    app.post('/api/admin/users', controller.requireAdmin, controller.createAdminManagedUser);
    app.get('/api/admin/analytics', controller.requireAdmin, controller.getAdminAnalytics);
    app.patch('/api/admin/settings', controller.requireAdmin, controller.updateSystemSettings);
    app.post('/api/admin/settings/broadcast', controller.requireAdmin, controller.broadcastSystemAnnouncement);
    app.patch('/api/admin/users/:userId/role', controller.requireAdmin, controller.updateUserRole);
    app.delete('/api/admin/users/:userId', controller.requireAdmin, controller.deleteUser);

    app.post('/api/practice/submissions', controller.submitPractice);
    app.post('/api/progress', controller.recordProgress);
    app.get('/api/users/:userId/progress', controller.requireOwnAccount, controller.getProgress);
    app.post('/api/users/:userId/progress', controller.requireOwnAccount, controller.recordLessonProgress);
    app.post('/api/users/:userId/quiz-results', controller.requireOwnAccount, controller.recordQuizResult);
    app.get('/api/users/:userId/bookmarks', controller.requireOwnAccount, controller.getBookmarks);
    app.post('/api/users/:userId/bookmarks', controller.requireOwnAccount, controller.toggleBookmark);

    app.post('/api/ai/chat', controller.chatAssist);
    app.get('/api/users/:userId/recommendations', controller.requireOwnAccount, controller.getRecommendations);
    app.post('/api/ai/feedback', controller.generateFeedback);
    app.get('/api/users/:userId/summary', controller.requireOwnAccount, controller.generateSummary);

    app.use(controller.notFound);
};
