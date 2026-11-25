const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const {
    User,
    PracticeSubmission,
    ProgressEvent,
    AIInteraction,
    Notification,
} = require('../models/projectModels');
const { asyncHandler } = require('../middlewares/authMiddleware');
const {
    normalizeText,
    isBcryptHash,
    validateEmailSpelling,
} = require('../utils/helpers');

const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.userId).populate('enrolledCourses.course');

    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    const safeUser = user.toObject();
    delete safeUser.password;
    res.json(safeUser);
});

const updateUserProfile = asyncHandler(async (req, res) => {
    const updates = {};
    [
        'name',
        'email',
        'bio',
        'avatarUrl',
        'avatarPreset',
        'goals',
        'interests',
        'proficiency',
    ].forEach(field => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (updates.email !== undefined) {
        const emailCheck = validateEmailSpelling(updates.email);
        if (!emailCheck.valid) {
            return res.status(400).json({ error: emailCheck.error });
        }
        updates.email = normalizeText(updates.email);

        const duplicateUser = await User.findOne({
            email: updates.email,
            _id: { $ne: req.params.userId },
        }).lean();
        if (duplicateUser) {
            return res.status(409).json({
                error: 'This email is already used by another account.',
            });
        }
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    Object.assign(user, updates);
    await user.save();

    const safeUser = user.toObject();
    delete safeUser.password;
    res.json(safeUser);
});

const changeUserPassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    const passwordMatches = isBcryptHash(user.password)
        ? await bcrypt.compare(currentPassword || '', user.password)
        : currentPassword === user.password;
    if (!passwordMatches) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated successfully.' });
});

const resetCourseProgress = asyncHandler(async (req, res) => {
    const { userId, courseId } = req.params;
    if (!mongoose.isValidObjectId(courseId)) {
        return res.status(400).json({ error: 'Valid courseId is required.' });
    }

    const user = await User.findById(userId).populate('enrolledCourses.course');
    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    const enrollment = user.enrolledCourses.find(
        entry => String(entry.course?._id || entry.course) === String(courseId)
    );
    if (!enrollment) {
        return res.status(404).json({ error: 'You are not enrolled in this course.' });
    }

    enrollment.completedLessons = [];
    enrollment.completionRate = 0;
    enrollment.lastLessonId = null;
    enrollment.lastLessonTitle = '';
    enrollment.lastLessonSlug = '';
    enrollment.lastAccessedAt = new Date();

    await Promise.all([
        user.save(),
        ProgressEvent.deleteMany({ user: userId, course: courseId }),
        PracticeSubmission.deleteMany({ user: userId, course: courseId }),
    ]);

    const safeUser = user.toObject();
    delete safeUser.password;

    res.json({
        message: 'Course progress has been reset to 0%.',
        user: safeUser,
    });
});

const exportUserData = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const [user, submissions, progressEvents] = await Promise.all([
        User.findById(userId).populate('enrolledCourses.course', 'title subject').lean(),
        PracticeSubmission.find({ user: userId })
            .populate('course', 'title subject')
            .sort({ createdAt: -1 })
            .lean(),
        ProgressEvent.find({ user: userId })
            .populate('course', 'title subject')
            .sort({ createdAt: -1 })
            .lean(),
    ]);

    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    const safeUser = { ...user };
    delete safeUser.password;
    delete safeUser.resetPasswordToken;
    delete safeUser.resetPasswordExpires;

    res.json({
        exportedAt: new Date().toISOString(),
        platform: 'Learning Support Platform',
        account: {
            id: safeUser._id,
            name: safeUser.name,
            email: safeUser.email,
            role: safeUser.role,
            authProvider: safeUser.authProvider || 'local',
            bio: safeUser.bio || '',
            avatarUrl: safeUser.avatarUrl || '',
            avatarPreset: safeUser.avatarPreset || '',
            createdAt: safeUser.createdAt,
            lastLoginAt: safeUser.lastLoginAt,
        },
        enrolledCourses: (safeUser.enrolledCourses || []).map(entry => ({
            courseId: entry.course?._id || entry.course,
            courseTitle: entry.course?.title || 'Course',
            subject: entry.course?.subject || '',
            completionRate: entry.completionRate || 0,
            completedLessonsCount: (entry.completedLessons || []).length,
            lastLessonTitle: entry.lastLessonTitle || '',
            enrolledAt: entry.enrolledAt,
            lastAccessedAt: entry.lastAccessedAt,
        })),
        bookmarkedLessons: safeUser.bookmarkedLessons || [],
        quizAndPracticeSubmissions: submissions.map(sub => ({
            courseTitle: sub.course?.title || 'Course',
            questionType: sub.questionType,
            submittedAnswer: sub.submittedAnswer,
            score: sub.score,
            isCorrect: sub.isCorrect,
            createdAt: sub.createdAt,
        })),
        progressHistory: progressEvents.map(evt => ({
            courseTitle: evt.course?.title || 'Course',
            eventType: evt.eventType,
            durationMinutes: evt.durationMinutes || 0,
            createdAt: evt.createdAt,
        })),
    });
});

const deleteOwnAccount = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    await Promise.all([
        ProgressEvent.deleteMany({ user: userId }),
        PracticeSubmission.deleteMany({ user: userId }),
        AIInteraction.deleteMany({ user: userId }),
        Notification.deleteMany({ user: userId }),
        User.findByIdAndDelete(userId),
    ]);

    res.json({
        message: 'Your account and all learning data have been permanently deleted.',
    });
});

const listUsers = asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ createdAt: -1 }).lean();

    res.json(
        users.map(user => {
            const safeUser = { ...user };
            delete safeUser.password;
            return safeUser;
        })
    );
});

const createAdminManagedUser = asyncHandler(async (req, res) => {
    const { name, email, password, role = 'learner' } = req.body;

    if (!name || !String(name).trim() || !email || !String(email).trim()) {
        return res.status(400).json({ error: 'Name and email are required.' });
    }

    const emailCheck = validateEmailSpelling(email);
    if (!emailCheck.valid) {
        return res.status(400).json({ error: emailCheck.error });
    }

    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    if (!['learner', 'instructor', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role.' });
    }

    const normalizedEmail = normalizeText(email);
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
        return res.status(409).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
        name: String(name).trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role,
        authProvider: 'local',
    });

    const safeUser = user.toObject();
    delete safeUser.password;
    res.status(201).json({ message: 'User created successfully.', user: safeUser });
});

const updateUserRole = asyncHandler(async (req, res) => {
    const { role } = req.body;

    if (!['learner', 'instructor', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role.' });
    }

    const user = await User.findByIdAndUpdate(
        req.params.userId,
        { role },
        {
            new: true,
            runValidators: true,
        }
    );

    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    const safeUser = user.toObject();
    delete safeUser.password;
    res.json({ message: 'User role updated successfully.', user: safeUser });
});

const deleteUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (req.adminUser && String(req.adminUser._id) === String(userId)) {
        return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
        return res.status(404).json({ error: 'User not found.' });
    }

    await Promise.all([
        ProgressEvent.deleteMany({ user: userId }),
        PracticeSubmission.deleteMany({ user: userId }),
        AIInteraction.deleteMany({ user: userId }),
        Notification.deleteMany({ user: userId }),
    ]);

    res.json({ message: 'User deleted successfully.' });
});

module.exports = {
    getUserProfile,
    updateUserProfile,
    changeUserPassword,
    resetCourseProgress,
    exportUserData,
    deleteOwnAccount,
    listUsers,
    createAdminManagedUser,
    updateUserRole,
    deleteUser,
};
