// models/Registration.js — Mongoose schema for a student's event registration

const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: [true, 'Event ID is required'],
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    phone: {
        type: String,
        trim: true,
        default: '',
    },
    department: {
        type: String,
        trim: true,
        default: '',
    },
    year: {
        type: String,
        enum: ['1', '2', '3', '4'],
        required: [true, 'Year of study is required'],
    },
    // Optional: linked to an authenticated user account
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    status: {
        type: String,
        enum: ['confirmed', 'waitlisted', 'cancelled'],
        default: 'confirmed',
    },
    // null when confirmed; integer position (1-indexed) when waitlisted
    waitlistPosition: {
        type: Number,
        default: null,
    },
    registeredAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound unique index — prevents a student from registering twice for same event
// The DB enforces this even if application logic fails (e.g., concurrent requests)
registrationSchema.index({ eventId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
