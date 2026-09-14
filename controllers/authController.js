// controllers/authController.js — Register, Login, Profile CRUD

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const SECRET  = process.env.JWT_SECRET || 'mace_festhub_jwt_secret_2026_lab';
const EXPIRES = '7d';

function signToken(user) {
    return jwt.sign(
        { id: user._id, role: user.role },
        SECRET,
        { expiresIn: EXPIRES }
    );
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
exports.register = async (req, res) => {
    try {
        const { name, email, password, role, department, year, phone } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // Only allow safe self-registration roles
        const allowedRoles = ['student', 'faculty_advisor', 'principal'];
        const assignedRole = allowedRoles.includes(role) ? role : 'student';

        const user = new User({ name, email, password, role: assignedRole, department, year, phone });
        await user.save();

        const token = signToken(user);
        res.status(201).json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role,
                    department: user.department, year: user.year, phone: user.phone },
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'An account with this email already exists' });
        }
        res.status(400).json({ error: err.message });
    }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Must explicitly select password (it's `select: false` in schema)
        const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });

        const match = await user.comparePassword(password);
        if (!match) return res.status(401).json({ error: 'Invalid email or password' });

        const token = signToken(user);
        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role,
                    department: user.department, year: user.year, phone: user.phone },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/auth/me — Return current user's profile ─────────────────────────
exports.getMe = async (req, res) => {
    try {
        // req.user set by requireAuth middleware
        const user = req.user;
        res.json({
            id: user._id, name: user.name, email: user.email, role: user.role,
            department: user.department, year: user.year, phone: user.phone,
            createdAt: user.createdAt,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /api/auth/me — Update profile (not password or role) ─────────────────
exports.updateMe = async (req, res) => {
    try {
        const { name, department, year, phone } = req.body;
        const allowed = {};
        if (name)       allowed.name       = name.trim();
        if (department) allowed.department = department.trim();
        if (year)       allowed.year       = year;
        if (phone)      allowed.phone      = phone.trim();

        const user = await User.findByIdAndUpdate(req.user._id, allowed, {
            new: true, runValidators: true,
        });
        res.json({
            id: user._id, name: user.name, email: user.email, role: user.role,
            department: user.department, year: user.year, phone: user.phone,
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// ─── PUT /api/auth/me/password — Change password ──────────────────────────────
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'currentPassword and newPassword are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user._id).select('+password');
        const match = await user.comparePassword(currentPassword);
        if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

        user.password = newPassword; // pre-save hook will re-hash
        await user.save();
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
