// models/FARequest.js — Faculty Advisor role request to Principal

const mongoose = require('mongoose');

const faRequestSchema = new mongoose.Schema({
    // The faculty member making the request
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // The club they want to advise
    club: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Club',
        required: true,
    },
    // Optional note from the faculty member
    note: { type: String, trim: true, default: '' },

    // Workflow state
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },

    // Principal's response
    reviewNote:  { type: String, trim: true, default: '' },
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt:  { type: Date, default: null },

    createdAt: { type: Date, default: Date.now },
});

// Prevent duplicate pending requests from the same user for the same club
faRequestSchema.index({ requestedBy: 1, club: 1, status: 1 });

module.exports = mongoose.model('FARequest', faRequestSchema);
