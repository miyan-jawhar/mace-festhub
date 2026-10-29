// public/js/login.js — Login / Register page logic
// Includes smart email detection and post-login FA request flow for faculty

import { getToken, setToken, setUser, getUser, renderNavAuth } from './auth.js';

// ─── Redirect if already logged in ───────────────────────────────────────────
if (getToken()) { window.location.replace('/'); }

renderNavAuth();

// ─── Email Pattern Detection ──────────────────────────────────────────────────
//  Student roll number format: b + YY (join year) + dept code (2-4 letters) + roll (3+ digits)
//  Examples: b24co013, b24co018, b24cs001, b23ec052, B24CS3L08
//  Faculty: any other @mace.ac.in  e.g. john.doe@mace.ac.in, hod.cse@mace.ac.in
const STUDENT_ROLL_RE = /^[bB]\d{2}[a-zA-Z]{2,4}\d/;   // b + 2-digit year + 2-4 letters + digit

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
const interestsGroup   = document.getElementById('reg-interests-group');
const officerGroup     = document.getElementById('reg-officer-group');
const facultyNotice    = document.getElementById('faculty-reg-notice');

function applyEmailUI(email) {
    const type = detectEmailType(email);
    updateEmailChip(email, emailChip);
    updateEmailBorderClass(regEmailInput, email);

    const isFaculty = (type === 'faculty');
    if (deptGroup) deptGroup.style.display           = isFaculty ? 'none' : '';
    if (yearGroup) yearGroup.style.display           = isFaculty ? 'none' : '';
    if (interestsGroup) interestsGroup.style.display = isFaculty ? 'none' : '';
    if (officerGroup) officerGroup.style.display     = isFaculty ? 'none' : '';
    if (facultyNotice) facultyNotice.style.display   = isFaculty ? 'flex' : 'none';
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
            // Normal redirect: staff / approvers to profile, students to homepage
            const targetUrl = ['principal', 'faculty_advisor', 'admin'].includes(data.user.role) ? '/profile.html' : '/';
            showToast(`Welcome back, ${data.user.name.split(' ')[0]} 👋`, 'success');
            setTimeout(() => { window.location.replace(targetUrl); }, 700);
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

// ─── Interest Tags Logic ──────────────────────────────────────────────────────
const regTagChipsContainer = document.getElementById('reg-tag-chips');
const regNewTagInput = document.getElementById('reg-new-tag-input');
const btnAddRegTag = document.getElementById('btn-add-reg-tag');
const selectedInterests = new Set(['Robotics', 'Coding & Hackathons', 'AI & Machine Learning']);

async function loadRegistrationTags() {
    if (!regTagChipsContainer) return;
    try {
        const res = await fetch('/api/tags');
        const tags = await res.json();
        renderRegTagChips(tags);
    } catch (e) {
        console.warn('Failed to fetch tags for registration:', e);
    }
}

function renderRegTagChips(availableTags) {
    if (!regTagChipsContainer) return;
    const allTagNames = Array.from(new Set([
        ...availableTags.map(t => t.name),
        ...selectedInterests
    ]));

    regTagChipsContainer.innerHTML = allTagNames.map(name => {
        const isActive = selectedInterests.has(name);
        return `<span class="tag-chip ${isActive ? 'active' : ''}" data-tag="${name}">
            ${isActive ? '✓' : '+'} ${name}
        </span>`;
    }).join('');

    regTagChipsContainer.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const tag = chip.dataset.tag;
            if (selectedInterests.has(tag)) {
                selectedInterests.delete(tag);
                chip.classList.remove('active');
                chip.textContent = `+ ${tag}`;
            } else {
                selectedInterests.add(tag);
                chip.classList.add('active');
                chip.textContent = `✓ ${tag}`;
            }
        });
    });
}

function addNewCustomRegTag() {
    if (!regNewTagInput) return;
    const val = regNewTagInput.value.trim();
    if (!val) return;
    selectedInterests.add(val);
    regNewTagInput.value = '';
    fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: val })
    }).catch(() => {});
    loadRegistrationTags();
}

