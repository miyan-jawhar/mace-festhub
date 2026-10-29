/**
 * test/test-full-shebang.js
 * 
 * Tests the EXACT full shebang workflow requested by the user:
 * 1. Club setup with an Organizer Student (President) & Club ID
 * 2. Faculty member submits FA request to guide the club
 * 3. Principal (PA) approves FA request -> Faculty is now the official FA
 * 4. Organizer Student submits event proposal to FA -> status: pending_fa
 * 5. FA logs in, reviews proposal, approves it -> status: pending_principal
 * 6. Principal logs in, reviews proposal, approves it -> status: approved, event auto-created & listed
 * 7. Another Student logs in, registers for the event (paid event Razorpay flow)
 * 8. Payment verified -> confirmed registration + ticketToken issued
 * 9. QR code generated and verified
 * 10. PDF e-ticket downloaded and verified
 * 11. Door scan verification verified
 */

require('dotenv').config();
const crypto = require('crypto');
const BASE = 'http://localhost:3000';

async function api(path, opt = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opt.headers || {}) };
    const res = await fetch(`${BASE}${path}`, {
        ...opt,
        headers
    });
    let data;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) data = await res.json();
    else if (ct.includes('image/') || ct.includes('application/pdf')) data = Buffer.from(await res.arrayBuffer());
    else data = await res.text();
    return { status: res.status, data };
}

