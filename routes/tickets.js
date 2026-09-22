// routes/tickets.js — E-ticket routes

const express = require('express');
const router  = express.Router();
const { getQR, getPDF, verifyTicket } = require('../controllers/ticketController');
const { requireAuth } = require('../middleware/auth');

// GET /api/tickets/verify/:token — Public scan endpoint (no auth — QR scanner at door)
router.get('/verify/:token', verifyTicket);

// GET /api/tickets/:id/qr.png — QR code image for a registration (auth required)
router.get('/:id/qr.png', requireAuth, getQR);

// GET /api/tickets/:id/pdf  — PDF e-ticket download (auth required)
router.get('/:id/pdf', requireAuth, getPDF);

module.exports = router;
