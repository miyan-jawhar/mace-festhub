// routes/registrations.js — Registration API routes

const express = require('express');
const router = express.Router();
const {
    register,
    getRegistrations,
    cancel,
    deleteRegistration,
} = require('../controllers/registrationController');

router.post('/', register);                        // POST   /api/registrations
router.get('/:eventId', getRegistrations);         // GET    /api/registrations/:eventId
router.put('/:id/cancel', cancel);                 // PUT    /api/registrations/:id/cancel
router.delete('/:id', deleteRegistration);         // DELETE /api/registrations/:id

module.exports = router;
