/**
 * seed.js — Wipe and re-seed the database with demo-ready data.
 *
 * Creates events in every state so ALL features are immediately visible:
 *   - Open events (Register Now button)
 *   - Almost-full event (shows "X seats left" warning)
 *   - FULL event with people on waitlist (Join Waitlist button visible)
 *   - Past event (Event Ended, button disabled)
 *
 * Also creates demo user accounts:
 *   - admin@mace.ac.in / admin2026
 *   - student1: b24co013@mace.ac.in / student123  (confirmed registration)
 *   - student2: b24co018@mace.ac.in / student123  (waitlisted)
 *   - student3: b24co052@mace.ac.in / student123  (open registration)
 *
 * Run: node seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const User         = require('./models/User');
const Event        = require('./models/Event');
const Registration = require('./models/Registration');
const { generateTicketToken } = require('./utils/ticketService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mace_festhub';

// ── Helpers ──────────────────────────────────────────────────────────────────
const future = (daysFromNow, hour = 9) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, 0, 0, 0);
    return d;
};
const past = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(10, 0, 0, 0);
    return d;
};

async function seed() {
    console.log('\n🌱  Connecting to MongoDB…');
    await mongoose.connect(MONGO_URI);
    console.log('✅  Connected.\n');

    // ── Wipe collections ──────────────────────────────────────────────────────
    await Promise.all([
        User.deleteMany({ role: { $in: ['student', 'admin'] }, email: { $ne: 'principal@mace.ac.in' } }),
        Event.deleteMany({}),
        Registration.deleteMany({}),
    ]);
    console.log('🗑   Cleared existing events, registrations, and non-principal users.\n');

    // ── Users ─────────────────────────────────────────────────────────────────
    const hash = (pw) => bcrypt.hashSync(pw, 10);

    const [admin, s1, s2, s3, s4, s5] = await User.insertMany([
        {
            name: 'Site Admin', email: 'admin@mace.ac.in', password: hash('admin2026'),
            role: 'admin', department: 'Administration', year: '4',
        },
        {
            name: 'Arjun Krishnan', email: 'b24co013@mace.ac.in', password: hash('student123'),
            role: 'student', department: 'CSE (Data Science)', year: '1', phone: '9876543210',
        },
        {
            name: 'Sneha Nair', email: 'b24co018@mace.ac.in', password: hash('student123'),
            role: 'student', department: 'CSE (Data Science)', year: '1', phone: '9876543211',
        },
        {
            name: 'Rahul Menon', email: 'b24co052@mace.ac.in', password: hash('student123'),
            role: 'student', department: 'CSE (Data Science)', year: '1',
        },
        {
            name: 'Priya Suresh', email: 'b23ec021@mace.ac.in', password: hash('student123'),
            role: 'student', department: 'Electronics & Communication', year: '2',
        },
        {
            name: 'Arun Kumar', email: 'b23me045@mace.ac.in', password: hash('student123'),
            role: 'student', department: 'Mechanical Engineering', year: '2',
        },
    ]);
    console.log('👤  Created users:');
    console.log('    admin@mace.ac.in           / admin2026');
    console.log('    b24co013@mace.ac.in        / student123  (Arjun Krishnan)');
    console.log('    b24co018@mace.ac.in        / student123  (Sneha Nair)');
    console.log('    b24co052@mace.ac.in        / student123  (Rahul Menon)');
    console.log('    b23ec021@mace.ac.in        / student123  (Priya Suresh)');
    console.log('    b23me045@mace.ac.in        / student123  (Arun Kumar)\n');

    // ── Events ────────────────────────────────────────────────────────────────
    // 1. OPEN — plenty of seats (Register Now, no warnings)
    const e_open = await Event.create({
        name:        'MACE Hackathon 2026',
        description: 'A 24-hour hackathon for all branches. Build solutions to real-world problems. Teams of 2–4. Winners get cash prizes and internship referrals.',
        date:        future(14),
        venue:       'Main Seminar Hall',
        category:    'technical',
        capacity:    60,
        confirmedCount: 18,
        waitlistCount:  0,
        eventUrl:    'https://mace.ac.in',
    });

    // 2. ALMOST FULL — 3 seats left (shows "3 seats left" amber warning)
    const e_almostFull = await Event.create({
        name:        'Web Dev Bootcamp',
        description: 'Hands-on full-stack workshop covering React, Node.js and MongoDB. Bring your laptop.',
        date:        future(7),
        venue:       'CS Lab 3',
        category:    'workshop',
        capacity:    20,
        confirmedCount: 17,
        waitlistCount:  0,
    });

    // 3. FULL + WAITLIST — shows "Join Waitlist" button; has 3 people waitlisted
    const e_full = await Event.create({
        name:        'Sanskriti Cultural Fest',
        description: 'Annual inter-college cultural extravaganza. Dance, music, drama, and fine arts competitions. Open to all MACE students.',
        date:        future(21),
        venue:       'Open Air Auditorium',
        category:    'cultural',
        capacity:    5,   // deliberately small so it fills up
        confirmedCount: 5,
        waitlistCount:  3,
        eventUrl:    'https://mace.ac.in',
    });

    // 4. ANOTHER OPEN — sports
    const e_sports = await Event.create({
        name:        'Inter-Dept Cricket Tournament',
        description: 'Annual cricket tournament between departments. Teams of 11. Register your department team.',
        date:        future(10),
        venue:       'MACE Cricket Ground',
        category:    'sports',
        capacity:    80,
        confirmedCount: 24,
        waitlistCount:  0,
    });

    // 5. PAST — "Event Ended" state visible
    const e_past = await Event.create({
        name:        'AI & ML Seminar',
        description: 'Introduction to Artificial Intelligence and Machine Learning. Guest lectures by industry experts.',
        date:        past(3),
        venue:       'Seminar Hall B',
        category:    'technical',
        capacity:    30,
        confirmedCount: 28,
        waitlistCount:  0,
    });

    console.log('📅  Created events:');
    console.log(`    ✅ OPEN         "${e_open.name}"        (${e_open.capacity - e_open.confirmedCount} seats free)`);
    console.log(`    ⚠️  ALMOST FULL  "${e_almostFull.name}"       (3 seats left — amber warning)`);
    console.log(`    🔴 FULL+WAITLIST "${e_full.name}"   (Join Waitlist button)`);
    console.log(`    ✅ OPEN         "${e_sports.name}" (${e_sports.capacity - e_sports.confirmedCount} seats free)`);
    console.log(`    🏁 PAST         "${e_past.name}"         (Event Ended — button disabled)\n`);

    // ── Registrations — confirmed seats for the FULL event ────────────────────
    // These fill the capacity=5 event so the 6th person onward goes to waitlist
    const confirmedEmails = [
        { name: 'Arjun Krishnan', email: 'b24co013@mace.ac.in', year: '1', dept: 'CSE (DS)', uid: s1._id },
        { name: 'Test User A',    email: 'test.a@mace.ac.in',   year: '2', dept: 'ECE',      uid: null },
        { name: 'Test User B',    email: 'test.b@mace.ac.in',   year: '3', dept: 'MECH',     uid: null },
        { name: 'Test User C',    email: 'test.c@mace.ac.in',   year: '1', dept: 'CIVIL',    uid: null },
        { name: 'Test User D',    email: 'test.d@mace.ac.in',   year: '2', dept: 'EEE',      uid: null },
    ];
    const waitlistedEmails = [
        { name: 'Sneha Nair',   email: 'b24co018@mace.ac.in', year: '1', dept: 'CSE (DS)', uid: s2._id, pos: 1 },
        { name: 'Priya Suresh', email: 'b23ec021@mace.ac.in', year: '2', dept: 'ECE',      uid: s4._id, pos: 2 },
        { name: 'Arun Kumar',   email: 'b23me045@mace.ac.in', year: '2', dept: 'MECH',     uid: s5._id, pos: 3 },
    ];

    await Registration.insertMany([
        // Confirmed in full event
        ...confirmedEmails.map(r => ({
            eventId: e_full._id, name: r.name, email: r.email,
            year: r.year, department: r.dept, status: 'confirmed',
            userId: r.uid, registeredAt: new Date(Date.now() - 86400000),
            ticketToken: generateTicketToken(),
        })),
        // Waitlisted in full event
        ...waitlistedEmails.map(r => ({
            eventId: e_full._id, name: r.name, email: r.email,
            year: r.year, department: r.dept, status: 'waitlisted',
            waitlistPosition: r.pos, userId: r.uid,
            registeredAt: new Date(Date.now() - 43200000),
        })),
        // Arjun also registered in the open hackathon (confirmed)
        {
            eventId: e_open._id, name: 'Arjun Krishnan', email: 'b24co013@mace.ac.in',
            year: '1', department: 'CSE (DS)', status: 'confirmed',
            userId: s1._id, registeredAt: new Date(), ticketToken: generateTicketToken(),
        },
        // Rahul in the sports event
        {
            eventId: e_sports._id, name: 'Rahul Menon', email: 'b24co052@mace.ac.in',
            year: '1', department: 'CSE (DS)', status: 'confirmed',
            userId: s3._id, registeredAt: new Date(), ticketToken: generateTicketToken(),
        },
    ]);

    console.log('📝  Created registrations:');
    console.log('    Sanskriti Cultural Fest: 5 confirmed + 3 waitlisted');
    console.log('    MACE Hackathon: Arjun (b24co013) confirmed');
    console.log('    Cricket Tournament: Rahul (b24co052) confirmed\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅  Seed complete! Open http://localhost:3000 to demo:');
    console.log('');
    console.log('  Homepage shows:');
    console.log('    • "Register Now"    → MACE Hackathon, Cricket Tournament');
    console.log('    • "3 seats left"    → Web Dev Bootcamp (amber bar)');
    console.log('    • "Join Waitlist"   → Sanskriti Cultural Fest (red/full)');
    console.log('    • "Event Ended"     → AI & ML Seminar (disabled button)');
    console.log('');
    console.log('  Login credentials:');
    console.log('    admin@mace.ac.in     / admin2026     → admin panel');
    console.log('    b24co013@mace.ac.in  / student123    → has confirmed reg + waitlisted');
    console.log('    b24co018@mace.ac.in  / student123    → is waitlisted for Cultural Fest');
    console.log('    b24co052@mace.ac.in  / student123    → fresh student');
    console.log('    principal@mace.ac.in / principal2026 → principal (unchanged)');
    console.log('═══════════════════════════════════════════════════════\n');

    await mongoose.disconnect();
    process.exit(0);
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
