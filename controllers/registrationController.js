// controllers/registrationController.js — Registration logic including waitlist auto-promotion

const Registration  = require('../models/Registration');
const Event         = require('../models/Event');
const emailService  = require('../utils/emailService');
const calendarService = require('../utils/calendarService');
const Razorpay      = require('razorpay');
const crypto        = require('crypto');
const { generateTicketToken } = require('../utils/ticketService');

// Initialize Razorpay instance (using test credentials from .env)
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
});
// ─── POST /api/registrations — Register a student ────────────────────────────
// If user is authenticated (optionalAuth), auto-fills name/email/dept/year from profile
exports.register = async (req, res) => {
    try {
        let { eventId, name, email, phone, department, year } = req.body;

        // Auto-fill from authenticated user profile
        if (req.user) {
            name       = req.user.name;
            email      = req.user.email;
            phone      = phone      || req.user.phone      || '';
            department = department || req.user.department || '';
            year       = year       || req.user.year       || '1';
        }

        if (!eventId || !name || !email || !year) {
            return res.status(400).json({ error: 'eventId, name, email, and year are required' });
        }

        // Reject if year is not a valid enum value (non-student roles use 'N/A')
        const validYears = ['1', '2', '3', '4'];
        if (!validYears.includes(year)) year = '1';

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

        // ── Razorpay Payment Flow ────────────────────────────────────────────────
        let paymentId = null;
        let razorpayOrderId = null;

        if (event.fee > 0) {
            const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

            // Step 1: No payment details yet -> Create Razorpay Order and return 402
            if (!razorpay_payment_id) {
                const options = {
                    amount: event.fee * 100, // amount in smallest currency unit (paise)
                    currency: "INR",
                    receipt: `receipt_event_${event._id}_${Date.now()}`
                };
                try {
                    const order = await razorpay.orders.create(options);
                    return res.status(402).json({
                        error: 'Payment required',
                        order_id: order.id,
                        amount: order.amount,
                        currency: order.currency,
                        key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key'
                    });
                } catch (err) {
                    return res.status(500).json({ error: 'Failed to create payment order' });
                }
            }

            // Step 2: Payment details provided -> Verify Signature
            const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'dummy_secret');
            hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
            const expectedSignature = hmac.digest('hex');

            if (expectedSignature !== razorpay_signature) {
                return res.status(400).json({ error: 'Payment verification failed (Invalid signature)' });
            }

            paymentId = razorpay_payment_id;
            razorpayOrderId = razorpay_order_id;
        }
        // ──────────────────────────────────────────────────────────────────────────

        let registration;
        let status;
        const userId      = req.user ? req.user._id : null;
        const ticketToken = generateTicketToken();

        if (event.confirmedCount < event.capacity) {
            // ── CONFIRMED path ──
            registration = await Registration.findOneAndUpdate(
                { eventId, email },
                { name, phone, department, year, status: 'confirmed', waitlistPosition: null,
                  registeredAt: new Date(), userId, ticketToken, paymentId, razorpayOrderId },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            await Event.findByIdAndUpdate(eventId, { $inc: { confirmedCount: 1 } });
            status = 'confirmed';
        } else {
            // ── WAITLISTED path — no ticket token until promoted ──
            const waitlistPos = event.waitlistCount + 1;
            registration = await Registration.findOneAndUpdate(
                { eventId, email },
                { name, phone, department, year, status: 'waitlisted', waitlistPosition: waitlistPos,
                  registeredAt: new Date(), userId, ticketToken, paymentId, razorpayOrderId },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            await Event.findByIdAndUpdate(eventId, { $inc: { waitlistCount: 1 } });
            status = 'waitlisted';
        }

        res.status(201).json({ registration, status });

        // ── Fire email in background (never blocks response) ──────────────
        emailService.sendRegistrationConfirmation({
            to:             email,
            name,
            eventName:      event.name,
            eventDate:      event.date,
            venue:          event.venue,
            category:       event.category,
            status,
            waitlistPos:    registration.waitlistPosition,
            ticketToken:    registration.ticketToken,
            registrationId: registration._id.toString(),
        }).catch(() => {}); // silent — email never breaks the flow

        // ── Sync to Google Calendar in background ──────────────
        if (userId) {
            calendarService.addEventToCalendar(userId, event, registration).catch(() => {});
        }

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
            status: { $ne: 'cancelled' },
        }).sort({ status: 1, waitlistPosition: 1, registeredAt: 1 });

        res.json(registrations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/registrations/student/:email — Look up by email (auth required) ─
exports.getStudentRegistrations = async (req, res) => {
    try {
        // A student can only look up their own registrations;
        // admin can look up anyone's
        const email = req.params.email.toLowerCase().trim();
        if (req.user.role !== 'admin' && req.user.email !== email) {
            return res.status(403).json({ error: 'You can only view your own registrations' });
        }

        const registrations = await Registration.find({
            email,
            status: { $ne: 'cancelled' },
        }).populate('eventId', 'name date venue category capacity confirmedCount waitlistCount')
          .sort({ registeredAt: -1 });

        res.json(registrations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /api/registrations/:id/cancel — Cancel + auto-promote waitlist ──────
exports.cancel = async (req, res) => {
    try {
        const reg = await Registration.findById(req.params.id);
        if (!reg) return res.status(404).json({ error: 'Registration not found' });
        if (reg.status === 'cancelled') {
            return res.status(400).json({ error: 'Registration is already cancelled' });
        }

        // Ownership check: logged-in non-admin users can only cancel their own
        if (req.user && req.user.role !== 'admin' && reg.email !== req.user.email) {
            return res.status(403).json({ error: 'You can only cancel your own registration' });
        }

        const wasConfirmed    = reg.status === 'confirmed';
        const prevWaitlistPos = reg.waitlistPosition;

        // Step 1: Mark as cancelled
        reg.status           = 'cancelled';
        reg.waitlistPosition = null;
        await reg.save();

        let promoted = null;

        if (wasConfirmed) {
            // Step 2: Free up one confirmed seat
            await Event.findByIdAndUpdate(reg.eventId, { $inc: { confirmedCount: -1 } });

            // Step 3: Promote first waitlisted student
            // Assign ticket token to promoted student
            const promoToken = generateTicketToken();
            promoted = await Registration.findOneAndUpdate(
                { eventId: reg.eventId, status: 'waitlisted', waitlistPosition: 1 },
                { status: 'confirmed', waitlistPosition: null, ticketToken: promoToken },
                { new: true }
            );

            if (promoted) {
                // Step 4: Shift remaining waitlist positions down
                await Registration.updateMany(
                    { eventId: reg.eventId, status: 'waitlisted' },
                    { $inc: { waitlistPosition: -1 } }
                );
                // Step 5: Update event counts
                await Event.findByIdAndUpdate(reg.eventId, {
                    $inc: { confirmedCount: 1, waitlistCount: -1 },
                });

                // Fire promotion email in background
                const promoEvent = await Event.findById(reg.eventId).lean();
                emailService.sendWaitlistPromotion({
                    to:         promoted.email,
                    name:       promoted.name,
                    eventName:  promoEvent?.name  || 'your event',
                    eventDate:  promoEvent?.date,
                    venue:      promoEvent?.venue,
                    ticketToken: promoToken,
                }).catch(() => {});
            }
        } else {
            // Was waitlisted — shift those behind this student
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
