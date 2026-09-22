// utils/passportSetup.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'dummy-client-id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy-client-secret',
    callbackURL: '/api/auth/google/callback',
    // Request offline access to get a refresh_token
    accessType: 'offline',
    prompt: 'consent' // Force consent screen to always get a refresh token
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        if (!email) {
            return done(new Error('No email found in Google profile.'));
        }

        // Only allow college emails (or bypass in dev if needed, but keeping it strict as per requirements)
        if (!email.endsWith('@mace.ac.in')) {
            return done(null, false, { message: 'Only @mace.ac.in emails are allowed.' });
        }

        // Find existing user or create a new one
        let user = await User.findOne({ email }).select('+googleRefreshToken');
        
        if (user) {
            // Update Google ID and Refresh Token if provided
            user.googleId = profile.id;
            if (refreshToken) {
                user.googleRefreshToken = refreshToken;
            }
            await user.save();
        } else {
            // New user via Google Auth
            user = new User({
                name: profile.displayName || email.split('@')[0],
                email: email,
                googleId: profile.id,
                googleRefreshToken: refreshToken || null,
                role: 'student', // Default role
            });
            await user.save();
        }

        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

// We are primarily using JWTs, but passport requires serialization if session is used during the OAuth flow
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});
