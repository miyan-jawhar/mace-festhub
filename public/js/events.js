// public/js/events.js — Student-facing event listing and registration logic

import { getUser, getToken, renderNavAuth, authHeaders } from './auth.js';

const API = '';  // Same origin; Express serves these files

// ── State ────────────────────────────────────────────────────────────
let allEvents = [];
let activeFilter = 'all';
let activeTrack = 'all';

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
          ${ev.tags && ev.tags.length ? `
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin: 8px 0 10px;">
              ${ev.tags.map(t => `<span class="tag-badge" style="background:rgba(124,58,237,0.15); color:#c4b5fd; font-size:0.72rem; padding:2px 8px; border-radius:12px; border:1px solid rgba(139,92,246,0.25);">#${t}</span>`).join('')}
            </div>
          ` : ''}
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
    let filtered = allEvents;
    if (activeFilter !== 'all') {
        filtered = filtered.filter(e => e.category === activeFilter);
    }
    if (activeTrack !== 'all') {
        filtered = filtered.filter(e => (e.tags || []).some(t => t.toLowerCase() === activeTrack.toLowerCase()));
    }
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

async function loadTrackFilter() {
    const bar = document.getElementById('track-filter-bar');
    if (!bar) return;
    try {
        const res = await fetch(`${API}/api/tags`);
        const tags = await res.json();
        if (!tags.length) return;

        bar.innerHTML = `<span class="track-filter-label">Tracks:</span>
            <button class="track-pill ${activeTrack === 'all' ? 'active' : ''}" data-track="all">All Tracks</button>` +
            tags.map(t => `<button class="track-pill ${activeTrack.toLowerCase() === t.name.toLowerCase() ? 'active' : ''}" data-track="${t.name}">#${t.name}</button>`).join('');

        bar.querySelectorAll('.track-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                bar.querySelectorAll('.track-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTrack = btn.dataset.track;
                applyFilter();
            });
        });
    } catch (e) {
        console.warn('Failed to load track filter:', e);
    }
}

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

    const user         = getUser();
    const formFields   = document.getElementById('reg-form-fields');
    const loginPrompt  = document.getElementById('login-prompt');
    const loggedInStrip = document.getElementById('logged-in-strip');
    const roleNotice   = document.getElementById('role-restricted-notice');
    const submitBtn    = document.getElementById('reg-submit-btn');
    const cancelBtn    = document.getElementById('modal-cancel-btn');

    if (user && user.role !== 'student') {
        // Non-student accounts (Principal, Faculty Advisor, Admin) cannot register
        const roleLabels = {
            faculty_advisor: 'Faculty Advisor',
            principal: 'Principal',
            admin: 'Administrator'
        };
        const label = roleLabels[user.role] || user.role;
        loginPrompt.style.display   = 'none';
        loggedInStrip.style.display = 'block';
        document.getElementById('strip-name').textContent  = `${user.name} (${label})`;
        document.getElementById('strip-email').textContent = user.email;

        if (roleNotice) {
            roleNotice.style.display = 'block';
            document.getElementById('role-notice-text').innerHTML =
                `You are currently logged in with a supervisory account (<strong>${label}</strong>).<br>Event participation is open to students only. To oversee approvals and clubs, visit your <a href="/profile.html" style="color:var(--primary-h); font-weight:600;">Dashboard</a>.`;
        }
        formFields.style.display = 'none';
        submitBtn.style.display  = 'none';
        cancelBtn.textContent    = 'Close';
    } else if (user) {
        if (roleNotice) roleNotice.style.display = 'none';
        formFields.style.display = 'grid';
        submitBtn.style.display  = 'inline-flex';
        cancelBtn.textContent    = 'Cancel';

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
        if (roleNotice) roleNotice.style.display = 'none';
        formFields.style.display = 'grid';
        submitBtn.style.display  = 'inline-flex';
        cancelBtn.textContent    = 'Cancel';

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

    // Focus first editable field if student
    if (!user || user.role === 'student') {
        const firstInput = document.getElementById(user ? 'reg-phone' : 'reg-name');
        if (firstInput && !firstInput.disabled) firstInput.focus();
    }
};

function closeModal() {
    modal.style.display = 'none';
    // Re-enable locked fields for next open
    ['reg-name','reg-email'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
    });
    document.getElementById('reg-form-fields').style.display = 'grid';
    document.getElementById('reg-submit-btn').style.display  = 'inline-flex';
    document.getElementById('modal-cancel-btn').textContent = 'Cancel';
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
                name: "MACE EventHub",
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

// ─── EventBot AI Campus Assistant ──────────────────────────────────────────
const eventbotModal    = document.getElementById('eventbot-modal') || document.getElementById('festbot-modal');
const eventbotOpenBtn  = document.getElementById('eventbot-open-btn') || document.getElementById('festbot-open-btn');
const eventbotCloseBtn = document.getElementById('eventbot-close-btn') || document.getElementById('festbot-close-btn');
const eventbotForm     = document.getElementById('eventbot-form') || document.getElementById('festbot-form');
const eventbotInput    = document.getElementById('eventbot-input') || document.getElementById('festbot-input');
const eventbotMessages = document.getElementById('eventbot-messages') || document.getElementById('festbot-messages');

let eventbotHistory = [];

/**
 * Clean markdown-to-HTML parser that converts markdown asterisks, bolding,
 * italics, and list items into clean, beautiful HTML elements without raw stars.
 */
