// routes/registrations.js — Registration API routes

const express = require('express');
const router  = express.Router();
const {
    register,
    getRegistrations,
    getStudentRegistrations,
    cancel,
    deleteRegistration,
    cancelByEmail,
} = require('../controllers/registrationController');
const { optionalAuth, requireAuth, requireRole } = require('../middleware/auth');

// IMPORTANT: /student/:email must come before /:eventId to prevent Express
// matching the literal string "student" as a MongoDB ObjectId
router.get( '/student/:email', optionalAuth, getStudentRegistrations); // GET  /api/registrations/student/:email

router.post('/',                 optionalAuth, register);              // POST /api/registrations
router.get( '/:eventId',         getRegistrations);                    // GET  /api/registrations/:eventId
router.put( '/:id/cancel',       optionalAuth, cancel);                // PUT  /api/registrations/:id/cancel
router.delete('/email/:email',   requireAuth, cancelByEmail);          // DELETE /api/registrations/email/:email
router.delete('/:id',            requireAuth, requireRole('admin'), deleteRegistration); // DELETE /api/registrations/:id

module.exports = router;
