// public/js/admin.js — Admin panel logic

import { getUser, requireLogin, renderNavAuth, authHeaders } from './auth.js';

// ── Role guard: only 'admin' users may access this page ───────────────────────
requireLogin();
const _adminUser = getUser();
if (!_adminUser || _adminUser.role !== 'admin') {
    alert('Access denied. Admin accounts only.');
    window.location.href = '/';
}
renderNavAuth();

const API = '';

// ── State ──────────────────────────────────────────────────────────────
let allEvents = [];
let editingEventId = null;
let selectedEventId = null;
let confirmCallback = null;

// ── Toast ──────────────────────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────
function formatDate(d) {
    return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function formatDateTime(d) {
    return new Date(d).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
}

// ── Sidebar navigation ─────────────────────────────────────────────────
document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
});

function switchPanel(panelId) {
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-panel="${panelId}"]`).classList.add('active');
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`panel-${panelId}`).classList.add('active');

    // Load relevant data
    if (panelId === 'dashboard' || panelId === 'events-list') loadEvents();
    if (panelId === 'registrations') { loadRegistrationEventList(); showRegSelectView(); }
    if (panelId === 'add-event') resetEventForm();
}

// ── Confirm modal ──────────────────────────────────────────────────────
function showConfirm(title, msg, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent   = msg;
    confirmCallback = onConfirm;
    document.getElementById('confirm-modal').style.display = 'flex';
}
document.getElementById('confirm-cancel-btn').addEventListener('click', () => {
    document.getElementById('confirm-modal').style.display = 'none';
});
document.getElementById('confirm-ok-btn').addEventListener('click', () => {
    document.getElementById('confirm-modal').style.display = 'none';
    if (confirmCallback) confirmCallback();
});

// ── Fetch all events ────────────────────────────────────────────────────
async function loadEvents() {
    try {
        const res = await fetch(`${API}/api/events`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to load events');
        allEvents = await res.json();
        renderDashboard();
        renderEventsList();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Dashboard ───────────────────────────────────────────────────────────
function renderDashboard() {
    document.getElementById('dash-total-events').textContent    = allEvents.length;
    document.getElementById('dash-total-confirmed').textContent = allEvents.reduce((s,e) => s + e.confirmedCount, 0);
    document.getElementById('dash-total-waitlisted').textContent= allEvents.reduce((s,e) => s + e.waitlistCount,  0);
    document.getElementById('dash-total-capacity').textContent  = allEvents.reduce((s,e) => s + e.capacity,       0);

    const tbody = document.getElementById('dash-events-tbody');
    if (!allEvents.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-dim); padding:32px;">No events yet. <a href="#" onclick="switchPanel('add-event');return false;" style="color:var(--primary-lt);">Add one</a></td></tr>`;
        return;
    }
    tbody.innerHTML = allEvents.map(ev => `
        <tr>
          <td><strong>${ev.name}</strong></td>
          <td><span class="card-cat cat-${ev.category}" style="font-size:.7rem;">${ev.category}</span></td>
          <td>${formatDate(ev.date)}</td>
          <td>${ev.capacity}</td>
          <td style="color:var(--success);">${ev.confirmedCount}</td>
          <td style="color:var(--warning);">${ev.waitlistCount}</td>
          <td>
            <button class="btn-danger btn-sm" onclick="viewEventRegistrations('${ev._id}')">View Regs</button>
          </td>
        </tr>`).join('');
}

document.getElementById('dash-add-btn').addEventListener('click', () => switchPanel('add-event'));

// ── Events List ─────────────────────────────────────────────────────────
function renderEventsList() {
    const tbody = document.getElementById('events-list-tbody');
    if (!allEvents.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-dim); padding:32px;">No events yet.</td></tr>`;
        return;
    }
    tbody.innerHTML = allEvents.map(ev => `
        <tr>
          <td><strong>${ev.name}</strong></td>
          <td><span class="card-cat cat-${ev.category}" style="font-size:.7rem;">${ev.category}</span></td>
          <td>${formatDate(ev.date)}</td>
          <td>${ev.venue || '—'}</td>
          <td>${ev.capacity}</td>
          <td style="color:var(--success);">${ev.confirmedCount}</td>
          <td style="color:var(--warning);">${ev.waitlistCount}</td>
          <td style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="startEditEvent('${ev._id}')">Edit</button>
            <button class="btn-danger btn-sm" onclick="deleteEvent('${ev._id}','${ev.name.replace(/'/g,"\\'")}')">Delete</button>
          </td>
        </tr>`).join('');
}

