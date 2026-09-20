// server.js — Entry point for MACE FestHub
// Sets up Express app, connects to MongoDB Atlas, and starts the server

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const dotenv   = require('dotenv');
const path     = require('path');
const dns      = require('dns');

// Set public DNS servers to resolve MongoDB Atlas SRV records reliably
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
    console.warn('Could not set custom DNS servers:', e.message);
}

// Load environment variables from .env
dotenv.config();

// Validate required env vars
if (!process.env.MONGO_URI) {
    console.error('❌  MONGO_URI is not defined. Copy .env.example to .env and fill in your Atlas credentials.');
    process.exit(1);
}
if (!process.env.JWT_SECRET) {
    console.warn('⚠️   JWT_SECRET not set — using default fallback (NOT safe for production)');
}

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/clubs',         require('./routes/clubs'));
app.use('/api/proposals',     require('./routes/proposals'));
app.use('/api/events',        require('./routes/events'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/fa-requests',   require('./routes/faRequests'));

// Note: Named HTML pages (login.html, admin.html, profile.html) are served
// directly by express.static above. No SPA catch-all needed.


// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// ─── Seed Hardcoded Principal Account ────────────────────────────────────────
async function seedPrincipal() {
    const User = require('./models/User');
    const PRINCIPAL_EMAIL    = process.env.PRINCIPAL_EMAIL    || 'principal@mace.ac.in';
    const PRINCIPAL_PASSWORD = process.env.PRINCIPAL_PASSWORD || 'principal2026';
    const PRINCIPAL_NAME     = process.env.PRINCIPAL_NAME     || 'Principal';

    try {
        const existing = await User.findOne({ email: PRINCIPAL_EMAIL });
        if (!existing) {
            const principal = new User({
                name:     PRINCIPAL_NAME,
                email:    PRINCIPAL_EMAIL,
                password: PRINCIPAL_PASSWORD,
                role:     'principal',
            });
            await principal.save();
            console.log(`✅  Principal account seeded: ${PRINCIPAL_EMAIL}`);
        } else if (existing.role !== 'principal') {
            // Enforce role in case it was changed externally
            existing.role = 'principal';
            await existing.save();
            console.log(`⚠️   Principal role restored for: ${PRINCIPAL_EMAIL}`);
        }
    } catch (err) {
        console.error('❌  Failed to seed principal account:', err.message);
    }
}

// ─── Connect to MongoDB Atlas & Start Server ──────────────────────────────────
const PORT      = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

mongoose
    .connect(MONGO_URI)
    .then(async () => {
        console.log('✅  Connected to MongoDB Atlas');
        await seedPrincipal();
        app.listen(PORT, () => {
            console.log(`🚀  Server running at http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌  MongoDB connection failed:', err.message);
        process.exit(1);
    });
