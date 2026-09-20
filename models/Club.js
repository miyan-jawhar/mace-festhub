// models/Club.js — Campus club with members and faculty advisor

const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clubRole: { type: String, enum: ['president', 'secretary', 'member'], default: 'member' },
}, { _id: false });

const clubSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Club name is required'],
        unique: true,
        trim: true,
    },
    description: { type: String, trim: true, default: '' },
    // Must be a user with role 'faculty_advisor'
    facultyAdvisor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    members: [memberSchema],
    createdAt: { type: Date, default: Date.now },
});

// Virtual: get only president + secretary for proposal eligibility checks
clubSchema.virtual('officers').get(function () {
    if (!this.members) return [];
    return this.members.filter(m => ['president', 'secretary'].includes(m.clubRole));
});

clubSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Club', clubSchema);
