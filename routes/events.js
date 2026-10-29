// routes/events.js — Event API routes

const express = require('express');
const router  = express.Router();
const {
    getAllEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
} = require('../controllers/eventController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/',    getAllEvents);                                                    // GET  /api/events (public)
router.get('/:id', getEvent);                                                       // GET  /api/events/:id (public)
router.post('/',   requireAuth, requireRole('admin', 'principal'), createEvent);                 // POST /api/events (admin, principal)
router.put('/:id', requireAuth, requireRole('admin', 'principal'), updateEvent);                 // PUT  /api/events/:id (admin, principal)
router.delete('/:id', requireAuth, requireRole('admin', 'principal'), deleteEvent);              // DELETE /api/events/:id (admin, principal)

module.exports = router;
