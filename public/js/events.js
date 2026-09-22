// public/js/events.js — Student-facing event listing and registration logic

import { getUser, getToken, renderNavAuth, authHeaders } from './auth.js';

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
    if (isPast(event.date))                        return { cls:'status-past',    text:'Event Ended' };
    if (event.confirmedCount >= event.capacity)    return { cls:'status-full',    text:'Full — Waitlist Open' };
    const avail = event.capacity - event.confirmedCount;
    if (avail <= 5)                                return { cls:'status-limited', text:`${avail} seats left` };
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
            ${ev.fee > 0 ? `<div class="card-meta-item"><span class="icon">💳</span>₹${ev.fee}</div>` : `<div class="card-meta-item"><span class="icon">💳</span>Free</div>`}
            ${ev.eventUrl ? `<div class="card-meta-item"><span class="icon">🔗</span><a href="${ev.eventUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--primary-h);text-decoration:none;font-weight:500;">Learn More →</a></div>` : ''}
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
window.openModal = function openModal(eventId) {
    const ev = allEvents.find(e => e._id === eventId);
    if (!ev) return;

    document.getElementById('reg-event-id').value = eventId;
    document.getElementById('modal-title').textContent = `Register for ${ev.name}`;
    const isFull = ev.confirmedCount >= ev.capacity;
    document.getElementById('modal-subtitle').textContent = isFull
        ? `⏳ Event is full. You'll be added to the waitlist (position ${ev.waitlistCount + 1}).`
        : `📅 ${formatDate(ev.date)}  ·  ${ev.capacity - ev.confirmedCount} seats available`;
    document.getElementById('reg-btn-text').textContent = isFull ? 'Join Waitlist' : 'Register Now';

    const user = getUser();
    const formFields   = document.getElementById('reg-form-fields');
    const loginPrompt  = document.getElementById('login-prompt');
    const loggedInStrip = document.getElementById('logged-in-strip');

    if (user) {
        // Logged-in: show strip, collapse non-essential fields, pre-fill
        loginPrompt.style.display   = 'none';
        loggedInStrip.style.display = 'block';
        document.getElementById('strip-name').textContent  = user.name;
        document.getElementById('strip-email').textContent = user.email;

        // Pre-fill & lock name/email
        document.getElementById('reg-name').value  = user.name  || '';
        document.getElementById('reg-email').value = user.email || '';
        document.getElementById('reg-name').disabled  = true;
        document.getElementById('reg-email').disabled = true;

        // Pre-fill optional fields
        document.getElementById('reg-phone').value = user.phone      || '';
        document.getElementById('reg-dept').value  = user.department || '';
        if (['1','2','3','4'].includes(user.year)) {
            document.getElementById('reg-year').value = user.year;
        }
    } else {
        // Guest: show login prompt, show full form
        loginPrompt.style.display   = 'block';
        loggedInStrip.style.display = 'none';

        // Clear and re-enable all fields
        ['reg-name','reg-email','reg-phone','reg-dept'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.value = ''; el.disabled = false; }
        });
        document.getElementById('reg-year').value = '';
    }

    clearErrors();
    formView.style.display   = 'block';
    resultView.style.display = 'none';
    modal.style.display      = 'flex';

    // Focus first editable field
    const firstInput = document.getElementById(user ? 'reg-phone' : 'reg-name');
    if (firstInput && !firstInput.disabled) firstInput.focus();
};

function closeModal() {
    modal.style.display = 'none';
    // Re-enable locked fields for next open
    ['reg-name','reg-email'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
    });
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

    if (!name)  { document.getElementById('err-name').textContent  = 'Name is required'; valid = false; }
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

    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        const res  = await fetch(`${API}/api/registrations`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (res.status === 402) {
            // Payment required
            const options = {
                key: data.key_id,
                amount: data.amount,
                currency: data.currency,
                name: "MACE FestHub",
                description: `Payment for ${document.getElementById('modal-title').textContent}`,
                order_id: data.order_id,
                handler: async function (response) {
                    // Re-submit registration with payment details
                    payload.razorpay_payment_id = response.razorpay_payment_id;
                    payload.razorpay_order_id = response.razorpay_order_id;
                    payload.razorpay_signature = response.razorpay_signature;
                    
                    showToast('Payment successful. Finalizing registration...', 'info');
                    
                    try {
                        const finalRes = await fetch(`${API}/api/registrations`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(payload)
                        });
                        const finalData = await finalRes.json();
                        if (!finalRes.ok) throw new Error(finalData.error || 'Failed to finalize');
                        handleRegistrationSuccess(finalData, payload);
                    } catch (err) {
                        showToast(err.message, 'error');
                    } finally {
                        submitBtn.disabled = false;
                        document.getElementById('reg-btn-text').textContent = 'Register Now';
                    }
                },
                prefill: {
                    name: payload.name,
                    email: payload.email,
                    contact: payload.phone
                },
                theme: {
                    color: "#3b82f6"
                }
            };
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response){
                showToast('Payment failed: ' + response.error.description, 'error');
                submitBtn.disabled = false;
                document.getElementById('reg-btn-text').textContent = 'Register Now';
            });
            rzp.open();
            return; // Wait for Razorpay callback
        }

        if (!res.ok) {
            showToast(data.error || 'Registration failed', 'error');
            return;
        }

        handleRegistrationSuccess(data, payload);
    } catch (err) {
        showToast('Network error. Please try again.', 'error');
        submitBtn.disabled = false;
        document.getElementById('reg-btn-text').textContent = 'Register Now';
    }
});

function handleRegistrationSuccess(data, payload) {
    // Show result view
    formView.style.display   = 'none';
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

    // If logged in, hint them to their profile
    const user = getUser();
    if (user) {
        showToast('View your registrations on your <a href="/profile.html" style="color:var(--primary-h);text-decoration:underline;">Profile page</a>', 'success');
    }
    
    // Reset button state
    const submitBtn = document.getElementById('reg-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = false;
        document.getElementById('reg-btn-text').textContent = 'Register Now';
    }
}
// ── Init ───────────────────────────────────────────────────────────────
renderNavAuth();
fetchEvents();
