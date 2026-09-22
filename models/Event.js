// models/Event.js — Mongoose schema for a campus event

const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Event name is required'],
        unique: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
        default: '',
    },
    // Optional external URL for the official event page / RSVP link
    eventUrl: {
        type: String,
        trim: true,
        default: '',
    },
    date: {
        type: Date,
        required: [true, 'Event date is required'],
    },
    venue: {
        type: String,
        trim: true,
        default: 'TBD',
    },
    category: {
        type: String,
        enum: ['technical', 'cultural', 'sports', 'workshop'],
        default: 'technical',
    },
    capacity: {
        type: Number,
        required: [true, 'Capacity is required'],
        min: [1, 'Capacity must be at least 1'],
        default: 50,
    },
    fee: {
        type: Number,
        default: 0,
        min: [0, 'Fee cannot be negative'],
    },
    // Denormalized counts — updated atomically with $inc to avoid COUNT(*) queries
    confirmedCount: { type: Number, default: 0, min: 0 },
    waitlistCount: { type: Number, default: 0, min: 0 },

    createdAt: { type: Date, default: Date.now },
});

// Virtual: available seats (not stored in DB)
eventSchema.virtual('availableSeats').get(function () {
    return Math.max(0, this.capacity - this.confirmedCount);
});

// Include virtuals when converting to JSON (for API responses)
eventSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Event', eventSchema);
