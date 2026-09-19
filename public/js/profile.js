// public/js/profile.js — Profile page logic

import {
    getToken, getUser, setUser, requireLogin, renderNavAuth, authHeaders, logout
} from './auth.js';

requireLogin(); // Redirect to /login.html if not logged in
renderNavAuth();

const API  = '';
let currentUser = getUser();
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
    if (panelId === 'my-registrations') loadMyRegistrations();
    if (panelId === 'manage-profile')   loadProfile();
    if (panelId === 'propose-event')    loadMyClubsForProposal();
    if (panelId === 'my-proposals')     loadMyProposals();
    if (panelId === 'pending-approvals') loadPendingApprovals();
}

// ── Show/hide sidebar sections based on user role ─────────────────────────────
function configureSidebar(user) {
    // Officer section: visible if user is admin (can always propose) or
    // will be shown after we check club memberships
    if (['admin'].includes(user.role)) {
        document.getElementById('officer-section').style.display = 'block';
    }
    if (['faculty_advisor', 'principal', 'admin'].includes(user.role)) {
        document.getElementById('approver-section').style.display = 'block';
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
            const badgeCls = status === 'confirmed' ? 'result-confirmed' : 'result-waitlisted';
            const badgeTxt = status === 'confirmed' ? '✓ Confirmed' : `⏳ Waitlist #${r.waitlistPosition}`;
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
              <div class="reg-card-actions">
                <button class="btn btn-outline btn-sm"
                  onclick="selfCancel('${r._id}', '${ev?.name || 'this event'}')"
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

// ── Manage Profile ────────────────────────────────────────────────────────────
function loadProfile() {
    const u = currentUser;
    document.getElementById('pf-name').value  = u.name        || '';
    document.getElementById('pf-email').value = u.email       || '';
    document.getElementById('pf-dept').value  = u.department  || '';
    document.getElementById('pf-year').value  = u.year        || 'N/A';
    document.getElementById('pf-phone').value = u.phone       || '';
    document.getElementById('pf-role').value  = u.role        || 'student';
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
        const res  = await fetch(`${API}/api/auth/me`, {
            method: 'PUT', headers: authHeaders(),
            body: JSON.stringify({ name, department: dept, year, phone }),
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
async function loadMyClubsForProposal() {
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
        const res  = await fetch(`${API}/api/proposals`, {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({ clubId, title, description: desc, date, time, venue, category, capacity: +capacity }),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Submission failed', 'error'); return; }
        document.getElementById('proposal-form').reset();
        showToast('Proposal submitted! Awaiting Faculty Advisor review.', 'success');
        switchPanel('my-proposals');
    } catch { showToast('Network error', 'error'); }
    finally {
        btn.disabled     = false;
        text.textContent = 'Submit Proposal';
    }
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
    actionCallback = () => submitAction(proposalId, action);
    actionModal.style.display = 'flex';
    actionCommentEl.focus();
};

document.getElementById('action-confirm-btn').addEventListener('click', () => {
    closeActionModal();
    if (actionCallback) actionCallback();
});

async function submitAction(proposalId, action) {
    const comment = actionCommentEl.value.trim();
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

    // Load pending count for badge
    if (['faculty_advisor', 'principal', 'admin'].includes(currentUser.role)) {
        fetch(`${API}/api/proposals/pending`, { headers: authHeaders() })
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data) && data.length) {
                    const badge = document.getElementById('pending-badge');
                    badge.textContent    = data.length;
                    badge.style.display  = 'inline-block';
                }
            }).catch(() => {});
    }
}

init();
