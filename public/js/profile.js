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
    if (panelId === 'my-registrations')  loadMyRegistrations();
    if (panelId === 'manage-profile')    loadProfile();
    if (panelId === 'propose-event')     loadMyClubsForProposal();
    if (panelId === 'my-proposals')      loadMyProposals();
    if (panelId === 'pending-approvals') loadPendingApprovals();
    if (panelId === 'manage-users')      loadUserManagement();
}

// ── Show/hide sidebar sections based on user role ────────────────────────────────
function configureSidebar(user) {
    if (['admin'].includes(user.role)) {
        document.getElementById('officer-section').style.display = 'block';
    }
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

// ── Manage Profile ──────────────────────────────────────────────────
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

    // Student-only fields: dept and year
    const isStudent = u.role === 'student';
    document.getElementById('pf-dept-group').style.display = isStudent ? '' : 'none';
    document.getElementById('pf-year-group').style.display = isStudent ? '' : 'none';

    if (isStudent) {
        document.getElementById('pf-dept').value = u.department  || '';
        document.getElementById('pf-year').value = u.year        || 'N/A';
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
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--t2); padding:20px;">No clubs exist yet. Create clubs via the Admin Panel.</td></tr>`;
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
              : `<span style="color:var(--amber); font-size:.78rem;">No Faculty Advisors yet. Grant FA role to a user first.</span>`
            }
          </td>
          <td>
            ${fas.length
              ? `<button class="btn btn-outline btn-sm" onclick="assignFA('${c._id}', '${c.name}')">Assign</button>`
              : '—'
            }
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

// ── Search/filter wiring for user table ───────────────────────────────────────
document.getElementById('user-search-btn')?.addEventListener('click', () => {
    const search = document.getElementById('user-search').value.trim();
    const role   = document.getElementById('user-role-filter').value;
    fetchAllUsers(search, role);
});
document.getElementById('user-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('user-search-btn').click();
});
document.getElementById('reload-clubs-btn')?.addEventListener('click', fetchAllClubs);

