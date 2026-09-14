// middleware/auth.js — JWT authentication middleware

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SECRET = process.env.JWT_SECRET || 'mace_festhub_jwt_secret_2026_lab';

// ─── requireAuth ─────────────────────────────────────────────────────────────
// Blocks the request if no valid JWT is provided.
exports.requireAuth = async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, SECRET);
        // Attach fresh user from DB (catches deleted / role-changed users)
        req.user = await User.findById(decoded.id);
        if (!req.user) return res.status(401).json({ error: 'User not found' });
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// ─── optionalAuth ─────────────────────────────────────────────────────────────
// Attaches req.user if a valid token is present; continues either way.
exports.optionalAuth = async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return next();
    try {
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, SECRET);
        req.user = await User.findById(decoded.id);
    } catch (_) {
        // Invalid token — treat as unauthenticated (don't block)
    }
    next();
};

// ─── requireRole ─────────────────────────────────────────────────────────────
// Factory: returns middleware that allows only the listed roles.
// Must be used after requireAuth.
exports.requireRole = (...roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }
    next();
};
