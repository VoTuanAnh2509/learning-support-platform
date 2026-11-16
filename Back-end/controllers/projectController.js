const {
    Course,
    User,
    PracticeSubmission,
    ProgressEvent,
    AIInteraction,
    Notification,
} = require('../models/projectModels');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Khởi tạo Gemini client bằng API Key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const getTokenFromRequest = req => {
    const header = req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
        return '';
    }

    return header.slice(7).trim();
};

const verifyRoleUser = async (req, allowedRoles, errorMessage) => {
    const token = getTokenFromRequest(req);

    if (!token) {
        return { ok: false, status: 401, error: 'Authorization token missing.' };
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_key_for_development');
        const user = await User.findById(payload.userId).lean();

        if (!user) {
            return { ok: false, status: 401, error: 'User not found.' };
        }

        if (!allowedRoles.includes(user.role)) {
            return { ok: false, status: 403, error: errorMessage };
        }

        return { ok: true, user };
    } catch (_error) {
        return { ok: false, status: 401, error: 'Invalid or expired token.' };
    }
};

const verifyAdminUser = req =>
    verifyRoleUser(req, ['admin'], 'Admin access required.');

const verifyStaffUser = req =>
    verifyRoleUser(req, ['admin', 'instructor'], 'Staff (Instructor or Admin) access required.');

const normalizeText = value => String(value || '').trim().toLowerCase();

const isBcryptHash = value => typeof value === 'string' && /^\$2[aby]\$/.test(value);

const isTruthy = value => {
    const normalized = normalizeText(value);
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const splitKeywords = value =>
    normalizeText(value)
        .split(/\s+/)
        .filter(Boolean);

const getCourseSignal = course => {
    const moduleCount = Array.isArray(course.modules) ? course.modules.length : 0;
    const lessonCount = Array.isArray(course.modules)
        ? course.modules.reduce((total, module) => total + (module.lessons?.length || 0), 0)
        : 0;

    return {
        moduleCount,
        lessonCount,
        difficulty: course.difficulty,
        subject: course.subject,
        tags: course.tags || [],
    };
};

const deriveWeakAreas = submissions => {
    const weakAreas = new Map();

    submissions.forEach(submission => {
        if (submission.isCorrect) {
            return;
        }

        const signal = submission.feedback || submission.questionType || 'practice';
        weakAreas.set(signal, (weakAreas.get(signal) || 0) + 1);
    });

    return [...weakAreas.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([label, count]) => ({ label, count }));
};

const craftAssistantReply = ({ question, subject, lesson }) => {
    const keywords = splitKeywords(question);
    const hasDebugging = keywords.some(word => ['error', 'bug', 'debug', 'fail', 'exception'].includes(word));
    const hasDatabase = keywords.some(word => ['database', 'mongodb', 'mongoose', 'sql', 'collection'].includes(word));
    const hasJavaScript = keywords.some(word => ['javascript', 'js', 'array', 'object', 'function', 'async'].includes(word));

    if (hasDebugging) {
        return `Start by isolating the failing step, then check the expected input, the actual output, and any thrown errors. If you share the code path, I can help trace the bug line by line.${lesson ? ` The current lesson focus is ${lesson}.` : ''}`;
    }

    if (hasDatabase) {
        return `When working with ${subject || 'the course'} data, confirm the schema shape, required fields, and query filters first. Then validate the document you are saving or reading matches the model structure.`;
    }

    if (hasJavaScript) {
        return `For JavaScript concepts, think in terms of data flow: inputs, transformation, and outputs. Break the code into small steps, name intermediate values clearly, and test each branch separately.`;
    }

    return `Here is a simple study approach for ${subject || 'this topic'}: identify the concept, read one worked example, reproduce it without looking, then solve one small variation. If you want, I can also summarize the idea in beginner or advanced terms.`;
};

const buildRecommendations = async userId => {
    const [user, recentSubmissions, recentEvents, courses] = await Promise.all([
        User.findById(userId).lean(),
        PracticeSubmission.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
        ProgressEvent.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
        Course.find({ isPublished: true }).sort({ updatedAt: -1 }).lean(),
    ]);

    const weakAreas = deriveWeakAreas(recentSubmissions);
    const enrolledCourseIds = new Set((user?.enrolledCourses || []).map(entry => String(entry.course)));

    const recommendedCourses = courses
        .filter(course => !enrolledCourseIds.has(String(course._id)))
        .sort((left, right) => {
            const leftScore = (weakAreas.some(area => normalizeText(left.subject).includes(area.label)) ? 2 : 0) + (left.difficulty === user?.proficiency ? 1 : 0);
            const rightScore = (weakAreas.some(area => normalizeText(right.subject).includes(area.label)) ? 2 : 0) + (right.difficulty === user?.proficiency ? 1 : 0);
            return rightScore - leftScore;
        })
        .slice(0, 5)
        .map(course => ({
            courseId: course._id,
            title: course.title,
            subject: course.subject,
            difficulty: course.difficulty,
            reason: weakAreas.length
                ? `Matches your practice gaps around ${weakAreas[0].label}.`
                : 'Aligned with your current study level.',
        }));

    const reviewSuggestions = weakAreas.slice(0, 3).map(area => ({
        topic: area.label,
        recommendation: `Review the lesson paths connected to ${area.label} and repeat one short practice set.`,
    }));

    return {
        learner: user ? { id: user._id, name: user.name, proficiency: user.proficiency } : null,
        weakAreas,
        recentActivityCount: recentEvents.length,
        recommendedCourses,
        reviewSuggestions,
    };
};

const buildWeeklySummary = async userId => {
    const [user, submissions, progressEvents] = await Promise.all([
        User.findById(userId).lean(),
        PracticeSubmission.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
        ProgressEvent.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    const completedCount = progressEvents.filter(event => event.eventType === 'lesson_completed').length;
    const correctCount = submissions.filter(submission => submission.isCorrect).length;
    const weakAreas = deriveWeakAreas(submissions);

    return {
        learner: user ? { id: user._id, name: user.name } : null,
        strengths: correctCount > 0 ? ['You are building consistency through repeated attempts.'] : ['Continue practicing to build momentum.'],
        knowledgeGaps: weakAreas.slice(0, 3).map(area => `${area.label} needs more review.`),
        progressSnapshot: {
            recentLessonsCompleted: completedCount,
            practiceAccuracy: submissions.length ? Math.round((correctCount / submissions.length) * 100) : 0,
            activityEvents: progressEvents.length,
        },
        nextActions: [
            'Review one weak topic before starting the next lesson.',
            'Complete one coding challenge with a focus on explanation, not only the final answer.',
            'Record a short reflection on what changed after the practice session.',
        ],
    };
};

exports.createCourse = asyncHandler(async (req, res) => {
    const course = await Course.create(req.body);
    res.status(201).json(course);
});

exports.listCourses = asyncHandler(async (_req, res) => {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.json(courses);
});

exports.getCourse = asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.courseId);

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    res.json(course);
});

