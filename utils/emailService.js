// utils/emailService.js — Nodemailer email service
// Gracefully degrades: if GMAIL_USER / GMAIL_APP_PASSWORD not set,
// emails are printed to console instead (useful for development).
//
// Gmail setup (takes 2 minutes):
//   1. Enable 2-Step Verification on your Gmail account
//   2. Go to: Google Account → Security → App passwords
//   3. Create an app password for "Mail" / "Windows Computer"
//   4. Add to .env:
//        GMAIL_USER=your.email@gmail.com
//        GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
//        APP_URL=http://localhost:3000

const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;
const APP_URL    = process.env.APP_URL || 'http://localhost:3000';
const CONFIGURED = !!(GMAIL_USER && GMAIL_PASS);

// Build transporter once
let transporter;
if (CONFIGURED) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });
}

// ── Internal send helper ──────────────────────────────────────────────────────
async function send({ to, subject, html }) {
    if (!CONFIGURED) {
        // Dev fallback: log to console so you can see what would be sent
        console.log('\n📧  [EMAIL — not configured, logged to console]');
        console.log(`    To:      ${to}`);
        console.log(`    Subject: ${subject}`);
        console.log(`    (Set GMAIL_USER + GMAIL_APP_PASSWORD in .env to send real emails)\n`);
        return;
    }
    try {
        await transporter.sendMail({
            from: `"MACE FestHub" <${GMAIL_USER}>`,
            to,
            subject,
            html,
        });
        console.log(`📧  Email sent → ${to}: ${subject}`);
    } catch (err) {
        // Never let email failure break the main flow
        console.error(`⚠️  Email failed (${to}):`, err.message);
    }
}

