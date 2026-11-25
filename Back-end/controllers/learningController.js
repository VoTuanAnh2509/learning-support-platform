const mongoose = require('mongoose');
const {
    Course,
    User,
    PracticeSubmission,
    ProgressEvent,
} = require('../models/projectModels');
const { asyncHandler } = require('../middlewares/authMiddleware');
const { normalizeText, buildSlug, getCourseSignal } = require('../utils/helpers');

const enrollCourse = asyncHandler(async (req, res) => {
    const { userId, courseId } = req.params;
    const [user, course] = await Promise.all([
        User.findById(userId),
        Course.findById(courseId),
    ]);

    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    const enrolled = user.enrolledCourses.find(
        entry => String(entry.course) === String(courseId)
    );

    if (!enrolled) {
        user.enrolledCourses.push({
            course: course._id,
            enrolledAt: new Date(),
            completionRate: 0,
        });
        await user.save();
    }

    res.json({ message: 'Course enrollment updated.', course: getCourseSignal(course) });
});

const submitPractice = asyncHandler(async (req, res) => {
    const {
        userId,
        courseId,
        moduleId,
        lessonId,
        exerciseId,
        submittedAnswer,
        expectedAnswer,
        questionType,
    } = req.body;
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

const recordProgress = asyncHandler(async (req, res) => {
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
    let enrollment = user.enrolledCourses.find(
        entry => String(entry.course) === String(course._id)
    );
    if (!enrollment) {
        user.enrolledCourses.push({ course: course._id });
        enrollment = user.enrolledCourses[user.enrolledCourses.length - 1];
    }

    const wasCompleted = enrollment.completedLessons.some(
        id => String(id) === String(lesson._id)
    );
    if (!wasCompleted) enrollment.completedLessons.push(lesson._id);

    const totalLessons = course.modules.reduce(
        (total, courseModule) => total + courseModule.lessons.length,
        0
    );
    const completedLessonCount = new Set(
        enrollment.completedLessons.map(id => String(id))
    ).size;
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

const recordLessonProgress = asyncHandler(async (req, res) => {
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

const recordQuizResult = asyncHandler(async (req, res) => {
    const { courseId, moduleId, lessonId, correctAnswers, totalQuestions } = req.body;
    if (!courseId || !mongoose.isValidObjectId(courseId)) {
        return res.status(400).json({ error: 'A valid courseId is required.' });
    }

    const hasModuleId = moduleId !== undefined && moduleId !== null;
    const hasLessonId = lessonId !== undefined && lessonId !== null;
    if (
        hasModuleId !== hasLessonId ||
        (hasModuleId &&
            (!mongoose.isValidObjectId(moduleId) || !mongoose.isValidObjectId(lessonId)))
    ) {
        return res
            .status(400)
            .json({ error: 'Provide both valid moduleId and lessonId for a lesson quiz.' });
    }

    if (
        !Number.isInteger(correctAnswers) ||
        !Number.isInteger(totalQuestions) ||
        totalQuestions < 1 ||
        correctAnswers < 0 ||
        correctAnswers > totalQuestions
    ) {
        return res
            .status(400)
            .json({ error: 'Valid correctAnswers and totalQuestions are required.' });
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
            return res
                .status(400)
                .json({ error: 'The lesson does not belong to the specified course module.' });
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

const getProgress = asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    const [events, submissions, user] = await Promise.all([
        ProgressEvent.find({ user: userId }).sort({ createdAt: -1 }).lean(),
        PracticeSubmission.find({ user: userId }).sort({ createdAt: -1 }).lean(),
        User.findById(userId).lean(),
    ]);

    const completedLessons = new Set(
        events
            .filter(
                event =>
                    event.eventType === 'lesson_completed' && event.course && event.lessonId
            )
            .map(event => `${event.course}:${event.lessonId}`)
    ).size;
    const completedCourses = new Set(
        events
            .filter(event => event.eventType === 'course_completed' && event.course)
            .map(event => String(event.course))
    ).size;
    const courseIds = [
        ...new Set(
            events
                .filter(event => event.course && event.durationMinutes > 0)
                .map(event => String(event.course))
        ),
    ];
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
            courseSlug: normalizeText(course.title || course.subject)
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, ''),
            courseName: course.title || course.subject,
            minutes: 0,
        };
        studyTime.minutes += event.durationMinutes;
        studyTimeByCourse.set(courseId, studyTime);
    });
    const correctSubmissions = submissions.filter(submission => submission.isCorrect).length;
    const scoresFor = questionType => {
        const matching = submissions.filter(
            submission => submission.questionType === questionType
        );
        return {
            attempts: matching.length,
            averageScore: matching.length
                ? Math.round(
                      matching.reduce(
                          (total, submission) => total + (submission.score || 0),
                          0
                      ) / matching.length
                  )
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
            accuracy: submissions.length
                ? Math.round((correctSubmissions / submissions.length) * 100)
                : 0,
            quiz: scoresFor('quiz'),
            exercises: scoresFor('coding'),
            studyMinutes: events.reduce(
                (total, event) => total + (event.durationMinutes || 0),
                0
            ),
            studyTime: [...studyTimeByCourse.values()],
            recentActivity: events.slice(0, 10),
        },
    });
});

const getBookmarks = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.userId).select('bookmarkedLessons').lean();
    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ bookmarkedLessons: user.bookmarkedLessons || [] });
});

const toggleBookmark = asyncHandler(async (req, res) => {
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

    if (
        !courseId ||
        !lessonId ||
        !mongoose.isValidObjectId(courseId) ||
        !mongoose.isValidObjectId(lessonId)
    ) {
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
        const normalizedLessonSlug =
            String(lessonSlug).trim() || buildSlug(lessonTitle) || 'home';
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
            enrollment.lastLessonTitle =
                String(lessonTitle).trim() || enrollment.lastLessonTitle || 'Lesson';
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

module.exports = {
    enrollCourse,
    submitPractice,
    recordProgress,
    recordLessonProgress,
    recordQuizResult,
    getProgress,
    getBookmarks,
    toggleBookmark,
};
