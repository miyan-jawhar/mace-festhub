// controllers/authController.js — Register, Login, Profile CRUD, User Management

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const SECRET  = process.env.JWT_SECRET || 'mace_festhub_jwt_secret_2026_lab';
const EXPIRES = '7d';

// Roles that cannot be self-assigned during registration
const PRIVILEGED_ROLES = ['faculty_advisor', 'principal', 'admin'];

// Email of the hardcoded principal (cannot be demoted via API)
const PRINCIPAL_EMAIL = (process.env.PRINCIPAL_EMAIL || 'principal@mace.ac.in').toLowerCase();

exports.signToken = function(user) {
    return jwt.sign(
        { id: user._id, role: user.role },
        SECRET,
        { expiresIn: EXPIRES }
    );
};

exports.publicUser = function(user) {
    return {
        id:         user._id,
        name:       user.name,
        email:      user.email,
        role:       user.role,
        department: user.department,
        year:       user.year,
        phone:      user.phone,
    };
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────
exports.register = async (req, res) => {
    try {
        const { name, email, password, department, year, phone } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // All self-registrations are students — no privileged role selection
        const user = new User({
            name, email, password,
            role: 'student',   // ← hardcoded; cannot be overridden by client
            department: department || '',
            year: (year && ['1','2','3','4'].includes(year)) ? year : 'N/A',
            phone: phone || '',
        });
        await user.save();

        const token = exports.signToken(user);
        res.status(201).json({ token, user: exports.publicUser(user) });
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

        const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });

        const match = await user.comparePassword(password);
        if (!match) return res.status(401).json({ error: 'Invalid email or password' });

        const token = exports.signToken(user);
        res.json({ token, user: exports.publicUser(user) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
    try {
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

// ─── PUT /api/auth/me — Update own profile (not password / role) ──────────────
exports.updateMe = async (req, res) => {
    try {
        const { name, department, year, phone } = req.body;
        const allowed = {};
        if (name)                              allowed.name       = name.trim();
        if (department !== undefined)          allowed.department = department.trim();
        if (year && ['1','2','3','4','N/A'].includes(year)) allowed.year = year;
        if (phone !== undefined)               allowed.phone      = phone.trim();

        const user = await User.findByIdAndUpdate(req.user._id, allowed, {
            new: true, runValidators: true,
        });
        res.json(publicUser(user));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// ─── PUT /api/auth/me/password ────────────────────────────────────────────────
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

        user.password = newPassword;
        await user.save();
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/auth/users — List all users (Principal + Admin only) ─────────────
exports.listUsers = async (req, res) => {
    try {
        const { search, role } = req.query;
        const filter = {};
        if (role)   filter.role = role;
        if (search) filter.$or = [
            { name:  { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];

        const users = await User.find(filter)
            .select('name email role department year phone createdAt')
            .sort({ createdAt: -1 })
            .limit(200);
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /api/auth/users/:id/role — Change a user's system role ───────────────
// Only Principal or Admin can call this.
// The hardcoded Principal account's role can never be changed.
exports.changeUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        const allowedRoles = ['student', 'faculty_advisor', 'admin'];
        // Principal role is seeded only — not assignable via API
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ error: `role must be one of: ${allowedRoles.join(', ')}` });
        }

        const target = await User.findById(req.params.id);
        if (!target) return res.status(404).json({ error: 'User not found' });

        // Protect the hardcoded principal account
        if (target.email === PRINCIPAL_EMAIL) {
            return res.status(403).json({ error: 'The principal account role cannot be changed' });
        }

        target.role = role;
        await target.save();
        res.json({ message: `Role updated to ${role}`, user: publicUser(target) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
