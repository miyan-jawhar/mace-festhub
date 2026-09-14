// public/js/auth.js — Shared JWT auth utility for all pages

const AUTH_KEY  = 'mace_token';
const USER_KEY  = 'mace_user';

// ─── Token storage ────────────────────────────────────────────────────────────
export function getToken()       { return localStorage.getItem(AUTH_KEY); }
export function setToken(t)      { localStorage.setItem(AUTH_KEY, t); }
export function clearToken()     { localStorage.removeItem(AUTH_KEY); localStorage.removeItem(USER_KEY); }

// ─── User cache (stored as JSON alongside token) ──────────────────────────────
export function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
}
export function setUser(u)  { localStorage.setItem(USER_KEY, JSON.stringify(u)); }

// ─── Auth headers for fetch calls ─────────────────────────────────────────────
export function authHeaders(extra = {}) {
    const t = getToken();
    return t
        ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...extra }
        : { 'Content-Type': 'application/json', ...extra };
}

// ─── Redirect guard — call on pages that require login ───────────────────────
export function requireLogin() {
    if (!getToken()) { window.location.href = '/login.html'; }
}

// ─── Redirect guard — redirect logged-in users away from login page ───────────
export function redirectIfLoggedIn(to = '/') {
    if (getToken()) { window.location.href = to; }
}

// ─── Logout ──────────────────────────────────────────────────────────────────
export function logout() {
    clearToken();
    window.location.href = '/login.html';
}

// ─── Render the shared navbar auth state ─────────────────────────────────────
// Injects Login / Profile links dynamically into .nav-links
export function renderNavAuth() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    // Remove any existing auth-injected elements
    navLinks.querySelectorAll('[data-auth-dynamic]').forEach(el => el.remove());

    const user = getUser();

    if (user) {
        // Show: Profile  [Admin if admin]  Logout
        if (user.role === 'admin') {
            const adminLink = document.createElement('a');
            adminLink.href = '/admin.html';
            adminLink.textContent = 'Admin';
            adminLink.dataset.authDynamic = '1';
            // Make active if on admin page
            if (window.location.pathname === '/admin.html') adminLink.classList.add('active');
            navLinks.appendChild(adminLink);
        }

        const profileLink = document.createElement('a');
        profileLink.href = '/profile.html';
        profileLink.textContent = `👤 ${user.name.split(' ')[0]}`;
        profileLink.dataset.authDynamic = '1';
        if (window.location.pathname === '/profile.html') profileLink.classList.add('active');
        navLinks.appendChild(profileLink);

        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'btn btn-outline btn-sm nav-logout-btn';
        logoutBtn.textContent = 'Logout';
        logoutBtn.dataset.authDynamic = '1';
        logoutBtn.addEventListener('click', logout);
        navLinks.appendChild(logoutBtn);

    } else {
        const loginLink = document.createElement('a');
        loginLink.href = '/login.html';
        loginLink.textContent = 'Login';
        loginLink.dataset.authDynamic = '1';
        if (window.location.pathname === '/login.html') loginLink.classList.add('active');
        navLinks.appendChild(loginLink);
    }
}

// ─── Refresh user profile from API (call after profile updates) ───────────────
export async function refreshUser() {
    const token = getToken();
    if (!token) return null;
    try {
        const res  = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { clearToken(); return null; }
        const user = await res.json();
        setUser(user);
        return user;
    } catch {
        return null;
    }
}
