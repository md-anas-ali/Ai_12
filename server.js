require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 10000;

// ---- Config (set these in Render Environment Variables) ----
const GROQ_API_KEY = process.env.GROQ_API_KEY;           // free key from https://console.groq.com
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MY_API_KEY = process.env.MY_API_KEY || '';          // optional: protects your endpoint from public abuse

// ---- Simple auth middleware (optional, only active if MY_API_KEY is set) ----
function checkAuth(req, res, next) {
  if (!MY_API_KEY) return next(); // no protection configured
  const key = req.headers['x-api-key'];
  if (key !== MY_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized. Missing/invalid x-api-key header.' });
  }
  next();
}

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'viral-short-ai',
    usage: 'POST /api/generate with JSON body: { "topic": "...", "language": "bn"|"en", "durationSec": 30 }',
  });
});

// Render free plan spins down after inactivity — this lets you (or a cron)
// ping the service to keep it warm, or just check it's alive.
app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post('/api/generate', checkAuth, async (req, res) => {
  try {
    const {
      topic,
      language = 'bn',        // 'bn' = Bangla, 'en' = English
      durationSec = 30,       // target video length
      tone = 'energetic, curiosity-driven',
      numScenes,
    } = req.body || {};

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ error: '"topic" field is required (string).' });
    }
    if (!GROQ_API_KEY) {
      return res.status(500).json({
        error: 'Server misconfigured: GROQ_API_KEY environment variable is not set.',
      });
    }

    const scenes = numScenes || Math.max(4, Math.round(durationSec / 5));

    const systemPrompt = `You are an expert viral short-form video (Reels/Shorts/TikTok, 9:16 vertical) scriptwriter and visual director.
You always respond with STRICT JSON only — no markdown, no commentary, no code fences.
JSON schema you must follow exactly:
{
  "title": "string, catchy video title",
  "hook": "string, first 1-2 lines spoken in the first 2 seconds to stop the scroll",
  "caption": "string, social media caption for the post",
  "hashtags": ["string", "..."],
  "scenes": [
    {
      "scene_number": 1,
      "timeframe": "0-5s",
      "voiceover": "string, exact narration/voiceover line for this scene",
      "on_screen_text": "string, short punchy text overlay for this scene",
      "image_prompt": "string, a detailed English text-to-image prompt (for tools like Midjourney/SDXL/DALLE) describing this scene visually, vertical 9:16 composition, cinematic, include style/lighting/camera angle details"
    }
  ],
  "cta": "string, call to action for the final scene (like/follow/comment)"
}
Rules:
- Total scenes must be exactly ${scenes}.
- Timeframes must be sequential and cover roughly ${durationSec} seconds total.
- Voiceover language must be: ${language === 'bn' ? 'Bangla (বাংলা)' : 'English'}.
- image_prompt must ALWAYS be written in English regardless of voiceover language, and must be detailed enough to generate directly in an image AI tool.
- Tone: ${tone}.
- Make the hook extremely scroll-stopping and curiosity-driven.
- Return ONLY valid JSON, nothing else.`;

    const userPrompt = `Create a viral 9:16 short video script about: "${topic}"`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.9,
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return res.status(502).json({ error: 'Upstream AI provider error', details: errText });
    }

    const data = await groqRes.json();
    const raw = data.choices?.[0]?.message?.content || '{}';

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return res.status(502).json({ error: 'Failed to parse AI response as JSON', raw });
    }

    return res.json({ success: true, topic, language, durationSec, result: parsed });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error', details: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`viral-short-ai running on port ${PORT}`);
});
