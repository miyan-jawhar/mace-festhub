// models/Tag.js — Tracks and Themes for event categorization & interest matching
const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tag name is required'],
        unique: true,
        trim: true,
    },
    slug: {
        type: String,
        lowercase: true,
        trim: true,
    },
    category: {
        type: String,
        enum: ['technical', 'cultural', 'sports', 'workshop', 'general'],
        default: 'general',
    },
    eventCount: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

tagSchema.pre('save', function (next) {
    if (this.name) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    next();
});

module.exports = mongoose.model('Tag', tagSchema);
