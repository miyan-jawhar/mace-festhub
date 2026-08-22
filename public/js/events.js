// public/js/events.js — Student-facing event listing and registration logic

const API = '';  // Same origin; Express serves these files

// ── State ────────────────────────────────────────────────────────────
let allEvents = [];
let activeFilter = 'all';

// ── DOM refs ──────────────────────────────────────────────────────────
const grid       = document.getElementById('events-grid');
const loading    = document.getElementById('loading');
const emptyState = document.getElementById('empty-state');
const modal      = document.getElementById('reg-modal');
const formView   = document.getElementById('modal-form-view');
const resultView = document.getElementById('modal-result-view');

// ── Toast ─────────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────
function formatDate(d) {
    return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function isPast(d) { return new Date(d) < new Date(); }

function capacityPercent(confirmed, capacity) {
    return Math.min(100, Math.round((confirmed / capacity) * 100));
}

function capacityClass(pct) {
    if (pct >= 100) return 'full';
    if (pct >= 75)  return 'warn';
    return '';
}

function statusLabel(event) {
    if (isPast(event.date))               return { cls:'status-past',    text:'Event Ended' };
    if (event.confirmedCount >= event.capacity) return { cls:'status-full',    text:'Full — Waitlist Open' };
    const avail = event.capacity - event.confirmedCount;
    if (avail <= 5)                        return { cls:'status-limited', text:`${avail} seats left` };
    return { cls:'status-open', text:`${avail} seats available` };
}

// ── Render event cards ─────────────────────────────────────────────────
function renderCards(events) {
    if (!events.length) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';
    grid.style.display = 'grid';

    grid.innerHTML = events.map(ev => {
        const pct  = capacityPercent(ev.confirmedCount, ev.capacity);
        const cls  = capacityClass(pct);
        const st   = statusLabel(ev);
        const past = isPast(ev.date);
        const full = ev.confirmedCount >= ev.capacity;

        return `
        <article class="event-card" data-id="${ev._id}">
          <div class="card-top">
            <span class="card-cat cat-${ev.category}">${ev.category}</span>
            <span class="card-status ${st.cls}">${st.text}</span>
          </div>
          <h2 class="card-title">${ev.name}</h2>
          ${ev.description ? `<p class="card-desc">${ev.description}</p>` : ''}
          <div class="card-meta">
            <div class="card-meta-item"><span class="icon">📅</span>${formatDate(ev.date)}</div>
            <div class="card-meta-item"><span class="icon">📍</span>${ev.venue || 'TBD'}</div>
          </div>
          <div class="capacity-wrap">
            <div class="capacity-label">
              <span>Capacity</span>
              <span>${ev.confirmedCount} / ${ev.capacity}</span>
            </div>
            <div class="capacity-bar">
              <div class="capacity-fill ${cls}" style="width:${pct}%"></div>
            </div>
            ${ev.waitlistCount > 0 ? `<div class="waitlist-note">⏳ ${ev.waitlistCount} on waitlist</div>` : ''}
          </div>
          <div class="card-footer">
            ${past
              ? `<button class="btn btn-secondary" disabled>Event Ended</button>`
              : `<button class="btn btn-primary" onclick="openModal('${ev._id}')">
                   ${full ? 'Join Waitlist' : 'Register Now'}
                 </button>`
            }
          </div>
        </article>`;
    }).join('');

    // Update hero stats
    document.getElementById('stat-events').textContent = allEvents.length;
    const totalSeats = allEvents.reduce((s, e) => s + Math.max(0, e.capacity - e.confirmedCount), 0);
    document.getElementById('stat-seats').textContent = totalSeats;
}

// ── Fetch all events ──────────────────────────────────────────────────
async function fetchEvents() {
    loading.style.display = 'block';
    grid.style.display = 'none';
    emptyState.style.display = 'none';
    try {
        const res = await fetch(`${API}/api/events`);
        if (!res.ok) throw new Error('Failed to load events');
        allEvents = await res.json();
        applyFilter();
    } catch (err) {
        showToast(err.message, 'error');
        emptyState.style.display = 'block';
    } finally {
        loading.style.display = 'none';
    }
}

// ── Filter ────────────────────────────────────────────────────────────
function applyFilter() {
    const filtered = activeFilter === 'all'
        ? allEvents
        : allEvents.filter(e => e.category === activeFilter);
    renderCards(filtered);
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        applyFilter();
    });
});

