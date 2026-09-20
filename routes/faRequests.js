// routes/faRequests.js — FA request routes

const express = require('express');
const router  = express.Router();
const {
    submitRequest,
    getMyRequests,
    getAllRequests,
    getPendingCount,
    approveRequest,
    rejectRequest,
} = require('../controllers/faRequestController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Any authenticated user can submit / view their own requests
router.post('/',        requireAuth, submitRequest);    // POST   /api/fa-requests
router.get( '/mine',    requireAuth, getMyRequests);    // GET    /api/fa-requests/mine
router.get( '/count',   requireAuth, requireRole('principal', 'admin'), getPendingCount); // GET /api/fa-requests/count

// Principal + Admin manage all requests
router.get( '/',        requireAuth, requireRole('principal', 'admin'), getAllRequests);
router.put( '/:id/approve', requireAuth, requireRole('principal', 'admin'), approveRequest);
router.put( '/:id/reject',  requireAuth, requireRole('principal', 'admin'), rejectRequest);

module.exports = router;
