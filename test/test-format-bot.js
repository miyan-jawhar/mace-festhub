// test/test-format-bot.js
const assert = require('assert');

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
            // Convert any remaining italic pattern
            itemText = itemText.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');
            // Remove any leftover raw asterisks
            itemText = itemText.replace(/\s\*\s/g, ' &bull; ').replace(/\*/g, '');
            out.push(`<li style="margin-bottom:5px; line-height:1.45;">${itemText}</li>`);
        } else {
            if (inList) {
                out.push('</ul>');
                inList = false;
            }
            let itemText = trimmed;
            itemText = itemText.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');
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

// Test with the exact user screenshot snippet
const testInput = "Hands-on bootcamp focusing on generative models and cloud systems. * **RoboWars 2026 76398** ⚔ * **Date:** 9 Oct 2026 | **Venue:** Mechanical Workshop Hall | **Fee:** ₹200 * *Details:* High-octane combat robotics challenge featuring amazing cash prizes! * **AI Swarm Arena 1790305371781** 🤖 * **Date:** 15 Oct 2026 | **Venue:** Robotics Lab | **Fee:** Free * *Tags:* **Robotics**, **Deep Space Tech**, **Drones** * *Details:* An exciting autonomous robotics challenge arena. 🎟 Seats are filling up fast—let me know which one you'd like to dive into and I can guide you through registration!";

const formatted = formatBotMarkdown(testInput);
console.log('--- FORMATTED OUTPUT ---');
console.log(formatted);
console.log('------------------------');

// Assertions
assert(!formatted.includes('*'), 'Output should not contain any raw asterisk characters!');
assert(formatted.includes('<strong>RoboWars 2026 76398</strong>'), 'Should have bolded RoboWars title');
assert(formatted.includes('<strong>Date:</strong>'), 'Should have bolded Date:');
assert(formatted.includes('<em>Details:</em>'), 'Should have italicized Details:');
assert(formatted.includes('<ul'), 'Should have parsed bullet list items');
assert(formatted.includes('<li'), 'Should contain li elements');
console.log('✅ All markdown formatting tests PASSED!');
