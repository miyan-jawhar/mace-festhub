// controllers/faRequestController.js — Faculty Advisor request workflow

const FARequest = require('../models/FARequest');
const Club      = require('../models/Club');
const User      = require('../models/User');

// ─── POST /api/fa-requests — Submit FA request for a club ─────────────────────
exports.submitRequest = async (req, res) => {
    try {
        const { clubId, note } = req.body;
        if (!clubId) return res.status(400).json({ error: 'clubId is required' });

        // Verify club exists (lean to avoid virtual getter issues)
        const club = await Club.findById(clubId).lean();
        if (!club) return res.status(404).json({ error: 'Club not found' });

        // Check if a pending request already exists
        const existing = await FARequest.findOne({
            requestedBy: req.user._id,
            club: clubId,
            status: 'pending',
        });
        if (existing) {
            return res.status(400).json({ error: 'You already have a pending request for this club' });
        }

        const request = new FARequest({
            requestedBy: req.user._id,
            club:        clubId,
            note:        note || '',
        });
        await request.save();

        // Populate for response
        const populated = await FARequest.findById(request._id)
            .populate('requestedBy', 'name email')
            .populate('club',        'name')
            .lean();
        res.status(201).json(populated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};


// ─── GET /api/fa-requests/mine — Own requests ─────────────────────────────────
exports.getMyRequests = async (req, res) => {
    try {
        const requests = await FARequest.find({ requestedBy: req.user._id })
            .populate('club', 'name')
            .populate('reviewedBy', 'name')
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/fa-requests — All requests, pending by default (Principal/Admin) ─
exports.getAllRequests = async (req, res) => {
    try {
        const { status = 'pending' } = req.query;
        const filter = status === 'all' ? {} : { status };

        const requests = await FARequest.find(filter)
            .populate('requestedBy', 'name email department')
            .populate('club',        'name description')
            .populate('reviewedBy',  'name')
            .sort({ createdAt: 1 });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/fa-requests/count — Pending count badge ────────────────────────
exports.getPendingCount = async (req, res) => {
    try {
        const count = await FARequest.countDocuments({ status: 'pending' });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /api/fa-requests/:id/approve ────────────────────────────────────────
exports.approveRequest = async (req, res) => {
    try {
        const { reviewNote } = req.body;
        const request = await FARequest.findById(req.params.id)
            .populate('requestedBy')
            .populate('club');
        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'pending') {
            return res.status(400).json({ error: `Request is already ${request.status}` });
        }

        // 1. Set the user's role to faculty_advisor
        await User.findByIdAndUpdate(request.requestedBy._id, { role: 'faculty_advisor' });

        // 2. Assign them as FA for the club
        await Club.findByIdAndUpdate(request.club._id, {
            facultyAdvisor: request.requestedBy._id,
        });

        // 3. Mark request as approved
        request.status     = 'approved';
        request.reviewNote = reviewNote || '';
        request.reviewedBy = req.user._id;
        request.reviewedAt = new Date();
        await request.save();

        await request.populate([
            { path: 'requestedBy', select: 'name email' },
            { path: 'club',        select: 'name' },
            { path: 'reviewedBy',  select: 'name' },
        ]);
        res.json({ message: 'Approved — user is now Faculty Advisor for this club', request });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /api/fa-requests/:id/reject ─────────────────────────────────────────
exports.rejectRequest = async (req, res) => {
    try {
        const { reviewNote } = req.body;
        const request = await FARequest.findById(req.params.id);
        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'pending') {
            return res.status(400).json({ error: `Request is already ${request.status}` });
        }

        request.status     = 'rejected';
        request.reviewNote = reviewNote || '';
        request.reviewedBy = req.user._id;
        request.reviewedAt = new Date();
        await request.save();

        await request.populate([
            { path: 'requestedBy', select: 'name email' },
            { path: 'club',        select: 'name' },
            { path: 'reviewedBy',  select: 'name' },
        ]);
        res.json({ message: 'Request rejected', request });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
