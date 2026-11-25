const {
    Course,
    User,
    ProgressEvent,
    AIInteraction,
    Notification,
    SystemSetting,
} = require('../models/projectModels');
const { asyncHandler, getUserIdFromToken } = require('../middlewares/authMiddleware');
const { formatProviderLabel } = require('../utils/helpers');

const VALID_AI_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-2.0-flash',
];

const getOrCreateSystemSettings = async () => {
    let settings = await SystemSetting.findOne({ key: 'global' });
    if (!settings) {
        settings = await SystemSetting.create({ key: 'global' });
    }
    return settings;
};

const getSystemSettings = asyncHandler(async (_req, res) => {
    const settings = await getOrCreateSystemSettings();
    res.json({
        allowRegistration: Boolean(settings.allowRegistration),
        aiTutorEnabled: Boolean(settings.aiTutorEnabled),
        defaultAiModel: settings.defaultAiModel || 'gemini-2.5-flash',
        maintenanceMode: Boolean(settings.maintenanceMode),
        maintenanceMessage:
            settings.maintenanceMessage ||
            'Scheduled maintenance is in progress. Some platform features may be temporarily limited.',
        updatedAt: settings.updatedAt,
    });
});

const updateSystemSettings = asyncHandler(async (req, res) => {
    const settings = await getOrCreateSystemSettings();
    const {
        allowRegistration,
        aiTutorEnabled,
        defaultAiModel,
        maintenanceMode,
        maintenanceMessage,
    } = req.body;

    if (typeof allowRegistration === 'boolean') {
        settings.allowRegistration = allowRegistration;
    }
    if (typeof aiTutorEnabled === 'boolean') {
        settings.aiTutorEnabled = aiTutorEnabled;
    }
    if (defaultAiModel && VALID_AI_MODELS.includes(defaultAiModel)) {
        settings.defaultAiModel = defaultAiModel;
    }
    if (typeof maintenanceMode === 'boolean') {
        settings.maintenanceMode = maintenanceMode;
    }
    if (typeof maintenanceMessage === 'string') {
        settings.maintenanceMessage =
            maintenanceMessage.trim() ||
            'Scheduled maintenance is in progress. Some platform features may be temporarily limited.';
    }
    if (req.adminUser?._id) {
        settings.updatedBy = req.adminUser._id;
    }

    await settings.save();

    res.json({
        message: 'System settings updated successfully.',
        settings: {
            allowRegistration: Boolean(settings.allowRegistration),
            aiTutorEnabled: Boolean(settings.aiTutorEnabled),
            defaultAiModel: settings.defaultAiModel,
            maintenanceMode: Boolean(settings.maintenanceMode),
            maintenanceMessage: settings.maintenanceMessage,
            updatedAt: settings.updatedAt,
        },
    });
});

const broadcastSystemAnnouncement = asyncHandler(async (req, res) => {
    const { title, message, targetRole = 'all' } = req.body;

    if (!title || !String(title).trim() || !message || !String(message).trim()) {
        return res
            .status(400)
            .json({ error: 'Announcement title and message are both required.' });
    }

    const filter =
        targetRole && ['learner', 'instructor', 'admin'].includes(targetRole)
            ? { role: targetRole }
            : {};

    const recipients = await User.find(filter).select('_id').lean();
    if (!recipients.length) {
        return res.status(404).json({ error: 'No matching users found to receive announcement.' });
    }

    const docs = recipients.map(u => ({
        user: u._id,
        type: 'system',
        title: `📢 ${String(title).trim()}`,
        message: String(message).trim(),
        link: '/',
        isRead: false,
    }));

    await Notification.insertMany(docs);

    res.status(201).json({
        message: `Broadcasted announcement to ${recipients.length} user(s).`,
        recipientCount: recipients.length,
    });
});

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
    getOrCreateSystemSettings,
    getSystemSettings,
    updateSystemSettings,
    broadcastSystemAnnouncement,
    notifyAdminsOfUserLogin,
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getAdminAnalytics,
};
