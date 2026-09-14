// routes/proposals.js — Event proposal routes

const express = require('express');
const router  = express.Router();
const {
    createProposal,
    getMyProposals,
    getPendingProposals,
    getAllProposals,
    approveProposal,
    rejectProposal,
} = require('../controllers/proposalController');
const { requireAuth, requireRole } = require('../middleware/auth');

// All proposal routes require auth
router.post('/',        requireAuth, createProposal);       // POST /api/proposals
router.get( '/mine',   requireAuth, getMyProposals);        // GET  /api/proposals/mine
router.get( '/pending', requireAuth,
    requireRole('faculty_advisor', 'principal', 'admin'),
    getPendingProposals);                                    // GET  /api/proposals/pending
router.get( '/', requireAuth, requireRole('admin'), getAllProposals); // GET /api/proposals (admin)
router.put( '/:id/approve', requireAuth,
    requireRole('faculty_advisor', 'principal', 'admin'),
    approveProposal);                                        // PUT /api/proposals/:id/approve
router.put( '/:id/reject', requireAuth,
    requireRole('faculty_advisor', 'principal', 'admin'),
    rejectProposal);                                         // PUT /api/proposals/:id/reject

module.exports = router;
