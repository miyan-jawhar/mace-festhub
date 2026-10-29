// controllers/proposalController.js — Event proposal with FA → Principal approval workflow

const Proposal     = require('../models/Proposal');
const Club         = require('../models/Club');
const Event        = require('../models/Event');
const Tag          = require('../models/Tag');
const User         = require('../models/User');
const emailService = require('../utils/emailService');

// ─── Helper: get user's officer membership in a club ──────────────────────────
async function getClubOfficerRole(userId, clubId) {
    const club = await Club.findById(clubId);
    if (!club) return null;
    const member = club.members.find(m => m.userId.toString() === userId.toString());
    if (!member) return null;
    return ['president', 'secretary'].includes(member.clubRole) ? { club, member } : null;
}

// ─── Helper: Notify students whose profile interests match event tags ─────────
async function notifyMatchingStudents(event, eventTags) {
    try {
        if (!eventTags || eventTags.length === 0) return;
        const regexes = eventTags.map(t => new RegExp(`^${t.trim()}$`, 'i'));
        const students = await User.find({
            role: 'student',
            interests: { $in: regexes },
        });

        console.log(`🔔 Found ${students.length} student(s) interested in tags [${eventTags.join(', ')}] for event "${event.name}"`);

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
        console.error('Error in notifyMatchingStudents:', err.message);
    }
}