document.getElementById('events-list-add-btn').addEventListener('click', () => switchPanel('add-event'));

// ── Add / Edit Event Form ───────────────────────────────────────────────
function resetEventForm() {
    editingEventId = null;
    document.getElementById('add-event-title').textContent = 'Add New Event';
    document.getElementById('save-event-btn').textContent  = 'Create Event';
    document.getElementById('cancel-edit-btn').style.display = 'none';
    document.getElementById('edit-event-id').value = '';
    document.getElementById('add-event-form').reset();
    clearEventErrors();
}

function clearEventErrors() {
    ['ev-name','ev-date','ev-cat','ev-cap'].forEach(id => {
        const el = document.getElementById(`err-${id}`);
        if (el) el.textContent = '';
    });
}

function startEditEvent(id) {
    const ev = allEvents.find(e => e._id === id);
    if (!ev) return;
    editingEventId = id;
    document.getElementById('add-event-title').textContent = 'Edit Event';
    document.getElementById('save-event-btn').textContent  = 'Save Changes';
    document.getElementById('cancel-edit-btn').style.display = 'inline-flex';
    document.getElementById('edit-event-id').value   = id;
    document.getElementById('ev-name').value         = ev.name;
    document.getElementById('ev-desc').value         = ev.description || '';
    document.getElementById('ev-date').value         = ev.date.slice(0,10);
    document.getElementById('ev-venue').value        = ev.venue || '';
    document.getElementById('ev-category').value     = ev.category;
    document.getElementById('ev-capacity').value     = ev.capacity;
    document.getElementById('ev-url').value          = ev.eventUrl || '';
    switchPanel('add-event');
}

document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    resetEventForm();
    switchPanel('events-list');
});

function validateEventForm() {
    clearEventErrors();
    let valid = true;
    if (!document.getElementById('ev-name').value.trim()) {
        document.getElementById('err-ev-name').textContent = 'Event name is required'; valid = false;
    }
    if (!document.getElementById('ev-date').value) {
        document.getElementById('err-ev-date').textContent = 'Date is required'; valid = false;
    }
    if (!document.getElementById('ev-category').value) {
        document.getElementById('err-ev-cat').textContent = 'Category is required'; valid = false;
    }
    const cap = parseInt(document.getElementById('ev-capacity').value);
    if (!cap || cap < 1) {
        document.getElementById('err-ev-cap').textContent = 'Capacity must be at least 1'; valid = false;
    }
    return valid;
}

