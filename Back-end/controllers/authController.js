const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { User } = require('../models/projectModels');
const { asyncHandler } = require('../middlewares/authMiddleware');
const {
    normalizeText,
    isBcryptHash,
    formatProviderLabel,
    validateEmailSpelling,
} = require('../utils/helpers');
const { notifyAdminsOfUserLogin } = require('./notificationController');

const checkEmailAvailability = asyncHandler(async (req, res) => {
    const rawEmail = String(req.query.email || '').trim();
    if (!rawEmail) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    const emailCheck = validateEmailSpelling(rawEmail);
    if (!emailCheck.valid) {
        return res.json({
            exists: false,
            valid: false,
            error: emailCheck.error,
        });
    }

    const normalizedEmail = normalizeText(rawEmail);
    const existingUser = await User.findOne({ email: normalizedEmail })
        .select('email authProvider')
        .lean();

    if (existingUser) {
        const provider = formatProviderLabel(existingUser.authProvider);
        return res.json({
            exists: true,
            valid: true,
            authProvider: existingUser.authProvider || 'local',
            message: `This email (${normalizedEmail}) is already registered${provider !== 'Email' ? ` via ${provider}` : ''}. Please sign in or use a different email.`,
        });
    }

    return res.json({
        exists: false,
        valid: true,
        message: 'This email is available.',
    });
});

const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, bio, goals, interests, proficiency } = req.body;

    const emailCheck = validateEmailSpelling(email);
    if (!emailCheck.valid) {
        return res.status(400).json({ error: emailCheck.error });
    }

    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const existingUser = await User.findOne({ email: normalizeText(email) });
    if (existingUser) {
        const provider = formatProviderLabel(existingUser.authProvider);
        return res.status(409).json({
            error: `This email is already registered${provider !== 'Email' ? ` (via ${provider})` : ''}. Please sign in or use another email.`,
        });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
        name,
        email: normalizeText(email),
        password: hashedPassword,
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

    await notifyAdminsOfUserLogin(user, 'register');

    const safeUser = user.toObject();
    delete safeUser.password;
    res.status(201).json({
        message: 'User registered successfully.',
        token,
        user: safeUser,
    });
});

const bootstrapAdminUser = asyncHandler(async (req, res) => {
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

const ensureAdminExists = async () => {
    try {
        const name = process.env.ADMIN_BOOTSTRAP_NAME;
        const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
        const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

        if (!name || !email || !password) {
            return;
        }

        const existingAdmin = await User.findOne({ role: 'admin' }).lean();
        if (existingAdmin) {
            console.log(`Admin seed: admin already exists (${existingAdmin.email})`);
            return;
        }

        const existingUser = await User.findOne({ email: normalizeText(email) });
        if (existingUser) {
            existingUser.role = 'admin';
            if (!isBcryptHash(existingUser.password)) {
                const salt = await bcrypt.genSalt(10);
                existingUser.password = await bcrypt.hash(password, salt);
            }
            await existingUser.save();
            console.log(`Admin seed: promoted existing user (${existingUser.email}) to admin`);
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

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: normalizeText(email) });

    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
    }

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

    await notifyAdminsOfUserLogin(user, 'login');

    const payload = {
        userId: user._id,
        role: user.role,
    };

    const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || 'your_super_secret_key_for_development',
        { expiresIn: '7d' }
    );

    const safeUser = user.toObject();
    delete safeUser.password;

    res.json({
        message: 'Login successful.',
        token,
        user: safeUser,
    });
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email || !String(email).trim()) {
        return res.status(400).json({ error: 'Please provide your email address.' });
    }

    const emailCheck = validateEmailSpelling(email);
    if (!emailCheck.valid) {
        return res.status(400).json({ error: emailCheck.error });
    }

    const normalizedEmail = normalizeText(email);
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
        return res.status(404).json({ error: 'No account found with that email address.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const originUrl = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:5173';
    const frontendBase = String(originUrl).replace(/\/$/, '');
    const resetUrl = `${frontendBase}/reset-password/${rawToken}`;

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
        return res.status(500).json({
            error: 'Email service is not configured on the server (missing EMAIL_USER or EMAIL_PASSWORD).',
        });
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });

        await transporter.sendMail({
            from: `"Learning Support Platform" <${emailUser}>`,
            to: user.email,
            subject: 'Password Reset Request - Learning Support',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; color: #0f172a;">
                    <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; color: #0f766e; text-transform: uppercase;">Learning Support Platform</p>
                    <h2 style="margin: 0 0 12px; color: #0f172a;">Reset Your Password</h2>
                    <p style="color: #334155; line-height: 1.6;">Hi <strong>${user.name || 'Learner'}</strong>,</p>
                    <p style="color: #334155; line-height: 1.6;">We received a request to reset the password for your account. Click the button below to choose a new password. This link will expire in <strong>15 minutes</strong>.</p>
                    <div style="margin: 24px 0;">
                        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; border-radius: 999px; background: #0f766e; color: #ffffff; font-weight: 700; text-decoration: none;">Reset Password</a>
                    </div>
                    <p style="color: #64748b; font-size: 13px; line-height: 1.5;">Or copy and paste this link into your browser:<br><a href="${resetUrl}" style="color: #0f766e; word-break: break-all;">${resetUrl}</a></p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">If you did not request a password reset, you can safely ignore this email.</p>
                </div>
            `,
        });

        res.json({
            message: 'A password reset link has been sent to your email address (valid for 15 minutes).',
        });
    } catch (mailError) {
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();
        console.error('Nodemailer error:', mailError);
        return res.status(500).json({
            error: 'Failed to send reset email. Please try again later.',
        });
    }
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { password, newPassword } = req.body;
    const nextPassword = password || newPassword;

    if (!token) {
        return res.status(400).json({ error: 'Reset token is required.' });
    }

    if (typeof nextPassword !== 'string' || nextPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const hashedToken = crypto.createHash('sha256').update(String(token)).digest('hex');

    const user = await User.findOne({
        resetPasswordToken: { $in: [hashedToken, String(token)] },
        resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
        return res.status(400).json({
            error: 'Password reset link is invalid or has expired (15 minutes limit).',
        });
    }

    user.password = await bcrypt.hash(nextPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({
        message:
            'Your password has been reset successfully. You can now sign in with your new password.',
    });
});

module.exports = {
    checkEmailAvailability,
    registerUser,
    bootstrapAdminUser,
    ensureAdminExists,
    loginUser,
    forgotPassword,
    resetPassword,
};
