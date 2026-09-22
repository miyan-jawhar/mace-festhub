// controllers/ticketController.js — QR image, PDF e-ticket, and verify endpoints

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const Registration = require('../models/Registration');
const Event        = require('../models/Event');
const { qrToPngBuffer, qrToDataURL } = require('../utils/ticketService');

// ── Auth helper: ensure user owns the registration (or is admin) ──────────────
async function getOwnedRegistration(req, res) {
    const reg = await Registration.findById(req.params.id)
        .populate('eventId', 'name date venue category capacity confirmedCount');
    if (!reg) { res.status(404).json({ error: 'Registration not found' }); return null; }
    if (req.user.role !== 'admin' && reg.email !== req.user.email) {
        res.status(403).json({ error: 'Access denied' }); return null;
    }
    return reg;
}

// ── GET /api/tickets/:id/qr.png — Serve QR as PNG ────────────────────────────
exports.getQR = async (req, res) => {
    try {
        const reg = await getOwnedRegistration(req, res);
        if (!reg) return;
        if (!reg.ticketToken) return res.status(400).json({ error: 'No ticket token for this registration' });

        const pngBuf = await qrToPngBuffer(reg.ticketToken);
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'private, max-age=86400');
        res.send(pngBuf);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/tickets/:id/pdf — Serve PDF e-ticket ────────────────────────────
exports.getPDF = async (req, res) => {
    try {
        const reg = await getOwnedRegistration(req, res);
        if (!reg) return;

        const ev  = reg.eventId;
        const pdf = await buildTicketPDF(reg, ev);

        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition',
            `attachment; filename="MACE_Ticket_${reg.ticketToken || reg._id}.pdf"`);
        res.send(pdf);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/tickets/verify/:token — Scan verification (admin entry check) ────
exports.verifyTicket = async (req, res) => {
    try {
        const reg = await Registration.findOne({ ticketToken: req.params.token })
            .populate('eventId', 'name date venue category');
        if (!reg) return res.status(404).json({ valid: false, error: 'Invalid ticket' });

        res.json({
            valid: true,
            status: reg.status,
            name:   reg.name,
            email:  reg.email,
            event:  reg.eventId?.name,
            date:   reg.eventId?.date,
            venue:  reg.eventId?.venue,
            token:  reg.ticketToken,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── Internal: Build PDF ticket using pdf-lib ──────────────────────────────────
async function buildTicketPDF(reg, ev) {
    const pdfDoc = await PDFDocument.create();
    const page   = pdfDoc.addPage([595, 842]); // A4 portrait
    const { width, height } = page.getSize();

    // Embed built-in fonts (no external font files needed)
    const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontMono   = await pdfDoc.embedFont(StandardFonts.Courier);

    // ── Color palette ──────────────────────────────────────────────────────
    const purple  = rgb(0.486, 0.227, 0.929);   // #7c3aed
    const white   = rgb(1, 1, 1);
    const dark    = rgb(0.063, 0.063, 0.082);    // ~#101015
    const dimText = rgb(0.58, 0.64, 0.75);        // #94a3b8
    const light   = rgb(0.945, 0.961, 0.988);    // #f1f5f9

    // ── Background ────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: 0, width, height, color: dark });

    // ── Header gradient band ──────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: height - 160, width, height: 160, color: purple });

    // College name (no emoji — StandardFonts can't encode them)
    page.drawText('MACE FestHub', {
        x: 40, y: height - 55, size: 22, font: fontBold, color: white,
    });
    page.drawText('Mar Athanasius College of Engineering, Kothamangalam', {
        x: 40, y: height - 80, size: 10, font: fontNormal, color: rgb(0.9, 0.85, 1),
    });

    // 'EVENT TICKET' label top right
    page.drawText('EVENT TICKET', {
        x: width - 140, y: height - 55, size: 10, font: fontBold,
        color: rgb(0.9, 0.85, 1),
    });

    // ── Ticket status badge ───────────────────────────────────────────────
    const isConfirmed = reg.status === 'confirmed';
    const badgeColor  = isConfirmed ? rgb(0.13, 0.77, 0.37) : rgb(0.984, 0.75, 0.141);
    const badgeLabel  = isConfirmed ? 'CONFIRMED' : `WAITLIST #${reg.waitlistPosition}`;
    page.drawRectangle({ x: 40, y: height - 140, width: 100, height: 26, color: badgeColor, borderRadius: 4 });
    page.drawText(badgeLabel, {
        x: 50, y: height - 130, size: 9, font: fontBold, color: dark,
    });

    // ── Event name ────────────────────────────────────────────────────────
    const evName  = ev?.name || 'Event';
    const evDate  = ev?.date ? new Date(ev.date).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }) : 'TBD';
    const evVenue = ev?.venue || 'TBD';
    const evCat   = ev?.category || '';

    page.drawText(evName, {
        x: 40, y: height - 200, size: 24, font: fontBold, color: light,
        maxWidth: width - 80,
    });

    // ── Event detail rows ─────────────────────────────────────────────────
    const details = [
        { label: 'Date',     value: evDate },
        { label: 'Venue',    value: evVenue },
        { label: 'Category', value: evCat.charAt(0).toUpperCase() + evCat.slice(1) },
    ];
    let detailY = height - 240;
    for (const d of details) {
        page.drawText(d.label.toUpperCase(), {
            x: 40, y: detailY, size: 7, font: fontBold, color: dimText,
        });
        page.drawText(d.value, {
            x: 40, y: detailY - 16, size: 12, font: fontNormal, color: light,
        });
        detailY -= 46;
    }

    // ── Separator dashed line ─────────────────────────────────────────────
    const sepY = height - 380;
    for (let x = 40; x < width - 40; x += 12) {
        page.drawLine({
            start: { x, y: sepY }, end: { x: x + 6, y: sepY },
            thickness: 1, color: rgb(0.2, 0.2, 0.3),
        });
    }

    // ── Attendee section ──────────────────────────────────────────────────
    const attendeeY = sepY - 30;
    page.drawText('ATTENDEE', {
        x: 40, y: attendeeY, size: 7, font: fontBold, color: dimText,
    });
    page.drawText(reg.name, {
        x: 40, y: attendeeY - 18, size: 16, font: fontBold, color: light,
    });
    page.drawText(reg.email, {
        x: 40, y: attendeeY - 38, size: 10, font: fontNormal, color: dimText,
    });

    const dept = reg.department ? `${reg.department}` : '';
    const yr   = reg.year ? `Year ${reg.year}` : '';
    const sub  = [dept, yr].filter(Boolean).join('  ·  ');
    if (sub) {
        page.drawText(sub, {
            x: 40, y: attendeeY - 56, size: 9, font: fontNormal, color: dimText,
        });
    }

    // ── Ticket token ──────────────────────────────────────────────────────
    const tokenY = attendeeY - 90;
    page.drawText('TICKET ID', {
        x: 40, y: tokenY, size: 7, font: fontBold, color: dimText,
    });
    page.drawText(reg.ticketToken || '—', {
        x: 40, y: tokenY - 18, size: 22, font: fontMono, color: purple,
    });

    // ── QR Code ───────────────────────────────────────────────────────────
    if (reg.ticketToken) {
        try {
            const qrBuf = await qrToPngBuffer(reg.ticketToken);
            const qrImg = await pdfDoc.embedPng(qrBuf);
            const qrSize = 140;
            page.drawImage(qrImg, {
                x: width - qrSize - 40,
                y: attendeeY - 80,
                width: qrSize,
                height: qrSize,
            });
            page.drawText('Scan for entry', {
                x: width - qrSize - 40 + 18, y: attendeeY - 90,
                size: 8, font: fontNormal, color: dimText,
            });
        } catch { /* QR embedding failed — skip gracefully */ }
    }

    // ── Footer ────────────────────────────────────────────────────────────
    const footerY = 40;
    page.drawRectangle({ x: 0, y: 0, width, height: footerY + 20, color: rgb(0.1, 0.1, 0.15) });
    page.drawText(
        `Generated by MACE FestHub  ·  ${new Date().toLocaleDateString('en-IN')}  ·  This is an official ticket.`,
        { x: 40, y: footerY, size: 7, font: fontNormal, color: dimText }
    );

    return pdfDoc.save();
}
