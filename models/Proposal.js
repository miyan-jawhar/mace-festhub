// models/Proposal.js — Event proposal with FA → Principal approval workflow

const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
    // Event details
    title:       { type: String, required: [true, 'Title is required'], trim: true },
    description: { type: String, trim: true, default: '' },
    date:        { type: Date,   required: [true, 'Event date is required'] },
    time:        { type: String, trim: true, default: '' },        // e.g. "10:00 AM"
    venue:       { type: String, trim: true, default: 'TBD' },
    category: {
        type: String,
        enum: ['technical', 'cultural', 'sports', 'workshop'],
        default: 'technical',
    },
    capacity: {
        type: Number,
        required: [true, 'Capacity is required'],
        min: [1, 'Capacity must be at least 1'],
    },

    // Ownership
    club:       { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Workflow state
    status: {
        type: String,
        enum: ['pending_fa', 'pending_principal', 'approved', 'rejected'],
        default: 'pending_fa',
    },

    // Feedback from approvers
    faComment:         { type: String, default: '' },
    principalComment:  { type: String, default: '' },
    rejectedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedAt:        { type: Date, default: null },
    approvedAt:        { type: Date, default: null },

    // Set when proposal is fully approved and event is auto-created
    createdEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },

    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Proposal', proposalSchema);
