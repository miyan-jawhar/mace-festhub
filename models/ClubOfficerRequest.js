// models/ClubOfficerRequest.js — Student application to become club officer
// Flow: Student applies → Club FA reviews → approved/rejected

const mongoose = require('mongoose');

const clubOfficerRequestSchema = new mongoose.Schema({
    // The student applying
    applicant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // The club they want to lead
    club: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Club',
        required: true,
    },
    // The role they're applying for
    requestedRole: {
        type: String,
        enum: ['president', 'secretary'],
        required: true,
    },
    // Applicant's statement / motivation
    statement: {
        type: String,
        trim: true,
        default: '',
    },

    // Workflow state
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },

    // FA's response
    reviewNote:  { type: String, trim: true, default: '' },
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt:  { type: Date, default: null },

    createdAt: { type: Date, default: Date.now },
});

// One active pending request per student per club per role
clubOfficerRequestSchema.index({ applicant: 1, club: 1, requestedRole: 1, status: 1 });

module.exports = mongoose.model('ClubOfficerRequest', clubOfficerRequestSchema);
