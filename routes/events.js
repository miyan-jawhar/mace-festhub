// routes/events.js — Event API routes

const express = require('express');
const router = express.Router();
const {
    getAllEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
} = require('../controllers/eventController');

router.get('/', getAllEvents);        // GET  /api/events
router.get('/:id', getEvent);        // GET  /api/events/:id
router.post('/', createEvent);       // POST /api/events
router.put('/:id', updateEvent);     // PUT  /api/events/:id
router.delete('/:id', deleteEvent);  // DELETE /api/events/:id

module.exports = router;