// ── Shared HTML wrapper ───────────────────────────────────────────────────────
function wrap(bodyContent) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f0f14; font-family: 'Segoe UI', Arial, sans-serif; color: #e2e8f0; }
    .wrapper { max-width: 560px; margin: 32px auto; background: #1a1a2e; border-radius: 16px; overflow: hidden; border: 1px solid rgba(139,92,246,.25); }
    .header { background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 32px 40px; text-align: center; }
    .header h1 { font-size: 1.5rem; font-weight: 700; color: #fff; letter-spacing: -.5px; }
    .header p  { font-size: .85rem; color: rgba(255,255,255,.75); margin-top: 4px; }
    .logo-icon  { font-size: 2rem; margin-bottom: 8px; display: block; }
    .body  { padding: 32px 40px; }
    .body h2 { font-size: 1.1rem; font-weight: 600; color: #f1f5f9; margin-bottom: 20px; }
    .event-card { background: rgba(139,92,246,.1); border: 1px solid rgba(139,92,246,.25); border-radius: 10px; padding: 18px 20px; margin: 16px 0; }
    .event-name { font-size: 1.1rem; font-weight: 700; color: #a78bfa; margin-bottom: 10px; }
    .detail-row { display: flex; gap: 8px; align-items: center; font-size: .85rem; color: #94a3b8; margin: 5px 0; }
    .pill { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: .75rem; font-weight: 600; }
    .pill-confirmed  { background: rgba(34,197,94,.15); color: #4ade80; border: 1px solid rgba(34,197,94,.3); }
    .pill-waitlisted { background: rgba(251,191,36,.15); color: #fbbf24; border: 1px solid rgba(251,191,36,.3); }
    .ticket-box { background: #0f0f14; border: 1px dashed rgba(139,92,246,.4); border-radius: 10px; padding: 16px 20px; margin: 20px 0; text-align: center; }
    .ticket-id  { font-size: 1.4rem; font-weight: 700; letter-spacing: 4px; color: #a78bfa; font-family: monospace; }
    .ticket-label { font-size: .7rem; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .btn { display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: .9rem; margin-top: 16px; }
    .footer { padding: 20px 40px; border-top: 1px solid rgba(255,255,255,.06); text-align: center; font-size: .75rem; color: #475569; }
    .divider { height: 1px; background: rgba(255,255,255,.06); margin: 20px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="logo-icon">⚡</span>
      <h1>MACE FestHub</h1>
      <p>Mar Athanasius College of Engineering</p>
    </div>
    <div class="body">
      ${bodyContent}
    </div>
    <div class="footer">
      This is an automated message from MACE FestHub.<br />
      Visit <a href="${APP_URL}" style="color:#7c3aed;">${APP_URL}</a> to manage your registrations.
    </div>
  </div>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send registration confirmation (confirmed or waitlisted).
 * @param {Object} opts
 * @param {string} opts.to           - Student email
 * @param {string} opts.name         - Student name
 * @param {string} opts.eventName    - Event name
 * @param {string} opts.eventDate    - ISO date string
 * @param {string} opts.venue        - Venue
 * @param {string} opts.category     - Category
 * @param {string} opts.status       - 'confirmed' | 'waitlisted'
 * @param {number} opts.waitlistPos  - Position if waitlisted
 * @param {string} opts.ticketToken  - Unique ticket ID
 * @param {string} opts.registrationId
 */
exports.sendRegistrationConfirmation = async (opts) => {
    const {
        to, name, eventName, eventDate, venue, category,
        status, waitlistPos, ticketToken, registrationId,
    } = opts;

    const isConfirmed = status === 'confirmed';
    const dateStr = new Date(eventDate).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const subject = isConfirmed
        ? `✅ Registration Confirmed — ${eventName}`
        : `⏳ You're on the Waitlist — ${eventName}`;

    const statusPill = isConfirmed
        ? `<span class="pill pill-confirmed">✓ Confirmed</span>`
        : `<span class="pill pill-waitlisted">⏳ Waitlist #${waitlistPos}</span>`;

    const ticketSection = isConfirmed ? `
        <div class="ticket-box">
          <div class="ticket-label">Your Ticket ID</div>
          <div class="ticket-id">${ticketToken}</div>
        </div>
        <p style="text-align:center;">
          <a class="btn" href="${APP_URL}/profile.html">View My Ticket →</a>
        </p>` : `
        <p style="font-size:.85rem; color:#94a3b8; margin-top:16px;">
          You'll receive another email if you get promoted to a confirmed spot. Keep an eye out!
        </p>`;

    const body = `
        <h2>Hey ${name.split(' ')[0]}! 👋</h2>
        <p style="color:#94a3b8; margin-bottom:4px; font-size:.9rem;">
          ${isConfirmed ? 'Your spot is secured for:' : 'You have been added to the waitlist for:'}
        </p>
        <div class="event-card">
          <div class="event-name">${eventName}</div>
          <div class="detail-row">📅 ${dateStr}</div>
          <div class="detail-row">📍 ${venue || 'TBD'}</div>
          <div class="detail-row">🏷️ ${category}</div>
          <div style="margin-top:10px;">${statusPill}</div>
        </div>
        ${ticketSection}
        <div class="divider"></div>
        <p style="font-size:.8rem; color:#64748b;">
          Registered as: <strong style="color:#e2e8f0;">${to}</strong>
        </p>`;

    await send({ to, subject, html: wrap(body) });
};

/**
 * Send waitlist promotion email when a student gets confirmed.
 */
exports.sendWaitlistPromotion = async (opts) => {
    const { to, name, eventName, eventDate, venue, ticketToken } = opts;
    const dateStr = new Date(eventDate).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    const body = `
        <h2>🎉 Good news, ${name.split(' ')[0]}!</h2>
        <p style="color:#94a3b8; margin-bottom:4px; font-size:.9rem;">
          A spot just opened up — you've been promoted from the waitlist!
        </p>
        <div class="event-card">
          <div class="event-name">${eventName}</div>
          <div class="detail-row">📅 ${dateStr}</div>
          <div class="detail-row">📍 ${venue || 'TBD'}</div>
          <div style="margin-top:10px;"><span class="pill pill-confirmed">✓ Now Confirmed</span></div>
        </div>
        <div class="ticket-box">
          <div class="ticket-label">Your Ticket ID</div>
          <div class="ticket-id">${ticketToken}</div>
        </div>
        <p style="text-align:center;">
          <a class="btn" href="${APP_URL}/profile.html">View My Ticket →</a>
        </p>`;

    await send({
        to,
        subject: `🎉 You're In! Waitlist Promotion — ${eventName}`,
        html: wrap(body),
    });
};
