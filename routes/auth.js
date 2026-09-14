// routes/auth.js — Authentication routes

const express = require('express');
const router  = express.Router();
const {
    register,
    login,
    getMe,
    updateMe,
    changePassword,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/register',       register);        // POST /api/auth/register
router.post('/login',          login);           // POST /api/auth/login
router.get( '/me',  requireAuth, getMe);         // GET  /api/auth/me
router.put( '/me',  requireAuth, updateMe);      // PUT  /api/auth/me
router.put( '/me/password', requireAuth, changePassword); // PUT /api/auth/me/password

module.exports = router;
