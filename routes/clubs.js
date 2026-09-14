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

router.get( '/',                         getAllClubs);                              // GET /api/clubs (public)
router.get( '/my', requireAuth,          getMyClubs);                              // GET /api/clubs/my (officer's clubs)
router.get( '/:id',                      getClub);                                 // GET /api/clubs/:id (public)
router.post('/', requireAuth, requireRole('admin'), createClub);                   // POST /api/clubs
router.put( '/:id', requireAuth, requireRole('admin'), updateClub);                // PUT /api/clubs/:id
router.post('/:id/members', requireAuth, requireRole('admin'), upsertMember);      // POST /api/clubs/:id/members
router.delete('/:id/members/:userId', requireAuth, requireRole('admin'), removeMember); // DELETE member

module.exports = router;
