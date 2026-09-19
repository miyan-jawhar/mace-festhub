// routes/auth.js — Authentication and user management routes

const express = require('express');
const router  = express.Router();
const {
    register,
    login,
    getMe,
    updateMe,
    changePassword,
    listUsers,
    changeUserRole,
} = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/register',  register);   // POST /api/auth/register  (always creates student)
router.post('/login',     login);      // POST /api/auth/login

// ── Own profile (any authenticated user) ─────────────────────────────────────
router.get( '/me',             requireAuth, getMe);            // GET  /api/auth/me
router.put( '/me',             requireAuth, updateMe);         // PUT  /api/auth/me
router.put( '/me/password',    requireAuth, changePassword);   // PUT  /api/auth/me/password

// ── User management (Principal + Admin only) ──────────────────────────────────
router.get('/users',
    requireAuth, requireRole('principal', 'admin'), listUsers);      // GET  /api/auth/users

router.put('/users/:id/role',
    requireAuth, requireRole('principal', 'admin'), changeUserRole); // PUT  /api/auth/users/:id/role

module.exports = router;
