// public/js/profile.js — Profile page logic

import {
    getToken, getUser, setUser, requireLogin, renderNavAuth, authHeaders, logout
} from './auth.js';

requireLogin(); // Redirect to /login.html if not logged in
renderNavAuth();

const API  = '';
let currentUser = getUser();

if (!currentUser && getToken()) {
    try {
        const res = await fetch('/api/auth/me', { headers: authHeaders() });
        if (res.ok) {
            currentUser = await res.json();
            setUser(currentUser);
            renderNavAuth();
        } else {
            logout();
        }
    } catch {
        logout();
    }
}

let myClubs     = [];
let actionCallback = null;

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => {
        t.classList.add('hiding');
        t.addEventListener('animationend', () => t.remove());
    }, 3500);
}

function formatDate(d) {
    return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

// ── Sidebar navigation ─────────────────────────────────────────────────────────
document.querySelectorAll('.sidebar-btn[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
});

function switchPanel(panelId) {
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    const target = document.querySelector(`.sidebar-btn[data-panel="${panelId}"]`);
    if (target) target.classList.add('active');
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`panel-${panelId}`)?.classList.add('active');

    // Load data for each panel
    if (panelId === 'my-registrations')    loadMyRegistrations();
    if (panelId === 'manage-profile')      loadProfile();
    if (panelId === 'propose-event')       loadMyClubsForProposal();
    if (panelId === 'my-proposals')        loadMyProposals();
    if (panelId === 'pending-approvals')   loadPendingApprovals();
    if (panelId === 'manage-users')        loadUserManagement();
    if (panelId === 'inbox')               loadInbox();
    if (panelId === 'apply-officer')       loadClubsForOfficerApply();
    if (panelId === 'my-officer-requests') loadMyOfficerRequests();
    if (panelId === 'officer-applications') loadOfficerApplications();
}

// ── Show/hide sidebar sections based on user role ────────────────────────────────
function configureSidebar(user) {
    // Students can apply to become club officers
    if (user.role === 'student') {
        document.getElementById('apply-officer-section').style.display = 'block';
    }
    // Officer section (Propose Event + My Proposals) is ONLY shown to club presidents/secretaries
    // — dynamically revealed by checkOfficerStatus() via /api/clubs/my
    // DO NOT show it here for faculty_advisor: FA approves, they do not propose

    if (['faculty_advisor', 'principal', 'admin'].includes(user.role)) {
        document.getElementById('approver-section').style.display = 'block';
    }
    if (['principal', 'admin'].includes(user.role)) {
        document.getElementById('user-mgmt-section').style.display = 'block';
    }
    if (user.role === 'admin') {
        document.getElementById('admin-shortcut-section').style.display = 'block';
    }
}

// ── Load officer section visibility based on club membership ──────────────────
async function checkOfficerStatus() {
    if (currentUser.role === 'admin') return; // already shown
    try {
        const res = await fetch(`${API}/api/clubs/my`, { headers: authHeaders() });
        if (!res.ok) return;
        myClubs = await res.json();
        if (myClubs.length > 0) {
            document.getElementById('officer-section').style.display = 'block';
        }
    } catch { /* not a club officer — fine */ }
}

// ── My Registrations ──────────────────────────────────────────────────────────
async function loadMyRegistrations() {
    const loadEl  = document.getElementById('my-regs-loading');
    const emptyEl = document.getElementById('my-regs-empty');
    const listEl  = document.getElementById('my-regs-list');
    loadEl.style.display  = 'block';
    emptyEl.style.display = 'none';
    listEl.style.display  = 'none';
    listEl.innerHTML      = '';

    try {
        const email = currentUser.email;
        const res   = await fetch(`${API}/api/registrations/student/${encodeURIComponent(email)}`, {
            headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Failed to load registrations');
        const regs = await res.json();

        if (!regs.length) {
            emptyEl.style.display = 'block';
            return;
        }

        listEl.style.display = 'block';
        listEl.innerHTML = regs.map(r => {
            const ev      = r.eventId;
            const status  = r.status;
            const isConf  = status === 'confirmed';
            const badgeCls = isConf ? 'result-confirmed' : 'result-waitlisted';
            const badgeTxt = isConf ? '✓ Confirmed' : `⏳ Waitlist #${r.waitlistPosition}`;

            const ticketSection = (isConf && r.ticketToken) ? `
              <div class="ticket-section" id="ticket-${r._id}">
                <button class="btn btn-ghost btn-sm ticket-toggle"
                  onclick="toggleQR('${r._id}')" id="qr-toggle-${r._id}">
                  <span>🎫</span> Show QR Code
                </button>
                <div class="qr-expand" id="qr-expand-${r._id}" style="display:none;">
                  <img src="/api/tickets/${r._id}/qr.png?token=${getToken()}"
                       alt="Entry QR Code"
                       class="ticket-qr"
                       loading="lazy"
                       onerror="this.style.display='none'" />
                  <div class="ticket-id-display">
                    <div class="ticket-id-label">Ticket ID</div>
                    <div class="ticket-id-value">${r.ticketToken}</div>
                  </div>
                </div>
                <a href="/api/tickets/${r._id}/pdf?token=${getToken()}"
                   target="_blank"
                   class="btn btn-outline btn-sm"
                   style="color:var(--primary-h); border-color:rgba(124,58,237,.35);">
                  ⬇ Download E-Ticket PDF
                </a>
              </div>` : (status === 'waitlisted'
                ? `<div class="ticket-section"><span style="font-size:.78rem; color:var(--t3);">Ticket issued when you're promoted from waitlist</span></div>`
                : '');

            return `
            <div class="reg-card" id="reg-card-${r._id}">
              <div class="reg-card-info">
                <div>
                  <div class="reg-card-event">${ev?.name || 'Unknown Event'}</div>
                  <div class="reg-card-meta">
                    📅 ${ev ? formatDate(ev.date) : '—'}
                    &nbsp;•&nbsp; 📍 ${ev?.venue || 'TBD'}
                    &nbsp;•&nbsp; 🏷️ ${ev?.category || ''}
                  </div>
                </div>
                <div class="result-badge ${badgeCls}" style="white-space:nowrap;">${badgeTxt}</div>
              </div>
              ${ticketSection}
              <div class="reg-card-actions">
                <button class="btn btn-outline btn-sm"
                  onclick="selfCancel('${r._id}', '${(ev?.name || 'this event').replace(/'/g, "\\'")}')"
                  id="cancel-btn-${r._id}">
                  Cancel Registration
                </button>
              </div>
            </div>`;
        }).join('');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        loadEl.style.display = 'none';
    }
}

// Make selfCancel global so inline onclick works
window.selfCancel = async function(regId, eventName) {
    if (!confirm(`Cancel your registration for "${eventName}"?`)) return;
    try {
        const res  = await fetch(`${API}/api/registrations/${regId}/cancel`, {
            method: 'PUT', headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Cancel failed', 'error'); return; }

        const card = document.getElementById(`reg-card-${regId}`);
        if (card) { card.style.opacity = '0'; setTimeout(() => card.remove(), 300); }

        showToast('Registration cancelled', 'success');
        if (data.promoted) showToast(`🎉 ${data.promoted.name} was promoted from the waitlist`, 'info');

        // Check if list is now empty
        setTimeout(() => {
            const remaining = document.querySelectorAll('.reg-card');
            if (!remaining.length) {
                document.getElementById('my-regs-list').style.display  = 'none';
                document.getElementById('my-regs-empty').style.display = 'block';
            }
        }, 350);
    } catch { showToast('Network error', 'error'); }
};

// ── QR Code toggle ──────────────────────────────────────────────────────
window.toggleQR = function(regId) {
    const expand = document.getElementById(`qr-expand-${regId}`);
    const btn    = document.getElementById(`qr-toggle-${regId}`);
    if (!expand) return;
    const open = expand.style.display === 'none' || expand.style.display === '';
    expand.style.display = open ? 'block' : 'none';
    btn.innerHTML = open
        ? '<span>🎫</span> Hide QR Code'
        : '<span>🎫</span> Show QR Code';
};

// ── Manage Profile ──────────────────────────────────────────────────
let profileInterests = new Set();
async function initProfileInterests(initial) {
    profileInterests = new Set(initial || []);
    const chipsEl = document.getElementById('pf-tag-chips');
    if (!chipsEl) return;

    try {
        const res = await fetch(`${API}/api/tags`);
        const allTags = await res.json();
        const tagNames = Array.from(new Set([
            ...allTags.map(t => t.name),
            ...profileInterests
        ]));

        chipsEl.innerHTML = tagNames.map(name => {
            const active = profileInterests.has(name);
            return `<span class="tag-chip ${active ? 'active' : ''}" data-tag="${name}">
                ${active ? '✓' : '+'} ${name}
            </span>`;
        }).join('');

        chipsEl.querySelectorAll('.tag-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const tag = chip.dataset.tag;
                if (profileInterests.has(tag)) {
                    profileInterests.delete(tag);
                    chip.classList.remove('active');
                    chip.textContent = `+ ${tag}`;
                } else {
                    profileInterests.add(tag);
                    chip.classList.add('active');
                    chip.textContent = `✓ ${tag}`;
                }
            });
        });
    } catch (e) {
        console.warn('Failed to load profile tags:', e);
    }
}

const btnAddPfTag = document.getElementById('btn-add-pf-tag');
const pfNewTagInput = document.getElementById('pf-new-tag-input');
if (btnAddPfTag && pfNewTagInput) {
    const addFn = () => {
        const val = pfNewTagInput.value.trim();
        if (!val) return;
        profileInterests.add(val);
        pfNewTagInput.value = '';
        fetch(`${API}/api/tags`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ name: val })
        }).catch(() => {});
        initProfileInterests(Array.from(profileInterests));
    };
    btnAddPfTag.addEventListener('click', addFn);
    pfNewTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addFn(); }
    });
}

