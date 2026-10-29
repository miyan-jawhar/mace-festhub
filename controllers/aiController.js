// controllers/aiController.js — Endpoints for Gemini AI features
const geminiService = require('../utils/geminiService');
const Tag           = require('../models/Tag');
const Event         = require('../models/Event');

// ─── POST /api/ai/suggest-tags ───────────────────────────────────────────────
exports.suggestTags = async (req, res) => {
    try {
        const { title, description, category } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Event title is required for AI suggestions' });
        }

        const tagsDocs = await Tag.find({}, 'name').sort({ eventCount: -1 }).limit(30);
        const availableTags = tagsDocs.map(t => t.name);

        const result = await geminiService.suggestTagsAndDescription({
            title: title.trim(),
            description: (description || '').trim(),
            category: category || 'technical',
            availableTags,
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /api/ai/event-bot (and legacy /fest-bot) ───────────────────────────
exports.chatEventBot = async (req, res) => {
    try {
        const { question } = req.body;
        if (!question || !question.trim()) {
            return res.status(400).json({ error: 'Question is required' });
        }

        // Fetch upcoming active events from DB for real context
        const events = await Event.find().sort({ date: 1 }).limit(25);

        const answer = await geminiService.askEventBot({
            question: question.trim(),
            events,
        });

        res.json({ answer });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.chatFestBot = exports.chatEventBot;