// ── Modal open ────────────────────────────────────────────────────────
function openModal(eventId) {
    const ev = allEvents.find(e => e._id === eventId);
    if (!ev) return;

    document.getElementById('reg-event-id').value = eventId;
    document.getElementById('modal-title').textContent = `Register for ${ev.name}`;
    const isFull = ev.confirmedCount >= ev.capacity;
    document.getElementById('modal-subtitle').textContent = isFull
        ? `⏳ Event is full. You'll be added to the waitlist (position ${ev.waitlistCount + 1}).`
        : `📅 ${formatDate(ev.date)}  ·  ${ev.capacity - ev.confirmedCount} seats available`;
    document.getElementById('reg-btn-text').textContent = isFull ? 'Join Waitlist' : 'Register Now';

    // Reset form
    document.getElementById('reg-form').reset();
    clearErrors();
    formView.style.display = 'block';
    resultView.style.display = 'none';
    modal.style.display = 'flex';
    document.getElementById('reg-name').focus();
}

function closeModal() {
    modal.style.display = 'none';
    fetchEvents(); // Refresh seat counts
}

document.getElementById('modal-close-btn').addEventListener('click', closeModal);
document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
document.getElementById('result-close-btn').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

// ── Form validation ────────────────────────────────────────────────────
function clearErrors() {
    ['name','email','phone','year'].forEach(f => {
        const el = document.getElementById(`err-${f}`);
        if (el) el.textContent = '';
    });
}

function validateForm() {
    clearErrors();
    let valid = true;
    const name  = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const year  = document.getElementById('reg-year').value;

    if (!name) { document.getElementById('err-name').textContent = 'Name is required'; valid = false; }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        document.getElementById('err-email').textContent = 'Valid email is required'; valid = false;
    }
    if (phone && !/^[0-9+\s\-]{7,15}$/.test(phone)) {
        document.getElementById('err-phone').textContent = 'Enter a valid phone number'; valid = false;
    }
    if (!year) { document.getElementById('err-year').textContent = 'Please select your year'; valid = false; }
    return valid;
}

// ── Form submit ───────────────────────────────────────────────────────
document.getElementById('reg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const submitBtn = document.getElementById('reg-submit-btn');
    submitBtn.disabled = true;
    document.getElementById('reg-btn-text').textContent = 'Submitting…';

    const payload = {
        eventId:    document.getElementById('reg-event-id').value,
        name:       document.getElementById('reg-name').value.trim(),
        email:      document.getElementById('reg-email').value.trim(),
        phone:      document.getElementById('reg-phone').value.trim(),
        department: document.getElementById('reg-dept').value.trim(),
        year:       document.getElementById('reg-year').value,
    };

    try {
        const res  = await fetch(`${API}/api/registrations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || 'Registration failed', 'error');
            return;
        }

        // Show result view
        formView.style.display = 'none';
        resultView.style.display = 'block';

        if (data.status === 'confirmed') {
            document.getElementById('result-icon').textContent  = '🎉';
            document.getElementById('result-title').textContent = 'Registration Confirmed!';
            document.getElementById('result-msg').textContent   = `You're all set, ${payload.name}!`;
            const badge = document.getElementById('result-badge');
            badge.className = 'result-badge result-confirmed';
            badge.textContent = '✓ Confirmed';
        } else {
            const pos = data.registration?.waitlistPosition || '?';
            document.getElementById('result-icon').textContent  = '⏳';
            document.getElementById('result-title').textContent = 'Added to Waitlist';
            document.getElementById('result-msg').textContent   = `The event is full. You're #${pos} on the waitlist.`;
            const badge = document.getElementById('result-badge');
            badge.className = 'result-badge result-waitlisted';
            badge.textContent = `Waitlist #${pos}`;
        }
    } catch (err) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        document.getElementById('reg-btn-text').textContent = 'Register Now';
    }
});

// ── Init ───────────────────────────────────────────────────────────────
fetchEvents();

// ═══════════════════════════════════════════════════════════════════════
// MY REGISTRATIONS — Student self-cancel section
// ═══════════════════════════════════════════════════════════════════════

// ── Collapsible toggle ─────────────────────────────────────────────────
const myRegsToggle  = document.getElementById('my-regs-toggle');
const myRegsBody    = document.getElementById('my-regs-body');
const myRegsChevron = document.getElementById('my-regs-chevron');

myRegsToggle.addEventListener('click', toggleMyRegs);
myRegsToggle.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMyRegs(); }
});

function toggleMyRegs() {
    const open = myRegsBody.classList.toggle('open');
    myRegsChevron.classList.toggle('open', open);
    myRegsToggle.setAttribute('aria-expanded', open);
    if (open) document.getElementById('lookup-email').focus();
}

