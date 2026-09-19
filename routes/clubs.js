// routes/clubs.js — Club management routes

const express = require('express');
const router  = express.Router();
const {
    getAllClubs,
    getClub,
    createClub,
    updateClub,
    upsertMember,
    removeMember,
    getMyClubs,
} = require('../controllers/clubController');
const { requireAuth, requireRole } = require('../middleware/auth');

// ── Public reads ──────────────────────────────────────────────────────────────
router.get('/',    getAllClubs);    // GET /api/clubs (public — event page needs club list)
router.get('/:id', getClub);       // GET /api/clubs/:id

// ── Officer self-service ──────────────────────────────────────────────────────
router.get('/my', requireAuth, getMyClubs); // GET /api/clubs/my — clubs where user is officer

// ── Club management: Principal OR Admin ──────────────────────────────────────
// Principal can manage clubs and assign FAs; Admin can too
const canManageClubs = [requireAuth, requireRole('principal', 'admin')];

router.post('/',                        ...canManageClubs, createClub);       // POST /api/clubs
router.put( '/:id',                     ...canManageClubs, updateClub);       // PUT  /api/clubs/:id
router.post('/:id/members',             ...canManageClubs, upsertMember);     // POST /api/clubs/:id/members
router.delete('/:id/members/:userId',   ...canManageClubs, removeMember);     // DELETE member

module.exports = router;
