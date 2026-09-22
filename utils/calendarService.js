// utils/calendarService.js
const { google } = require('googleapis');
const User = require('../models/User');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    '/api/auth/google/callback'
);

/**
 * Adds an event to the user's Google Calendar if they have a connected Google account.
 * 
 * @param {string} userId - The MongoDB User ID
 * @param {Object} event - The MACE FestHub Event object
 * @param {Object} registration - The student's Registration object
 */
exports.addEventToCalendar = async (userId, event, registration) => {
    try {
        const user = await User.findById(userId).select('+googleRefreshToken');
        if (!user || !user.googleRefreshToken) {
            console.log(`📅  [Calendar] User ${userId} does not have a Google Refresh Token. Skipping.`);
            return;
        }

        oauth2Client.setCredentials({
            refresh_token: user.googleRefreshToken
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // Calculate end time (assume 3 hours if not specified)
        const startDate = new Date(event.date);
        const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);

        const ticketUrl = `${APP_URL}/profile.html`;
        const description = `
You are registered for ${event.name}!
Status: ${registration.status === 'confirmed' ? '✅ Confirmed' : `⏳ Waitlisted (#${registration.waitlistPosition})`}
${registration.ticketToken ? `Ticket ID: ${registration.ticketToken}` : ''}

View your ticket here: ${ticketUrl}

Description:
${event.description || 'No additional details.'}
        `.trim();

        const calendarEvent = {
            summary: `${event.name} - MACE FestHub`,
            location: event.venue || 'MACE Campus',
            description,
            start: {
                dateTime: startDate.toISOString(),
                timeZone: 'Asia/Kolkata', // IST timezone
            },
            end: {
                dateTime: endDate.toISOString(),
                timeZone: 'Asia/Kolkata',
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 }, // 1 day before
                    { method: 'popup', minutes: 60 },      // 1 hour before
                ],
            },
        };

        const res = await calendar.events.insert({
            calendarId: 'primary',
            resource: calendarEvent,
            sendUpdates: 'all',
        });

        console.log(`📅  [Calendar] Event added to Google Calendar for ${user.email}. Link: ${res.data.htmlLink}`);
    } catch (err) {
        console.error(`❌  [Calendar] Failed to add event for user ${userId}:`, err.message);
    }
};
