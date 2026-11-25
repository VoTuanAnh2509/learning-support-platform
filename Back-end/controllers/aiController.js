const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
    Course,
    User,
    PracticeSubmission,
    ProgressEvent,
    AIInteraction,
} = require('../models/projectModels');
const { asyncHandler } = require('../middlewares/authMiddleware');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const GEMINI_MODELS = [
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
];

async function generateWithFallback(prompt) {
    let lastError = null;

    for (const modelName of GEMINI_MODELS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            lastError = error;
            const status = error?.status || error?.response?.status;
            const msg = String(error?.message || '').toLowerCase();
            if (
                status === 503 ||
                status === 429 ||
                status === 404 ||
                msg.includes('503') ||
                msg.includes('429') ||
                msg.includes('404') ||
                msg.includes('overloaded') ||
                msg.includes('not found')
            ) {
                console.warn(
                    `⚠️ Model ${modelName} gặp sự cố (${status || 'fallback'}), đang chuyển sang model dự phòng...`
                );
                continue;
            }
            throw error;
        }
    }

    throw lastError;
}

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

const chatAssist = asyncHandler(async (req, res) => {
    const { userId, question, subject, lesson } = req.body;

    if (!process.env.GEMINI_API_KEY) {
        return res
            .status(500)
            .json({ answer: 'System Error: Gemini API Key is missing on the server.' });
    }

    try {
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

        const responseText = await generateWithFallback(prompt);

        await AIInteraction.create({
            user: userId || null,
            contextType: 'chat',
            subject: subject || '',
            prompt: question,
            response: responseText,
            confidence: 0.95,
        });

        res.json({ answer: responseText });
    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({
            answer: "I'm having trouble connecting to my AI brain right now. Please try again later.",
        });
    }
});

const getRecommendations = asyncHandler(async (req, res) => {
    const userId = req.params.userId;

    const [user, recentSubmissions, recentEvents, courses] = await Promise.all([
        User.findById(userId).lean(),
        PracticeSubmission.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
        ProgressEvent.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
        Course.find({ isPublished: true }).lean(),
    ]);

    const weakAreas = deriveWeakAreas(recentSubmissions);
    const enrolledCourseIds = new Set(
        (user?.enrolledCourses || []).map(entry => String(entry.course))
    );
    const availableCourses = courses.filter(c => !enrolledCourseIds.has(String(c._id)));

    const baseResult = {
        learner: user ? { id: user._id, name: user.name, proficiency: user.proficiency } : null,
        weakAreas,
        recentActivityCount: recentEvents.length,
        recommendedCourses: [],
        reviewSuggestions: [],
    };

    if (!process.env.GEMINI_API_KEY) {
        return res.json(baseResult);
    }

    try {
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

        let responseText = await generateWithFallback(prompt);
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiRecommendations = JSON.parse(responseText);

        baseResult.recommendedCourses = aiRecommendations.recommendedCourses || [];
        baseResult.reviewSuggestions = aiRecommendations.reviewSuggestions || [];

        await AIInteraction.create({
            user: userId,
            contextType: 'recommendation',
            prompt: 'Generate personalized course recommendations from catalog',
            response: JSON.stringify(aiRecommendations),
            confidence: 0.9,
        });
    } catch (error) {
        console.error('Gemini API Error (Recommendations):', error);
    }

    res.json(baseResult);
});

const generateFeedback = asyncHandler(async (req, res) => {
    const { userId, submittedAnswer, subject } = req.body;

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ feedback: 'System Error: Gemini API Key is missing.' });
    }

    try {
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

        const feedbackText = await generateWithFallback(prompt);

        await AIInteraction.create({
            user: userId || null,
            contextType: 'feedback',
            subject: subject || '',
            prompt: submittedAnswer || '',
            response: feedbackText,
            confidence: 0.9,
        });

        return res.json({ feedback: feedbackText });
    } catch (error) {
        console.error('Gemini API Error (Feedback):', error);
        res.status(500).json({
            feedback: "I'm having trouble analyzing your code right now. Please try again later.",
        });
    }
});

const generateSummary = asyncHandler(async (req, res) => {
    const userId = req.params.userId;

    const [user, submissions, progressEvents] = await Promise.all([
        User.findById(userId).lean(),
        PracticeSubmission.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
        ProgressEvent.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    const completedCount = progressEvents.filter(
        event => event.eventType === 'lesson_completed'
    ).length;
    const correctCount = submissions.filter(submission => submission.isCorrect).length;
    const practiceAccuracy = submissions.length
        ? Math.round((correctCount / submissions.length) * 100)
        : 0;

    const weakAreas = deriveWeakAreas(submissions);
    const weakLabels =
        weakAreas.map(a => a.label).join(', ') || 'No specific weak areas identified yet';

    const summaryResult = {
        learner: user ? { id: user._id, name: user.name } : null,
        strengths: ['Continue practicing to build momentum.'],
        knowledgeGaps: ['Review recent lessons.'],
        progressSnapshot: {
            recentLessonsCompleted: completedCount,
            practiceAccuracy,
            activityEvents: progressEvents.length,
        },
        nextActions: ['Complete one new coding challenge.'],
    };

    if (!process.env.GEMINI_API_KEY) {
        return res.json(summaryResult);
    }

    try {
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

        let responseText = await generateWithFallback(prompt);
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiAnalysis = JSON.parse(responseText);

        summaryResult.strengths = aiAnalysis.strengths || summaryResult.strengths;
        summaryResult.knowledgeGaps = aiAnalysis.knowledgeGaps || summaryResult.knowledgeGaps;
        summaryResult.nextActions = aiAnalysis.nextActions || summaryResult.nextActions;

        await AIInteraction.create({
            user: userId,
            contextType: 'summary',
            prompt: 'Generate personalized learning summary with user data',
            response: JSON.stringify(aiAnalysis),
            confidence: 0.9,
        });
    } catch (error) {
        console.error('Gemini API Error (Summary):', error);
    }

    res.json(summaryResult);
});

module.exports = {
    generateWithFallback,
    deriveWeakAreas,
    chatAssist,
    getRecommendations,
    generateFeedback,
    generateSummary,
};