function loadProfile() {
    const u = currentUser;
    document.getElementById('pf-name').value  = u.name        || '';
    document.getElementById('pf-email').value = u.email       || '';
    document.getElementById('pf-phone').value = u.phone       || '';

    // Role badge
    const roleLabels = {
        student:         { label:'Student',          cls:'prop-status-approved' },
        faculty_advisor: { label:'Faculty Advisor',  cls:'prop-status-principal' },
        principal:       { label:'Principal',        cls:'prop-status-rejected' },
        admin:           { label:'Administrator',    cls:'prop-status-rejected' },
    };
    const rl = roleLabels[u.role] || { label: u.role, cls:'' };
    document.getElementById('profile-role-badge').innerHTML =
        `<span class="pill ${rl.cls}" style="font-size:.8rem;">${rl.label}</span>`;

    // Student-only fields: dept, year, interests
    const isStudent = u.role === 'student';
    document.getElementById('pf-dept-group').style.display = isStudent ? '' : 'none';
    document.getElementById('pf-year-group').style.display = isStudent ? '' : 'none';
    const pfInterests = document.getElementById('pf-interests-group');
    if (pfInterests) pfInterests.style.display = isStudent ? '' : 'none';

    if (isStudent) {
        document.getElementById('pf-dept').value = u.department  || '';
        document.getElementById('pf-year').value = u.year        || 'N/A';
        initProfileInterests(u.interests || []);
    }
}

document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name  = document.getElementById('pf-name').value.trim();
    const dept  = document.getElementById('pf-dept').value.trim();
    const year  = document.getElementById('pf-year').value;
    const phone = document.getElementById('pf-phone').value.trim();

    if (!name) { document.getElementById('err-pf-name').textContent = 'Name is required'; return; }
    document.getElementById('err-pf-name').textContent = '';

    const btn  = document.getElementById('save-profile-btn');
    const text = document.getElementById('save-profile-text');
    btn.disabled     = true;
    text.textContent = 'Saving…';

    try {
        const interests = Array.from(profileInterests);
        const res  = await fetch(`${API}/api/auth/me`, {
            method: 'PUT', headers: authHeaders(),
            body: JSON.stringify({ name, department: dept, year, phone, interests }),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Update failed', 'error'); return; }
        setUser({ ...currentUser, ...data });
        currentUser = getUser();
        renderNavAuth(); // Update nav name
        showToast('Profile updated ✓', 'success');
    } catch { showToast('Network error', 'error'); }
    finally {
        btn.disabled     = false;
        text.textContent = 'Save Changes';
    }
});

