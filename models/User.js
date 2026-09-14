// models/User.js — Mongoose schema for authenticated users

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false, // Never returned in queries by default
    },
    // System-level role — controls page access
    role: {
        type: String,
        enum: ['student', 'faculty_advisor', 'principal', 'admin'],
        default: 'student',
    },
    department: { type: String, trim: true, default: '' },
    year: {
        type: String,
        enum: ['1', '2', '3', '4', 'N/A'],
        default: 'N/A',
    },
    phone: { type: String, trim: true, default: '' },
    createdAt: { type: Date, default: Date.now },
});

// Hash password before saving (only when modified)
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Instance method: compare plain password with hash
userSchema.methods.comparePassword = async function (plain) {
    return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
