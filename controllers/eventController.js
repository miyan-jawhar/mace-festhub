// controllers/eventController.js — CRUD operations for Events

const Event = require('../models/Event');
const Registration = require('../models/Registration');

// GET /api/events — List all events, sorted by date ascending
exports.getAllEvents = async (req, res) => {
    try {
        const events = await Event.find().sort({ date: 1 });
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/events/:id — Get a single event by ID
exports.getEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json(event);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/events — Create a new event (admin)
exports.createEvent = async (req, res) => {
    try {
        const event = new Event(req.body);
        await event.save();
        res.status(201).json(event);
    } catch (err) {
        // Duplicate event name
        if (err.code === 11000) {
            return res.status(400).json({ error: 'An event with this name already exists' });
        }
        res.status(400).json({ error: err.message });
    }
};

// PUT /api/events/:id — Update event details (admin)
exports.updateEvent = async (req, res) => {
    try {
        // runValidators ensures schema rules apply on update too
        const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json(event);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// DELETE /api/events/:id — Delete event and all its registrations (admin)
exports.deleteEvent = async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // Cascade: remove all registrations for this event
        await Registration.deleteMany({ eventId: req.params.id });

        res.json({ message: `Event "${event.name}" and all its registrations deleted` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
