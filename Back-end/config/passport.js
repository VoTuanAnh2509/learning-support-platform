const crypto = require('crypto');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const bcrypt = require('bcrypt');
const { User } = require('../models/projectModels');

const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const facebookAppID = process.env.FACEBOOK_APP_ID;
const facebookAppSecret = process.env.FACEBOOK_APP_SECRET;
const githubClientID = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

const backendUrl = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

if (clientID && clientSecret) {
    passport.use(new GoogleStrategy(
        {
            clientID,
            clientSecret,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || `${backendUrl}/api/auth/google/callback`,
        },
        async (_accessToken, _refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value?.trim().toLowerCase();
                if (!email) {
                    return done(new Error('Google account did not provide an email address.'));
                }

                let user = await User.findOne({ email });
                if (!user) {
                    const password = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
                    try {
                        user = await User.create({
                            name: profile.displayName || email.split('@')[0] || 'Learner',
                            email,
                            password,
                            role: 'learner',
                            authProvider: 'google',
                        });
                    } catch (error) {
                        if (error.code !== 11000) throw error;
                        user = await User.findOne({ email });
                    }
                }

                if (!user) {
                    return done(new Error('Unable to create or find the Google account.'));
                }

                user.authProvider = 'google';
                user.lastLoginAt = new Date();
                await user.save();
                return done(null, user);
            } catch (error) {
                return done(error);
            }
        }
    ));
}

if (facebookAppID && facebookAppSecret) {
    passport.use(new FacebookStrategy(
        {
            clientID: facebookAppID,
            clientSecret: facebookAppSecret,
            callbackURL: process.env.FACEBOOK_CALLBACK_URL || `${backendUrl}/api/auth/facebook/callback`,
            profileFields: ['id', 'displayName', 'emails'],
        },
        async (_accessToken, _refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value?.trim().toLowerCase();
                if (!email) {
                    return done(new Error('Facebook account did not provide an email address.'));
                }

                let user = await User.findOne({ email });
                if (!user) {
                    const password = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
                    try {
                        user = await User.create({
                            name: profile.displayName || email.split('@')[0] || 'Learner',
                            email,
                            password,
                            role: 'learner',
                            authProvider: 'facebook',
                        });
                    } catch (error) {
                        if (error.code !== 11000) throw error;
                        user = await User.findOne({ email });
                    }
                }

                if (!user) {
                    return done(new Error('Unable to create or find the Facebook account.'));
                }

                user.authProvider = 'facebook';
                user.lastLoginAt = new Date();
                await user.save();
                return done(null, user);
            } catch (error) {
                return done(error);
            }
        }
    ));
}

if (githubClientID && githubClientSecret) {
    passport.use(new GitHubStrategy(
        {
            clientID: githubClientID,
            clientSecret: githubClientSecret,
            callbackURL: process.env.GITHUB_CALLBACK_URL || `${backendUrl}/api/auth/github/callback`,
        },
        async (_accessToken, _refreshToken, profile, done) => {
            try {
                const email = profile.emails?.find(item => item.primary)?.value?.trim().toLowerCase()
                    || profile.emails?.[0]?.value?.trim().toLowerCase();
                if (!email) {
                    return done(new Error('GitHub account did not provide an email address.'));
                }

                let user = await User.findOne({ email });
                if (!user) {
                    const password = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
                    try {
                        user = await User.create({
                            name: profile.displayName || profile.username || email.split('@')[0] || 'Learner',
                            email,
                            password,
                            role: 'learner',
                            authProvider: 'github',
                        });
                    } catch (error) {
                        if (error.code !== 11000) throw error;
                        user = await User.findOne({ email });
                    }
                }

                if (!user) {
                    return done(new Error('Unable to create or find the GitHub account.'));
                }

                user.authProvider = 'github';
                user.lastLoginAt = new Date();
                await user.save();
                return done(null, user);
            } catch (error) {
                return done(error);
            }
        }
    ));
}

module.exports = passport;