// utils/geminiService.js — Gemini AI integration for MACE EventHub
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
const MODELS = ['gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-flash-latest'];

/**
 * Call Gemini REST API generateContent with automatic model fallback
 */
async function callGemini(prompt, systemInstruction = '') {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured in .env');
    }

    let lastError = null;

    for (const model of MODELS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
            const body = {
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ]
            };

            if (systemInstruction) {
                body.systemInstruction = {
                    parts: [{ text: systemInstruction }]
                };
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error?.message || `Gemini API error (${res.status})`);
            }

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text && text.trim()) {
                return text.trim();
            }
        } catch (err) {
            lastError = err;
            console.warn(`Model ${model} failed, trying next fallback: ${err.message}`);
        }
    }

    throw lastError || new Error('All Gemini models failed');
}

/**
 * AI Tag Suggester & Description Enhancer for Event Proposals
 */
exports.suggestTagsAndDescription = async ({ title, description, category, availableTags = [] }) => {
    if (!GEMINI_API_KEY) {
        return fallbackSuggestions(title, description, category);
    }

    const systemPrompt = `You are the chief event curator for MACE EventHub, an elite engineering college at Mar Athanasius College of Engineering.
Your task is to analyze proposed event titles and draft descriptions, recommend 3 to 5 precise, highly relevant theme/track tags, and generate an engaging, professional, exciting description suitable for the official campus brochure.
Available track tags to prioritize if relevant: ${availableTags.join(', ')}. You may also invent new high-value tags if needed.
You MUST reply strictly in valid JSON format with no markdown backticks around it:
{
  "tags": ["Tag 1", "Tag 2", "Tag 3"],
  "enhancedDescription": "Enhanced compelling description here with highlights..."
}`;

    const userPrompt = `Event Title: "${title}"
Category: "${category || 'technical'}"
Draft Description: "${description || 'None provided'}"

Suggest 3-5 tags and an enhanced 2-3 paragraph promotional description. Output ONLY valid JSON.`;

    try {
        const raw = await callGemini(userPrompt, systemPrompt);
        const cleaned = raw.replace(/^```(json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        const tagList = Array.isArray(parsed.tags) ? parsed.tags : [];
        return {
            tags: tagList,
            suggestedTags: tagList,
            enhancedDescription: parsed.enhancedDescription || description
        };
    } catch (err) {
        console.warn('⚠️ Gemini suggestion error, using fallback:', err.message);
        return fallbackSuggestions(title, description, category);
    }
};

/**
 * EventBot AI Campus Assistant
 */
exports.askEventBot = async ({ question, events = [] }) => {
    if (!GEMINI_API_KEY) {
        return "EventBot AI is in offline demo mode. Please set `GEMINI_API_KEY` in `.env` to enable full live generative intelligence.";
    }

    const eventsSummary = events.map(e => ({
        id: e._id,
        name: e.name,
        category: e.category,
        date: e.date ? new Date(e.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD',
        venue: e.venue,
        fee: e.fee ? `₹${e.fee}` : 'Free',
        availableSeats: e.availableSeats !== undefined ? e.availableSeats : (e.capacity - (e.confirmedCount || 0)),
        tags: e.tags || [],
        description: (e.description || '').slice(0, 150)
    }));

    const systemPrompt = `You are "EventBot", the enthusiastic, knowledgeable AI concierge for MACE EventHub (Mar Athanasius College of Engineering).
You help students discover events, give personalized recommendations based on their interests, explain rules/venues/fees, and guide them to register.
Here is the LIVE database of events currently scheduled:
${JSON.stringify(eventsSummary, null, 2)}

Instructions:
- Keep answers friendly, helpful, inspiring, and concise (under 150 words).
- Mention specific event names, venues, dates, and whether they are Free or have a fee.
- Format event names in **bold**.
- Present multi-event lists as clean bullet points, each on its own separate line starting with a bullet (- ) or emoji.
- CRITICAL FORMATTING: Never chain multiple asterisks together or write messy markdown inline like "* **" or "* *Details:*". Always place each event and its key details on its own separate line.
- Use emoji appropriately (⚡, 🤖, 🎭, 🏆, 🎟️).`;

    try {
        return await callGemini(question, systemPrompt);
    } catch (err) {
        console.error('EventBot error:', err.message);
        return `I'm having a brief connection blip (${err.message}). Feel free to ask again or browse the events listed right on this page!`;
    }
};

exports.askFestBot = exports.askEventBot;

function fallbackSuggestions(title, description, category) {
    const text = `${title} ${description}`.toLowerCase();
    const tags = [];
    if (/robot|war|bot|arduino|iot|hardware|drone/i.test(text)) tags.push('Robotics & Automation', 'IoT & Embedded Systems');
    if (/code|hack|program|python|react|web|app/i.test(text)) tags.push('Competitive Programming', 'Web Development');
    if (/ai|ml|data|neural|learning|model/i.test(text)) tags.push('AI & Machine Learning');
    if (/dance|music|band|drama|play|stage/i.test(text)) tags.push('Cultural & Arts');
    if (/game|esport|valorant|fifa/i.test(text)) tags.push('Gaming & Esports');
    if (tags.length === 0) tags.push(category === 'technical' ? 'Technical Innovation' : 'Campus Spotlight');

    return {
        tags,
        enhancedDescription: description ? `${description}\n\nJoin us for an electrifying showcase of talent, innovation, and campus competition at MACE EventHub.` : 'Experience a high-stakes challenge designed to push your skills to the limit.'
    };
}