exports.updateCourse = asyncHandler(async (req, res) => {
    const course = await Course.findByIdAndUpdate(req.params.courseId, req.body, {
        new: true,
        runValidators: true,
    });

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    res.json(course);
});

exports.deleteCourse = asyncHandler(async (req, res) => {
    const course = await Course.findByIdAndDelete(req.params.courseId);

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    res.json({ message: 'Course removed successfully.' });
});

exports.addModule = asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.courseId);

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    course.modules.push(req.body);
    await course.save();

    res.status(201).json(course);
});

exports.addLesson = asyncHandler(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    const module = course.modules.id(moduleId);

    if (!module) {
        return res.status(404).json({ error: 'Module not found.' });
    }

    module.lessons.push(req.body);
    await course.save();

    res.status(201).json(course);
});

exports.updateLesson = asyncHandler(async (req, res) => {
    const { courseId, moduleId, lessonId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    const module = course.modules.id(moduleId);

    if (!module) {
        return res.status(404).json({ error: 'Module not found.' });
    }

    const lesson = module.lessons.id(lessonId);

    if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found.' });
    }

    Object.assign(lesson, req.body);
    await course.save();

    res.json(course);
});

exports.updateModule = asyncHandler(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    const module = course.modules.id(moduleId);
    if (!module) {
        return res.status(404).json({ error: 'Module not found.' });
    }

    // Allow updating title, description, order
    const { title, description, order } = req.body;
    if (typeof title === 'string') module.title = title;
    if (typeof description === 'string') module.description = description;
    if (typeof order !== 'undefined') module.order = Number(order) || 0;

    await course.save();
    res.json(course);
});

exports.deleteModule = asyncHandler(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    const module = course.modules.id(moduleId);
    if (!module) {
        return res.status(404).json({ error: 'Module not found.' });
    }

    module.remove();
    await course.save();

    res.json({ message: 'Module deleted successfully.' });
});

exports.deleteLesson = asyncHandler(async (req, res) => {
    const { courseId, moduleId, lessonId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    const module = course.modules.id(moduleId);
    if (!module) {
        return res.status(404).json({ error: 'Module not found.' });
    }

    const lesson = module.lessons.id(lessonId);
    if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found.' });
    }

    lesson.remove();
    await course.save();

    res.json({ message: 'Lesson deleted successfully.' });
});

exports.registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, bio, goals, interests, proficiency } = req.body;

    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const existingUser = await User.findOne({ email: normalizeText(email) });

    if (existingUser) {
        return res.status(409).json({ error: 'Email already registered.' });
    }

    // 1. Tạo "muối" (salt) để tăng độ phức tạp cho mật khẩu
    const salt = await bcrypt.genSalt(10);
    // 2. Băm mật khẩu cùng với muối
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
        name,
        email: normalizeText(email),
        password: hashedPassword, // Lưu mật khẩu đã băm thay vì mật khẩu gốc
        role: 'learner',
        authProvider: 'local',
        bio,
        goals,
        interests,
        proficiency,
        lastLoginAt: new Date(),
    });

    const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET || 'your_super_secret_key_for_development',
        { expiresIn: '7d' }
    );

    const safeUser = user.toObject();
    delete safeUser.password;
    res.status(201).json({
        message: 'User registered successfully.',
        token,
        user: safeUser,
    });
});

