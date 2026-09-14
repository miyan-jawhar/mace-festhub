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

// Catch-all: serve index.html for unknown GET routes (SPA fallback)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// ─── Connect to MongoDB Atlas & Start Server ──────────────────────────────────
const PORT      = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log('✅  Connected to MongoDB Atlas');
        app.listen(PORT, () => {
            console.log(`🚀  Server running at http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌  MongoDB connection failed:', err.message);
        process.exit(1);
    });
