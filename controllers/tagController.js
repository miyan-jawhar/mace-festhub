// controllers/tagController.js — Manage event themes, tracks, and tags
const Tag = require('../models/Tag');

const DEFAULT_TAGS = [
    { name: 'AI & Machine Learning', category: 'technical' },
    { name: 'Robotics & Automation', category: 'technical' },
    { name: 'Web Development', category: 'technical' },
    { name: 'Cybersecurity & Ethical Hacking', category: 'technical' },
    { name: 'Cloud Computing & DevOps', category: 'technical' },
    { name: 'IoT & Embedded Systems', category: 'technical' },
    { name: 'Competitive Programming', category: 'technical' },
    { name: 'UI/UX Design', category: 'workshop' },
    { name: 'Music & Bands', category: 'cultural' },
    { name: 'Dance & Choreography', category: 'cultural' },
    { name: 'Dramatics & Street Play', category: 'cultural' },
    { name: 'Photography & Filmmaking', category: 'cultural' },
    { name: 'Gaming & Esports', category: 'sports' },
    { name: 'Entrepreneurship & Startups', category: 'workshop' },
    { name: 'Open Source', category: 'technical' },
];

/**
 * Seed default tags if none exist
 */
async function ensureDefaultTags() {
    const count = await Tag.countDocuments();
    if (count === 0) {
        await Tag.insertMany(DEFAULT_TAGS);
        console.log('🏷️  Seeded default event track tags');
    }
}

// ─── GET /api/tags — List all tags ──────────────────────────────────────────
exports.getAllTags = async (req, res) => {
    try {
        await ensureDefaultTags();
        const tags = await Tag.find().sort({ name: 1 });
        res.json(tags);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /api/tags — Create a new tag ───────────────────────────────────────
exports.createTag = async (req, res) => {
    try {
        let { name, category } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Tag name is required' });
        }
        name = name.trim();

        // Check if tag already exists (case-insensitive)
        let tag = await Tag.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (tag) {
            return res.status(200).json(tag);
        }

        tag = new Tag({
            name,
            category: category || 'general',
        });
        await tag.save();
        res.status(201).json(tag);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.ensureDefaultTags = ensureDefaultTags;