function formatBotMarkdown(text) {
    if (!text) return '';
    let raw = String(text).replace(/\r\n/g, '\n');

    // 1. Normalize inline chained bullets: e.g. ' * **' or ' * *' or ' * Event'
    // Converts inline asterisks used as delimiters into clean newline bullets
    let normalized = raw.replace(/([^\n])\s+\*\s+(\*\*|\*|[A-Z0-9\u00a9-\uFFFF])/g, '$1\n* $2');

    // 2. Escape HTML entities
    let clean = normalized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 3. Headers: ### Header -> <h4>, ## Header -> <h3>
    clean = clean.replace(/^### (.*$)/gim, '<h4 style="margin:8px 0 4px;font-size:0.92rem;font-weight:700;color:#c4b5fd;">$1</h4>');
    clean = clean.replace(/^## (.*$)/gim, '<h3 style="margin:10px 0 4px;font-size:0.96rem;font-weight:700;color:#c4b5fd;">$1</h3>');

    // 4. Bold: **text** or __text__
    clean = clean.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    clean = clean.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // 5. Italic: *text* (must not start or end with whitespace)
    clean = clean.replace(/(^|[^\*])\*([^\*\s][^\*\n]*?[^\*\s]|[^\*\s])\*([^\*]|$)/g, '$1<em>$2</em>$3');

    // 6. Inline code: `code`
    clean = clean.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.12);padding:2px 5px;border-radius:4px;font-size:0.85em;">$1</code>');

    // 7. Process lines into paragraphs and list items
    const lines = clean.split('\n');
    let out = [];
    let inList = false;

    for (let line of lines) {
        let trimmed = line.trim();
        if (!trimmed) continue;

        // Check if line starts with a list bullet marker
        const bulletMatch = trimmed.match(/^[\*\-\•]\s+(.*)$/);
        if (bulletMatch) {
            if (!inList) {
                out.push('<ul style="margin:6px 0 8px; padding-left:18px; list-style-type:disc;">');
                inList = true;
            }
            let itemText = bulletMatch[1].trim();
            itemText = itemText.replace(/(^|[^\*])\*([^\*\s][^\*\n]*?[^\*\s]|[^\*\s])\*([^\*]|$)/g, '$1<em>$2</em>$3');
            itemText = itemText.replace(/\s\*\s/g, ' &bull; ').replace(/\*/g, '');
            out.push(`<li style="margin-bottom:5px; line-height:1.45;">${itemText}</li>`);
        } else {
            if (inList) {
                out.push('</ul>');
                inList = false;
            }
            let itemText = trimmed;
            itemText = itemText.replace(/(^|[^\*])\*([^\*\s][^\*\n]*?[^\*\s]|[^\*\s])\*([^\*]|$)/g, '$1<em>$2</em>$3');
            itemText = itemText.replace(/\s\*\s/g, ' &bull; ').replace(/\*/g, '');
            out.push(`<p style="margin:4px 0 6px; line-height:1.45;">${itemText}</p>`);
        }
    }
    if (inList) out.push('</ul>');

    let result = out.join('');
    // Absolute guarantee: no stray raw asterisks remain anywhere in the rendered HTML
    result = result.replace(/\*/g, '');
    return result;
}

function appendEventbotMessage(text, role) {
    if (!eventbotMessages) return null;
    const msg = document.createElement('div');
    msg.className = `eventbot-msg festbot-msg ${role}`;
    if (role === 'bot') {
        msg.innerHTML = formatBotMarkdown(text);
    } else {
        msg.textContent = text;
    }
    eventbotMessages.appendChild(msg);
    eventbotMessages.scrollTop = eventbotMessages.scrollHeight;
    return msg;
}

async function handleEventbotQuestion(question) {
    appendEventbotMessage(question, 'user');
    const loadingMsg = appendEventbotMessage('Thinking… 💭', 'bot');

    try {
        const res = await fetch(`${API}/api/ai/event-bot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, history: eventbotHistory })
        });
        const data = await res.json();
        loadingMsg?.remove();

        if (!res.ok) {
            appendEventbotMessage(data.error || 'Sorry, I hit a snag answering that.', 'bot');
            return;
        }

        appendEventbotMessage(data.answer, 'bot');
        eventbotHistory.push({ role: 'user', content: question });
        eventbotHistory.push({ role: 'assistant', content: data.answer });
    } catch {
        loadingMsg?.remove();
        appendEventbotMessage('Network error. Please try asking again.', 'bot');
    }
}

if (eventbotOpenBtn && eventbotModal) {
    eventbotOpenBtn.addEventListener('click', () => {
        const isHidden = eventbotModal.style.display === 'none';
        eventbotModal.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) eventbotInput?.focus();
    });
    eventbotCloseBtn?.addEventListener('click', () => {
        eventbotModal.style.display = 'none';
    });

    document.querySelectorAll('.eventbot-quick-chip, .festbot-quick-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const q = chip.dataset.q;
            if (q) handleEventbotQuestion(q);
        });
    });

    eventbotForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = eventbotInput.value.trim();
        if (!text) return;
        eventbotInput.value = '';
        handleEventbotQuestion(text);
    });
}

// ── Init ───────────────────────────────────────────────────────────────
renderNavAuth();
fetchEvents();
loadTrackFilter();
