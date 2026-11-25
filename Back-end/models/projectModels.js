const mongoose = require('mongoose');

const { Schema } = mongoose;

const QuizItemSchema = new Schema(
    {
        question: { type: String, required: true, trim: true },
        options: [{ type: String, trim: true }],
        answerIndex: { type: Number, default: 0 },
        explanation: { type: String, default: '' },
        points: { type: Number, default: 1, min: 0 },
    },
    { _id: true }
);

const ExerciseSchema = new Schema(
    {
        prompt: { type: String, required: true, trim: true },
        starterCode: { type: String, default: '' },
        solution: { type: String, default: '' },
        explanation: { type: String, default: '' },
        difficulty: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced'],
            default: 'beginner',
        },
        points: { type: Number, default: 1, min: 0 },
    },
    { _id: true }
);

const LessonSchema = new Schema(
    {
        title: { type: String, required: true, trim: true },
        overview: { type: String, default: '' },
        content: { type: String, default: '' },
        videoUrl: { type: String, default: '' },
        videoTitle: { type: String, default: '' },  // Tiêu đề video bài giảng
        videoIntro: { type: String, default: '' },  // Lời giới thiệu/tóm tắt video
        codeExamples: [{ type: String, default: '' }],
        codeExplanations: [{ type: String, default: '' }],
        exercises: [ExerciseSchema],
        quizzes: [QuizItemSchema],
        resources: [
            {
                label: { type: String, default: '' },
                url: { type: String, default: '' },
            },
        ],
        order: { type: Number, default: 0, min: 0 },
        estimatedMinutes: { type: Number, default: 10, min: 0 },
        tags: [{ type: String, trim: true }],
    },
    { _id: true }
);

const ModuleSchema = new Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        order: { type: Number, default: 0, min: 0 },
        lessons: [LessonSchema],
        quizzes: [QuizItemSchema],
    },
    { _id: true }
);

const CourseSchema = new Schema(
    {
        title: { type: String, required: true, trim: true },
        subject: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        difficulty: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced'],
            default: 'beginner',
        },
        category: { type: String, default: 'information-technology' },
        tags: [{ type: String, trim: true }],
        prerequisites: [{ type: String, trim: true }],
        modules: [ModuleSchema],
        isPublished: { type: Boolean, default: true },
    },
    { timestamps: true }
);

const CourseEnrollmentSchema = new Schema(
    {
        course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
        enrolledAt: { type: Date, default: Date.now },
        completedLessons: [{ type: Schema.Types.ObjectId, default: null }],
        completionRate: { type: Number, default: 0, min: 0, max: 100 },
        lastLessonId: { type: Schema.Types.ObjectId, default: null },
        lastLessonTitle: { type: String, default: '' },
        lastLessonSlug: { type: String, default: '' },
        lastAccessedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const BookmarkItemSchema = new Schema(
    {
        course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
        courseTitle: { type: String, default: '' },
        courseSlug: { type: String, default: '' },
        moduleId: { type: Schema.Types.ObjectId, default: null },
        moduleTitle: { type: String, default: '' },
        lessonId: { type: Schema.Types.ObjectId, required: true },
        lessonTitle: { type: String, required: true, trim: true },
        lessonSlug: { type: String, required: true, trim: true },
        savedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const UserSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true, minlength: 8 },
        resetPasswordToken: { type: String, default: null },
        resetPasswordExpires: { type: Date, default: null },
        role: {
            type: String,
            enum: ['learner', 'instructor', 'admin'],
            default: 'learner',
        },
        authProvider: {
            type: String,
            enum: ['local', 'google', 'facebook', 'github'],
            default: 'local',
        },
        avatarUrl: { type: String, default: '' },
        avatarPreset: { type: String, default: '' },
        bio: { type: String, default: '' },
        goals: [{ type: String, trim: true }],
        interests: [{ type: String, trim: true }],
        proficiency: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced'],
            default: 'beginner',
        },
        enrolledCourses: [CourseEnrollmentSchema],
        bookmarkedLessons: [BookmarkItemSchema],
        lastLoginAt: { type: Date },
    },
    { timestamps: true }
);

const PracticeSubmissionSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
        moduleId: { type: Schema.Types.ObjectId, default: null },
        lessonId: { type: Schema.Types.ObjectId, default: null },
        exerciseId: { type: Schema.Types.ObjectId, default: null },
        questionType: {
            type: String,
            enum: ['coding', 'quiz', 'reflection'],
            default: 'coding',
        },
        submittedAnswer: { type: String, default: '' },
        isCorrect: { type: Boolean, default: false },
        score: { type: Number, default: 0, min: 0 },
        feedback: { type: String, default: '' },
        reviewHints: [{ type: String, default: '' }],
    },
    { timestamps: true }
);

const ProgressEventSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        course: { type: Schema.Types.ObjectId, ref: 'Course', default: null },
        moduleId: { type: Schema.Types.ObjectId, default: null },
        lessonId: { type: Schema.Types.ObjectId, default: null },
        eventType: {
            type: String,
            enum: ['lesson_completed', 'course_completed', 'quiz_completed', 'practice_attempt', 'session_time'],
            required: true,
        },
        durationMinutes: { type: Number, default: 0, min: 0 },
        metadata: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

const AIInteractionSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        contextType: {
            type: String,
            enum: ['chat', 'recommendation', 'feedback', 'summary'],
            required: true,
        },
        subject: { type: String, default: '' },
        prompt: { type: String, default: '' },
        response: { type: String, default: '' },
        suggestions: [{ type: String, default: '' }],
        confidence: { type: Number, default: 0.7, min: 0, max: 1 },
    },
    { timestamps: true }
);

const NotificationSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        type: {
            type: String,
            enum: ['ai_report', 'reminder', 'system'],
            default: 'system',
        },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        link: { type: String, default: '/' },
        isRead: { type: Boolean, default: false },
    },
    { timestamps: true }
);

const SystemSettingSchema = new Schema(
    {
        key: { type: String, default: 'global', unique: true },
        allowRegistration: { type: Boolean, default: true },
        aiTutorEnabled: { type: Boolean, default: true },
        defaultAiModel: {
            type: String,
            enum: [
                'gemini-2.5-flash',
                'gemini-2.5-flash-lite',
                'gemini-3.5-flash',
                'gemini-2.0-flash',
            ],
            default: 'gemini-2.5-flash',
        },
        maintenanceMode: { type: Boolean, default: false },
        maintenanceMessage: {
            type: String,
            default:
                'Scheduled maintenance is in progress. Some platform features may be temporarily limited.',
            trim: true,
        },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    },
    { timestamps: true }
);

const Course = mongoose.model('Course', CourseSchema);
const User = mongoose.model('User', UserSchema);
const PracticeSubmission = mongoose.model('PracticeSubmission', PracticeSubmissionSchema);
const ProgressEvent = mongoose.model('ProgressEvent', ProgressEventSchema);
const AIInteraction = mongoose.model('AIInteraction', AIInteractionSchema);
const Notification = mongoose.model('Notification', NotificationSchema);
const SystemSetting = mongoose.model('SystemSetting', SystemSettingSchema);

module.exports = {
    Course,
    User,
    PracticeSubmission,
    ProgressEvent,
    AIInteraction,
    Notification,
    SystemSetting,
};