exports.bootstrapAdminUser = asyncHandler(async (req, res) => {
    const setupKey = req.headers['x-admin-setup-key'] || req.body.setupKey || '';
    const expectedKey = process.env.ADMIN_SETUP_KEY || '';

    if (!expectedKey) {
        return res.status(500).json({ error: 'Admin setup key is not configured.' });
    }

    if (String(setupKey).trim() !== String(expectedKey).trim()) {
        return res.status(401).json({ error: 'Invalid admin setup key.' });
    }

    const { name, email, password, bio, goals, interests, proficiency } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'name, email, and password are required.' });
    }

    const existingUser = await User.findOne({ email: normalizeText(email) });

    if (existingUser) {
        return res.status(409).json({ error: 'Email already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
        name,
        email: normalizeText(email),
        password: hashedPassword,
        role: 'admin',
        bio,
        goals,
        interests,
        proficiency,
    });

    const safeUser = user.toObject();
    delete safeUser.password;

    res.status(201).json({
        message: 'Admin account created successfully.',
        user: safeUser,
    });
});

exports.ensureAdminExists = async () => {
    try {
        const name = process.env.ADMIN_BOOTSTRAP_NAME;
        const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
        const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

        if (!name || !email || !password) {
            // nothing to do
            return;
        }

        const existing = await User.findOne({ email: normalizeText(email) });
        if (existing) {
            console.log('Admin seed: admin already exists.');
            return;
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const admin = await User.create({
            name,
            email: normalizeText(email),
            password: hashedPassword,
            role: 'admin',
            bio: 'Bootstrapped admin',
        });

        console.log(`Admin seed: created admin ${admin.email}`);
    } catch (err) {
        console.error('Admin seed error:', err.message || err);
    }
};

exports.loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: normalizeText(email) });

    // 1. Kiểm tra xem email có tồn tại không
    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 2. Dùng bcrypt để so sánh mật khẩu người dùng nhập vào với mã băm trong database.
    //    Hỗ trợ tạm thời cho dữ liệu cũ vẫn còn lưu mật khẩu dạng plain text.
    const isMatch = isBcryptHash(user.password)
        ? await bcrypt.compare(password, user.password)
        : password === user.password;
    if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!isBcryptHash(user.password)) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
    }

    if (!user.authProvider) {
        user.authProvider = 'local';
    }
    user.lastLoginAt = new Date();
    await user.save();

    // 3. Tạo Payload (thông tin gói gọn trong token)
    const payload = {
        userId: user._id,
        role: user.role
    };

    // 4. Ký tạo JWT
    // Lưu ý: Chuỗi 'your_super_secret_key' nên được lưu trong file .env (ví dụ: process.env.JWT_SECRET)
    const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || 'your_super_secret_key_for_development', 
        { expiresIn: '7d' } // Token sẽ hết hạn sau 7 ngày
    );

    const safeUser = user.toObject();
    delete safeUser.password;
    
    // 5. Trả về token cùng thông tin user
    res.json({ 
        message: 'Login successful.', 
        token: token, 
        user: safeUser 
    });
});

exports.getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.userId).populate('enrolledCourses.course');

    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    const safeUser = user.toObject();
    delete safeUser.password;
    res.json(safeUser);
});