document.getElementById('pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cur  = document.getElementById('pw-current').value;
    const nw   = document.getElementById('pw-new').value;
    const conf = document.getElementById('pw-confirm').value;

    ['current','new','confirm'].forEach(f => {
        document.getElementById(`err-pw-${f}`).textContent = '';
    });

    let valid = true;
    if (!cur)                { document.getElementById('err-pw-current').textContent = 'Required'; valid = false; }
    if (!nw || nw.length<6) { document.getElementById('err-pw-new').textContent = 'Min 6 characters'; valid = false; }
    if (nw !== conf)         { document.getElementById('err-pw-confirm').textContent = 'Passwords do not match'; valid = false; }
    if (!valid) return;

    const btn = document.getElementById('change-pw-btn');
    btn.disabled = true; btn.textContent = 'Updating…';

    try {
        const res  = await fetch(`${API}/api/auth/me/password`, {
            method: 'PUT', headers: authHeaders(),
            body: JSON.stringify({ currentPassword: cur, newPassword: nw }),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Password update failed', 'error'); return; }
        document.getElementById('pw-form').reset();
        showToast('Password updated ✓', 'success');
    } catch { showToast('Network error', 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Update Password'; }
});

// ── Propose Event ─────────────────────────────────────────────────────────────
let proposalTags = new Set();
async function initProposalTags() {
    const chipsEl = document.getElementById('prop-tag-chips');
    if (!chipsEl) return;
    try {
        const res = await fetch(`${API}/api/tags`);
        const allTags = await res.json();
        const tagNames = Array.from(new Set([
            ...allTags.map(t => t.name),
            ...proposalTags
        ]));

        chipsEl.innerHTML = tagNames.map(name => {
            const active = proposalTags.has(name);
            return `<span class="tag-chip ${active ? 'active' : ''}" data-tag="${name}">
                ${active ? '✓' : '+'} ${name}
            </span>`;
        }).join('');

        chipsEl.querySelectorAll('.tag-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const tag = chip.dataset.tag;
                if (proposalTags.has(tag)) {
                    proposalTags.delete(tag);
                    chip.classList.remove('active');
                    chip.textContent = `+ ${tag}`;
                } else {
                    proposalTags.add(tag);
                    chip.classList.add('active');
                    chip.textContent = `✓ ${tag}`;
                }
            });
        });
    } catch (e) {
        console.warn('Failed to load proposal tags:', e);
    }
}

const btnAddPropTag = document.getElementById('btn-add-prop-tag');
const propNewTagInput = document.getElementById('prop-new-tag-input');
if (btnAddPropTag && propNewTagInput) {
    const addPropFn = () => {
        const val = propNewTagInput.value.trim();
        if (!val) return;
        proposalTags.add(val);
        propNewTagInput.value = '';
        fetch(`${API}/api/tags`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ name: val })
        }).catch(() => {});
        initProposalTags();
    };
    btnAddPropTag.addEventListener('click', addPropFn);
    propNewTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addPropFn(); }
    });
}

// Gemini AI Suggest Tags & Polish
const btnAiSuggest = document.getElementById('btn-ai-suggest-tags');
if (btnAiSuggest) {
    btnAiSuggest.addEventListener('click', async () => {
        const title = document.getElementById('prop-title').value.trim();
        const desc = document.getElementById('prop-desc').value.trim();
        const category = document.getElementById('prop-category').value;
        const aiText = document.getElementById('ai-btn-text');

        if (!title) {
            showToast('Please enter an Event Title first so Gemini can analyze it.', 'warning');
            document.getElementById('prop-title').focus();
            return;
        }

        aiText.textContent = '✨ Gemini thinking…';
        btnAiSuggest.disabled = true;

        try {
            const res = await fetch(`${API}/api/ai/suggest-tags`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ title, description: desc, category })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'AI suggestion failed');

            if (data.enhancedDescription && (!desc || desc.length < data.enhancedDescription.length)) {
                document.getElementById('prop-desc').value = data.enhancedDescription;
            }

            if (data.suggestedTags && data.suggestedTags.length > 0) {
                data.suggestedTags.forEach(t => proposalTags.add(t));
                initProposalTags();
            }

            showToast(`✨ Gemini suggested ${data.suggestedTags?.length || 0} tracks and polished your proposal!`, 'success');
        } catch (err) {
            showToast(`AI Assistant: ${err.message}`, 'error');
        } finally {
            aiText.textContent = '✨ Gemini: Suggest Tags & Polish';
            btnAiSuggest.disabled = false;
        }
    });
}

async function loadMyClubsForProposal() {
    initProposalTags();
    const clubSel = document.getElementById('prop-club');
    clubSel.innerHTML = '<option value="">Loading clubs…</option>';

    try {
        let clubs = [];
        if (currentUser.role === 'admin') {
            const res = await fetch(`${API}/api/clubs`, { headers: authHeaders() });
            clubs = await res.json();
        } else {
            const res = await fetch(`${API}/api/clubs/my`, { headers: authHeaders() });
            clubs = await res.json();
            myClubs = clubs;
        }

        if (!clubs.length) {
            clubSel.innerHTML = '<option value="">No clubs available</option>';
            return;
        }
        clubSel.innerHTML = '<option value="">Select club…</option>' +
            clubs.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
    } catch {
        clubSel.innerHTML = '<option value="">Error loading clubs</option>';
    }
}

