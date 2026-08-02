// controllers/registrationController.js — Registration logic including waitlist auto-promotion

const Registration = require('../models/Registration');
const Event = require('../models/Event');

// ─── POST /api/registrations — Register a student ────────────────────────────
// Logic: if seats available → confirmed; else → waitlisted
exports.register = async (req, res) => {
    const { eventId, name, email, phone, department, year } = req.body;

    if (!eventId || !name || !email || !year) {
        return res.status(400).json({ error: 'eventId, name, email, and year are required' });
    }

    try {
        // Check for existing active registration
        const existing = await Registration.findOne({ eventId, email });
        if (existing && existing.status !== 'cancelled') {
            return res.status(400).json({
                error: `You are already registered for this event (status: ${existing.status})`,
            });
        }

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // Prevent registration for past events
        if (new Date(event.date) < new Date()) {
            return res.status(400).json({ error: 'Cannot register for a past event' });
        }

        let registration;
        let status;

        if (event.confirmedCount < event.capacity) {
            // ── CONFIRMED path ──
            // Upsert handles the re-registration case (previously cancelled)
            registration = await Registration.findOneAndUpdate(
                { eventId, email },
                { name, phone, department, year, status: 'confirmed', waitlistPosition: null, registeredAt: new Date() },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            // Atomically increment confirmed count — $inc is safe against concurrent requests
            await Event.findByIdAndUpdate(eventId, { $inc: { confirmedCount: 1 } });
            status = 'confirmed';
        } else {
            // ── WAITLISTED path ──
            const position = event.waitlistCount + 1;
            registration = await Registration.findOneAndUpdate(
                { eventId, email },
                { name, phone, department, year, status: 'waitlisted', waitlistPosition: position, registeredAt: new Date() },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            await Event.findByIdAndUpdate(eventId, { $inc: { waitlistCount: 1 } });
            status = 'waitlisted';
        }

        res.status(201).json({ registration, status });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Duplicate registration (DB constraint)' });
        }
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/registrations/:eventId — All registrations for an event ─────────
exports.getRegistrations = async (req, res) => {
    try {
        const registrations = await Registration.find({
            eventId: req.params.eventId,
            status: { $ne: 'cancelled' }, // exclude cancelled
        }).sort({ status: 1, waitlistPosition: 1, registeredAt: 1 });

        res.json(registrations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /api/registrations/:id/cancel — Cancel + auto-promote waitlist ──────
// This is the KEY engineering piece: state-transition logic
exports.cancel = async (req, res) => {
    try {
        const reg = await Registration.findById(req.params.id);
        if (!reg) return res.status(404).json({ error: 'Registration not found' });
        if (reg.status === 'cancelled') {
            return res.status(400).json({ error: 'Registration is already cancelled' });
        }

        const wasConfirmed = reg.status === 'confirmed';
        const prevWaitlistPos = reg.waitlistPosition;

        // Step 1: Mark as cancelled
        reg.status = 'cancelled';
        reg.waitlistPosition = null;
        await reg.save();

        let promoted = null;

        if (wasConfirmed) {
            // Step 2: Free up one confirmed seat
            await Event.findByIdAndUpdate(reg.eventId, { $inc: { confirmedCount: -1 } });

            // Step 3: Promote the first waitlisted student (position = 1)
            promoted = await Registration.findOneAndUpdate(
                { eventId: reg.eventId, status: 'waitlisted', waitlistPosition: 1 },
                { status: 'confirmed', waitlistPosition: null },
                { new: true }
            );

            if (promoted) {
                // Step 4: Shift remaining waitlist positions down by 1
                await Registration.updateMany(
                    { eventId: reg.eventId, status: 'waitlisted' },
                    { $inc: { waitlistPosition: -1 } }
                );
                // Step 5: Update event counts (one confirmed added, one waitlisted removed)
                await Event.findByIdAndUpdate(reg.eventId, {
                    $inc: { confirmedCount: 1, waitlistCount: -1 },
                });
            }
        } else {
            // Was waitlisted — shift positions of those behind this student
            await Registration.updateMany(
                { eventId: reg.eventId, status: 'waitlisted', waitlistPosition: { $gt: prevWaitlistPos } },
                { $inc: { waitlistPosition: -1 } }
            );
            await Event.findByIdAndUpdate(reg.eventId, { $inc: { waitlistCount: -1 } });
        }

        res.json({
            message: 'Registration cancelled successfully',
            promoted: promoted
                ? { name: promoted.name, email: promoted.email }
                : null,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── DELETE /api/registrations/email/:email — Cancel by student email ───────
exports.cancelByEmail = async (req, res) => {
    try {
        const { email } = req.params;
        const { eventId } = req.query;

        const query = { email: email.trim().toLowerCase(), status: { $ne: 'cancelled' } };
        if (eventId) query.eventId = eventId;

        const reg = await Registration.findOne(query);
        if (!reg) return res.status(404).json({ error: 'No active registration found for this email' });

        // Delegate to main cancel logic using reg._id
        req.params.id = reg._id.toString();
        return exports.cancel(req, res);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── DELETE /api/registrations/:id — Hard delete (admin) ─────────────────────
exports.deleteRegistration = async (req, res) => {
    try {
        const reg = await Registration.findByIdAndDelete(req.params.id);
        if (!reg) return res.status(404).json({ error: 'Registration not found' });
        res.json({ message: 'Registration deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
