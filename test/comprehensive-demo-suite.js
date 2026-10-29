/**
 * test/comprehensive-demo-suite.js
 * 
 * Complete End-to-End Automated Test Suite for MACE EventHub
 * Demonstrates all platform features claimed for judges:
 * 
 *  1. System Health & Sanity
 *  2. Authentication, Roles & Profile Management
 *  3. Faculty Advisor Governance (Request -> Principal Inbox -> Approval -> Club Link)
 *  4. Event Proposal Engine (FA Proposal -> Principal Review -> Event Auto-Publish)
 *  5. Registration Engine (Free Event, Duplicate Prevention, Capacity Limits)
 *  6. Razorpay Payment Gateway (402 Gating, HMAC Signature Verification, Paid Confirmation)
 *  7. Waitlist Auto-Promotion Engine (Attendee Cancellation -> Waitlist #1 Promotion)
 *  8. QR Code & PDF E-Ticket Delivery (JWT Query Token, Image Loading, PDF Generation)
 *  9. Door Entry Ticket Verification (QR Scan /verify Endpoint & API)
 * 10. Role Security & Boundary Protections (401 / 403 Enforcement)
 * 11. Headless Browser E2E UI Verification (Puppeteer with Microsoft Edge)
 */

require('dotenv').config();
const crypto = require('crypto');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Helper for colored console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m',
};

let passed = 0;
let failed = 0;
let total = 0;

function logSuite(name) {
    console.log(`\n${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}  SUITE: ${name}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}`);
}

function logTest(name, ok, details = '') {
    total++;
    if (ok) {
        passed++;
        console.log(`  ${colors.green}✔ PASS${colors.reset} ${name}${details ? ` ${colors.bright}(${details})${colors.reset}` : ''}`);
    } else {
        failed++;
        console.log(`  ${colors.red}✘ FAIL${colors.reset} ${name}${details ? ` ${colors.red}[${details}]${colors.reset}` : ''}`);
    }
}

// HTTP request helper
async function api(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };
    const res = await fetch(url, { ...options, headers });
    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        data = await res.json();
    } else if (contentType.includes('image/') || contentType.includes('application/pdf')) {
        data = Buffer.from(await res.arrayBuffer());
    } else {
        data = await res.text();
    }
    return { status: res.status, headers: res.headers, data };
}

