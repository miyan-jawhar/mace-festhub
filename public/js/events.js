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

        const passCard = document.getElementById('ticket-pass-card');
        const printBtn = document.getElementById('print-ticket-btn');

        if (data.status === 'confirmed') {
            document.getElementById('result-icon').textContent  = '🎉';
            document.getElementById('result-title').textContent = 'Registration Confirmed!';
            document.getElementById('result-msg').textContent   = `You're all set, ${payload.name}! Here is your E-Ticket Pass:`;
            const badge = document.getElementById('result-badge');
            badge.className = 'result-badge result-confirmed';
            badge.textContent = '✓ Confirmed Pass';

            // Populate Digital Pass Card (Step 9 Feature)
            const ev = allEvents.find(e => e._id === payload.eventId);
            const passCode = `MACE-${Math.floor(1000 + Math.random() * 9000)}-${data.registration?._id?.slice(-4).toUpperCase() || 'PASS'}`;
            
            document.getElementById('ticket-code').textContent = `#${passCode}`;
            document.getElementById('ticket-event-name').textContent = ev ? ev.name : 'MACE Campus Event';
            document.getElementById('ticket-student-info').textContent = `${payload.name} • ${payload.department || 'Student'} (Year ${payload.year})`;
            document.getElementById('ticket-date').textContent = ev ? formatDate(ev.date) : 'Upcoming Date';
            document.getElementById('ticket-venue').textContent = ev ? (ev.venue || 'MACE Campus') : 'MACE Campus';

            passCard.style.display = 'block';
            printBtn.style.display = 'inline-flex';
        } else {
            const pos = data.registration?.waitlistPosition || '?';
            document.getElementById('result-icon').textContent  = '⏳';
            document.getElementById('result-title').textContent = 'Added to Waitlist';
            document.getElementById('result-msg').textContent   = `The event is full. You're #${pos} on the waitlist.`;
            const badge = document.getElementById('result-badge');
            badge.className = 'result-badge result-waitlisted';
            badge.textContent = `Waitlist #${pos}`;

            passCard.style.display = 'none';
            printBtn.style.display = 'none';
        }
    } catch (err) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        document.getElementById('reg-btn-text').textContent = 'Register Now';
    }
});

// ── View Switcher (Grid vs Timeline Schedule) ──────────────────────────
let currentView = 'grid';

const gridBtn     = document.getElementById('view-grid-btn');
const timelineBtn = document.getElementById('view-timeline-btn');

if (gridBtn && timelineBtn) {
    gridBtn.addEventListener('click', () => {
        currentView = 'grid';
        gridBtn.classList.add('active');
        timelineBtn.classList.remove('active');
        applyFilter();
    });
    timelineBtn.addEventListener('click', () => {
        currentView = 'timeline';
        timelineBtn.classList.add('active');
        gridBtn.classList.remove('active');
        applyFilter();
    });
}

function renderTimeline(events) {
    if (!events.length) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';
    grid.style.display = 'flex';
    grid.className = 'events-timeline';

    grid.innerHTML = events.map(ev => {
        const d = new Date(ev.date);
        const day = d.getDate();
        const month = d.toLocaleDateString('en-IN', { month: 'short' });
        const st = statusLabel(ev);
        const full = ev.confirmedCount >= ev.capacity;
        const past = isPast(ev.date);

        return `
        <div class="timeline-item">
          <div class="timeline-date">
            <div class="timeline-day">${day}</div>
            <div class="timeline-month">${month}</div>
          </div>
          <div class="timeline-details">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="card-cat cat-${ev.category}">${ev.category}</span>
              <span class="card-status ${st.cls}">${st.text}</span>
            </div>
            <h3 class="timeline-title">${ev.name}</h3>
            <div class="timeline-meta">
              📍 ${ev.venue || 'TBD'} • 👥 ${ev.confirmedCount}/${ev.capacity} Seats
            </div>
          </div>
          <div>
            ${past
              ? `<button class="btn btn-secondary btn-sm" disabled>Ended</button>`
              : `<button class="btn btn-primary btn-sm" onclick="openModal('${ev._id}')">
                   ${full ? 'Waitlist' : 'Register'}
                 </button>`
            }
          </div>
        </div>`;
    }).join('');
}

// Modify applyFilter to support both grid and timeline views
const originalApplyFilter = applyFilter;
applyFilter = function() {
    const filtered = activeFilter === 'all'
        ? allEvents
        : allEvents.filter(e => e.category === activeFilter);
        
    if (currentView === 'timeline') {
        renderTimeline(filtered);
    } else {
        grid.className = 'events-grid';
        renderCards(filtered);
    }
};

// ── Init ───────────────────────────────────────────────────────────────
fetchEvents();
