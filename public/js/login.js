// public/js/login.js — Login and Register form logic

import { setToken, setUser, redirectIfLoggedIn } from './auth.js';

// Redirect already-logged-in users
redirectIfLoggedIn('/');

// ── Tab switching ─────────────────────────────────────────────────────────────
const tabLogin    = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const panelLogin  = document.getElementById('panel-login');
const panelReg    = document.getElementById('panel-register');

function showTab(tab) {
    const isLogin = tab === 'login';
    tabLogin.classList.toggle('active', isLogin);
    tabRegister.classList.toggle('active', !isLogin);
    tabLogin.setAttribute('aria-selected', isLogin);
    tabRegister.setAttribute('aria-selected', !isLogin);
    panelLogin.style.display  = isLogin ? 'block' : 'none';
    panelReg.style.display    = isLogin ? 'none'  : 'block';
}

tabLogin.addEventListener('click',    () => showTab('login'));
tabRegister.addEventListener('click', () => showTab('register'));

// ── Password toggle ────────────────────────────────────────────────────────────
function setupToggle(btnId, inputId) {
    document.getElementById(btnId).addEventListener('click', () => {
        const inp = document.getElementById(inputId);
        inp.type = inp.type === 'password' ? 'text' : 'password';
    });
}
setupToggle('toggle-login-pw', 'login-password');
setupToggle('toggle-reg-pw',   'reg-password');

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
    const icons = { success:'✅', error:'❌', info:'ℹ️' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => {
        t.classList.add('hiding');
        t.addEventListener('animationend', () => t.remove());
    }, 3500);
}

// ── Error box helper ──────────────────────────────────────────────────────────
function showError(boxId, msg) {
    const box = document.getElementById(boxId);
    box.textContent = msg;
    box.style.display = 'block';
}
function clearError(boxId) {
    const box = document.getElementById(boxId);
    box.textContent = '';
    box.style.display = 'none';
}

// ── Login form ────────────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError('login-error');

    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    let valid = true;
    document.getElementById('err-login-email').textContent = '';
    document.getElementById('err-login-pw').textContent    = '';

    if (!email) { document.getElementById('err-login-email').textContent = 'Email is required'; valid = false; }
    if (!password) { document.getElementById('err-login-pw').textContent = 'Password is required'; valid = false; }
    if (!valid) return;

    const btn  = document.getElementById('login-submit-btn');
    const text = document.getElementById('login-btn-text');
    btn.disabled  = true;
    text.textContent = 'Signing in…';

    try {
        const res  = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
            showError('login-error', data.error || 'Login failed');
            return;
        }

        setToken(data.token);
        setUser(data.user);
        showToast(`Welcome back, ${data.user.name}! 👋`, 'success');
        setTimeout(() => { window.location.href = '/'; }, 800);
    } catch {
        showError('login-error', 'Network error. Please try again.');
    } finally {
        btn.disabled     = false;
        text.textContent = 'Sign In';
    }
});

// ── Register form ──────────────────────────────────────────────────────────────
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError('register-error');

    const name     = document.getElementById('reg-name').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const dept     = document.getElementById('reg-dept').value.trim();
    const year     = document.getElementById('reg-year').value;
    const phone    = document.getElementById('reg-phone').value.trim();
    const role     = document.getElementById('reg-role').value;

    let valid = true;
    ['name','email','pw'].forEach(f => {
        const el = document.getElementById(`err-reg-${f}`);
        if (el) el.textContent = '';
    });

    if (!name)     { document.getElementById('err-reg-name').textContent  = 'Name is required'; valid = false; }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        document.getElementById('err-reg-email').textContent = 'Valid email is required'; valid = false;
    }
    if (!password || password.length < 6) {
        document.getElementById('err-reg-pw').textContent = 'Password must be at least 6 characters'; valid = false;
    }
    if (!valid) return;

    const btn  = document.getElementById('register-submit-btn');
    const text = document.getElementById('register-btn-text');
    btn.disabled     = true;
    text.textContent = 'Creating account…';

    try {
        const res  = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role, department: dept, year, phone }),
        });
        const data = await res.json();

        if (!res.ok) {
            showError('register-error', data.error || 'Registration failed');
            return;
        }

        setToken(data.token);
        setUser(data.user);
        showToast(`Account created! Welcome, ${data.user.name} 🎉`, 'success');
        setTimeout(() => { window.location.href = '/'; }, 800);
    } catch {
        showError('register-error', 'Network error. Please try again.');
    } finally {
        btn.disabled     = false;
        text.textContent = 'Create Account';
    }
});