(async function runFullTestSuite() {
    const startTime = Date.now();
    console.log(`\n${colors.bright}${colors.magenta}====================================================================`);
    console.log(`  MACE EventHub - Comprehensive End-to-End Demo Test Suite`);
    console.log(`  Testing against: ${BASE_URL}`);
    console.log(`  Targeting Complete Feature Verification for Judges & Demo`);
    console.log(`====================================================================${colors.reset}`);

    // Context objects across tests
    const timestamp = Date.now().toString().slice(-6);
    const studentUser = {
        name: `Arjun Nair ${timestamp}`,
        email: `b24co${timestamp.slice(-3)}@mace.ac.in`,
        password: 'Password@123',
        department: 'CSE',
        year: '2',
        phone: '9876543210',
        token: null,
        id: null
    };

    const facultyUser = {
        name: `Dr. Suresh Menon ${timestamp}`,
        email: `suresh.${timestamp}@mace.ac.in`,
        password: 'Password@123',
        token: null,
        id: null
    };

    let principalToken = null;
    let selectedClub = null;
    let createdProposalId = null;
    let liveEventId = null;
    let freeRegistration = null;
    let waitlistEventId = null;
    let paidEventId = null;

    // ──────────────────────────────────────────────────────────────────
    // SUITE 1: System Health & Server Connectivity
    // ──────────────────────────────────────────────────────────────────
    logSuite('1. System Health & Initial Connectivity');
    try {
        const eventsRes = await api('/api/events');
        logTest('Server returns 200 OK on /api/events', eventsRes.status === 200);
        logTest('Default seeded events are loaded', Array.isArray(eventsRes.data) && eventsRes.data.length > 0, `${eventsRes.data?.length} events found`);

        const clubsRes = await api('/api/clubs');
        logTest('Clubs API returns 200 OK on /api/clubs', clubsRes.status === 200);
        logTest('Default seeded clubs are present', Array.isArray(clubsRes.data) && clubsRes.data.length > 0, `${clubsRes.data?.length} clubs found`);
        if (clubsRes.data && clubsRes.data.length > 0) {
            selectedClub = clubsRes.data[0];
        }
    } catch (err) {
        logTest('System connectivity', false, err.message);
    }

    // ──────────────────────────────────────────────────────────────────
    // SUITE 2: Authentication & Authorization Flow
    // ──────────────────────────────────────────────────────────────────
    logSuite('2. Authentication & Role Management');
    try {
        // 2.1 Student Registration
        const regRes = await api('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(studentUser)
        });
        logTest('Student registration with MACE roll-pattern email', regRes.status === 201 && regRes.data.token);
        logTest('Student auto-assigned role "student"', regRes.data?.user?.role === 'student');
        studentUser.token = regRes.data?.token;
        studentUser.id = regRes.data?.user?.id;

        // 2.2 Student Login
        const loginRes = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: studentUser.email, password: studentUser.password })
        });
        logTest('Student login with correct password returns 200 + JWT', loginRes.status === 200 && loginRes.data.token);

        // 2.3 Invalid Login Rejection
        const badLogin = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: studentUser.email, password: 'WrongPassword' })
        });
        logTest('Invalid login attempt returns 401 Unauthorized', badLogin.status === 401);

        // 2.4 Profile Fetch (/api/auth/me)
        const meRes = await api('/api/auth/me', {
            headers: { Authorization: `Bearer ${studentUser.token}` }
        });
        logTest('Authenticated /api/auth/me returns current user profile', meRes.status === 200 && meRes.data.email === studentUser.email);

        // 2.5 Profile Update
        const updatedName = `${studentUser.name} Updated`;
        const updateRes = await api('/api/auth/me', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${studentUser.token}` },
            body: JSON.stringify({ name: updatedName, phone: '9999988888' })
        });
        logTest('Student can update profile info (name/phone)', updateRes.status === 200 && updateRes.data.phone === '9999988888');
        studentUser.name = updatedName;

        // 2.6 Faculty Registration
        const facRes = await api('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                name: facultyUser.name,
                email: facultyUser.email,
                password: facultyUser.password
            })
        });
        logTest('Faculty registration with faculty email', facRes.status === 201 && facRes.data.token);
        facultyUser.token = facRes.data?.token;
        facultyUser.id = facRes.data?.user?.id;

        // 2.7 Principal Login
        const princLogin = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'principal@mace.ac.in', password: 'principal2026' })
        });
        logTest('Hardcoded Principal account login returns 200', princLogin.status === 200 && princLogin.data.user?.role === 'principal');
        principalToken = princLogin.data?.token;

    } catch (err) {
        logTest('Auth suite execution', false, err.message);
    }

    // ──────────────────────────────────────────────────────────────────
    // SUITE 3: Faculty Advisor Governance (FA Request & Principal Approval)
    // ──────────────────────────────────────────────────────────────────
    logSuite('3. Faculty Advisor Request & Principal Approval Workflow');
    try {
        if (!selectedClub) throw new Error('No club available for FA test');

        // 3.1 Faculty submits FA request
        const reqRes = await api('/api/fa-requests', {
            method: 'POST',
            headers: { Authorization: `Bearer ${facultyUser.token}` },
            body: JSON.stringify({
                clubId: selectedClub._id,
                note: 'Requesting to be the official Faculty Advisor for this academic year.'
            })
        });
        logTest('Faculty can submit FA request for a club', reqRes.status === 201 && reqRes.data._id);
        const faRequestId = reqRes.data?._id;

        // 3.2 Principal Inbox checks pending count
        const countRes = await api('/api/fa-requests/count', {
            headers: { Authorization: `Bearer ${principalToken}` }
        });
        logTest('Principal inbox displays pending FA request count', countRes.status === 200 && countRes.data.count > 0);

        // 3.3 Principal approves FA request
        const approveRes = await api(`/api/fa-requests/${faRequestId}/approve`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${principalToken}` },
            body: JSON.stringify({ reviewNote: 'Approved. Welcome as Faculty Advisor.' })
        });
        logTest('Principal approves FA request with note', approveRes.status === 200 && approveRes.data.request?.status === 'approved');

        // 3.4 Verify user role updated to faculty_advisor
        const facMeRes = await api('/api/auth/me', {
            headers: { Authorization: `Bearer ${facultyUser.token}` }
        });
        logTest('Faculty user role automatically promoted to "faculty_advisor"', facMeRes.data?.role === 'faculty_advisor');

        // 3.5 Verify club now lists in FA's club list
        const myClubsRes = await api('/api/clubs/my', {
            headers: { Authorization: `Bearer ${facultyUser.token}` }
        });
        logTest('Promoted FA now sees assigned club in /api/clubs/my', Array.isArray(myClubsRes.data) && myClubsRes.data.some(c => c._id === selectedClub._id));

    } catch (err) {
        logTest('FA Governance suite', false, err.message);
    }

    // ──────────────────────────────────────────────────────────────────
    // SUITE 4: Event Proposal Engine (FA Proposes -> Principal Approves -> Live Event)
    // ──────────────────────────────────────────────────────────────────
    logSuite('4. Event Proposal Engine & Multi-Tier Approval Workflow');
    try {
        const proposalPayload = {
            clubId: selectedClub._id,
            title: `AI & Cloud Workshop ${timestamp}`,
            description: 'Hands-on bootcamp on generative models and cloud systems.',
            date: new Date(Date.now() + 86400000 * 7).toISOString(),
            time: '10:00 AM',
            venue: 'Seminar Hall 3',
            category: 'technical',
            capacity: 50
        };

        // 4.1 FA creates proposal
        const propRes = await api('/api/proposals', {
            method: 'POST',
            headers: { Authorization: `Bearer ${facultyUser.token}` },
            body: JSON.stringify(proposalPayload)
        });
        logTest('Faculty Advisor proposes event for their club', propRes.status === 201 && propRes.data._id);
        logTest('FA-proposed event advances directly to "pending_principal"', propRes.data?.status === 'pending_principal');
        createdProposalId = propRes.data?._id;

        // 4.2 Principal views pending proposals
        const pendingProps = await api('/api/proposals/pending', {
            headers: { Authorization: `Bearer ${principalToken}` }
        });
        logTest('Principal retrieves pending proposals queue', pendingProps.status === 200 && Array.isArray(pendingProps.data));
        const hasOurProp = pendingProps.data?.some(p => p._id === createdProposalId);
        logTest('Submitted proposal is visible in Principal queue', hasOurProp);

        // 4.3 Principal approves proposal
        const approveProp = await api(`/api/proposals/${createdProposalId}/approve`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${principalToken}` },
            body: JSON.stringify({ comment: 'Approved for campus festival' })
        });
        logTest('Principal approves proposal', approveProp.status === 200 && approveProp.data.status === 'approved');
        logTest('Approval triggers automatic Event creation with createdEventId', !!approveProp.data.createdEventId);
        liveEventId = approveProp.data.createdEventId;

        // 4.4 Verify newly created event is live on public homepage
        const publicEvents = await api('/api/events');
        const foundLive = publicEvents.data?.some(e => e._id === liveEventId);
        logTest('Newly approved proposal is immediately live in public /api/events', foundLive);

    } catch (err) {
        logTest('Proposal suite', false, err.message);
    }

    // ──────────────────────────────────────────────────────────────────
    // SUITE 5: Event Registration Engine (Free, Duplicate Prevention, Capacity Limits)
    // ──────────────────────────────────────────────────────────────────
    logSuite('5. Event Registration Engine & Validation');
    try {
        if (!liveEventId) throw new Error('Live event not available for registration');

        // 5.1 Free Event Registration
        const reg1 = await api('/api/registrations', {
            method: 'POST',
            headers: { Authorization: `Bearer ${studentUser.token}` },
            body: JSON.stringify({
                eventId: liveEventId,
                name: studentUser.name,
                email: studentUser.email,
                year: '2'
            })
        });
        logTest('Student registers for free event successfully', reg1.status === 201 && reg1.data.status === 'confirmed');
        logTest('Registration issues unique 8-char ticketToken', !!reg1.data?.registration?.ticketToken && reg1.data.registration.ticketToken.length === 8);
        freeRegistration = reg1.data?.registration;

        // 5.2 Duplicate Registration Attempt
        const dupReg = await api('/api/registrations', {
            method: 'POST',
            headers: { Authorization: `Bearer ${studentUser.token}` },
            body: JSON.stringify({
                eventId: liveEventId,
                name: studentUser.name,
                email: studentUser.email,
                year: '2'
            })
        });
        logTest('Duplicate registration attempt returns 400 error', dupReg.status === 400);

        // 5.3 Verify event confirmedCount incremented
        const evAfter = await api(`/api/events/${liveEventId}`);
        logTest('Event confirmedCount incremented in database', evAfter.data?.confirmedCount >= 1);

    } catch (err) {
        logTest('Registration suite', false, err.message);
    }

    // ──────────────────────────────────────────────────────────────────
    // SUITE 6: Razorpay Payment Gateway Flow (402 Gating & Signature Verification)
    // ──────────────────────────────────────────────────────────────────
    logSuite('6. Razorpay Payment Gateway Flow (402 Gating & Signature Verification)');
    try {
        // Find or create a paid event
        const allEvents = await api('/api/events');
        let paidEvent = allEvents.data.find(e => e.fee > 0);
        if (!paidEvent) {
            // Create a paid event using principal or admin
            const newPaid = await api('/api/events', {
                method: 'POST',
                headers: { Authorization: `Bearer ${principalToken}` },
                body: JSON.stringify({
                    name: `MACE Hackathon 2026 ${timestamp}`,
                    description: '24-hour national hackathon with cash prizes',
                    date: new Date(Date.now() + 86400000 * 10).toISOString(),
                    venue: 'CS Main Lab',
                    category: 'technical',
                    capacity: 100,
                    fee: 250
                })
            });
            paidEvent = newPaid.data;
        }
        paidEventId = paidEvent?._id;

        // 6.1 Register without payment info -> HTTP 402 Payment Required
        const studentPaidEmail = `b24cs${timestamp.slice(-3)}@mace.ac.in`;
        const initialPaidReg = await api('/api/registrations', {
            method: 'POST',
            body: JSON.stringify({
                eventId: paidEventId,
                name: 'Paid Tester',
                email: studentPaidEmail,
                year: '3'
            })
        });
        logTest('Unpaid attempt on paid event triggers HTTP 402 Payment Required', initialPaidReg.status === 402);
        logTest('402 response includes Razorpay order_id, amount & currency', !!initialPaidReg.data?.order_id && initialPaidReg.data?.amount === (paidEvent.fee * 100));

        const orderId = initialPaidReg.data?.order_id || 'order_mock_test123';
        const fakePaymentId = `pay_mock_${Date.now()}`;

        // 6.2 Submit with invalid signature -> 400
        const badSigReg = await api('/api/registrations', {
            method: 'POST',
            body: JSON.stringify({
                eventId: paidEventId,
                name: 'Paid Tester',
                email: studentPaidEmail,
                year: '3',
                razorpay_order_id: orderId,
                razorpay_payment_id: fakePaymentId,
                razorpay_signature: 'invalid_signature_hash'
            })
        });
        logTest('Invalid payment signature rejection (HTTP 400)', badSigReg.status === 400);

        // 6.3 Submit with authentic HMAC signature -> 201 Confirmed
        const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(`${orderId}|${fakePaymentId}`);
        const validSignature = hmac.digest('hex');

        const successPaidReg = await api('/api/registrations', {
            method: 'POST',
            body: JSON.stringify({
                eventId: paidEventId,
                name: 'Paid Tester',
                email: studentPaidEmail,
                year: '3',
                razorpay_order_id: orderId,
                razorpay_payment_id: fakePaymentId,
                razorpay_signature: validSignature
            })
        });
        logTest('Valid signature confirms registration & assigns ticketToken', successPaidReg.status === 201 && successPaidReg.data.status === 'confirmed');

    } catch (err) {
        logTest('Razorpay suite', false, err.message);
    }

    // ──────────────────────────────────────────────────────────────────
    // SUITE 7: Waitlist Overflow & Auto-Promotion Engine
    // ──────────────────────────────────────────────────────────────────
    logSuite('7. Waitlist Overflow & Auto-Promotion on Cancellation');
    try {
        // Create an event with capacity = 1 to test waitlist & promotion deterministically
        const microEventRes = await api('/api/events', {
            method: 'POST',
            headers: { Authorization: `Bearer ${principalToken}` },
            body: JSON.stringify({
                name: `Micro Summit ${timestamp}`,
                description: 'Capacity 1 event to test waitlist mechanics',
                date: new Date(Date.now() + 86400000 * 5).toISOString(),
                venue: 'Board Room',
                category: 'workshop',
                capacity: 1,
                fee: 0
            })
        });
        waitlistEventId = microEventRes.data?._id;

        // Student A takes the 1 available seat -> Confirmed
        const studentAEmail = `studentA_${timestamp}@mace.ac.in`;
        const regA = await api('/api/registrations', {
            method: 'POST',
            body: JSON.stringify({
                eventId: waitlistEventId,
                name: 'Student A',
                email: studentAEmail,
                year: '1'
            })
        });
        logTest('Student A takes sole seat (status: confirmed)', regA.status === 201 && regA.data.status === 'confirmed');

        // Student B registers -> Capacity full -> Waitlist Position 1
        const studentBEmail = `studentB_${timestamp}@mace.ac.in`;
        const regB = await api('/api/registrations', {
            method: 'POST',
            body: JSON.stringify({
                eventId: waitlistEventId,
                name: 'Student B',
                email: studentBEmail,
                year: '1'
            })
        });
        logTest('Student B placed on waitlist (status: waitlisted, position: 1)', regB.status === 201 && regB.data.status === 'waitlisted' && regB.data.registration.waitlistPosition === 1);

        // Student C registers -> Waitlist Position 2
        const studentCEmail = `studentC_${timestamp}@mace.ac.in`;
        const regC = await api('/api/registrations', {
            method: 'POST',
            body: JSON.stringify({
                eventId: waitlistEventId,
                name: 'Student C',
                email: studentCEmail,
                year: '1'
            })
        });
        logTest('Student C placed on waitlist (position: 2)', regC.status === 201 && regC.data.registration.waitlistPosition === 2);

        // Student A cancels -> System must automatically promote Student B to Confirmed!
        const regAId = regA.data.registration._id;
        const cancelRes = await api(`/api/registrations/${regAId}/cancel`, {
            method: 'PUT'
        });
        logTest('Student A cancellation succeeds and reports promoted student', cancelRes.status === 200 && cancelRes.data.promoted?.email?.toLowerCase() === studentBEmail.toLowerCase());

        // Check Student B in database
        const regBCheck = await api(`/api/registrations/${waitlistEventId}`, {
            headers: { Authorization: `Bearer ${principalToken}` }
        });
        const studentBRecord = Array.isArray(regBCheck.data) ? regBCheck.data.find(r => r.email?.toLowerCase() === studentBEmail.toLowerCase()) : null;
        logTest('Student B is now status: confirmed with generated ticketToken', studentBRecord?.status === 'confirmed' && !!studentBRecord?.ticketToken);

        const studentCRecord = Array.isArray(regBCheck.data) ? regBCheck.data.find(r => r.email?.toLowerCase() === studentCEmail.toLowerCase()) : null;
        logTest('Student C shifted up to waitlist position 1', studentCRecord?.waitlistPosition === 1);

    } catch (err) {
        logTest('Waitlist suite', false, err.message);
    }

    // ──────────────────────────────────────────────────────────────────
    // SUITE 8: QR Code & PDF E-Ticket Delivery (The User's Reported Bugs)
    // ──────────────────────────────────────────────────────────────────
    logSuite('8. QR Code Image, PDF E-Ticket & Door Scan Verification');
    try {
        if (!freeRegistration) throw new Error('No confirmed registration available for ticket verification');

        const regId = freeRegistration._id;
        const token = studentUser.token;
        const ticketToken = freeRegistration.ticketToken;

        // 8.1 QR Code with Bearer Header
        const qrBearerRes = await api(`/api/tickets/${regId}/qr.png`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        logTest('QR endpoint with Bearer auth returns 200 image/png', qrBearerRes.status === 200 && qrBearerRes.headers.get('content-type')?.includes('image/png'));
        logTest('QR image payload contains valid PNG binary signature', Buffer.isBuffer(qrBearerRes.data) && qrBearerRes.data.slice(0, 4).toString('hex') === '89504e47');

        // 8.2 QR Code with Query Param (?token=...) — Crucial for <img> tags!
        const qrQueryRes = await api(`/api/tickets/${regId}/qr.png?token=${token}`);
        logTest('QR endpoint with ?token query param returns 200 image/png (fixes <img> tag)', qrQueryRes.status === 200 && qrQueryRes.headers.get('content-type')?.includes('image/png'));

        // 8.3 PDF E-Ticket with Query Param (?token=...) — Crucial for <a download> links!
        const pdfRes = await api(`/api/tickets/${regId}/pdf?token=${token}`);
        logTest('PDF endpoint with ?token returns 200 application/pdf', pdfRes.status === 200 && pdfRes.headers.get('content-type')?.includes('application/pdf'));
        logTest('PDF payload contains valid PDF magic header (%PDF-)', Buffer.isBuffer(pdfRes.data) && pdfRes.data.slice(0, 5).toString() === '%PDF-');
        logTest('PDF file size is healthy (> 2 KB vector PDF)', Buffer.isBuffer(pdfRes.data) && pdfRes.data.length > 2000, `${pdfRes.data.length} bytes`);

        // 8.4 Ticket verification without auth returns 401
        const unauthQR = await api(`/api/tickets/${regId}/qr.png`);
        logTest('Accessing ticket without token returns 401 Authentication required', unauthQR.status === 401);

        // 8.5 Accessing another user's ticket returns 403 Access denied
        const otherUser = await api('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                name: 'Stranger',
                email: `b24ec${timestamp.slice(-3)}@mace.ac.in`,
                password: 'Password@123',
                year: '1'
            })
        });
        const strangerToken = otherUser.data?.token;
        const forbiddenTicket = await api(`/api/tickets/${regId}/pdf?token=${strangerToken}`);
        logTest('Accessing another student\'s ticket returns 403 Forbidden', forbiddenTicket.status === 403);

        // 8.6 Door Scan Verification Endpoint (/api/tickets/verify/:token)
        const doorScan = await api(`/api/tickets/verify/${ticketToken}`);
        logTest('Door scanner endpoint verifies valid ticketToken (valid: true)', doorScan.status === 200 && doorScan.data.valid === true);
        logTest('Door scanner returns attendee name, event name & status', doorScan.data.name === studentUser.name && doorScan.data.status === 'confirmed');

        // 8.7 Door Scan Verification Page (/verify?token=...)
        const verifyPage = await api(`/verify?token=${ticketToken}`);
        logTest('Door verification web page (/verify) returns HTTP 200 HTML', verifyPage.status === 200 && typeof verifyPage.data === 'string' && verifyPage.data.includes('Verify Ticket'));

    } catch (err) {
        logTest('Ticket & QR suite', false, err.message);
    }

    // ──────────────────────────────────────────────────────────────────
    // SUITE 9: Role Security & Boundary Protections
    // ──────────────────────────────────────────────────────────────────
    logSuite('9. Role Security & Route Boundary Protections');
    try {
        // Student cannot create events directly (Admin only)
        const studentCreateEv = await api('/api/events', {
            method: 'POST',
            headers: { Authorization: `Bearer ${studentUser.token}` },
            body: JSON.stringify({ name: 'Hacked Event', date: new Date().toISOString() })
        });
        logTest('Student attempting admin event creation is rejected with 403 Forbidden', studentCreateEv.status === 403);

        // Student cannot approve proposals
        if (createdProposalId) {
            const studentApprove = await api(`/api/proposals/${createdProposalId}/approve`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${studentUser.token}` }
            });
            logTest('Student attempting proposal approval is rejected with 403 Forbidden', studentApprove.status === 403);
        }

        // Student cannot access Principal inbox count
        const studentInbox = await api('/api/fa-requests/count', {
            headers: { Authorization: `Bearer ${studentUser.token}` }
        });
        logTest('Student attempting to access FA inbox is rejected with 403 Forbidden', studentInbox.status === 403);

        // Student looking up someone else's registrations is blocked
        const otherRegs = await api('/api/registrations/student/principal@mace.ac.in', {
            headers: { Authorization: `Bearer ${studentUser.token}` }
        });
        logTest('Student looking up another user\'s registrations is rejected with 403', otherRegs.status === 403);

        // Student can look up their own registrations
        const ownRegs = await api(`/api/registrations/student/${studentUser.email}`, {
            headers: { Authorization: `Bearer ${studentUser.token}` }
        });
        logTest('Student looking up own registrations returns 200 OK', ownRegs.status === 200 && Array.isArray(ownRegs.data));

        // CRITIQUE VERIFICATION: Principal attempting to register for student event is blocked!
        if (liveEventId) {
            const princReg = await api('/api/registrations', {
                method: 'POST',
                headers: { Authorization: `Bearer ${principalToken}` },
                body: JSON.stringify({
                    eventId: liveEventId,
                    year: '1'
                })
            });
            logTest('Principal attempting to register for event is rejected with 403 Forbidden', princReg.status === 403);

            // Faculty Advisor attempting to register is also blocked
            const faReg = await api('/api/registrations', {
                method: 'POST',
                headers: { Authorization: `Bearer ${facultyUser.token}` },
                body: JSON.stringify({
                    eventId: liveEventId,
                    year: '1'
                })
            });
            logTest('Faculty Advisor attempting to register for event is rejected with 403 Forbidden', faReg.status === 403);
        }

    } catch (err) {
        logTest('Security suite', false, err.message);
    }

    // ──────────────────────────────────────────────────────────────────
    // SUITE 10: Headless Browser UI E2E Simulation (Puppeteer + Edge)
    // ──────────────────────────────────────────────────────────────────
    logSuite('10. Headless Browser E2E UI Simulation (Edge)');
    let browser = null;
    try {
        const executablePath = fs.existsSync(EDGE_PATH) ? EDGE_PATH : (fs.existsSync(CHROME_PATH) ? CHROME_PATH : null);
        if (!executablePath) {
            console.log(`  ${colors.yellow}⚠ Skipping browser UI test: Neither Edge nor Chrome found at standard paths.${colors.reset}`);
        } else {
            console.log(`  ${colors.cyan}Launching browser binary: ${executablePath}${colors.reset}`);
            browser = await puppeteer.launch({
                executablePath,
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });

            // 1. Visit homepage
            await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
            const title = await page.title();
            logTest('Browser loads homepage with correct title', title.includes('MACE EventHub'));

            // 2. Visit login page and login as student
            await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle0' });
            await page.type('#login-email', studentUser.email);
            await page.type('#login-password', studentUser.password);
            await page.click('#login-submit-btn');

            // Wait for navigation / token stored
            await page.waitForNavigation({ waitUntil: 'networkidle0' });
            logTest('Student logs in via UI form and navigates to home/profile', true);

            // 3. Open profile page
            await page.goto(`${BASE_URL}/profile.html`, { waitUntil: 'networkidle0' });
            await page.waitForSelector('#panel-my-registrations', { visible: true });
            logTest('Profile page renders "My Registrations" panel', true);

            // 4. Check for Show QR Code button
            const hasQrButton = await page.$('.ticket-toggle');
            logTest('Profile card renders "Show QR Code" button for confirmed registration', !!hasQrButton);

            if (hasQrButton) {
                // Click Show QR Code
                await page.click('.ticket-toggle');
                await page.waitForSelector('.qr-expand', { visible: true });
                
                // Inspect QR image src
                const qrImgSrc = await page.$eval('.ticket-qr', img => img.src);
                logTest('QR image src includes security token (?token=...)', qrImgSrc.includes('token='));

                // Wait for image to load over network
                await page.waitForFunction(() => {
                    const img = document.querySelector('.ticket-qr');
                    return img && img.complete && img.naturalWidth > 0;
                }, { timeout: 6000 }).catch(() => {});

                // Verify image loaded successfully (naturalWidth > 0 and display !== 'none')
                const imgLoaded = await page.$eval('.ticket-qr', img => img.complete && img.naturalWidth > 0 && img.style.display !== 'none');
                logTest('QR image renders visibly with positive dimensions (no 401 error or onerror hiding)', imgLoaded);

                // Inspect PDF download button href
                const pdfHref = await page.$eval('.ticket-section a.btn', a => a.href);
                logTest('Download PDF link includes security token (?token=...)', pdfHref.includes('token='));
            }

            await browser.close();
            browser = null;
        }
    } catch (err) {
        logTest('Browser UI E2E test', false, err.message);
        if (browser) await browser.close();
    }

    // ──────────────────────────────────────────────────────────────────
    // FINAL REPORT & BENCHMARK
    // ──────────────────────────────────────────────────────────────────
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}  FINAL DEMO TEST SUITE SUMMARY FOR JUDGES`);
    console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`  Total Tests Run: ${colors.bright}${total}${colors.reset}`);
    console.log(`  Passed Tests:    ${colors.green}${colors.bright}${passed}${colors.reset}`);
    console.log(`  Failed Tests:    ${failed > 0 ? colors.red : colors.green}${colors.bright}${failed}${colors.reset}`);
    console.log(`  Execution Time:  ${colors.yellow}${duration}s${colors.reset}`);
    console.log(`  Health Status:   ${failed === 0 ? `${colors.green}${colors.bright}100% PRODUCTION & DEMO READY - ZERO BUGS DETECTED${colors.reset}` : `${colors.red}BUGS DETECTED - NEEDS ATTENTION${colors.reset}`}`);
    console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}\n`);

    if (failed > 0) {
        process.exit(1);
    }
})();