// ── Email lookup ───────────────────────────────────────────────────────
const lookupBtn   = document.getElementById('lookup-btn');
const lookupInput = document.getElementById('lookup-email');
const resultsDiv  = document.getElementById('my-regs-results');

lookupBtn.addEventListener('click', doLookup);
lookupInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLookup(); });

async function doLookup() {
    const email = lookupInput.value.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        resultsDiv.innerHTML = `<p class="my-reg-empty" style="color:var(--error);">Please enter a valid email address.</p>`;
        return;
    }

    lookupBtn.disabled = true;
    lookupBtn.textContent = 'Looking up…';
    resultsDiv.innerHTML = `<p class="my-reg-empty">Searching…</p>`;

    try {
        const res  = await fetch(`${API}/api/registrations/student/${encodeURIComponent(email)}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Lookup failed');

        if (!data.length) {
            resultsDiv.innerHTML = `<p class="my-reg-empty">No active registrations found for <strong>${email}</strong>.</p>`;
            return;
        }

        renderMyRegs(data);
    } catch (err) {
        resultsDiv.innerHTML = `<p class="my-reg-empty" style="color:var(--error);">${err.message}</p>`;
    } finally {
        lookupBtn.disabled = false;
        lookupBtn.textContent = 'Look Up';
    }
}

// ── Render results ─────────────────────────────────────────────────────
function renderMyRegs(regs) {
    resultsDiv.innerHTML = `<div class="my-regs-list">${regs.map(r => {
        const ev      = r.eventId;   // populated object from server
        const evName  = ev?.name  ?? 'Unknown Event';
        const evDate  = ev?.date  ? formatDate(ev.date) : '—';
        const evVenue = ev?.venue ?? '—';
        const evCat   = ev?.category ?? '';

        const statusBadge = r.status === 'confirmed'
            ? `<span class="status-badge badge-confirmed">✓ Confirmed</span>`
            : `<span class="status-badge badge-waitlisted">⏳ Waitlist #${r.waitlistPosition}</span>`;

        return `
        <div class="my-reg-item" id="reg-item-${r._id}">
          <div class="my-reg-event">
            <div class="my-reg-event-name">${evName}</div>
            <div class="my-reg-event-meta">
              ${evCat ? `<span class="card-cat cat-${evCat}" style="font-size:.65rem; padding:2px 8px;">${evCat}</span>` : ''}
              <span>📅 ${evDate}</span>
              <span>📍 ${evVenue}</span>
            </div>
          </div>
          <div class="my-reg-actions">
            ${statusBadge}
            <button class="btn btn-danger btn-sm"
                    id="self-cancel-${r._id}"
                    onclick="selfCancel('${r._id}', '${evName.replace(/'/g, "\\'")}')">
              Cancel
            </button>
          </div>
        </div>`;
    }).join('')}</div>`;
}

// ── Self-cancel ────────────────────────────────────────────────────────
async function selfCancel(regId, eventName) {
    if (!confirm(`Cancel your registration for "${eventName}"?\n\nIf you're confirmed, the next waitlisted student will be promoted automatically.`)) return;

    const btn = document.getElementById(`self-cancel-${regId}`);
    if (btn) { btn.disabled = true; btn.textContent = 'Cancelling…'; }

    try {
        const res  = await fetch(`${API}/api/registrations/${regId}/cancel`, { method: 'PUT' });
        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || 'Cancel failed', 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Cancel'; }
            return;
        }

        // Remove the item from the list with a fade
        const item = document.getElementById(`reg-item-${regId}`);
        if (item) {
            item.style.opacity = '0';
            item.style.transform = 'translateX(20px)';
            item.style.transition = 'opacity .3s ease, transform .3s ease';
            setTimeout(() => item.remove(), 300);
        }

        const msg = data.promoted
            ? `Registration cancelled. ${data.promoted.name} was promoted from the waitlist! 🎉`
            : 'Your registration has been cancelled.';
        showToast(msg, data.promoted ? 'success' : 'warning');

        // Refresh event cards so seat counts update
        fetchEvents();

        // If results list is now empty, show empty state
        setTimeout(() => {
            const list = resultsDiv.querySelector('.my-regs-list');
            if (list && !list.children.length) {
                resultsDiv.innerHTML = `<p class="my-reg-empty">No more active registrations for this email.</p>`;
            }
        }, 400);
    } catch (err) {
        showToast('Network error. Please try again.', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Cancel'; }
    }
}

