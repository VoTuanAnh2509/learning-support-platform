const {
    Course,
    User,
    ProgressEvent,
    AIInteraction,
    Notification,
} = require('../models/projectModels');
const { asyncHandler, getUserIdFromToken } = require('../middlewares/authMiddleware');
const { formatProviderLabel } = require('../utils/helpers');

const notifyAdminsOfUserLogin = async (loggedInUser, actionType = 'login') => {
    try {
        if (!loggedInUser) return;
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        if (!admins.length) return;

        const providerLabel = formatProviderLabel(loggedInUser.authProvider);
        const roleLabel =
            loggedInUser.role === 'admin'
                ? 'Admin'
                : loggedInUser.role === 'instructor'
                  ? 'Instructor'
                  : 'Learner';
        const title =
            actionType === 'register' ? 'New User Registered & Signed In' : 'User Signed In';
        const message = `${loggedInUser.name || 'User'} (${loggedInUser.email}) [${roleLabel}] signed in via ${providerLabel}.`;

        const docs = admins.map(admin => ({
            user: admin._id,
            type: 'system',
            title,
            message,
            link: '/admin/users',
            isRead: false,
        }));

        await Notification.insertMany(docs);
    } catch (err) {
        console.error('Failed to notify admins of user login:', err.message || err);
    }
};

const listNotifications = asyncHandler(async (req, res) => {
    const userId = getUserIdFromToken(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authorization required.' });
    }

    const currentUser = await User.findById(userId).select('role').lean();
    if (!currentUser) {
        return res.status(404).json({ error: 'User not found.' });
    }

    // 1. ADMIN: Chỉ nhận thông báo về người dùng đăng nhập / đăng ký
    if (currentUser.role === 'admin') {
        await Notification.deleteMany({
            user: userId,
            title: { $in: ['AI Report', 'Study Reminder', 'System Update'] },
        });

        let notifications = await Notification.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        if (notifications.length === 0) {
            const recentUsers = await User.find({ lastLoginAt: { $ne: null } })
                .sort({ lastLoginAt: -1 })
                .limit(5)
                .lean();

            if (recentUsers.length > 0) {
                const seedItems = recentUsers.map(u => {
                    const providerLabel = formatProviderLabel(u.authProvider);
                    const roleLabel =
                        u.role === 'admin'
                            ? 'Admin'
                            : u.role === 'instructor'
                              ? 'Instructor'
                              : 'Learner';
                    return {
                        user: userId,
                        type: 'system',
                        title: 'User Signed In',
                        message: `${u.name || 'User'} (${u.email}) [${roleLabel}] signed in via ${providerLabel}.`,
                        link: '/admin/users',
                        isRead: false,
                        createdAt: u.lastLoginAt || u.updatedAt || new Date(),
                    };
                });
                await Notification.insertMany(seedItems);
                notifications = await Notification.find({ user: userId })
                    .sort({ createdAt: -1 })
                    .limit(20)
                    .lean();
            }
        }

        return res.json(notifications);
    }

    // 2. INSTRUCTOR & LEARNER: Chuông thông báo học tập / giảng dạy riêng
    await Notification.deleteMany({
        user: userId,
        title: { $in: ['User Signed In', 'New User Registered & Signed In'] },
    });

    let notifications = await Notification.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

    if (notifications.length === 0) {
        const defaultItems =
            currentUser.role === 'instructor'
                ? [
                      {
                          user: userId,
                          type: 'system',
                          title: 'Instructor Workspace Ready',
                          message:
                              'You can create courses, organize modules, and edit interactive lessons in the Instructor Panel.',
                          link: '/admin/courses',
                          isRead: false,
                      },
                      {
                          user: userId,
                          type: 'ai_report',
                          title: 'AI Mentor Active',
                          message:
                              'Learners can now use AI Code Review and practice quizzes in your published lessons.',
                          link: '/courses',
                          isRead: false,
                      },
                      {
                          user: userId,
                          type: 'reminder',
                          title: 'Course Catalog',
                          message:
                              'Preview how your tutorials appear to students in the Course Catalog.',
                          link: '/courses',
                          isRead: false,
                      },
                  ]
                : [
                      {
                          user: userId,
                          type: 'ai_report',
                          title: 'AI Report',
                          message:
                              'Your weekly learning summary from AI Mentor is ready to view!',
                          link: '/profile/insights',
                          isRead: false,
                      },
                      {
                          user: userId,
                          type: 'reminder',
                          title: 'Study Reminder',
                          message:
                              'Keep your coding streak alive! Continue your HTML & CSS lessons today.',
                          link: '/courses',
                          isRead: false,
                      },
                      {
                          user: userId,
                          type: 'system',
                          title: 'System Update',
                          message:
                              'Bookmark any lesson to save your progress and pick up right where you left off.',
                          link: '/profile/courses',
                          isRead: false,
                      },
                  ];

        await Notification.insertMany(defaultItems);
        notifications = await Notification.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
    }

    res.json(notifications);
});

const markNotificationRead = asyncHandler(async (req, res) => {
    const userId = getUserIdFromToken(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authorization required.' });
    }

    const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, user: userId },
        { isRead: true },
        { new: true }
    ).lean();

    if (!notification) {
        return res.status(404).json({ error: 'Notification not found.' });
    }

    res.json(notification);
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
    const userId = getUserIdFromToken(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authorization required.' });
    }

    await Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
    res.json({ message: 'All notifications marked as read.' });
});

const getAdminAnalytics = asyncHandler(async (_req, res) => {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const [userCount, courseCount, progressEvents, aiInteractions] = await Promise.all([
        User.countDocuments({ role: 'learner' }),
        Course.countDocuments(),
        ProgressEvent.aggregate([
            { $match: { createdAt: { $gte: last7Days } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        AIInteraction.aggregate([
            { $match: { createdAt: { $gte: last7Days } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]),
    ]);

    res.json({ userCount, courseCount, progressEvents, aiInteractions });
});

module.exports = {
    notifyAdminsOfUserLogin,
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getAdminAnalytics,
};
