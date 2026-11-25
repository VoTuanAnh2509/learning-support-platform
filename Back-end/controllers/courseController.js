const { Course } = require('../models/projectModels');
const { asyncHandler } = require('../middlewares/authMiddleware');
const { buildSlug } = require('../utils/helpers');

const createCourse = asyncHandler(async (req, res) => {
    const course = await Course.create(req.body);
    res.status(201).json(course);
});

const listCourses = asyncHandler(async (_req, res) => {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.json(courses);
});

const getCourse = asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.courseId);

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    res.json(course);
});

const updateCourse = asyncHandler(async (req, res) => {
    const course = await Course.findByIdAndUpdate(req.params.courseId, req.body, {
        new: true,
        runValidators: true,
    });

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    res.json(course);
});

const deleteCourse = asyncHandler(async (req, res) => {
    const course = await Course.findByIdAndDelete(req.params.courseId);

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    res.json({ message: 'Course removed successfully.' });
});

const addModule = asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.courseId);

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    course.modules.push(req.body);
    await course.save();

    res.status(201).json(course);
});

const updateModule = asyncHandler(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    const module = course.modules.id(moduleId);
    if (!module) {
        return res.status(404).json({ error: 'Module not found.' });
    }

    const { title, description, order } = req.body;
    if (typeof title === 'string') module.title = title;
    if (typeof description === 'string') module.description = description;
    if (typeof order !== 'undefined') module.order = Number(order) || 0;

    await course.save();
    res.json(course);
});

const deleteModule = asyncHandler(async (req, res) => {
    const { courseId, moduleId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
    }

    const module = course.modules.id(moduleId);
    if (!module) {
        return res.status(404).json({ error: 'Module not found.' });
    }

    module.deleteOne();
    await course.save();

    res.json({ message: 'Module deleted successfully.' });
});

const addLesson = asyncHandler(async (req, res) => {
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

const updateLesson = asyncHandler(async (req, res) => {
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

const deleteLesson = asyncHandler(async (req, res) => {
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

    lesson.deleteOne();
    await course.save();

    res.json({ message: 'Lesson deleted successfully.' });
});

const globalSearch = asyncHandler(async (req, res) => {
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

module.exports = {
    createCourse,
    listCourses,
    getCourse,
    updateCourse,
    deleteCourse,
    addModule,
    updateModule,
    deleteModule,
    addLesson,
    updateLesson,
    deleteLesson,
    globalSearch,
};
