// public/js/login.js — Login / Register page logic
// Includes smart email detection and post-login FA request flow for faculty

import { getToken, setToken, setUser, getUser, renderNavAuth } from './auth.js';

// ─── Redirect if already logged in ───────────────────────────────────────────
if (getToken()) { window.location.replace('/'); }

renderNavAuth();

// ─── Email Pattern Detection ──────────────────────────────────────────────────
//  Student roll: starts with B + 2 digits before @mace.ac.in
//    e.g. B24CS3L08@mace.ac.in, b22me001@mace.ac.in
//  Faculty: any other @mace.ac.in pattern
//    e.g. john.doe@mace.ac.in, hod.cse@mace.ac.in
const STUDENT_ROLL_RE = /^[bB]\d{2}[a-zA-Z0-9._]+$/;

function detectEmailType(email) {
    const lower = email.toLowerCase().trim();
    if (!lower.endsWith('@mace.ac.in')) return 'external';
    const local = lower.split('@')[0];
    return STUDENT_ROLL_RE.test(local) ? 'student' : 'faculty';
}

// ─── Chip labels / icon ───────────────────────────────────────────────────────
const CHIP_CONFIG = {
    student:  { icon: '🎒', text: 'Student roll number detected',     cls: 'student' },
    faculty:  { icon: '🎓', text: 'Faculty / Staff email detected',   cls: 'faculty' },
    external: { icon: '🔒', text: 'Use your @mace.ac.in email',       cls: 'external' },
};

function updateEmailChip(email, chipEl) {
    const type = email.trim() ? detectEmailType(email) : null;
    if (!type) {
        chipEl.className = 'email-type-chip';
        chipEl.textContent = '';
        return;
    }
    const cfg = CHIP_CONFIG[type];
    chipEl.textContent = `${cfg.icon} ${cfg.text}`;
    chipEl.className = `email-type-chip visible ${cfg.cls}`;
}

function updateEmailBorderClass(inputEl, email) {
    inputEl.classList.remove('email-student', 'email-faculty');
    if (!email.trim()) return;
    const type = detectEmailType(email);
    if (type === 'student') inputEl.classList.add('email-student');
    if (type === 'faculty') inputEl.classList.add('email-faculty');
}

// ─── Register form — dynamic fields ──────────────────────────────────────────
const regEmailInput    = document.getElementById('reg-email');
const emailChip        = document.getElementById('email-type-chip');
const deptGroup        = document.getElementById('reg-dept-group');
const yearGroup        = document.getElementById('reg-year-group');
const facultyNotice    = document.getElementById('faculty-reg-notice');

function applyEmailUI(email) {
    const type = detectEmailType(email);
    updateEmailChip(email, emailChip);
    updateEmailBorderClass(regEmailInput, email);

    const isFaculty = (type === 'faculty');
    deptGroup.style.display     = isFaculty ? 'none' : '';
    yearGroup.style.display     = isFaculty ? 'none' : '';
    facultyNotice.style.display = isFaculty ? 'flex' : 'none';
}

regEmailInput.addEventListener('input',  () => applyEmailUI(regEmailInput.value));
regEmailInput.addEventListener('blur',   () => applyEmailUI(regEmailInput.value));

// ─── Tab switching ────────────────────────────────────────────────────────────
const tabs = {
    login:    { tab: document.getElementById('tab-login'),    panel: document.getElementById('panel-login') },
    register: { tab: document.getElementById('tab-register'), panel: document.getElementById('panel-register') },
};

function showTab(name) {
    Object.entries(tabs).forEach(([n, { tab, panel }]) => {
        const active = n === name;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', active);
        panel.style.display = active ? 'block' : 'none';
    });
    document.getElementById('panel-fa-request').style.display = 'none';
}

tabs.login.tab.addEventListener('click',    () => showTab('login'));
tabs.register.tab.addEventListener('click', () => showTab('register'));

// ─── Password toggles ─────────────────────────────────────────────────────────
function bindPwToggle(btnId, inputId) {
    document.getElementById(btnId).addEventListener('click', () => {
        const inp = document.getElementById(inputId);
        inp.type = inp.type === 'password' ? 'text' : 'password';
    });
}
bindPwToggle('toggle-login-pw', 'login-password');
bindPwToggle('toggle-reg-pw',   'reg-password');

// ─── Toast ────────────────────────────────────────────────────────────────────
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

function showError(elId, msg) {
    const el = document.getElementById(elId);
    el.textContent = msg;
    el.style.display = 'block';
}
function clearError(elId) {
    const el = document.getElementById(elId);
    el.textContent = '';
    el.style.display = 'none';
}

function setLoading(btnId, textId, loading, label = 'Submit') {
    const btn  = document.getElementById(btnId);
    const span = document.getElementById(textId);
    btn.disabled    = loading;
    span.innerHTML  = loading
        ? `<span style="display:inline-flex;align-items:center;gap:6px;">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                  style="animation:spin .6s linear infinite;">
               <circle cx="12" cy="12" r="10" stroke-opacity=".25"/>
               <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
             </svg>${label}</span>`
        : label;
}