document.getElementById('add-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateEventForm()) return;

    const payload = {
        name:        document.getElementById('ev-name').value.trim(),
        description: document.getElementById('ev-desc').value.trim(),
        date:        document.getElementById('ev-date').value,
        venue:       document.getElementById('ev-venue').value.trim(),
        category:    document.getElementById('ev-category').value,
        capacity:    parseInt(document.getElementById('ev-capacity').value),
        eventUrl:    document.getElementById('ev-url').value.trim(),
    };

    const btn = document.getElementById('save-event-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
        const url    = editingEventId ? `${API}/api/events/${editingEventId}` : `${API}/api/events`;
        const method = editingEventId ? 'PUT' : 'POST';
        const res    = await fetch(url, {
            method,
            headers: authHeaders(),
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Save failed', 'error'); return; }

        showToast(editingEventId ? 'Event updated!' : 'Event created!', 'success');
        resetEventForm();
        await loadEvents();
        switchPanel('events-list');
    } catch (err) {
        showToast('Network error', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = editingEventId ? 'Save Changes' : 'Create Event';
    }
});

// ── Delete Event ────────────────────────────────────────────────────────
function deleteEvent(id, name) {
    showConfirm(
        'Delete Event',
        `Delete "${name}" and all its registrations? This cannot be undone.`,
        async () => {
            try {
                const res = await fetch(`${API}/api/events/${id}`, { method: 'DELETE', headers: authHeaders() });
                const data = await res.json();
                if (!res.ok) { showToast(data.error, 'error'); return; }
                showToast(data.message, 'success');
                await loadEvents();
            } catch (err) {
                showToast('Delete failed', 'error');
            }
        }
    );
}

// ── Registrations Section ───────────────────────────────────────────────
function showRegSelectView() {
    document.getElementById('reg-event-select-view').style.display = 'block';
    document.getElementById('reg-list-view').style.display = 'none';
}

function showRegListView() {
    document.getElementById('reg-event-select-view').style.display = 'none';
    document.getElementById('reg-list-view').style.display = 'block';
}

document.getElementById('reg-back-btn').addEventListener('click', () => {
    showRegSelectView();
    loadRegistrationEventList();
});

async function loadRegistrationEventList() {
    if (!allEvents.length) await loadEvents();
    const container = document.getElementById('reg-event-cards');
    if (!allEvents.length) {
        container.innerHTML = '<p style="color:var(--text-muted);">No events yet.</p>';
        return;
    }
    container.innerHTML = allEvents.map(ev => `
        <div class="event-card" style="cursor:pointer;" onclick="viewEventRegistrations('${ev._id}')">
          <div class="card-top">
            <span class="card-cat cat-${ev.category}">${ev.category}</span>
          </div>
          <h3 class="card-title">${ev.name}</h3>
          <div class="card-meta">
            <div class="card-meta-item"><span class="icon">📅</span>${formatDate(ev.date)}</div>
          </div>
          <div style="display:flex; gap:16px; margin-top:8px; font-size:.82rem;">
            <span style="color:var(--success);">✓ ${ev.confirmedCount} confirmed</span>
            <span style="color:var(--warning);">⏳ ${ev.waitlistCount} waiting</span>
          </div>
        </div>`).join('');
}

async function viewEventRegistrations(eventId) {
    selectedEventId = eventId;
    const ev = allEvents.find(e => e._id === eventId);
    switchPanel('registrations');
    showRegListView();

    if (ev) {
        document.getElementById('reg-list-title').textContent = `Registrations — ${ev.name}`;
        document.getElementById('reg-confirmed-count').textContent = ev.confirmedCount;
        document.getElementById('reg-waitlist-count').textContent  = ev.waitlistCount;
        document.getElementById('reg-capacity-display').textContent= ev.capacity;
    }

    const tbody = document.getElementById('reg-tbody');
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-dim); padding:24px;">Loading…</td></tr>`;

    try {
        const res  = await fetch(`${API}/api/registrations/${eventId}`, { headers: authHeaders() });
        const regs = await res.json();
        if (!res.ok) throw new Error(regs.error);

        if (!regs.length) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-dim); padding:32px;">No registrations yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = regs.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${r.name}</strong></td>
              <td>${r.email}</td>
              <td>${r.department || '—'}</td>
              <td>Year ${r.year}</td>
              <td><span class="status-badge badge-${r.status}">${r.status}</span></td>
              <td>${r.waitlistPosition ?? '—'}</td>
              <td>${formatDateTime(r.registeredAt)}</td>
              <td>
                ${r.status !== 'cancelled'
                    ? `<button class="btn-danger btn-sm" onclick="cancelReg('${r._id}','${r.name.replace(/'/g,"\\'")}')">Cancel</button>`
                    : '<span style="color:var(--text-dim); font-size:.78rem;">Cancelled</span>'
                }
              </td>
            </tr>`).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--error);">${err.message}</td></tr>`;
    }
}

// ── Cancel Registration ─────────────────────────────────────────────────
function cancelReg(regId, name) {
    showConfirm(
        'Cancel Registration',
        `Cancel ${name}'s registration? If they were confirmed, the next waitlisted student will be promoted automatically.`,
        async () => {
            try {
                const res  = await fetch(`${API}/api/registrations/${regId}/cancel`, { method: 'PUT', headers: authHeaders() });
                const data = await res.json();
                if (!res.ok) { showToast(data.error, 'error'); return; }

                let msg = data.message;
                if (data.promoted) {
                    msg += ` → ${data.promoted.name} promoted from waitlist!`;
                    showToast(msg, 'success');
                } else {
                    showToast(msg, 'warning');
                }

                // Refresh event data and re-render the list
                await loadEvents();
                viewEventRegistrations(selectedEventId);
            } catch (err) {
                showToast('Cancel failed', 'error');
            }
        }
    );
}

// ── Init ────────────────────────────────────────────────────────────────
loadEvents();