document.getElementById('proposal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const clubId   = document.getElementById('prop-club').value;
    const title    = document.getElementById('prop-title').value.trim();
    const desc     = document.getElementById('prop-desc').value.trim();
    const date     = document.getElementById('prop-date').value;
    const time     = document.getElementById('prop-time').value;
    const venue    = document.getElementById('prop-venue').value.trim();
    const category = document.getElementById('prop-category').value;
    const capacity = document.getElementById('prop-capacity').value;
    const fee      = document.getElementById('prop-fee')?.value || 0;

    // Validate
    let valid = true;
    ['club','title','date','cap'].forEach(f => {
        const el = document.getElementById(`err-prop-${f}`);
        if (el) el.textContent = '';
    });
    if (!clubId)   { document.getElementById('err-prop-club').textContent  = 'Select a club'; valid = false; }
    if (!title)    { document.getElementById('err-prop-title').textContent = 'Title is required'; valid = false; }
    if (!date)     { document.getElementById('err-prop-date').textContent  = 'Date is required'; valid = false; }
    if (!capacity) { document.getElementById('err-prop-cap').textContent   = 'Capacity is required'; valid = false; }
    if (!valid) return;

    const btn  = document.getElementById('submit-proposal-btn');
    const text = document.getElementById('proposal-btn-text');
    btn.disabled     = true;
    text.textContent = 'Submitting…';

    try {
        const tags = Array.from(proposalTags);
        const res  = await fetch(`${API}/api/proposals`, {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({
                clubId, title, description: desc, date, time, venue, category,
                capacity: +capacity, fee: +fee || 0, tags
            }),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Submission failed', 'error'); return; }
        document.getElementById('proposal-form').reset();
        proposalTags.clear();
        initProposalTags();
        showToast('Proposal submitted! Awaiting Faculty Advisor review.', 'success');
        switchPanel('my-proposals');
    } catch { showToast('Network error', 'error'); }
    finally {
        btn.disabled     = false;
        text.textContent = 'Submit Proposal';
    }
});

// ── Demo Quick Fill Proposal ──────────────────────────────────────────────────
document.getElementById('demo-fill-proposal')?.addEventListener('click', () => {
    const sel = document.getElementById('prop-club');
    if (sel && sel.options.length) {
        for (let opt of sel.options) {
            if (opt.text.toLowerCase().includes('robotics')) { sel.value = opt.value; break; }
        }
    }
    document.getElementById('prop-title').value = 'RoboWars 2026 Arena';
    document.getElementById('prop-desc').value = 'National combat robotics tournament with ₹50,000 prize pool.';
    document.getElementById('prop-date').value = '2026-10-15';
    document.getElementById('prop-time').value = '10:00';
    document.getElementById('prop-venue').value = 'Mechanical Workshop Hall';
    if (document.getElementById('prop-category')) document.getElementById('prop-category').value = 'technical';
    if (document.getElementById('prop-capacity')) document.getElementById('prop-capacity').value = '30';
    document.getElementById('prop-fee').value = '100';
    proposalTags.add('Robotics & Automation');
    proposalTags.add('IoT & Embedded Systems');
    initProposalTags();
    showToast('RoboWars 2026 Arena details populated! ✨', 'success');
});

// ── My Proposals ──────────────────────────────────────────────────────────────
async function loadMyProposals() {
    const loadEl  = document.getElementById('my-proposals-loading');
    const emptyEl = document.getElementById('my-proposals-empty');
    const listEl  = document.getElementById('my-proposals-list');
    loadEl.style.display  = 'block';
    emptyEl.style.display = 'none';
    listEl.style.display  = 'none';
    listEl.innerHTML      = '';

    try {
        const res  = await fetch(`${API}/api/proposals/mine`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        if (!data.length) { emptyEl.style.display = 'block'; return; }
        listEl.style.display = 'block';
        listEl.innerHTML = data.map(p => renderProposalCard(p, false)).join('');
    } catch (err) {
        showToast(err.message, 'error');
    } finally { loadEl.style.display = 'none'; }
}

// ── Pending Approvals ─────────────────────────────────────────────────────────
async function loadPendingApprovals() {
    const loadEl  = document.getElementById('pending-loading');
    const emptyEl = document.getElementById('pending-empty');
    const listEl  = document.getElementById('pending-list');
    loadEl.style.display  = 'block';
    emptyEl.style.display = 'none';
    listEl.style.display  = 'none';
    listEl.innerHTML      = '';

    try {
        const res  = await fetch(`${API}/api/proposals/pending`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Update badge
        const badge = document.getElementById('pending-badge');
        if (data.length) { badge.textContent = data.length; badge.style.display = 'inline-block'; }
        else             { badge.style.display = 'none'; }

        if (!data.length) { emptyEl.style.display = 'block'; return; }
        listEl.style.display = 'block';
        listEl.innerHTML = data.map(p => renderProposalCard(p, true)).join('');
    } catch (err) {
        showToast(err.message, 'error');
    } finally { loadEl.style.display = 'none'; }
}

// ── Proposal Card Renderer ────────────────────────────────────────────────────
function renderProposalCard(p, showActions) {
    const statusMap = {
        pending_fa:        { cls:'prop-status-fa',        label:'Awaiting FA Review' },
        pending_principal: { cls:'prop-status-principal', label:'Awaiting Principal' },
        approved:          { cls:'prop-status-approved',  label:'Approved ✓' },
        rejected:          { cls:'prop-status-rejected',  label:'Rejected' },
    };
    const st = statusMap[p.status] || { cls:'', label: p.status };
    const dateStr = p.date ? formatDate(p.date) : '—';

    const approveBtn = showActions
        ? `<button class="btn btn-primary btn-sm" onclick="openActionModal('${p._id}', 'approve')">Approve</button>`
        : '';
    const rejectBtn = showActions
        ? `<button class="btn btn-danger btn-sm" onclick="openActionModal('${p._id}', 'reject')">Reject</button>`
        : '';

    const comments = [];
    if (p.faComment)        comments.push(`<div class="proposal-comment"><strong>FA:</strong> ${p.faComment}</div>`);
    if (p.principalComment) comments.push(`<div class="proposal-comment"><strong>Principal:</strong> ${p.principalComment}</div>`);

    return `
    <div class="proposal-card">
      <div class="proposal-card-header">
        <div>
          <div class="proposal-title">${p.title}</div>
          <div class="proposal-meta">
            ${p.club?.name ? `🏛 ${p.club.name}` : ''}
            &nbsp;•&nbsp; 📅 ${dateStr}
            &nbsp;•&nbsp; 📍 ${p.venue || 'TBD'}
            &nbsp;•&nbsp; 👥 Capacity: ${p.capacity}
          </div>
          ${p.proposedBy ? `<div class="proposal-meta">Proposed by: ${p.proposedBy.name} (${p.proposedBy.email})</div>` : ''}
        </div>
        <span class="pill ${st.cls}">${st.label}</span>
      </div>
      ${p.description ? `<p style="color:var(--t2); margin:8px 0; font-size:.85em;">${p.description}</p>` : ''}
      ${p.tags && p.tags.length ? `
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 10px;">
          ${p.tags.map(t => `<span style="background:rgba(124,58,237,0.15); color:#c4b5fd; font-size:0.72rem; padding:2px 8px; border-radius:12px; border:1px solid rgba(139,92,246,0.25);">#${t}</span>`).join('')}
        </div>
      ` : ''}
      ${comments.join('')}
      ${p.createdEventId ? `<div class="proposal-comment" style="color:var(--green);">✓ Event created on the events page</div>` : ''}
      ${showActions ? `<div class="proposal-actions">${approveBtn}${rejectBtn}</div>` : ''}
    </div>`;
}

// ── Action Modal (Approve / Reject with comment) ──────────────────────────────
const actionModal      = document.getElementById('action-modal');
const actionModalTitle = document.getElementById('action-modal-title');
const actionSubtitle   = document.getElementById('action-modal-subtitle');
const actionCommentEl  = document.getElementById('action-comment');

document.getElementById('action-modal-close').addEventListener('click', closeActionModal);
document.getElementById('action-cancel-btn').addEventListener('click', closeActionModal);
actionModal.addEventListener('click', e => { if (e.target === actionModal) closeActionModal(); });

function closeActionModal() {
    actionModal.style.display = 'none';
    actionCommentEl.value     = '';
    actionCallback            = null;
}

window.openActionModal = function(proposalId, action) {
    const isApprove = action === 'approve';
    actionModalTitle.textContent  = isApprove ? 'Approve Proposal' : 'Reject Proposal';
    actionSubtitle.textContent    = isApprove
        ? 'This will move the proposal to the next approval stage.'
        : 'This will permanently reject the proposal.';
    document.getElementById('action-confirm-btn').className =
        `btn ${isApprove ? 'btn-primary' : 'btn-danger'}`;
    document.getElementById('action-confirm-btn').style.cssText = '';
    actionCallback = (comment) => submitAction(proposalId, action, comment);
    actionModal.style.display = 'flex';
    actionCommentEl.focus();
};

document.getElementById('action-confirm-btn').addEventListener('click', () => {
    const cb = actionCallback;
    const comment = actionCommentEl.value.trim();
    closeActionModal();
    if (cb) cb(comment);
});

async function submitAction(proposalId, action, comment = '') {
    try {
        const res  = await fetch(`${API}/api/proposals/${proposalId}/${action}`, {
            method: 'PUT', headers: authHeaders(),
            body: JSON.stringify({ comment }),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Action failed', 'error'); return; }

        if (action === 'approve' && data.status === 'approved') {
            showToast('Proposal approved — event created on the events page! 🎉', 'success');
        } else if (action === 'approve') {
            showToast('Approved — moved to next stage ✓', 'success');
        } else {
            showToast('Proposal rejected', 'warning');
        }
        loadPendingApprovals();
    } catch { showToast('Network error', 'error'); }
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
    configureSidebar(currentUser);
    await checkOfficerStatus();
    loadMyRegistrations();

    // Pending proposal approvals badge (FA / Principal / Admin)
    if (['faculty_advisor', 'principal', 'admin'].includes(currentUser.role)) {
        fetch(`${API}/api/proposals/pending`, { headers: authHeaders() })
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data) && data.length) {
                    const badge = document.getElementById('pending-badge');
                    badge.textContent   = data.length;
                    badge.style.display = 'inline-block';
                }
            }).catch(() => {});
    }

    // Officer Applications badge (FA + Principal + Admin)
    if (['faculty_advisor', 'principal', 'admin'].includes(currentUser.role)) {
        fetch(`${API}/api/officer-requests/count`, { headers: authHeaders() })
            .then(r => r.json())
            .then(data => {
                if (data.count > 0) {
                    const badge = document.getElementById('officer-apps-badge');
                    if (badge) {
                        badge.textContent   = data.count;
                        badge.style.display = 'inline-block';
                    }
                }
            }).catch(() => {});
    }

    // FA Requests inbox badge (Principal + Admin only)
    if (['principal', 'admin'].includes(currentUser.role)) {
        fetch(`${API}/api/fa-requests/count`, { headers: authHeaders() })
            .then(r => r.json())
            .then(data => {
                if (data.count > 0) {
                    const badge = document.getElementById('inbox-badge');
                    badge.textContent   = data.count;
                    badge.style.display = 'inline-block';
                }
            }).catch(() => {});
    }
}


init();

// ── User Management (Principal + Admin only) ──────────────────────────────────

const ROLE_LABELS = {
    student:         'Student',
    faculty_advisor: 'Faculty Advisor',
    principal:       'Principal',
    admin:           'Admin',
};
const ROLE_COLORS = {
    student:         'prop-status-approved',
    faculty_advisor: 'prop-status-principal',
    principal:       'prop-status-rejected',
    admin:           'prop-status-rejected',
};

// Track all users for FA dropdowns
let allUsers = [];
let allClubs = [];

async function loadUserManagement() {
    await Promise.all([fetchAllUsers(), fetchAllClubs()]);
}

async function fetchAllUsers(search = '', roleFilter = '') {
    const loadEl = document.getElementById('users-loading');
    const tableEl = document.getElementById('users-table');
    loadEl.style.display = 'block';
    tableEl.style.display = 'none';

    try {
        let url = `${API}/api/auth/users?`;
        if (search)     url += `search=${encodeURIComponent(search)}&`;
        if (roleFilter) url += `role=${roleFilter}&`;

        const res  = await fetch(url, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        allUsers = data;
        renderUsersTable(data);
    } catch (err) {
        loadEl.textContent = `Error: ${err.message}`;
    } finally {
        loadEl.style.display = 'none';
    }
}

function renderUsersTable(users) {
    const tbody  = document.getElementById('users-tbody');
    const tableEl = document.getElementById('users-table');
    const isPrincipal = currentUser.role === 'principal';

    if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--t2); padding:20px;">No users found.</td></tr>`;
        tableEl.style.display = 'table';
        return;
    }

    tbody.innerHTML = users.map(u => {
        const roleLabel = ROLE_LABELS[u.role] || u.role;
        const roleClass = ROLE_COLORS[u.role]  || '';
        const isProtected = u.email === 'principal@mace.ac.in';

        // Role change options — Principal cannot be assigned via UI
        const roleOptions = ['student', 'faculty_advisor', 'admin']
            .filter(r => r !== u.role)
            .map(r => `<option value="${r}">${ROLE_LABELS[r]}</option>`)
            .join('');

        return `
        <tr id="user-row-${u._id}">
          <td style="font-weight:600;">${u.name}</td>
          <td style="color:var(--t2); font-size:.8rem;">${u.email}</td>
          <td><span class="pill ${roleClass}">${roleLabel}</span></td>
          <td style="color:var(--t2); font-size:.8rem;">${u.department || '—'} ${u.year && u.year !== 'N/A' ? `· Y${u.year}` : ''}</td>
          <td>
            ${isProtected
              ? `<span style="color:var(--t3); font-size:.75rem;">Protected</span>`
              : `<div style="display:flex; gap:6px; align-items:center;">
                   <select id="role-sel-${u._id}" style="background:var(--bg-2); border:1px solid var(--border); border-radius:var(--r); padding:4px 8px; color:var(--t1); font-size:.75rem; outline:none;">
                     <option value="">Change role…</option>
                     ${roleOptions}
                   </select>
                   <button class="btn btn-outline btn-sm" onclick="changeUserRole('${u._id}', '${u.name}')">Apply</button>
                 </div>`
            }
          </td>
        </tr>`;
    }).join('');
    tableEl.style.display = 'table';

    // Also refresh FA dropdowns in clubs table with updated user list
    if (allClubs.length) renderClubsTable(allClubs);
}

