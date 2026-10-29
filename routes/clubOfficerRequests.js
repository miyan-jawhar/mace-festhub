// routes/clubOfficerRequests.js — Club Officer application routes

const express = require('express');
const router  = express.Router();
const {
    submitRequest,
    getMyRequests,
    getPendingRequests,
    getPendingCount,
    approveRequest,
    rejectRequest,
} = require('../controllers/clubOfficerRequestController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Any authenticated student can apply / view their own
router.post('/mine',       requireAuth, submitRequest);     // POST   /api/officer-requests/mine   (alias for submit)
router.post('/',           requireAuth, submitRequest);     // POST   /api/officer-requests
router.get( '/mine',       requireAuth, getMyRequests);     // GET    /api/officer-requests/mine
router.get( '/count',      requireAuth, requireRole('faculty_advisor', 'principal', 'admin'), getPendingCount); // GET /api/officer-requests/count
router.get( '/pending',    requireAuth, requireRole('faculty_advisor', 'principal', 'admin'), getPendingRequests);

// FA + admin/principal review
router.put( '/:id/approve', requireAuth, requireRole('faculty_advisor', 'principal', 'admin'), approveRequest);
router.put( '/:id/reject',  requireAuth, requireRole('faculty_advisor', 'principal', 'admin'), rejectRequest);

module.exports = router;