// ─── POST /api/proposals — Submit a new proposal ──────────────────────────────
exports.createProposal = async (req, res) => {
    try {
        const { title, description, date, time, venue, category, capacity, fee, tags, clubId } = req.body;

        if (!title || !date || !capacity || !clubId) {
            return res.status(400).json({ error: 'title, date, capacity, and clubId are required' });
        }

        // Parse and sanitize tags
        let parsedTags = [];
        if (Array.isArray(tags)) parsedTags = tags.map(t => String(t).trim()).filter(Boolean);
        else if (typeof tags === 'string') parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);

        // Auto-save new tags in Tag collection in background
        if (parsedTags.length > 0) {
            for (const tName of parsedTags) {
                Tag.findOneAndUpdate(
                    { name: { $regex: new RegExp(`^${tName}$`, 'i') } },
                    { $setOnInsert: { name: tName, category: category || 'general' } },
                    { upsert: true }
                ).catch(() => {});
            }
        }

        // Admin and Faculty Advisor of the club can propose; student members must be club officers
        let club;
        let initialStatus = 'pending_fa';

        if (['admin', 'principal'].includes(req.user.role)) {
            club = await Club.findById(clubId);
            if (!club) return res.status(404).json({ error: 'Club not found' });
            if (req.user.role === 'principal') initialStatus = 'pending_principal';
        } else if (req.user.role === 'faculty_advisor') {
            club = await Club.findById(clubId);
            if (!club) return res.status(404).json({ error: 'Club not found' });
            if (club.facultyAdvisor?.toString() !== req.user._id.toString()) {
                return res.status(403).json({ error: 'You are not the faculty advisor for this club' });
            }
            initialStatus = 'pending_principal';
        } else {
            const result = await getClubOfficerRole(req.user._id, clubId);
            if (!result) {
                return res.status(403).json({ error: 'You must be a club officer or faculty advisor to propose events' });
            }
            club = result.club;
        }

        const proposal = new Proposal({
            title, description, date, time, venue, category, capacity,
            fee: Number(fee) || 0,
            tags: parsedTags,
            club: clubId,
            proposedBy: req.user._id,
            status: initialStatus,
        });
        await proposal.save();
        await proposal.populate([
            { path: 'club', select: 'name' },
            { path: 'proposedBy', select: 'name email' },
        ]);
        res.status(201).json(proposal);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// ─── GET /api/proposals/mine — Proposals I submitted ─────────────────────────
exports.getMyProposals = async (req, res) => {
    try {
        const proposals = await Proposal.find({ proposedBy: req.user._id })
            .populate('club', 'name')
            .populate('proposedBy', 'name email')
            .sort({ createdAt: -1 });
        res.json(proposals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/proposals/pending — Proposals awaiting my action ────────────────
exports.getPendingProposals = async (req, res) => {
    try {
        let query = {};

        if (req.user.role === 'faculty_advisor') {
            // FA sees proposals for clubs where they are the advisor
            const myClubs = await Club.find({ facultyAdvisor: req.user._id }, '_id');
            const clubIds = myClubs.map(c => c._id);
            query = { status: 'pending_fa', club: { $in: clubIds } };

        } else if (req.user.role === 'principal') {
            query = { status: 'pending_principal' };

        } else if (req.user.role === 'admin') {
            // Admin sees all pending proposals
            query = { status: { $in: ['pending_fa', 'pending_principal'] } };

        } else {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const proposals = await Proposal.find(query)
            .populate('club', 'name facultyAdvisor')
            .populate('proposedBy', 'name email department')
            .sort({ createdAt: 1 });
        res.json(proposals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/proposals — All proposals (admin only) ─────────────────────────
exports.getAllProposals = async (req, res) => {
    try {
        const proposals = await Proposal.find()
            .populate('club', 'name')
            .populate('proposedBy', 'name email')
            .populate('rejectedBy', 'name role')
            .sort({ createdAt: -1 });
        res.json(proposals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /api/proposals/:id/approve ──────────────────────────────────────────
exports.approveProposal = async (req, res) => {
    try {
        const { comment } = req.body;
        const proposal = await Proposal.findById(req.params.id).populate('club');
        if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

        const role = req.user.role;

        if (proposal.status === 'pending_fa') {
            // FA for this club or admin may approve
            if (role === 'faculty_advisor') {
                const isFA = proposal.club.facultyAdvisor?.toString() === req.user._id.toString();
                if (!isFA) return res.status(403).json({ error: 'You are not the FA for this club' });
            } else if (role !== 'admin') {
                return res.status(403).json({ error: 'Only the faculty advisor or admin can approve at this stage' });
            }
            proposal.faComment = comment || '';
            proposal.status    = 'pending_principal';

        } else if (proposal.status === 'pending_principal') {
            if (!['principal', 'admin'].includes(role)) {
                return res.status(403).json({ error: 'Only the principal or admin can approve at this stage' });
            }
            proposal.principalComment = comment || '';
            proposal.status           = 'approved';
            proposal.approvedAt       = new Date();

            // ── Auto-create the Event ──────────────────────────────────────
            const newEvent = new Event({
                name:        proposal.title,
                description: proposal.description || '',
                date:        proposal.date,
                venue:       proposal.venue || 'TBD',
                category:    proposal.category || 'technical',
                capacity:    proposal.capacity,
                fee:         proposal.fee || 0,
                tags:        proposal.tags || [],
            });
            await newEvent.save();
            proposal.createdEventId = newEvent._id;

            // Notify students whose profile interests match the approved event tags
            if (proposal.tags && proposal.tags.length > 0) {
                notifyMatchingStudents(newEvent, proposal.tags).catch(err => {
                    console.error('Error notifying matching students on approval:', err.message);
                });
            }

        } else {
            return res.status(400).json({ error: `Proposal is already ${proposal.status}` });
        }

        await proposal.save();
        await proposal.populate([
            { path: 'proposedBy', select: 'name email' },
            { path: 'rejectedBy', select: 'name role' },
        ]);
        res.json(proposal);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /api/proposals/:id/reject ───────────────────────────────────────────
exports.rejectProposal = async (req, res) => {
    try {
        const { comment } = req.body;
        const proposal = await Proposal.findById(req.params.id).populate('club');
        if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

        const role = req.user.role;
        const stage = proposal.status;

        if (stage === 'pending_fa') {
            if (role === 'faculty_advisor') {
                const isFA = proposal.club.facultyAdvisor?.toString() === req.user._id.toString();
                if (!isFA) return res.status(403).json({ error: 'You are not the FA for this club' });
            } else if (role !== 'admin') {
                return res.status(403).json({ error: 'Only the faculty advisor or admin can reject at this stage' });
            }
            proposal.faComment = comment || '';

        } else if (stage === 'pending_principal') {
            if (!['principal', 'admin'].includes(role)) {
                return res.status(403).json({ error: 'Only the principal or admin can reject at this stage' });
            }
            proposal.principalComment = comment || '';

        } else {
            return res.status(400).json({ error: `Proposal is already ${proposal.status}` });
        }

        proposal.status     = 'rejected';
        proposal.rejectedBy = req.user._id;
        proposal.rejectedAt = new Date();
        await proposal.save();

        await proposal.populate([
            { path: 'proposedBy', select: 'name email' },
            { path: 'rejectedBy', select: 'name role' },
        ]);
        res.json(proposal);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