exports.updateUserProfile = asyncHandler(async (req, res) => {
    const updates = {};
    ['name', 'email', 'bio', 'goals', 'interests', 'proficiency'].forEach(field => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

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

exports.changeUserPassword = asyncHandler(async (req, res) => {
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

exports.listUsers = asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ createdAt: -1 }).lean();

    res.json(
        users.map(user => {
            const safeUser = { ...user };
            delete safeUser.password;
            return safeUser;
        })
    );
});

exports.createAdminManagedUser = asyncHandler(async (req, res) => {
    const { name, email, password, role = 'learner' } = req.body;

    if (!name || !String(name).trim() || !email || !String(email).trim()) {
        return res.status(400).json({ error: 'Name and email are required.' });
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

exports.updateUserRole = asyncHandler(async (req, res) => {
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

exports.deleteUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (req.adminUser && String(req.adminUser._id) === String(userId)) {
        return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
        return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ message: 'User deleted successfully.' });
});

exports.requireAdmin = async (req, res, next) => {
    const authCheck = await verifyAdminUser(req);

    if (!authCheck.ok) {
        return res.status(authCheck.status).json({ error: authCheck.error });
    }

    req.adminUser = authCheck.user;
    return next();
};

exports.requireStaff = async (req, res, next) => {
    const authCheck = await verifyStaffUser(req);

    if (!authCheck.ok) {
        return res.status(authCheck.status).json({ error: authCheck.error });
    }

    req.staffUser = authCheck.user;
    return next();
};

exports.requireOwnAccount = (req, res, next) => {
    const token = getTokenFromRequest(req);
    if (!token) {
        return res.status(401).json({ error: 'Authorization token missing.' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_key_for_development');
        if (String(payload.userId) !== String(req.params.userId) && payload.role !== 'admin') {
            return res.status(403).json({ error: 'You can only access your own account.' });
        }
        return next();
    } catch (_error) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

exports.enrollCourse = asyncHandler(async (req, res) => {
    const { userId, courseId } = req.params;
    const [user, course] = await Promise.all([User.findById(userId), Course.findById(courseId)]);

    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    const enrolled = user.enrolledCourses.find(entry => String(entry.course) === String(courseId));

    if (!enrolled) {
        user.enrolledCourses.push({ course: course._id, enrolledAt: new Date(), completionRate: 0 });
        await user.save();
    }

    res.json({ message: 'Course enrollment updated.', course: getCourseSignal(course) });
});

exports.submitPractice = asyncHandler(async (req, res) => {
    const { userId, courseId, moduleId, lessonId, exerciseId, submittedAnswer, expectedAnswer, questionType } = req.body;
    const answer = normalizeText(submittedAnswer);
    const expected = normalizeText(expectedAnswer);
    const isCorrect = expected ? answer === expected : answer.length > 0;
    const score = isCorrect ? 100 : 0;

    const feedback = isCorrect
        ? 'Correct answer. Keep going and try to explain why it works in your own words.'
        : 'Incorrect answer. Review the lesson, compare your approach with the sample solution, and try again with a smaller step.';

    const submission = await PracticeSubmission.create({
        user: userId,
        course: courseId,
        moduleId,
        lessonId,
        exerciseId,
        questionType: questionType || 'coding',
        submittedAnswer,
        isCorrect,
        score,
        feedback,
        reviewHints: isCorrect
            ? ['Explain the solution to reinforce understanding.']
            : ['Check the lesson notes and compare inputs, outputs, and assumptions.'],
    });

    await ProgressEvent.create({
        user: userId,
        course: courseId,
        moduleId,
        lessonId,
        eventType: 'practice_attempt',
        durationMinutes: 0,
        metadata: { isCorrect, score },
    });

    res.status(201).json(submission);
});

exports.recordProgress = asyncHandler(async (req, res) => {
    const event = await ProgressEvent.create(req.body);
    res.status(201).json(event);
});

const getLessonProgressContext = async ({ userId, courseId, moduleId, lessonId }) => {
    if (![userId, courseId, moduleId, lessonId].every(id => id && mongoose.isValidObjectId(id))) {
        return { error: 'Valid user, course, module, and lesson IDs are required.', status: 400 };
    }

    const [user, course] = await Promise.all([
        User.findById(userId),
        Course.findById(courseId),
    ]);

    if (!user) return { error: 'User not found.', status: 404 };
    if (!course) return { error: 'Course not found.', status: 404 };

    const module = course.modules.id(moduleId);
    const lesson = module?.lessons.id(lessonId);
    if (!module || !lesson) {
        return { error: 'The lesson does not belong to the specified course module.', status: 400 };
    }

    return { user, course, module, lesson };
};

const recordLessonCompletion = async ({ user, course, module, lesson }) => {
    let enrollment = user.enrolledCourses.find(entry => String(entry.course) === String(course._id));
    if (!enrollment) {
        user.enrolledCourses.push({ course: course._id });
        enrollment = user.enrolledCourses[user.enrolledCourses.length - 1];
    }

    const wasCompleted = enrollment.completedLessons.some(id => String(id) === String(lesson._id));
    if (!wasCompleted) enrollment.completedLessons.push(lesson._id);

    const totalLessons = course.modules.reduce((total, courseModule) => total + courseModule.lessons.length, 0);
    const completedLessonCount = new Set(enrollment.completedLessons.map(id => String(id))).size;
    enrollment.completionRate = totalLessons
        ? Math.round((completedLessonCount / totalLessons) * 100)
        : 0;
    enrollment.lastLessonId = lesson._id;
    enrollment.lastLessonTitle = lesson.title || '';
    enrollment.lastLessonSlug = buildSlug(lesson.title) || 'home';
    enrollment.lastAccessedAt = new Date();
    await user.save();

    if (!wasCompleted) {
        await ProgressEvent.create({
            user: user._id,
            course: course._id,
            moduleId: module._id,
            lessonId: lesson._id,
            eventType: 'lesson_completed',
            durationMinutes: lesson.estimatedMinutes || 0,
        });
    }

    if (totalLessons > 0 && enrollment.completionRate === 100) {
        const alreadyRecorded = await ProgressEvent.exists({
            user: user._id,
            course: course._id,
            eventType: 'course_completed',
        });
        if (!alreadyRecorded) {
            await ProgressEvent.create({
                user: user._id,
                course: course._id,
                eventType: 'course_completed',
            });
        }
    }

    return enrollment;
};

exports.recordLessonProgress = asyncHandler(async (req, res) => {
    const context = await getLessonProgressContext({
        userId: req.params.userId,
        courseId: req.body.courseId,
        moduleId: req.body.moduleId,
        lessonId: req.body.lessonId,
    });
    if (context.error) return res.status(context.status).json({ error: context.error });

    const enrollment = await recordLessonCompletion(context);
    res.status(200).json({
        message: 'Lesson progress saved.',
        completionRate: enrollment.completionRate,
        completedLessons: enrollment.completedLessons,
    });
});

exports.recordQuizResult = asyncHandler(async (req, res) => {
    const { courseId, moduleId, lessonId, correctAnswers, totalQuestions } = req.body;
    if (!courseId || !mongoose.isValidObjectId(courseId)) {
        return res.status(400).json({ error: 'A valid courseId is required.' });
    }

    const hasModuleId = moduleId !== undefined && moduleId !== null;
    const hasLessonId = lessonId !== undefined && lessonId !== null;
    if (hasModuleId !== hasLessonId || (hasModuleId
        && (!mongoose.isValidObjectId(moduleId) || !mongoose.isValidObjectId(lessonId)))) {
        return res.status(400).json({ error: 'Provide both valid moduleId and lessonId for a lesson quiz.' });
    }

    if (!Number.isInteger(correctAnswers) || !Number.isInteger(totalQuestions)
        || totalQuestions < 1 || correctAnswers < 0 || correctAnswers > totalQuestions) {
        return res.status(400).json({ error: 'Valid correctAnswers and totalQuestions are required.' });
    }

    const [user, course] = await Promise.all([
        User.findById(req.params.userId),
        Course.findById(courseId),
    ]);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    let module = null;
    let lesson = null;
    if (hasModuleId) {
        module = course.modules.id(moduleId);
        lesson = module?.lessons.id(lessonId);
        if (!module || !lesson) {
            return res.status(400).json({ error: 'The lesson does not belong to the specified course module.' });
        }
    }

    const score = Math.round((correctAnswers / totalQuestions) * 100);
    const submission = await PracticeSubmission.create({
        user: user._id,
        course: course._id,
        moduleId: module?._id || null,
        lessonId: lesson?._id || null,
        questionType: 'quiz',
        submittedAnswer: `${correctAnswers}/${totalQuestions}`,
        isCorrect: correctAnswers === totalQuestions,
        score,
    });

    const enrollment = lesson
        ? await recordLessonCompletion({ user, course, module, lesson })
        : null;
    res.status(201).json({
        message: 'Quiz result saved.',
        score,
        completionRate: enrollment?.completionRate ?? null,
        submission,
    });
});

exports.getProgress = asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    const [events, submissions, user] = await Promise.all([
        ProgressEvent.find({ user: userId }).sort({ createdAt: -1 }).lean(),
        PracticeSubmission.find({ user: userId }).sort({ createdAt: -1 }).lean(),
        User.findById(userId).lean(),
    ]);

    const completedLessons = new Set(events
        .filter(event => event.eventType === 'lesson_completed' && event.course && event.lessonId)
        .map(event => `${event.course}:${event.lessonId}`)).size;
    const completedCourses = new Set(events
        .filter(event => event.eventType === 'course_completed' && event.course)
        .map(event => String(event.course))).size;
    const courseIds = [...new Set(events
        .filter(event => event.course && event.durationMinutes > 0)
        .map(event => String(event.course)))];
    const courses = courseIds.length
        ? await Course.find({ _id: { $in: courseIds } }).select('title subject').lean()
        : [];
    const coursesById = new Map(courses.map(course => [String(course._id), course]));
    const studyTimeByCourse = new Map();
    events.forEach(event => {
        if (!event.course || event.durationMinutes <= 0) return;

        const courseId = String(event.course);
        const course = coursesById.get(courseId);
        if (!course) return;

        const studyTime = studyTimeByCourse.get(courseId) || {
            courseSlug: normalizeText(course.title || course.subject).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            courseName: course.title || course.subject,
            minutes: 0,
        };
        studyTime.minutes += event.durationMinutes;
        studyTimeByCourse.set(courseId, studyTime);
    });
    const correctSubmissions = submissions.filter(submission => submission.isCorrect).length;
    const scoresFor = questionType => {
        const matching = submissions.filter(submission => submission.questionType === questionType);
        return {
            attempts: matching.length,
            averageScore: matching.length
                ? Math.round(matching.reduce((total, submission) => total + (submission.score || 0), 0) / matching.length)
                : 0,
        };
    };

    res.json({
        user: user ? { id: user._id, name: user.name, proficiency: user.proficiency } : null,
        progressSummary: {
            completedLessons,
            completedCourses,
            practiceAttempts: submissions.length,
            correctSubmissions,
            accuracy: submissions.length ? Math.round((correctSubmissions / submissions.length) * 100) : 0,
            quiz: scoresFor('quiz'),
            exercises: scoresFor('coding'),
            studyMinutes: events.reduce((total, event) => total + (event.durationMinutes || 0), 0),
            studyTime: [...studyTimeByCourse.values()],
            recentActivity: events.slice(0, 10),
        },
    });
});

exports.chatAssist = asyncHandler(async (req, res) => {
    const { userId, question, subject, lesson } = req.body;

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ answer: "System Error: Gemini API Key is missing on the server." });
    }

    try {
       
        const model = genAI.getGenerativeModel({ model:   "gemini-3.5-flash"}); 

        // System Prompt: Định hướng tính cách và bối cảnh cho AI
        const prompt = `
            You are an expert IT Programming Mentor on a learning platform.
            Current Context:
            - Course Subject: ${subject || 'General Programming'}
            - Current Lesson: ${lesson || 'General Knowledge'}
            
            Learner's Question: "${question}"
            
            Instructions:
            - Answer the question clearly, concisely, and encouragingly.
            - Provide code examples if appropriate.
            - Keep the tone educational. Don't just give the answer; explain the 'why'.
            - Format your response nicely (markdown is supported on frontend if handled, otherwise use clear spacing).
        `;

        // Gọi API Gemini
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Lưu lịch sử tương tác vào DB (Giữ nguyên logic cũ của bạn)
        await AIInteraction.create({
            user: userId || null,
            contextType: 'chat',
            subject: subject || '',
            prompt: question,
            response: responseText,
            confidence: 0.95, // Giả định độ tự tin cao cho LLM
        });

        // Trả kết quả về cho Frontend
        res.json({ answer: responseText });
    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ answer: "I'm having trouble connecting to my AI brain right now. Please try again later." });
    }
});