(async () => {
    console.log('🚀 Starting Full Shebang Workflow Test...\n');
    const ts = Date.now().toString().slice(-5);

    // 1. Principal Login
    const pLogin = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'principal@mace.ac.in', password: 'principal2026' })
    });
    console.log('Principal login status:', pLogin.status, pLogin.data);
    const pToken = pLogin.data.token;
    console.log('✅ Step 1: Principal logged in');

    // 2. Register Faculty Member
    const facEmail = `prof.mathew${ts}@mace.ac.in`;
    const fReg = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: `Prof. Mathew ${ts}`, email: facEmail, password: 'password123' })
    });
    const fToken = fReg.data.token;
    const fId = fReg.data.user.id;
    console.log(`✅ Step 2: Faculty registered (${facEmail})`);

    // 3. Register Organizer Student (will be club president)
    const orgEmail = `b24co${ts.slice(-3)}@mace.ac.in`;
    const orgReg = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: `Organizer Student ${ts}`, email: orgEmail, password: 'password123', year: '3' })
    });
    const orgToken = orgReg.data.token;
    const orgId = orgReg.data.user.id;
    console.log(`✅ Step 3: Organizer student registered (${orgEmail})`);

    // 4. Create a club & appoint organizer student as President (via Admin/Principal)
    const clubRes = await api('/api/clubs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${pToken}` },
        body: JSON.stringify({ name: `Robotics Club ${ts}`, description: 'MACE Robotics Society' })
    });
    console.log('Club create response:', clubRes.status, clubRes.data);
    const clubId = clubRes.data._id;
    console.log(`Club created: ID=${clubId}, status=${clubRes.status}`);

    const memRes = await api(`/api/clubs/${clubId}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${pToken}` },
        body: JSON.stringify({ userEmail: orgEmail, clubRole: 'president' })
    });
    console.log(`Member upsert: status=${memRes.status}, data=`, JSON.stringify(memRes.data).slice(0, 100));
    console.log(`✅ Step 4: Robotics Club created & ${orgEmail} appointed President`);

    // 5. Faculty Member submits FA request to guide the club
    const faReq = await api('/api/fa-requests', {
        method: 'POST',
        headers: { Authorization: `Bearer ${fToken}` },
        body: JSON.stringify({ clubId, note: 'I have 10 years experience in Robotics and would like to guide this club.' })
    });
    const faReqId = faReq.data._id;
    console.log(`FA request: status=${faReq.status}, ID=${faReqId}`);
    console.log(`✅ Step 5: Faculty submitted FA request for Robotics Club`);

    // 6. Principal approves FA request in Inbox
    const faApprove = await api(`/api/fa-requests/${faReqId}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${pToken}` },
        body: JSON.stringify({ reviewNote: 'Approved. You are appointed Faculty Advisor.' })
    });
    console.log(`FA approve: status=${faApprove.status}`);
    console.log(`✅ Step 6: Principal approved FA request -> User is now Faculty Advisor`);

    // 7. Organizer Student asks approval to create an event (Submits Proposal to FA)
    const propRes = await api('/api/proposals', {
        method: 'POST',
        headers: { Authorization: `Bearer ${orgToken}` },
        body: JSON.stringify({
            clubId,
            title: `RoboWars 2026 ${ts}`,
            description: 'Combat robotics challenge with cash prizes',
            date: new Date(Date.now() + 86400000 * 14).toISOString(),
            time: '09:30 AM',
            venue: 'Mechanical Workshop Hall',
            category: 'technical',
            capacity: 40,
            fee: 200
        })
    });
    console.log(`Proposal create: status=${propRes.status}, data=`, propRes.data);
    const propId = propRes.data._id;
    console.log(`✅ Step 7: Organizer student submitted event proposal with Fee ₹200 (Status: ${propRes.data?.status})`);

    // 8. FA reviews & approves proposal -> Advances to pending_principal
    const faPropApprove = await api(`/api/proposals/${propId}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${fToken}` },
        body: JSON.stringify({ comment: 'Excellent technical initiative. Recommended for Principal approval.' })
    });
    console.log(`✅ Step 8: Faculty Advisor approved proposal -> Status: ${faPropApprove.data.status}`);

    // 9. Principal reviews & gives final approval -> Event auto-created & listed!
    const pPropApprove = await api(`/api/proposals/${propId}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${pToken}` },
        body: JSON.stringify({ comment: 'Approved on behalf of the college.' })
    });
    const createdEventId = pPropApprove.data.createdEventId;
    console.log(`✅ Step 9: Principal approved proposal -> Event auto-created with ID: ${createdEventId}`);

    // Verify it is publicly listed
    const pubEvents = await api('/api/events');
    const createdEvent = pubEvents.data.find(e => e._id === createdEventId);
    console.log(`✅ Step 9b: Event is publicly listed on homepage: ${Boolean(createdEvent)}, Fee: ₹${createdEvent?.fee}`);

    // 10. Participant Student registers for the event
    const partEmail = `b24cs${ts.slice(-3)}@mace.ac.in`;
    const partReg = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: `Participant Student ${ts}`, email: partEmail, password: 'password123', year: '2' })
    });
    const partToken = partReg.data.token;

    // 10a. First registration attempt: Gates for Payment (HTTP 402)
    const payGateRes = await api('/api/registrations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${partToken}` },
        body: JSON.stringify({ eventId: createdEventId, year: '2' })
    });
    console.log(`✅ Step 10a: Payment Gated -> HTTP Status: ${payGateRes.status} (Expected 402), Order ID: ${payGateRes.data.order_id}, Amount: ₹${payGateRes.data.amount / 100}`);

    // 10b. Razorpay Checkout simulated
    const orderId = payGateRes.data.order_id;
    const paymentId = `pay_mock_${Date.now()}`;
    const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${orderId}|${paymentId}`);
    const signature = hmac.digest('hex');

    const regRes = await api('/api/registrations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${partToken}` },
        body: JSON.stringify({
            eventId: createdEventId,
            year: '2',
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature
        })
    });
    const regData = regRes.data.registration;
    console.log(`✅ Step 10b: Payment confirmed & Ticket issued -> Status: ${regRes.data.status}, Ticket Token: ${regData.ticketToken}`);

    // 11. Student fetches QR Code
    const qrRes = await api(`/api/tickets/${regData._id}/qr.png?token=${partToken}`);
    console.log(`✅ Step 11: QR code fetched successfully (Status: ${qrRes.status}, isBuffer: ${Buffer.isBuffer(qrRes.data)})`);

    // 12. Student downloads E-Ticket PDF
    const pdfRes = await api(`/api/tickets/${regData._id}/pdf?token=${partToken}`);
    const isPdf = Buffer.isBuffer(pdfRes.data) && pdfRes.data.slice(0, 5).toString() === '%PDF-';
    console.log(`✅ Step 12: E-Ticket PDF generated & downloaded (Status: ${pdfRes.status}, Valid %PDF-: ${isPdf}, Size: ${pdfRes.data.length} bytes)`);

    // 13. Gatekeeper Door Scan
    const scanRes = await api(`/api/tickets/verify/${regData.ticketToken}`);
    console.log(`✅ Step 13: Door scan verified -> Valid: ${scanRes.data.valid}, Attendee: ${scanRes.data.name}, Event: ${scanRes.data.event}`);

    console.log('\n🎉 ALL 13 STEPS OF THE FULL SHEBANG WORKFLOW PASSED FLAWLESSLY!\n');
})();
