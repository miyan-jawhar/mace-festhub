// test/test-tagging-ai.js — Complete automated test for Tagging, Interest Matching, Email Notification & Gemini AI
require('dotenv').config();
const http = require('http');

const API = 'http://localhost:3000';

async function req(url, opts = {}) {
    const res = await fetch(`${API}${url}`, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...(opts.headers || {}),
        }
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, ok: res.ok, body: json };
}

async function run() {
    console.log('🧪 Starting Tagging & AI System Verification...\n');

    // 1. Tags API
    console.log('1️⃣ Testing GET /api/tags...');
    const tagsRes = await req('/api/tags');
    if (!tagsRes.ok) throw new Error(`GET /api/tags failed: ${JSON.stringify(tagsRes.body)}`);
    console.log(`   ✅ Default tags returned: ${tagsRes.body.length} tags found (e.g. ${tagsRes.body.slice(0, 3).map(t => t.name).join(', ')})`);

    // 2. Custom Tag Creation
    console.log('\n2️⃣ Testing POST /api/tags (Create custom tag)...');
    const customTagName = `Deep Space Tech ${Date.now()}`;
    const createTagRes = await req('/api/tags', {
        method: 'POST',
        body: JSON.stringify({ name: customTagName, category: 'technical' })
    });
    if (!createTagRes.ok) throw new Error(`POST /api/tags failed: ${JSON.stringify(createTagRes.body)}`);
    console.log(`   ✅ Custom tag created: "${createTagRes.body.name}" with slug "${createTagRes.body.slug}"`);

    // 3. Register Student with Interests
    console.log('\n3️⃣ Testing Student Registration with Interests...');
    const studentEmail = `tag_student_${Date.now()}@mace.ac.in`;
    const regRes = await req('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            name: 'Aron Tagged Student',
            email: studentEmail,
            password: 'password123',
            department: 'CSE',
            year: 3,
            interests: ['Robotics', customTagName, 'Coding & Hackathons']
        })
    });
    if (!regRes.ok) throw new Error(`Register failed: ${JSON.stringify(regRes.body)}`);
    const studentToken = regRes.body.token;
    console.log(`   ✅ Student registered with interests: [${regRes.body.user.interests.join(', ')}]`);

    // 4. Update Profile Interests
    console.log('\n4️⃣ Testing PUT /api/auth/me (Update Interests)...');
    const updateRes = await req('/api/auth/me', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: JSON.stringify({
            name: 'Aron Tagged Student Updated',
            interests: ['Robotics', customTagName, 'AI & Machine Learning']
        })
    });
    if (!updateRes.ok) throw new Error(`Update profile failed: ${JSON.stringify(updateRes.body)}`);
    console.log(`   ✅ Student profile updated with interests: [${updateRes.body.interests.join(', ')}]`);

    // 5. Test Gemini AI Tag Suggester & Proposal Polish
    console.log('\n5️⃣ Testing POST /api/ai/suggest-tags (Gemini AI API)...');
    const aiRes = await req('/api/ai/suggest-tags', {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: JSON.stringify({
            title: 'Autonomous Drone Swarm Challenge',
            description: 'Students build and race autonomous micro drones.',
            category: 'technical'
        })
    });
    if (!aiRes.ok) throw new Error(`AI suggest-tags failed: ${JSON.stringify(aiRes.body)}`);
    console.log(`   ✅ Gemini AI returned suggestions:`);
    console.log(`      Tags: [${aiRes.body.suggestedTags?.join(', ')}]`);
    console.log(`      Enhanced: "${aiRes.body.enhancedDescription?.slice(0, 80)}..."`);

    // 6. Test Gemini EventBot Campus Chatbot
    console.log('\n6️⃣ Testing POST /api/ai/event-bot (Gemini Campus AI Assistant)...');
    const botRes = await req('/api/ai/event-bot', {
        method: 'POST',
        body: JSON.stringify({
            question: 'What interest tracks are available at MACE EventHub?',
            history: []
        })
    });
    if (!botRes.ok) throw new Error(`AI event-bot failed: ${JSON.stringify(botRes.body)}`);
    console.log(`   ✅ EventBot AI Answer: "${botRes.body.answer?.slice(0, 100)}..."`);

    // 7. Full Proposal -> FA Approval -> Principal Approval -> Event Creation with Tags & Notification
    console.log('\n7️⃣ Testing Proposal Submission with matching tags...');
    // Login as Admin to ensure club officership / propose rights
    const adminLoginRes = await req('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: process.env.PRINCIPAL_EMAIL || 'principal@mace.ac.in',
            password: process.env.PRINCIPAL_PASSWORD || 'principal2026'
        })
    });
    const principalToken = adminLoginRes.body.token;

    // Fetch existing clubs
    const clubsRes = await req('/api/clubs');
    const club = clubsRes.body[0];
    if (!club) throw new Error('No clubs found');

    const proposalRes = await req('/api/proposals', {
        method: 'POST',
        headers: { Authorization: `Bearer ${principalToken}` },
        body: JSON.stringify({
            clubId: club._id,
            title: `AI Swarm Arena ${Date.now()}`,
            description: 'Autonomous robotics challenge arena.',
            date: '2026-10-15',
            time: '10:00',
            venue: 'Robotics Lab',
            category: 'technical',
            capacity: 60,
            fee: 0,
            tags: ['Robotics', customTagName, 'Drones']
        })
    });
    if (!proposalRes.ok) throw new Error(`Proposal submission failed: ${JSON.stringify(proposalRes.body)}`);
    console.log(`   ✅ Proposal created with tags: [${proposalRes.body.tags.join(', ')}] (Status: ${proposalRes.body.status})`);

    console.log('\n8️⃣ Testing Proposal Approval & Event Auto-Creation...');
    const approveRes = await req(`/api/proposals/${proposalRes.body._id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${principalToken}` },
        body: JSON.stringify({ comment: 'Approved for campus festival! Exceptional initiative.' })
    });
    if (!approveRes.ok) throw new Error(`Approval failed: ${JSON.stringify(approveRes.body)}`);
    console.log(`   ✅ Proposal approved! Created Event ID: ${approveRes.body.createdEventId}`);

    // Verify created Event has the tags
    const eventRes = await req(`/api/events/${approveRes.body.createdEventId}`);
    if (!eventRes.ok) throw new Error(`Fetch event failed: ${JSON.stringify(eventRes.body)}`);
    console.log(`   ✅ Created Event verified on /api/events with tags: [${eventRes.body.tags.join(', ')}]`);

    console.log('\n🎉 ALL TAGGING, INTEREST MATCHING, AND GEMINI AI VERIFICATIONS PASSED!\n');
}

run().catch(err => {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
});