exports.getRecommendations = asyncHandler(async (req, res) => {
    const userId = req.params.userId;

    // 1. Kéo dữ liệu thực tế từ Database
    const [user, recentSubmissions, recentEvents, courses] = await Promise.all([
        User.findById(userId).lean(),
        PracticeSubmission.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
        ProgressEvent.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
        Course.find({ isPublished: true }).lean(),
    ]);

    // Lọc ra các chủ đề đang yếu và các khóa học chưa đăng ký
    const weakAreas = deriveWeakAreas(recentSubmissions);
    const enrolledCourseIds = new Set((user?.enrolledCourses || []).map(entry => String(entry.course)));
    const availableCourses = courses.filter(c => !enrolledCourseIds.has(String(c._id)));

    // Chuẩn bị kết quả mặc định
    const baseResult = {
        learner: user ? { id: user._id, name: user.name, proficiency: user.proficiency } : null,
        weakAreas,
        recentActivityCount: recentEvents.length,
        recommendedCourses: [],
        reviewSuggestions: []
    };

    if (!process.env.GEMINI_API_KEY) {
        return res.json(baseResult);
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

        // 2. Thiết kế Prompt với Danh sách khóa học có sẵn (Catalog)
        const prompt = `
            You are an expert IT Programming Mentor. Recommend next courses and review topics for this specific student.
            
            Student Profile:
            - Name: ${user?.name || 'Student'}
            - Current Proficiency: ${user?.proficiency || 'Beginner'}
            - Weak Areas Identified: ${weakAreas.map(w => w.label).join(', ') || 'None yet'}
            
            Available Course Catalog (YOU MUST CHOOSE ONLY FROM THIS LIST):
            ${availableCourses.map(c => `- ID: ${c._id}, Title: "${c.title}", Subject: "${c.subject}", Difficulty: "${c.difficulty}"`).join('\n')}
            
            Instructions:
            1. Select up to 3 best-fit courses from the Available Course Catalog for this student based on their proficiency and weak areas.
            2. For each recommended course, provide the exact courseId, title, subject, difficulty, and write a personalized 'reason' (max 2 sentences) explaining why it helps them.
            3. Suggest up to 3 review topics based on their Weak Areas, providing a specific, actionable 'recommendation'.
            
            You MUST return ONLY a valid JSON object matching this exact structure, with NO markdown formatting, NO backticks, and NO extra text:
            {
                "recommendedCourses": [
                    { "courseId": "...", "title": "...", "subject": "...", "difficulty": "...", "reason": "..." }
                ],
                "reviewSuggestions": [
                    { "topic": "...", "recommendation": "..." }
                ]
            }
        `;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text();
        
        // Dọn dẹp chuỗi JSON an toàn
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiRecommendations = JSON.parse(responseText);
        
        // Ghép mảng AI tạo ra vào cấu trúc gốc
        baseResult.recommendedCourses = aiRecommendations.recommendedCourses || [];
        baseResult.reviewSuggestions = aiRecommendations.reviewSuggestions || [];

        // Lưu lịch sử
        await AIInteraction.create({
            user: userId,
            contextType: 'recommendation',
            prompt: 'Generate personalized course recommendations from catalog',
            response: JSON.stringify(aiRecommendations),
            confidence: 0.9,
        });

    } catch (error) {
        console.error("Gemini API Error (Recommendations):", error);
        // Trả về mảng rỗng nếu có lỗi để UI không bị vỡ
    }

    // 3. Trả về kết quả
    res.json(baseResult);
});

