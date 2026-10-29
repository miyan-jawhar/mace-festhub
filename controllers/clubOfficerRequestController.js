// controllers/clubOfficerRequestController.js
// Handles student applications to become Club President or Secretary.
// Reviewed and approved by the club's Faculty Advisor.

const ClubOfficerRequest = require('../models/ClubOfficerRequest');
const Club               = require('../models/Club');
const User               = require('../models/User');

// ─── POST /api/officer-requests — Student submits an application ───────────────
exports.submitRequest = async (req, res) => {
    try {
        const { clubId, requestedRole, statement } = req.body;

        if (!clubId || !requestedRole) {
            return res.status(400).json({ error: 'clubId and requestedRole are required' });
        }
        if (!['president', 'secretary'].includes(requestedRole)) {
            return res.status(400).json({ error: 'requestedRole must be president or secretary' });
        }

        const club = await Club.findById(clubId).populate('facultyAdvisor', 'name email');
        if (!club) return res.status(404).json({ error: 'Club not found' });

        // Club must have an FA before applications can be accepted
        if (!club.facultyAdvisor) {
            return res.status(400).json({
                error: 'This club does not have a Faculty Advisor yet. Applications can only be submitted once an FA is assigned.',
            });
        }

        // Block duplicate pending applications
        const existing = await ClubOfficerRequest.findOne({
            applicant:     req.user._id,
            club:          clubId,
            requestedRole,
            status:        'pending',
        });
        if (existing) {
            return res.status(400).json({
                error: `You already have a pending application for ${requestedRole} of this club`,
            });
        }

        // Block if the student is already an officer of this club
        const isMember = club.members.find(m => m.userId.toString() === req.user._id.toString());
        if (isMember && ['president', 'secretary'].includes(isMember.clubRole)) {
            return res.status(400).json({
                error: `You are already a ${isMember.clubRole} of ${club.name}`,
            });
        }

        const request = new ClubOfficerRequest({
            applicant:     req.user._id,
            club:          clubId,
            requestedRole,
            statement:     statement || '',
        });
        await request.save();

        const populated = await ClubOfficerRequest.findById(request._id)
            .populate('applicant', 'name email department year')
            .populate('club',      'name facultyAdvisor')
            .lean();

        res.status(201).json(populated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// ─── GET /api/officer-requests/mine — Applicant views their own requests ───────
exports.getMyRequests = async (req, res) => {
    try {
        const requests = await ClubOfficerRequest.find({ applicant: req.user._id })
            .populate('club',       'name')
            .populate('reviewedBy', 'name')
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/officer-requests/pending — FA sees requests for their clubs ──────
exports.getPendingRequests = async (req, res) => {
    try {
        if (req.user.role === 'faculty_advisor') {
            // FA only sees requests for clubs they advise
            const myClubs = await Club.find({ facultyAdvisor: req.user._id }, '_id');
            const clubIds = myClubs.map(c => c._id);

            const { status = 'pending' } = req.query;
            const filter = status === 'all'
                ? { club: { $in: clubIds } }
                : { club: { $in: clubIds }, status };

            const requests = await ClubOfficerRequest.find(filter)
                .populate('applicant', 'name email department year')
                .populate('club',      'name')
                .populate('reviewedBy','name')
                .sort({ createdAt: 1 });

            return res.json(requests);
        }

        if (['principal', 'admin'].includes(req.user.role)) {
            const { status = 'pending' } = req.query;
            const filter = status === 'all' ? {} : { status };
            const requests = await ClubOfficerRequest.find(filter)
                .populate('applicant', 'name email department year')
                .populate('club',      'name facultyAdvisor')
                .populate('reviewedBy','name')
                .sort({ createdAt: 1 });
            return res.json(requests);
        }

        return res.status(403).json({ error: 'Forbidden' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/officer-requests/count — Badge count for FA ─────────────────────
exports.getPendingCount = async (req, res) => {
    try {
        let count = 0;
        if (req.user.role === 'faculty_advisor') {
            const myClubs = await Club.find({ facultyAdvisor: req.user._id }, '_id');
            const clubIds = myClubs.map(c => c._id);
            count = await ClubOfficerRequest.countDocuments({ status: 'pending', club: { $in: clubIds } });
        } else if (['principal', 'admin'].includes(req.user.role)) {
            count = await ClubOfficerRequest.countDocuments({ status: 'pending' });
        }
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /api/officer-requests/:id/approve ────────────────────────────────────
exports.approveRequest = async (req, res) => {
    try {
        const { reviewNote } = req.body;
        const request = await ClubOfficerRequest.findById(req.params.id)
            .populate('applicant')
            .populate('club');

        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'pending') {
            return res.status(400).json({ error: `Request is already ${request.status}` });
        }
        if (!request.applicant) {
            return res.status(400).json({ error: 'Applicant user no longer exists.' });
        }
        if (!request.club) {
            return res.status(400).json({ error: 'The requested club no longer exists.' });
        }

        // Authorisation: FA of that club, or admin/principal
        if (req.user.role === 'faculty_advisor') {
            const isFA = request.club.facultyAdvisor?.toString() === req.user._id.toString();
            if (!isFA) {
                return res.status(403).json({ error: 'You are not the FA for this club' });
            }
        } else if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Only the club FA, admin, or principal can approve' });
        }

        // If role is president, remove any current president from the club first
        const club = request.club;
        if (request.requestedRole === 'president') {
            club.members = club.members.map(m =>
                m.clubRole === 'president' ? { ...m, clubRole: 'member' } : m
            );
        }

        // Add / update applicant in club members
        const existingIdx = club.members.findIndex(
            m => m.userId.toString() === request.applicant._id.toString()
        );
        if (existingIdx >= 0) {
            club.members[existingIdx].clubRole = request.requestedRole;
        } else {
            club.members.push({ userId: request.applicant._id, clubRole: request.requestedRole });
        }
        await club.save();

        // Mark the request approved
        request.status     = 'approved';
        request.reviewNote = reviewNote || '';
        request.reviewedBy = req.user._id;
        request.reviewedAt = new Date();
        await request.save();

        await request.populate([
            { path: 'applicant',  select: 'name email' },
            { path: 'club',       select: 'name' },
            { path: 'reviewedBy', select: 'name' },
        ]);

        res.json({ message: `Approved — ${request.applicant.name} is now ${request.requestedRole} of ${request.club.name}`, request });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /api/officer-requests/:id/reject ─────────────────────────────────────
exports.rejectRequest = async (req, res) => {
    try {
        const { reviewNote } = req.body;
        const request = await ClubOfficerRequest.findById(req.params.id)
            .populate('club');

        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'pending') {
            return res.status(400).json({ error: `Request is already ${request.status}` });
        }

        // Authorisation check
        if (req.user.role === 'faculty_advisor') {
            const isFA = request.club?.facultyAdvisor?.toString() === req.user._id.toString();
            if (!isFA) return res.status(403).json({ error: 'You are not the FA for this club' });
        } else if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Only the club FA, admin, or principal can reject' });
        }

        request.status     = 'rejected';
        request.reviewNote = reviewNote || '';
        request.reviewedBy = req.user._id;
        request.reviewedAt = new Date();
        await request.save();

        await request.populate([
            { path: 'applicant',  select: 'name email' },
            { path: 'club',       select: 'name' },
            { path: 'reviewedBy', select: 'name' },
        ]);

        res.json({ message: 'Application rejected', request });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
