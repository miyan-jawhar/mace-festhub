// utils/ticketService.js — QR code generation helpers

const QRCode = require('qrcode');
const crypto = require('crypto');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

/**
 * Generate a unique 8-character uppercase ticket token.
 * Collision probability at 10k tokens ≈ 0.002% — fine for a college event system.
 */
function generateTicketToken() {
    return crypto.randomBytes(5).toString('base64url').toUpperCase().slice(0, 8);
}

/**
 * Returns a QR code PNG Buffer encoding the ticket verify URL.
 * @param {string} ticketToken
 * @returns {Promise<Buffer>}
 */
async function qrToPngBuffer(ticketToken) {
    const url = `${APP_URL}/verify?token=${ticketToken}`;
    return QRCode.toBuffer(url, {
        type:          'png',
        width:         300,
        margin:        2,
        color: {
            dark:  '#7c3aed',   // purple dots
            light: '#0f0f14',  // dark background
        },
        errorCorrectionLevel: 'M',
    });
}

/**
 * Returns a QR code as a base64 PNG data URL (for inline HTML embedding).
 * @param {string} ticketToken
 * @returns {Promise<string>}
 */
async function qrToDataURL(ticketToken) {
    const url = `${APP_URL}/verify?token=${ticketToken}`;
    return QRCode.toDataURL(url, {
        width:  300,
        margin: 2,
        color: {
            dark:  '#7c3aed',
            light: '#0f0f14',
        },
        errorCorrectionLevel: 'M',
    });
}

module.exports = { generateTicketToken, qrToPngBuffer, qrToDataURL };
