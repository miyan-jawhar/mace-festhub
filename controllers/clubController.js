// controllers/clubController.js — Club CRUD and member management

const Club = require('../models/Club');
const User = require('../models/User');

// ─── GET /api/clubs — List all clubs (public) ─────────────────────────────────
exports.getAllClubs = async (req, res) => {
    try {
        const clubs = await Club.find()
            .populate('facultyAdvisor', 'name email')
            .populate('members.userId', 'name email department year')
            .sort({ name: 1 });
        res.json(clubs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/clubs/:id — Single club ────────────────────────────────────────
exports.getClub = async (req, res) => {
    try {
        const club = await Club.findById(req.params.id)
            .populate('facultyAdvisor', 'name email')
            .populate('members.userId', 'name email department year');
        if (!club) return res.status(404).json({ error: 'Club not found' });
        res.json(club);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /api/clubs — Create club (Principal + Admin) ───────────────────────────
exports.createClub = async (req, res) => {
    try {
        const { name, description, facultyAdvisorId } = req.body;
        if (!name) return res.status(400).json({ error: 'Club name is required' });

        let faId = null;
        if (facultyAdvisorId) {
            const fa = await User.findById(facultyAdvisorId);
            if (!fa) return res.status(404).json({ error: 'User not found' });
            if (fa.role !== 'faculty_advisor') {
                return res.status(400).json({ error: `${fa.name} does not have the Faculty Advisor role. Assign that role first.` });
            }
            faId = fa._id;
        }

        const club = new Club({ name, description, facultyAdvisor: faId });
        await club.save();
        await club.populate('facultyAdvisor', 'name email');
        res.status(201).json(club);
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ error: 'A club with this name already exists' });
        res.status(400).json({ error: err.message });
    }
};

// ─── PUT /api/clubs/:id — Update club name/desc/FA (Principal + Admin) ────────────────
exports.updateClub = async (req, res) => {
    try {
        const { name, description, facultyAdvisorId } = req.body;
        const club = await Club.findById(req.params.id);
        if (!club) return res.status(404).json({ error: 'Club not found' });

        if (name)                club.name        = name;
        if (description !== undefined) club.description = description;

        if (facultyAdvisorId !== undefined) {
            if (!facultyAdvisorId) {
                // Allow clearing the FA
                club.facultyAdvisor = null;
            } else {
                const fa = await User.findById(facultyAdvisorId);
                if (!fa) return res.status(404).json({ error: 'User not found' });
                if (fa.role !== 'faculty_advisor') {
                    return res.status(400).json({ error: `${fa.name} does not have the Faculty Advisor role. Assign that role first.` });
                }
                club.facultyAdvisor = fa._id;
            }
        }

        await club.save();
        await club.populate('facultyAdvisor', 'name email');
        res.json(club);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// ─── POST /api/clubs/:id/members — Add or update a member's role (admin) ─────
exports.upsertMember = async (req, res) => {
    try {
        const { userEmail, clubRole } = req.body;
        const validRoles = ['president', 'secretary', 'member'];
        if (!userEmail) return res.status(400).json({ error: 'userEmail is required' });
        if (!validRoles.includes(clubRole)) return res.status(400).json({ error: 'clubRole must be president | secretary | member' });

        const user = await User.findOne({ email: userEmail.toLowerCase() });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const club = await Club.findById(req.params.id);
        if (!club) return res.status(404).json({ error: 'Club not found' });

        const existing = club.members.find(m => m.userId.toString() === user._id.toString());
        if (existing) {
            existing.clubRole = clubRole;
        } else {
            club.members.push({ userId: user._id, clubRole });
        }
        await club.save();
        await club.populate('members.userId', 'name email department year');
        res.json(club);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── DELETE /api/clubs/:id/members/:userId — Remove member (admin) ────────────
exports.removeMember = async (req, res) => {
    try {
        const club = await Club.findById(req.params.id);
        if (!club) return res.status(404).json({ error: 'Club not found' });

        club.members = club.members.filter(m => m.userId.toString() !== req.params.userId);
        await club.save();
        res.json({ message: 'Member removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/clubs/my — Clubs where logged-in user is an officer ─────────────
exports.getMyClubs = async (req, res) => {
    try {
        const userId = req.user._id;
        const clubs = await Club.find({
            members: { $elemMatch: { userId, clubRole: { $in: ['president', 'secretary'] } } },
        })
            .populate('facultyAdvisor', 'name email')
            .populate('members.userId', 'name email');
        res.json(clubs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
