// controllers/eventController.js — CRUD operations for Events

const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Tag = require('../models/Tag');
const User = require('../models/User');
const emailService = require('../utils/emailService');

async function notifyMatchingStudents(event, eventTags) {
    try {
        if (!eventTags || eventTags.length === 0) return;
        const regexes = eventTags.map(t => new RegExp(`^${t.trim()}$`, 'i'));
        const students = await User.find({
            role: 'student',
            interests: { $in: regexes },
        });
        console.log(`🔔 Direct Event: Found ${students.length} student(s) interested in tags [${eventTags.join(', ')}] for event "${event.name}"`);

        for (const student of students) {
            const matched = (student.interests || []).filter(interest =>
                eventTags.some(t => t.toLowerCase() === interest.toLowerCase())
            );
            emailService.sendNewEventTagNotification({
                to: student.email,
                name: student.name,
                eventName: event.name,
                eventDescription: event.description,
                eventDate: event.date,
                venue: event.venue,
                fee: event.fee,
                eventId: event._id.toString(),
                matchingTags: matched.length > 0 ? matched : eventTags,
            }).catch(err => {
                console.error(`Failed to send tag alert to ${student.email}:`, err.message);
            });
        }
    } catch (err) {
        console.error('Error in notifyMatchingStudents (direct event):', err.message);
    }
}

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
        let parsedTags = [];
        if (Array.isArray(req.body.tags)) parsedTags = req.body.tags.map(t => String(t).trim()).filter(Boolean);
        else if (typeof req.body.tags === 'string') parsedTags = req.body.tags.split(',').map(t => t.trim()).filter(Boolean);

        const event = new Event({ ...req.body, tags: parsedTags });
        await event.save();

        if (parsedTags.length > 0) {
            for (const tName of parsedTags) {
                Tag.findOneAndUpdate(
                    { name: { $regex: new RegExp(`^${tName}$`, 'i') } },
                    { $setOnInsert: { name: tName, category: event.category || 'general' } },
                    { upsert: true }
                ).catch(() => {});
            }
            notifyMatchingStudents(event, parsedTags);
        }

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
