// routes/ai.js — Gemini AI routes
const express = require('express');
const router  = express.Router();
const { suggestTags, chatFestBot, chatEventBot } = require('../controllers/aiController');
const { requireAuth } = require('../middleware/auth');

router.post('/suggest-tags', requireAuth, suggestTags);  // POST /api/ai/suggest-tags (officers, FA, admin)
router.post('/event-bot',    chatEventBot || chatFestBot); // POST /api/ai/event-bot (public chat)
router.post('/fest-bot',     chatFestBot);                // POST /api/ai/fest-bot (backward compatibility)

module.exports = router;
