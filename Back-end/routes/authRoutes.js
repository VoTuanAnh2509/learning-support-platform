const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('../config/passport');
const { notifyAdminsOfUserLogin } = require('../controllers/projectController');

const router = express.Router();
const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const facebookConfigured = Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
const githubConfigured = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

router.get('/google', (req, res, next) => {
    if (!googleConfigured) {
        return res.status(503).json({ error: 'Google sign-in is not configured on the server.' });
    }

    return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get(
    '/google/callback',
    (req, res, next) => {
        if (!googleConfigured) {
            return res.redirect(`${frontendUrl}/login?error=google_not_configured`);
        }

        return passport.authenticate('google', {
            session: false,
            failureRedirect: `${frontendUrl}/login?error=google_login_failed`,
        })(req, res, next);
    },
    async (req, res) => {
        await notifyAdminsOfUserLogin(req.user, 'login');
        const token = jwt.sign(
            { userId: req.user._id, role: req.user.role },
            process.env.JWT_SECRET || 'your_super_secret_key_for_development',
            { expiresIn: '7d' }
        );

        res.redirect(`${frontendUrl}/login?token=${encodeURIComponent(token)}`);
    }
);

router.get('/facebook', (req, res, next) => {
    if (!facebookConfigured) {
        return res.status(503).json({ error: 'Facebook sign-in is not configured on the server.' });
    }

    return passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
});

router.get(
    '/facebook/callback',
    (req, res, next) => {
        if (!facebookConfigured) {
            return res.redirect(`${frontendUrl}/login?error=facebook_not_configured`);
        }

        return passport.authenticate('facebook', {
            session: false,
            failureRedirect: `${frontendUrl}/login?error=facebook_login_failed`,
        })(req, res, next);
    },
    async (req, res) => {
        await notifyAdminsOfUserLogin(req.user, 'login');
        const token = jwt.sign(
            { userId: req.user._id, role: req.user.role },
            process.env.JWT_SECRET || 'your_super_secret_key_for_development',
            { expiresIn: '7d' }
        );

        res.redirect(`${frontendUrl}/login?token=${encodeURIComponent(token)}`);
    }
);

router.get('/github', (req, res, next) => {
    if (!githubConfigured) {
        return res.status(503).json({ error: 'GitHub sign-in is not configured on the server.' });
    }

    return passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
});

router.get(
    '/github/callback',
    (req, res, next) => {
        if (!githubConfigured) {
            return res.redirect(`${frontendUrl}/login?error=github_not_configured`);
        }

        return passport.authenticate('github', {
            session: false,
            failureRedirect: `${frontendUrl}/login?error=github_login_failed`,
        })(req, res, next);
    },
    async (req, res) => {
        await notifyAdminsOfUserLogin(req.user, 'login');
        const token = jwt.sign(
            { userId: req.user._id, role: req.user.role },
            process.env.JWT_SECRET || 'your_super_secret_key_for_development',
            { expiresIn: '7d' }
        );

        res.redirect(`${frontendUrl}/login?token=${encodeURIComponent(token)}`);
    }
);

module.exports = router;