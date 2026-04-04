// SilkSense — Vercel Serverless Function
// Model: gemini-2.5-flash (best free vision model as of 2025-26)
// Supports: multimodal image + text, free tier ~500 req/day, no credit card needed

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb'   // supports up to 20MB images + base64 overhead
    }
  }
};

export default async function handler(req, res) {
  // ── CORS headers (allow any origin for GitHub Pages / local dev) ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // ── API Key from Vercel environment variable ──
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not set. Go to Vercel → Project → Settings → Environment Variables and add it.'
    });
  }

  // ── Parse request body ──
  const { imageBase64, mimeType, prompt } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing imageBase64 in request body.' });
  }
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt in request body.' });
  }

  // Validate image mime type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const resolvedMime = allowedTypes.includes(mimeType) ? mimeType : 'image/jpeg';

  // ── Gemini 2.5 Flash API call ──
  // gemini-2.5-flash: best free vision model — multimodal, fast, ~500 req/day free
  const GEMINI_MODEL = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: resolvedMime,
              data: imageBase64
            }
          },
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,          // low temperature = consistent, factual analysis
      maxOutputTokens: 1500,
      responseMimeType: 'application/json'  // force JSON output directly
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ]
  };

  try {
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await geminiRes.json();

    // Handle Gemini-level errors
    if (!geminiRes.ok) {
      const errMsg = data?.error?.message || `Gemini API error ${geminiRes.status}`;
      console.error('Gemini error:', errMsg);
      return res.status(geminiRes.status).json({ error: errMsg });
    }

    // Extract text from Gemini response
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!rawText) {
      const finishReason = data?.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY') {
        return res.status(400).json({ error: 'Image was blocked by safety filters. Please use a clearer spider web photo.' });
      }
      return res.status(500).json({ error: 'Empty response from Gemini. Try again with a clearer image.' });
    }

    // Clean and parse JSON (strip markdown fences if present)
    let cleanText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    // Find first { and last } to extract valid JSON
    const jsonStart = cleanText.indexOf('{');
    const jsonEnd   = cleanText.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('Could not find JSON in response:', cleanText.slice(0, 300));
      return res.status(500).json({
        error: 'Gemini returned an unexpected format. Please try again.',
        raw: cleanText.slice(0, 300)
      });
    }

    const jsonString = cleanText.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonString);

    // Validate required fields exist
    const required = ['pollution_level', 'confidence', 'visual_evidence', 'likely_pollutants', 'summary'];
    for (const field of required) {
      if (!parsed[field]) {
        parsed[field] = parsed[field] || (field === 'likely_pollutants' ? [] : 'Not assessed');
      }
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('SilkSense handler error:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error. Please try again.'
    });
  }
}
