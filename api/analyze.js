export const config = { api: { bodyParser: { sizeLimit: '25mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not set in Vercel environment variables.' });

  const { imageBase64, mimeType, prompt } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64.' });
  if (!prompt) return res.status(400).json({ error: 'Missing prompt.' });

  const resolvedMime = ['image/jpeg','image/jpg','image/png','image/webp'].includes(mimeType) ? mimeType : 'image/jpeg';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: resolvedMime, data: imageBase64 } },
        { text: prompt }
      ]
    }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ]
  };

  try {
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({ error: data?.error?.message || `Gemini error ${geminiRes.status}` });
    }

    // Extract text from all parts
    const parts = data?.candidates?.[0]?.content?.parts || [];
    let rawText = parts.map(p => p.text || '').join('');

    if (!rawText.trim()) {
      return res.status(500).json({ error: 'Empty response from Gemini.', debug: JSON.stringify(data).slice(0,300) });
    }

    // Strip markdown fences and extract JSON
    rawText = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');

    if (start === -1 || end === -1) {
      return res.status(500).json({ error: 'No JSON found in response.', raw: rawText.slice(0, 300) });
    }

    const parsed = JSON.parse(rawText.slice(start, end + 1));

    // Fill missing fields
    parsed.pollution_level   = parsed.pollution_level   || 'Insufficient Image Quality';
    parsed.confidence        = parsed.confidence        || 'Low';
    parsed.confidence_pct    = parsed.confidence_pct    || 20;
    parsed.visual_evidence   = parsed.visual_evidence   || 'Could not assess.';
    parsed.likely_pollutants = parsed.likely_pollutants || [];
    parsed.summary           = parsed.summary           || 'Analysis incomplete.';

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
}