exports.generateFeedback = asyncHandler(async (req, res) => {
    const { userId, submittedAnswer, subject } = req.body;

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ feedback: "System Error: Gemini API Key is missing." });
    }

    try {
        const model = genAI.getGenerativeModel({ model:  "gemini-3.5-flash" });

        // Prompt được thiết kế chuyên biệt cho việc Review code tự do
        const prompt = `
            You are an expert IT Programming Mentor.
            The user is experimenting with code in a "Try it Yourself" sandbox for the subject: ${subject || 'Web Development'}.
            
            Here is the exact code they wrote:
            \`\`\`
            ${submittedAnswer}
            \`\`\`
            
            Instructions:
            - Review the code above.
            - If there are any syntax errors or obvious bugs, point them out gently.
            - Explain briefly what the code does or will display.
            - Suggest one small improvement or best practice if applicable.
            - Keep your feedback concise, encouraging, and format it nicely in Markdown.
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Lưu lại lịch sử tương tác
        await AIInteraction.create({
            user: userId || null,
            contextType: 'feedback',
            subject: subject || '',
            prompt: submittedAnswer || '',
            response: responseText,
            confidence: 0.9,
        });

        res.json({ feedback: responseText });
    } catch (error) {
        console.error("Gemini API Error (Feedback):", error);
        res.status(500).json({ feedback: "I'm having trouble analyzing your code right now. Please try again later." });
    }
});

exports.generateSummary = asyncHandler(async (req, res) => {
    const userId = req.params.userId;

    // 1. Thu thập dữ liệu học tập thực tế của User từ Database
    const [user, submissions, progressEvents] = await Promise.all([
        User.findById(userId).lean(),
        PracticeSubmission.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
        ProgressEvent.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    const completedCount = progressEvents.filter(event => event.eventType === 'lesson_completed').length;
    const correctCount = submissions.filter(submission => submission.isCorrect).length;
    const practiceAccuracy = submissions.length ? Math.round((correctCount / submissions.length) * 100) : 0;
    
    // Tìm các chủ đề đang bị yếu
    const weakAreas = deriveWeakAreas(submissions);
    const weakLabels = weakAreas.map(a => a.label).join(', ') || 'No specific weak areas identified yet';

    // 2. Chuẩn bị cấu trúc JSON mặc định (Phòng hờ nếu API Gemini bị lỗi)
    let summaryResult = {
        learner: user ? { id: user._id, name: user.name } : null,
        strengths: ['Continue practicing to build momentum.'],
        knowledgeGaps: ['Review recent lessons.'],
        progressSnapshot: {
            recentLessonsCompleted: completedCount,
            practiceAccuracy: practiceAccuracy,
            activityEvents: progressEvents.length,
        },
        nextActions: ['Complete one new coding challenge.'],
    };

    if (!process.env.GEMINI_API_KEY) {
        return res.json(summaryResult); 
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
        
        // 3. Prompt ÉP Gemini phân tích và trả về ĐÚNG cấu trúc JSON
        const prompt = `
            You are an expert IT Programming Mentor. Analyze the following student data and provide a personalized weekly learning summary.
            
            Student Name: ${user ? user.name : 'Student'}
            Recent Lessons Completed: ${completedCount}
            Practice Accuracy: ${practiceAccuracy}%
            Topics needing review (Weak Areas): ${weakLabels}
            
            Instructions:
            - Write 1-2 encouraging points about their strengths (based on their accuracy and completion).
            - Write 1-2 points about knowledge gaps (based on the weak areas).
            - Suggest 1-2 concrete next actions to improve.
            
            You MUST return ONLY a valid JSON object with the following exact keys, with NO markdown formatting, NO backticks, and NO extra text:
            {
                "strengths": ["...", "..."],
                "knowledgeGaps": ["...", "..."],
                "nextActions": ["...", "..."]
            }
        `;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text();
        
        // 4. Dọn dẹp chuỗi trả về (Đề phòng Gemini cố tình thêm ```json ... ```)
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        // Parse JSON từ AI
        const aiAnalysis = JSON.parse(responseText);

        // Ghép dữ liệu AI sinh ra vào biến trả về
        summaryResult.strengths = aiAnalysis.strengths || summaryResult.strengths;
        summaryResult.knowledgeGaps = aiAnalysis.knowledgeGaps || summaryResult.knowledgeGaps;
        summaryResult.nextActions = aiAnalysis.nextActions || summaryResult.nextActions;

        // Lưu lại lịch sử tương tác AI
        await AIInteraction.create({
            user: userId,
            contextType: 'summary',
            prompt: 'Generate personalized learning summary with user data',
            response: JSON.stringify(aiAnalysis),
            confidence: 0.9,
        });

    } catch (error) {
        console.error("Gemini API Error (Summary):", error);
        // Nếu parse JSON thất bại, API vẫn không sập mà sẽ trả về dữ liệu mặc định ở trên
    }

    // 5. Gửi JSON hoàn chỉnh về cho Vue.js render
    res.json(summaryResult);
});

// TÍNH NĂNG MỚI: Trả về dữ liệu thống kê cho Admin Dashboard
exports.getAdminAnalytics = asyncHandler(async (req, res) => {
    // Gom nhóm dữ liệu 7 ngày gần nhất
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const [userCount, courseCount, progressEvents, aiInteractions] = await Promise.all([
        User.countDocuments({ role: 'learner' }),
        Course.countDocuments(),
        // Đếm sự kiện học tập theo từng ngày
        ProgressEvent.aggregate([
            { $match: { createdAt: { $gte: last7Days } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]),
        // Đếm số lần gọi Gemini API theo từng ngày
        AIInteraction.aggregate([
            { $match: { createdAt: { $gte: last7Days } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ])
    ]);

    res.json({ userCount, courseCount, progressEvents, aiInteractions });
});

const buildSlug = value =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

// 1. GLOBAL SEARCH: Tìm kiếm nhanh khóa học & bài học bằng Regex
exports.globalSearch = asyncHandler(async (req, res) => {
    const rawQuery = String(req.query.q || '').trim();
    if (!rawQuery) {
        return res.json({ results: [] });
    }

    const escapedQuery = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'i');

    const courses = await Course.find({ isPublished: { $ne: false } }).lean();
    const results = [];

    for (const course of courses) {
        const rawTitleSlug = buildSlug(course.title || course.subject);
        const courseSlug = rawTitleSlug.replace(/-tutorial$/, '') || rawTitleSlug;
        const courseMatches =
            regex.test(course.title || '') ||
            regex.test(course.subject || '') ||
            regex.test(course.description || '') ||
            (Array.isArray(course.tags) && course.tags.some(tag => regex.test(tag)));

        const modules = Array.isArray(course.modules) ? course.modules : [];
        const totalLessons = modules.reduce(
            (sum, m) => sum + (Array.isArray(m.lessons) ? m.lessons.length : 0),
            0
        );

        if (courseMatches) {
            results.push({
                id: `course-${course._id}`,
                type: 'Course',
                title: course.title,
                subtitle: `${course.subject || 'Course'} · ${modules.length} modules · ${totalLessons} lessons`,
                path: `/learn/${courseSlug}`,
            });
        }
        for (const mod of modules) {
            const lessons = Array.isArray(mod.lessons) ? mod.lessons : [];
            for (const lesson of lessons) {
                const lessonMatches =
                    regex.test(lesson.title || '') ||
                    regex.test(lesson.overview || '') ||
                    (Array.isArray(lesson.tags) && lesson.tags.some(tag => regex.test(tag)));

                if (lessonMatches) {
                    const lessonSlug = buildSlug(lesson.title) || 'home';
                    results.push({
                        id: `lesson-${lesson._id}`,
                        type: 'Lesson',
                        title: lesson.title,
                        subtitle: `${course.title} · ${mod.title}`,
                        path: `/learn/${courseSlug}/${lessonSlug}`,
                    });
                }
            }
        }
    }

    res.json({ results: results.slice(0, 10) });
});

// 2. NOTIFICATIONS: Lấy danh sách thông báo & đánh dấu đã đọc
const getUserIdFromToken = req => {
    const token = getTokenFromRequest(req);
    if (!token) return null;
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_key_for_development');
        return payload.userId || null;
    } catch (_error) {
        return null;
    }
};

exports.listNotifications = asyncHandler(async (req, res) => {
    const userId = getUserIdFromToken(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authorization required.' });
    }

    let notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean();

    // Khởi tạo 3 thông báo mẫu tiếng Anh nếu tài khoản chưa có thông báo nào
    if (notifications.length === 0) {
        const defaultItems = [
            {
                user: userId,
                type: 'ai_report',
                title: 'AI Report',
                message: 'Your weekly learning summary from AI Mentor is ready to view!',
                link: '/profile/insights',
                isRead: false,
            },
            {
                user: userId,
                type: 'reminder',
                title: 'Study Reminder',
                message: 'Keep your coding streak alive! Continue your HTML lessons today.',
                link: '/learn/html',
                isRead: false,
            },
            {
                user: userId,
                type: 'system',
                title: 'System Update',
                message: 'Interactive coding exercises and quizzes are ready for practice.',
                link: '/',
                isRead: false,
            },
        ];
        await Notification.insertMany(defaultItems);
        notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean();
    }

    res.json(notifications);
});

exports.markNotificationRead = asyncHandler(async (req, res) => {
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

exports.markAllNotificationsRead = asyncHandler(async (req, res) => {
    const userId = getUserIdFromToken(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authorization required.' });
    }

    await Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
    res.json({ message: 'All notifications marked as read.' });
});

// 3. BOOKMARKS: Lưu hoặc bỏ lưu bài học yêu thích
exports.getBookmarks = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.userId).select('bookmarkedLessons').lean();
    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ bookmarkedLessons: user.bookmarkedLessons || [] });
});

exports.toggleBookmark = asyncHandler(async (req, res) => {
    const {
        courseId,
        courseTitle = '',
        courseSlug = '',
        moduleId = null,
        moduleTitle = '',
        lessonId,
        lessonTitle = '',
        lessonSlug = '',
    } = req.body;

    if (!courseId || !lessonId || !mongoose.isValidObjectId(courseId) || !mongoose.isValidObjectId(lessonId)) {
        return res.status(400).json({ error: 'Valid courseId and lessonId are required.' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    if (!Array.isArray(user.bookmarkedLessons)) {
        user.bookmarkedLessons = [];
    }

    const existingIndex = user.bookmarkedLessons.findIndex(
        item => String(item.lessonId) === String(lessonId)
    );

    let bookmarked = false;
    if (existingIndex >= 0) {
        user.bookmarkedLessons.splice(existingIndex, 1);
        bookmarked = false;
    } else {
        const fallbackCourseSlug =
            courseSlug ||
            buildSlug(courseTitle).replace(/-tutorial$/, '') ||
            buildSlug(courseTitle);
        const normalizedLessonSlug = String(lessonSlug).trim() || buildSlug(lessonTitle) || 'home';
        user.bookmarkedLessons.unshift({
            course: courseId,
            courseTitle: String(courseTitle).trim(),
            courseSlug: fallbackCourseSlug,
            moduleId: moduleId && mongoose.isValidObjectId(moduleId) ? moduleId : null,
            moduleTitle: String(moduleTitle).trim(),
            lessonId,
            lessonTitle: String(lessonTitle).trim() || 'Lesson',
            lessonSlug: normalizedLessonSlug,
            savedAt: new Date(),
        });
        bookmarked = true;

        // Tự động thêm khóa học vào My Courses (enrolledCourses) và ghi nhớ bài học vừa đánh dấu
        let enrollment = user.enrolledCourses.find(
            entry => String(entry.course) === String(courseId)
        );
        if (!enrollment) {
            user.enrolledCourses.push({
                course: courseId,
                enrolledAt: new Date(),
                completedLessons: [],
                completionRate: 0,
                lastLessonId: lessonId,
                lastLessonTitle: String(lessonTitle).trim() || 'Lesson',
                lastLessonSlug: normalizedLessonSlug,
                lastAccessedAt: new Date(),
            });
        } else {
            enrollment.lastLessonId = lessonId;
            enrollment.lastLessonTitle = String(lessonTitle).trim() || enrollment.lastLessonTitle || 'Lesson';
            enrollment.lastLessonSlug = normalizedLessonSlug;
            enrollment.lastAccessedAt = new Date();
        }
    }

    await user.save();
    res.json({
        message: bookmarked ? 'Lesson bookmarked.' : 'Bookmark removed.',
        bookmarked,
        bookmarkedLessons: user.bookmarkedLessons,
    });
});

exports.notFound = (_req, res) => {
    res.status(404).json({ error: 'Resource not found.' });
};


