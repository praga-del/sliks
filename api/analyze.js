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

  const resolvedMime = ['image/jpeg','image/jpg','image/png','image/webp'].includes(mimeType)
    ? mimeType : 'image/jpeg';

  // gemini-2.5-flash — confirmed available for this API key
  // Using v1beta for 2.5-flash (required for this generation)
  // thinkingConfig: budgetTokens 0 = disable thinking mode → clean JSON output
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: resolvedMime, data: imageBase64 } },
        { text: prompt }
      ]
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1500,
      thinkingConfig: {
        thinkingBudget: 0   // disables thinking mode → direct clean JSON output
      }
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
      body: JSON.stringify(body)
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({
        error: data?.error?.message || `Gemini error ${geminiRes.status}`
      });
    }

    // Extract text — skip thought parts, only grab real text output
    const parts = data?.candidates?.[0]?.content?.parts || [];
    let rawText = '';
    for (const part of parts) {
      if (part.text && part.thought !== true) {
        rawText += part.text;
      }
    }
    // Fallback: grab everything if above is empty
    if (!rawText.trim()) {
      rawText = parts.map(p => p.text || '').join('').trim();
    }

    if (!rawText.trim()) {
      return res.status(500).json({
        error: 'Empty response from Gemini.',
        debug: JSON.stringify(data).slice(0, 400)
      });
    }

    // Strip markdown fences
    rawText = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();

    // Extract JSON object
    const start = rawText.indexOf('{');
    const end   = rawText.lastIndexOf('}');

    if (start === -1 || end === -1) {
      return res.status(500).json({
        error: 'No JSON in Gemini response.',
        raw: rawText.slice(0, 400)
      });
    }

    const parsed = JSON.parse(rawText.slice(start, end + 1));

    // Ensure all required fields exist
    parsed.pollution_level          = parsed.pollution_level          || 'Insufficient Image Quality';
    parsed.confidence               = parsed.confidence               || 'Low';
    parsed.confidence_pct           = parsed.confidence_pct           || 20;
    parsed.visual_evidence          = parsed.visual_evidence          || 'Could not assess from image.';
    parsed.deposit_analysis         = parsed.deposit_analysis         || '';
    parsed.particle_size_fractions  = parsed.particle_size_fractions  || { ultrafine_pct: 0, fine_pct: 0, coarse_pct: 0, basis: 'Particle size fraction data not returned by model.' };
    parsed.likely_pollutants        = parsed.likely_pollutants        || [];
    parsed.site_context_correlation = parsed.site_context_correlation || '';
    parsed.limitations              = parsed.limitations              || '';
    parsed.recommendations          = parsed.recommendations          || '';
    parsed.summary                  = parsed.summary                  || 'Analysis could not be completed.';

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
}