window.changeUserRole = async function(userId, userName) {
    const sel    = document.getElementById(`role-sel-${userId}`);
    const newRole = sel.value;
    if (!newRole) { showToast('Select a role first', 'warning'); return; }

    try {
        const res  = await fetch(`${API}/api/auth/users/${userId}/role`, {
            method: 'PUT', headers: authHeaders(),
            body: JSON.stringify({ role: newRole }),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Role change failed', 'error'); return; }
        showToast(`${userName}'s role changed to ${ROLE_LABELS[newRole]} ✓`, 'success');
        // Update local list and re-render
        allUsers = allUsers.map(u => u._id === userId ? { ...u, role: newRole } : u);
        renderUsersTable(allUsers);
    } catch { showToast('Network error', 'error'); }
};

// ── Club FA Assignment ────────────────────────────────────────────────────────
async function fetchAllClubs() {
    const loadEl  = document.getElementById('clubs-loading');
    const tableEl = document.getElementById('clubs-table');
    loadEl.style.display  = 'block';
    tableEl.style.display = 'none';

    try {
        const res  = await fetch(`${API}/api/clubs`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        allClubs = data;
        renderClubsTable(data);
    } catch (err) {
        loadEl.textContent = `Error: ${err.message}`;
    } finally {
        loadEl.style.display = 'none';
    }
}

function renderClubsTable(clubs) {
    const tbody   = document.getElementById('clubs-tbody');
    const tableEl = document.getElementById('clubs-table');

    // Only users with FA role can be assigned as FA
    const fas = allUsers.filter(u => u.role === 'faculty_advisor');

    if (!clubs.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--t2); padding:20px;">No clubs yet. Use the form above to add one.</td></tr>`;
        tableEl.style.display = 'table';
        return;
    }

    tbody.innerHTML = clubs.map(c => {
        const currentFA = c.facultyAdvisor
            ? `${c.facultyAdvisor.name} <span style="color:var(--t3); font-size:.75rem;">(${c.facultyAdvisor.email})</span>`
            : `<span style="color:var(--t3);">Not assigned</span>`;

        const faOptions = fas.map(u =>
            `<option value="${u._id}" ${c.facultyAdvisor?._id === u._id ? 'selected' : ''}>${u.name} — ${u.email}</option>`
        ).join('');

        return `
        <tr id="club-row-${c._id}">
          <td style="font-weight:600;">${c.name}${c.description ? `<div style="color:var(--t2); font-size:.75rem; font-weight:400; margin-top:2px;">${c.description}</div>` : ''}</td>
          <td>${currentFA}</td>
          <td>
            ${fas.length
              ? `<select id="fa-sel-${c._id}" style="background:var(--bg-2); border:1px solid var(--border); border-radius:var(--r); padding:4px 8px; color:var(--t1); font-size:.75rem; outline:none; min-width:200px;">
                   <option value="">— Remove FA —</option>
                   ${faOptions}
                 </select>`
              : `<span style="color:var(--amber); font-size:.78rem;">No Faculty Advisors yet. Grant FA role first.</span>`
            }
          </td>
          <td>
            <div style="display:flex; gap:6px;">
              ${fas.length
                ? `<button class="btn btn-outline btn-sm" onclick="assignFA('${c._id}', '${c.name.replace(/'/g, "\\'")}')">Assign</button>`
                : '—'
              }
              <button class="btn btn-outline btn-sm" style="color:var(--red); border-color:rgba(239,68,68,.3);" onclick="deleteClub('${c._id}', '${c.name.replace(/'/g, "\\'")}')">🗑️ Delete</button>
            </div>
          </td>
        </tr>`;
    }).join('');
    tableEl.style.display = 'table';
}

window.assignFA = async function(clubId, clubName) {
    const sel   = document.getElementById(`fa-sel-${clubId}`);
    const faId  = sel.value; // empty string = remove FA

    try {
        const res  = await fetch(`${API}/api/clubs/${clubId}`, {
            method: 'PUT', headers: authHeaders(),
            body: JSON.stringify({ facultyAdvisorId: faId || null }),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Assignment failed', 'error'); return; }

        // Update local clubs list
        allClubs = allClubs.map(c => c._id === clubId ? data : c);
        renderClubsTable(allClubs);
        showToast(
            faId
                ? `Faculty Advisor assigned to ${clubName} ✓`
                : `Faculty Advisor removed from ${clubName}`,
            'success'
        );
    } catch { showToast('Network error', 'error'); }
};

window.deleteClub = async function(clubId, clubName) {
    if (!confirm(`Delete club "${clubName}"? This cannot be undone.`)) return;
    try {
        const res  = await fetch(`${API}/api/clubs/${clubId}`, {
            method: 'DELETE', headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Delete failed', 'error'); return; }
        allClubs = allClubs.filter(c => c._id !== clubId);
        renderClubsTable(allClubs);
        showToast(`Club "${clubName}" deleted ✓`, 'success');
    } catch { showToast('Network error', 'error'); }
};

document.getElementById('create-club-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('new-club-name')?.value.trim();
    const desc = document.getElementById('new-club-desc')?.value.trim();
    if (!name) { showToast('Club name is required', 'warning'); return; }
    try {
        const res  = await fetch(`${API}/api/clubs`, {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({ name, description: desc }),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Create failed', 'error'); return; }
        allClubs = [...allClubs, data];
        renderClubsTable(allClubs);
        document.getElementById('new-club-name').value = '';
        document.getElementById('new-club-desc').value = '';
        showToast(`Club "${name}" created ✓`, 'success');
    } catch { showToast('Network error', 'error'); }
});

document.getElementById('user-search-btn')?.addEventListener('click', () => {
    const search = document.getElementById('user-search').value.trim();
    const role   = document.getElementById('user-role-filter').value;
    fetchAllUsers(search, role);
});
document.getElementById('user-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('user-search-btn').click();
});
document.getElementById('reload-clubs-btn')?.addEventListener('click', fetchAllClubs);

// ── Inbox — FA Requests (Principal + Admin) ────────────────────────────────────

const STATUS_CHIP = {
    pending:  `<span class="pill prop-status-fa">⏳ Pending</span>`,
    approved: `<span class="pill prop-status-approved">✅ Approved</span>`,
    rejected: `<span class="pill prop-status-rejected">❌ Rejected</span>`,
};

async function loadInbox() {
    const loadEl  = document.getElementById('inbox-loading');
    const emptyEl = document.getElementById('inbox-empty');
    const listEl  = document.getElementById('inbox-list');

    loadEl.style.display  = 'block';
    emptyEl.style.display = 'none';
    listEl.style.display  = 'none';
    listEl.innerHTML      = '';

    const status = document.getElementById('inbox-filter')?.value || 'pending';

    try {
        const res  = await fetch(`${API}/api/fa-requests?status=${status}`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        loadEl.style.display = 'none';
        if (!data.length) { emptyEl.style.display = 'block'; return; }

        listEl.style.display = 'block';
        listEl.innerHTML = data.map(r => {
            const person  = r.requestedBy?.name  || 'Unknown';
            const email   = r.requestedBy?.email || '—';
            const club    = r.club?.name          || 'Unknown Club';
            const date    = new Date(r.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
            const chip    = STATUS_CHIP[r.status] || '';
            const noteHtml = r.note
                ? `<div class="fa-request-note">"${r.note}"</div>`
                : '';
            const reviewHtml = r.reviewNote
                ? `<div class="proposal-comment" style="margin-top:8px;">
                     <strong>Principal's note:</strong> ${r.reviewNote}
                   </div>`
                : '';
            const actions = r.status === 'pending'
                ? `<button class="btn btn-outline btn-sm" style="color:var(--green);border-color:rgba(34,197,94,.3);"
                           onclick="inboxAction('${r._id}', 'approve')">✅ Approve</button>
                   <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:rgba(239,68,68,.3);"
                           onclick="inboxAction('${r._id}', 'reject')">✕ Reject</button>`
                : `<span style="color:var(--t3); font-size:.78rem;">
                     Reviewed on ${new Date(r.reviewedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                   </span>`;

            return `
            <div class="fa-request-card" id="fa-req-${r._id}">
              <div class="fa-request-card-header">
                <div>
                  <div class="fa-request-person">🎓 ${person}</div>
                  <div class="fa-request-meta">
                    ${email} &nbsp;·&nbsp;
                    Requesting FA for <strong style="color:var(--t1);">${club}</strong>
                    &nbsp;·&nbsp; ${date}
                  </div>
                </div>
                ${chip}
              </div>
              ${noteHtml}
              ${reviewHtml}
              <div class="fa-request-actions">${actions}</div>
            </div>`;
        }).join('');

        // Update inbox badge to current count
        if (status === 'pending') {
            const badge = document.getElementById('inbox-badge');
            if (badge) {
                badge.textContent   = data.length || '';
                badge.style.display = data.length ? 'inline-block' : 'none';
            }
        }
    } catch (err) {
        loadEl.style.display = 'none';
        listEl.style.display = 'block';
        listEl.innerHTML = `<p style="color:var(--red); padding:20px;">Error: ${err.message}</p>`;
    }
}

// Modal-based approve / reject with optional review note
window.inboxAction = function(requestId, action) {
    const isApprove = action === 'approve';

    // Re-use action modal
    const modal    = document.getElementById('action-modal');
    const title    = document.getElementById('action-modal-title');
    const subtitle = document.getElementById('action-modal-subtitle');
    const comment  = document.getElementById('action-comment');
    const confirmBtn = document.getElementById('action-confirm-btn');

    title.textContent    = isApprove ? 'Approve FA Request' : 'Reject FA Request';
    subtitle.textContent = isApprove
        ? 'The user will be granted Faculty Advisor role and assigned to the club.'
        : 'The request will be rejected. You can add an optional note.';
    confirmBtn.className = `btn ${isApprove ? 'btn-primary' : 'btn-danger'}`;
    confirmBtn.textContent = isApprove ? '✅ Approve' : '✕ Reject';
    confirmBtn.style.background = isApprove ? 'var(--green)' : 'var(--red)';
    comment.value = '';

    actionCallback = async (reviewNote) => {
        try {
            const res  = await fetch(`${API}/api/fa-requests/${requestId}/${action}`, {
                method: 'PUT', headers: authHeaders(),
                body: JSON.stringify({ reviewNote }),
            });
            const data = await res.json();

            if (!res.ok) { showToast(data.error || 'Action failed', 'error'); return; }
            showToast(
                isApprove ? 'FA request approved — role granted ✓' : 'FA request rejected',
                isApprove ? 'success' : 'warning'
            );
            loadInbox();  // Refresh list

            // Update inbox badge
            if (isApprove) {
                fetch(`${API}/api/fa-requests/count`, { headers: authHeaders() })
                    .then(r => r.json())
                    .then(d => {
                        const badge = document.getElementById('inbox-badge');
                        if (badge) {
                            badge.textContent   = d.count || '';
                            badge.style.display = d.count > 0 ? 'inline-block' : 'none';
                        }
                    }).catch(() => {});
            }
        } catch { showToast('Network error', 'error'); }
    };

    modal.style.display = 'flex';
    comment.focus();
};

// Filter change reloads inbox
document.getElementById('inbox-filter')?.addEventListener('change', loadInbox);
document.getElementById('inbox-refresh-btn')?.addEventListener('click', loadInbox);


// ── Club Officer Application (Student) ────────────────────────────────────────

let clubsListForOfficerApply = [];

async function loadClubsForOfficerApply() {
    const clubSel = document.getElementById('oa-club');
    const noteEl  = document.getElementById('oa-fa-note');
    if (!clubSel) return;

    clubSel.innerHTML = '<option value="">Loading clubs…</option>';
    if (noteEl) noteEl.textContent = '';

    try {
        const res = await fetch(`${API}/api/clubs`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to load clubs');
        clubsListForOfficerApply = await res.json();

        clubSel.innerHTML = '<option value="">Select a club…</option>' +
            clubsListForOfficerApply.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
    } catch {
        clubSel.innerHTML = '<option value="">Could not load clubs</option>';
    }
}

document.getElementById('oa-club')?.addEventListener('change', () => {
    const clubId = document.getElementById('oa-club').value;
    const noteEl = document.getElementById('oa-fa-note');
    if (!noteEl) return;

    const club = clubsListForOfficerApply.find(c => c._id === clubId);
    if (!club) { noteEl.textContent = ''; return; }

    if (club.facultyAdvisor) {
        noteEl.innerHTML = `👨‍🏫 <strong>Faculty Advisor:</strong> ${club.facultyAdvisor.name} (${club.facultyAdvisor.email}) — will review your application.`;
        noteEl.style.color = 'var(--t2)';
    } else {
        noteEl.innerHTML = `⚠️ <em>This club has no Faculty Advisor assigned yet. You can only apply once an FA is assigned.</em>`;
        noteEl.style.color = '#f59e0b';
    }
});

document.getElementById('officer-apply-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelectorAll('#officer-apply-form .field-error').forEach(el => el.textContent = '');

    const clubId        = document.getElementById('oa-club').value;
    const requestedRole = document.getElementById('oa-role').value;
    const statement     = document.getElementById('oa-statement').value.trim();

    let hasError = false;
    if (!clubId) {
        document.getElementById('err-oa-club').textContent = 'Please select a club';
        hasError = true;
    }
    if (!requestedRole) {
        document.getElementById('err-oa-role').textContent = 'Please select a role';
        hasError = true;
    }
    if (!statement) {
        document.getElementById('err-oa-statement').textContent = 'Please enter your motivation statement';
        hasError = true;
    }
    if (hasError) return;

    const btn = document.getElementById('submit-officer-btn');
    const txt = document.getElementById('submit-officer-text');
    btn.disabled = true;
    txt.textContent = 'Submitting…';

    try {
        const res = await fetch(`${API}/api/officer-requests`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ clubId, requestedRole, statement }),
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || 'Failed to submit application', 'error');
            return;
        }

        showToast('Application submitted! Your Faculty Advisor will review it. 🎉', 'success');
        document.getElementById('officer-apply-form').reset();
        document.getElementById('oa-fa-note').textContent = '';
        switchPanel('my-officer-requests');
    } catch {
        showToast('Network error while submitting application', 'error');
    } finally {
        btn.disabled = false;
        txt.textContent = 'Submit Application';
    }
});

// ── Student: My Officer Requests ──────────────────────────────────────────────

async function loadMyOfficerRequests() {
    const loadEl  = document.getElementById('my-officer-req-loading');
    const emptyEl = document.getElementById('my-officer-req-empty');
    const listEl  = document.getElementById('my-officer-req-list');
    if (!loadEl || !listEl) return;

    loadEl.style.display  = 'block';
    emptyEl.style.display = 'none';
    listEl.style.display  = 'none';
    listEl.innerHTML      = '';

    try {
        const res  = await fetch(`${API}/api/officer-requests/mine`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        loadEl.style.display = 'none';
        if (!data.length) { emptyEl.style.display = 'block'; return; }

        listEl.style.display = 'block';
        listEl.innerHTML = data.map(r => {
            const clubName = r.club?.name || 'Unknown Club';
            const roleName = r.requestedRole === 'president' ? '🏆 President' : '📝 Secretary';
            const chip = STATUS_CHIP[r.status] || '';
            const date = new Date(r.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
            const stmtHtml = r.statement
                ? `<div class="fa-request-note" style="margin-top:8px;">"${r.statement}"</div>`
                : '';
            const reviewHtml = r.reviewNote
                ? `<div class="proposal-comment" style="margin-top:8px;">
                     <strong>FA's Note:</strong> ${r.reviewNote}
                   </div>`
                : '';

            return `
            <div class="fa-request-card" id="my-officer-req-${r._id}">
              <div class="fa-request-card-header">
                <div>
                  <div class="fa-request-person">${clubName} &nbsp;—&nbsp; <span style="color:var(--primary);">${roleName}</span></div>
                  <div class="fa-request-meta">Submitted on ${date}</div>
                </div>
                ${chip}
              </div>
              ${stmtHtml}
              ${reviewHtml}
            </div>`;
        }).join('');
    } catch (err) {
        loadEl.style.display = 'none';
        listEl.style.display = 'block';
        listEl.innerHTML = `<p style="color:var(--red); padding:20px;">Error: ${err.message}</p>`;
    }
}

// ── FA Review: Officer Applications ───────────────────────────────────────────

async function loadOfficerApplications() {
    const loadEl  = document.getElementById('officer-apps-loading');
    const emptyEl = document.getElementById('officer-apps-empty');
    const listEl  = document.getElementById('officer-apps-list');
    if (!loadEl || !listEl) return;

    loadEl.style.display  = 'block';
    emptyEl.style.display = 'none';
    listEl.style.display  = 'none';
    listEl.innerHTML      = '';

    const status = document.getElementById('officer-apps-filter')?.value || 'pending';

    try {
        const res  = await fetch(`${API}/api/officer-requests/pending?status=${status}`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        loadEl.style.display = 'none';
        if (!data.length) { emptyEl.style.display = 'block'; return; }

        listEl.style.display = 'block';
        listEl.innerHTML = data.map(r => {
            const person   = r.applicant?.name  || 'Unknown';
            const email    = r.applicant?.email || '—';
            const deptYear = [r.applicant?.department, r.applicant?.year ? `Year ${r.applicant.year}` : ''].filter(Boolean).join(' · ');
            const club     = r.club?.name || 'Club';
            const roleName = r.requestedRole === 'president' ? '🏆 President' : '📝 Secretary';
            const date     = new Date(r.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
            const chip     = STATUS_CHIP[r.status] || '';
            const stmtHtml = r.statement
                ? `<div class="fa-request-note">"${r.statement}"</div>`
                : '';
            const reviewHtml = r.reviewNote
                ? `<div class="proposal-comment" style="margin-top:8px;">
                     <strong>Reviewed by ${r.reviewedBy?.name || 'FA'}:</strong> ${r.reviewNote}
                   </div>`
                : '';
            const actions = r.status === 'pending'
                ? `<button class="btn btn-outline btn-sm" style="color:var(--green);border-color:rgba(34,197,94,.3);"
                           onclick="officerAppAction('${r._id}', 'approve')">✅ Approve</button>
                   <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:rgba(239,68,68,.3);"
                           onclick="officerAppAction('${r._id}', 'reject')">✕ Reject</button>`
                : `<span style="color:var(--t3); font-size:.78rem;">
                     Reviewed on ${new Date(r.reviewedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                   </span>`;

            return `
            <div class="fa-request-card" id="officer-req-${r._id}">
              <div class="fa-request-card-header">
                <div>
                  <div class="fa-request-person">🎓 ${person} &nbsp;·&nbsp; <span style="color:var(--primary);">${roleName}</span></div>
                  <div class="fa-request-meta">
                    ${email} ${deptYear ? `&nbsp;·&nbsp; ${deptYear}` : ''} &nbsp;·&nbsp;
                    Applying for <strong style="color:var(--t1);">${club}</strong>
                    &nbsp;·&nbsp; ${date}
                  </div>
                </div>
                ${chip}
              </div>
              ${stmtHtml}
              ${reviewHtml}
              <div class="fa-request-actions">${actions}</div>
            </div>`;
        }).join('');

        // Update badge count
        if (status === 'pending') {
            const badge = document.getElementById('officer-apps-badge');
            if (badge) {
                badge.textContent   = data.length || '';
                badge.style.display = data.length ? 'inline-block' : 'none';
            }
        }
    } catch (err) {
        loadEl.style.display = 'none';
        listEl.style.display = 'block';
        listEl.innerHTML = `<p style="color:var(--red); padding:20px;">Error: ${err.message}</p>`;
    }
}

window.officerAppAction = function(requestId, action) {
    const isApprove = action === 'approve';

    const modal      = document.getElementById('action-modal');
    const title      = document.getElementById('action-modal-title');
    const subtitle   = document.getElementById('action-modal-subtitle');
    const comment    = document.getElementById('action-comment');
    const confirmBtn = document.getElementById('action-confirm-btn');

    title.textContent    = isApprove ? 'Approve Officer Application' : 'Reject Officer Application';
    subtitle.textContent = isApprove
        ? 'The student will become the club officer and gain event proposal privileges.'
        : 'The application will be rejected. You can add an optional note.';
    confirmBtn.className = `btn ${isApprove ? 'btn-primary' : 'btn-danger'}`;
    confirmBtn.textContent = isApprove ? '✅ Approve' : '✕ Reject';
    confirmBtn.style.background = isApprove ? 'var(--green)' : 'var(--red)';
    comment.value = '';

    actionCallback = async (reviewNote) => {
        try {
            const res  = await fetch(`${API}/api/officer-requests/${requestId}/${action}`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({ reviewNote }),
            });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || 'Action failed', 'error');
                return;
            }

            showToast(
                isApprove ? 'Application approved! Officer privileges granted ✓' : 'Application rejected',
                isApprove ? 'success' : 'warning'
            );
            loadOfficerApplications();

            // Refresh pending badge count
            fetch(`${API}/api/officer-requests/count`, { headers: authHeaders() })
                .then(r => r.json())
                .then(d => {
                    const badge = document.getElementById('officer-apps-badge');
                    if (badge) {
                        badge.textContent   = d.count || '';
                        badge.style.display = d.count > 0 ? 'inline-block' : 'none';
                    }
                }).catch(() => {});
        } catch {
            showToast('Network error', 'error');
        }
    };

    modal.style.display = 'flex';
    comment.focus();
};

document.getElementById('officer-apps-filter')?.addEventListener('change', loadOfficerApplications);
document.getElementById('officer-apps-refresh-btn')?.addEventListener('click', loadOfficerApplications);