// ─── Sign In ──────────────────────────────────────────────────────────────────
let loggedInToken = null;
let loggedInUser  = null;

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError('login-error');

    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showError('login-error', 'Email and password are required.');
        return;
    }

    setLoading('login-submit-btn', 'login-btn-text', true, 'Signing in…');
    try {
        const res  = await fetch('/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        setLoading('login-submit-btn', 'login-btn-text', false, 'Sign In');

        if (!res.ok) { showError('login-error', data.error || 'Login failed.'); return; }

        setToken(data.token);
        setUser(data.user);
        loggedInToken = data.token;
        loggedInUser  = data.user;

        // ── Faculty post-login check ──────────────────────────────────────────
        // If email looks like faculty AND the account is not already an FA/Principal
        const emailType = detectEmailType(email);
        if (emailType === 'faculty' && !['faculty_advisor', 'principal', 'admin'].includes(data.user.role)) {
            await showFARequestStep();
        } else {
            // Normal redirect
            showToast(`Welcome back, ${data.user.name.split(' ')[0]} 👋`, 'success');
            setTimeout(() => { window.location.replace('/'); }, 700);
        }
    } catch { showError('login-error', 'Network error — please try again.'); setLoading('login-submit-btn', 'login-btn-text', false, 'Sign In'); }
});

// ─── FA Request Step (shown after login for faculty emails) ──────────────────
async function showFARequestStep() {
    // Hide all panels, show FA step
    Object.values(tabs).forEach(({ panel }) => panel.style.display = 'none');
    const faPanel = document.getElementById('panel-fa-request');
    faPanel.style.display = 'block';

    // Load clubs into select
    const sel = document.getElementById('fa-club-select');
    sel.innerHTML = '<option value="">Loading clubs…</option>';
    try {
        const res   = await fetch('/api/clubs');
        const clubs = await res.json();
        sel.innerHTML = '<option value="">— Choose a club —</option>';
        clubs.forEach(c => {
            const opt = document.createElement('option');
            opt.value       = c._id;
            opt.textContent = c.name + (c.facultyAdvisor ? ` (FA: ${c.facultyAdvisor.name})` : ' — No FA assigned');
            sel.appendChild(opt);
        });
    } catch {
        sel.innerHTML = '<option value="">Could not load clubs</option>';
    }
}

// Submit FA request
document.getElementById('fa-submit-btn').addEventListener('click', async () => {
    clearError('fa-request-error');
    const clubId = document.getElementById('fa-club-select').value;
    const note   = document.getElementById('fa-note').value.trim();

    if (!clubId) {
        showError('fa-request-error', 'Please select a club first.');
        return;
    }

    setLoading('fa-submit-btn', 'fa-btn-text', true, 'Sending…');
    try {
        const res  = await fetch('/api/fa-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loggedInToken}` },
            body: JSON.stringify({ clubId, note }),
        });
        const data = await res.json();
        setLoading('fa-submit-btn', 'fa-btn-text', false, 'Send Request');

        if (!res.ok) { showError('fa-request-error', data.error || 'Could not submit request.'); return; }

        showToast('Request sent to Principal ✓', 'success');
        setTimeout(() => { window.location.replace('/'); }, 1000);
    } catch {
        showError('fa-request-error', 'Network error — please try again.');
        setLoading('fa-submit-btn', 'fa-btn-text', false, 'Send Request');
    }
});

// Skip FA request → go home
document.getElementById('fa-skip-btn').addEventListener('click', () => {
    showToast(`Welcome, ${loggedInUser?.name?.split(' ')[0] || 'there'} 👋`, 'success');
    setTimeout(() => { window.location.replace('/'); }, 700);
});

// ─── Register ─────────────────────────────────────────────────────────────────
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError('register-error');

    const name     = document.getElementById('reg-name').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const dept     = document.getElementById('reg-dept').value.trim();
    const year     = document.getElementById('reg-year').value;
    const phone    = document.getElementById('reg-phone').value.trim();

    // Client validation
    let valid = true;
    const clearFE = (id) => { document.getElementById(id).textContent = ''; };
    const setFE   = (id, msg) => { document.getElementById(id).textContent = msg; valid = false; };

    clearFE('err-reg-name'); clearFE('err-reg-email'); clearFE('err-reg-pw');
    if (!name)    setFE('err-reg-name',  'Full name is required.');
    if (!email)   setFE('err-reg-email', 'Email is required.');
    if (!password)                setFE('err-reg-pw', 'Password is required.');
    else if (password.length < 6) setFE('err-reg-pw', 'Password must be at least 6 characters.');
    if (!valid) return;

    setLoading('register-submit-btn', 'register-btn-text', true, 'Creating account…');
    try {
        const res  = await fetch('/api/auth/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            // role intentionally omitted — server always assigns 'student'
            body: JSON.stringify({ name, email, password, department: dept, year, phone }),
        });
        const data = await res.json();
        setLoading('register-submit-btn', 'register-btn-text', false, 'Create Account');

        if (!res.ok) { showError('register-error', data.error || 'Registration failed.'); return; }

        setToken(data.token);
        setUser(data.user);
        loggedInToken = data.token;
        loggedInUser  = data.user;

        // Faculty email registered → show FA step
        if (detectEmailType(email) === 'faculty') {
            await showFARequestStep();
        } else {
            showToast('Account created! Welcome 🎉', 'success');
            setTimeout(() => { window.location.replace('/'); }, 800);
        }
    } catch { showError('register-error', 'Network error — please try again.'); setLoading('register-submit-btn', 'register-btn-text', false, 'Create Account'); }
});