if (btnAddRegTag) btnAddRegTag.addEventListener('click', addNewCustomRegTag);
if (regNewTagInput) {
    regNewTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addNewCustomRegTag();
        }
    });
}
loadRegistrationTags();

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

    // Check if applying for club officer
    const isOfficer     = document.getElementById('reg-is-officer-checkbox')?.checked;
    const officerClubId = document.getElementById('reg-officer-club')?.value;
    const officerRole   = document.getElementById('reg-officer-role')?.value;
    const officerStmt   = document.getElementById('reg-officer-statement')?.value.trim();

    if (isOfficer) {
        if (!officerClubId) {
            showError('register-error', 'Please select a club for your officer application.');
            return;
        }
        if (!officerStmt) {
            showError('register-error', 'Please enter a motivation statement explaining why you should hold this leadership role.');
            return;
        }
    }

    setLoading('register-submit-btn', 'register-btn-text', true, 'Creating account…');
    try {
        const res  = await fetch('/api/auth/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            // role intentionally omitted — server always assigns 'student'
            body: JSON.stringify({
                name, email, password, department: dept, year, phone,
                interests: Array.from(selectedInterests)
            }),
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
        } else if (isOfficer) {
            try {
                const offRes = await fetch('/api/officer-requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
                    body: JSON.stringify({
                        clubId: officerClubId,
                        requestedRole: officerRole,
                        statement: officerStmt,
                    }),
                });
                const offData = await offRes.json();
                if (!offRes.ok) {
                    showToast(offData.error || 'Account created, but officer request failed.', 'warning');
                } else {
                    showToast('Account created & Officer Application sent to Faculty Advisor! 🎉', 'success');
                }
            } catch {
                showToast('Account created! Submit officer request in Profile.', 'warning');
            }
            setTimeout(() => { window.location.replace('/profile.html'); }, 900);
        } else {
            showToast('Account created! Welcome 🎉', 'success');
            setTimeout(() => { window.location.replace('/'); }, 800);
        }
    } catch { showError('register-error', 'Network error — please try again.'); setLoading('register-submit-btn', 'register-btn-text', false, 'Create Account'); }
});

// ─── Registration Officer Checkbox & Sub-form ────────────────────────────────
let regClubsList = [];

async function loadClubsForRegistration() {
    const sel = document.getElementById('reg-officer-club');
    if (!sel || regClubsList.length > 0) return;
    sel.innerHTML = '<option value="">Loading clubs…</option>';
    try {
        const res = await fetch('/api/clubs');
        regClubsList = await res.json();
        sel.innerHTML = '<option value="">— Choose a club —</option>' +
            regClubsList.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
    } catch {
        sel.innerHTML = '<option value="">Could not load clubs</option>';
    }
}

document.getElementById('reg-is-officer-checkbox')?.addEventListener('change', (e) => {
    const fields = document.getElementById('reg-officer-fields');
    if (fields) {
        fields.style.display = e.target.checked ? 'block' : 'none';
        if (e.target.checked) loadClubsForRegistration();
    }
});

document.getElementById('reg-officer-club')?.addEventListener('change', () => {
    const clubId = document.getElementById('reg-officer-club').value;
    const noteEl = document.getElementById('reg-officer-fa-note');
    if (!noteEl) return;
    const club = regClubsList.find(c => c._id === clubId);
    if (!club) { noteEl.textContent = ''; return; }
    if (club.facultyAdvisor) {
        noteEl.innerHTML = `👨‍🏫 <strong>Faculty Advisor:</strong> ${club.facultyAdvisor.name} (${club.facultyAdvisor.email}) — will review your application.`;
        noteEl.style.color = 'var(--t2)';
    } else {
        noteEl.innerHTML = `⚠️ <em>This club has no Faculty Advisor assigned yet. You can only apply once an FA is assigned.</em>`;
        noteEl.style.color = '#f59e0b';
    }
});

// ─── Demo Fast Fill Handlers ──────────────────────────────────────────────────
document.getElementById('demo-fill-faculty')?.addEventListener('click', () => {
    document.getElementById('login-email').value = 'prof.mathew@mace.ac.in';
    document.getElementById('login-password').value = 'password123';
});
document.getElementById('demo-fill-principal')?.addEventListener('click', () => {
    document.getElementById('login-email').value = 'principal@mace.ac.in';
    document.getElementById('login-password').value = 'principal2026';
});
document.getElementById('demo-fill-president')?.addEventListener('click', () => {
    document.getElementById('login-email').value = 'b24co052@mace.ac.in';
    document.getElementById('login-password').value = 'student123';
});
document.getElementById('demo-fill-student')?.addEventListener('click', () => {
    document.getElementById('login-email').value = 'b24co013@mace.ac.in';
    document.getElementById('login-password').value = 'student123';
});

