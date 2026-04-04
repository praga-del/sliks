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

    // ─── Validate + normalise all fields ───

    // Core fields
    parsed.pollution_level          = parsed.pollution_level          || 'Insufficient Image Quality';
    parsed.confidence               = parsed.confidence               || 'Low';
    parsed.confidence_pct           = Number(parsed.confidence_pct)   || 20;
    parsed.visual_evidence          = parsed.visual_evidence          || 'Could not assess from image.';
    parsed.deposit_analysis         = parsed.deposit_analysis         || '';
    parsed.likely_pollutants        = Array.isArray(parsed.likely_pollutants) ? parsed.likely_pollutants : [];
    parsed.site_context_correlation = parsed.site_context_correlation || '';
    parsed.limitations              = parsed.limitations              || '';
    parsed.recommendations          = parsed.recommendations          || '';
    parsed.summary                  = parsed.summary                  || 'Analysis could not be completed.';
    parsed.exposure_note            = parsed.exposure_note            || '';

    // Deposit colours (Stojanowska 2022 · Muzamil 2024)
    if (!parsed.deposit_colors) parsed.deposit_colors = null;
    else {
      const dc = parsed.deposit_colors;
      dc.dominant_color    = dc.dominant_color    || 'mixed';
      dc.dominant_source   = dc.dominant_source   || 'unknown';
      dc.colors_detected   = Array.isArray(dc.colors_detected) ? dc.colors_detected : [dc.dominant_color];
      dc.color_interpretation = dc.color_interpretation || '';
      dc.pollen_present    = Boolean(dc.pollen_present);
    }

    // Fine/coarse ratio (Górka et al. 2018 · Bartz et al. 2021)
    if (!parsed.particle_fractions) parsed.particle_fractions = null;
    else {
      const pf = parsed.particle_fractions;
      pf.fine_pct      = Number(pf.fine_pct)      || 0;
      pf.coarse_pct    = Number(pf.coarse_pct)    || 0;
      pf.ultrafine_pct = Number(pf.ultrafine_pct) || 0;
      const total = pf.fine_pct + pf.coarse_pct + pf.ultrafine_pct;
      if (total > 0 && Math.abs(total - 100) > 2) {
        pf.fine_pct      = Math.round(pf.fine_pct      / total * 100);
        pf.coarse_pct    = Math.round(pf.coarse_pct    / total * 100);
        pf.ultrafine_pct = 100 - pf.fine_pct - pf.coarse_pct;
      }
      pf.dominant_fraction  = pf.dominant_fraction  || 'mixed';
      pf.fine_evidence      = pf.fine_evidence      || '';
      pf.coarse_evidence    = pf.coarse_evidence    || '';
      pf.ultrafine_evidence = pf.ultrafine_evidence || '';
      pf.health_implication = pf.health_implication || '';
    }

    // Source fingerprint (Muzamil 2024)
    if (!parsed.source_fingerprint) parsed.source_fingerprint = null;
    else {
      const sf = parsed.source_fingerprint;
      sf.primary_source      = sf.primary_source      || 'unknown';
      sf.secondary_source    = sf.secondary_source    || 'none';
      sf.source_confidence   = sf.source_confidence   || 'Low';
      sf.fingerprint_reasoning = sf.fingerprint_reasoning || '';
    }

    // Web structural integrity (Su et al. 2018)
    if (!parsed.web_integrity) parsed.web_integrity = null;
    else {
      const wi = parsed.web_integrity;
      wi.score_pct        = Math.min(100, Math.max(0, Number(wi.score_pct) || 0));
      wi.grade            = wi.grade            || 'Unknown';
      wi.observations     = wi.observations     || '';
      wi.pollution_impact = wi.pollution_impact || '';
    }

    // WHO AQG tier (WHO 2021 · Alotaibi 2024)
    if (!parsed.who_aqg) parsed.who_aqg = null;
    else {
      const wa = parsed.who_aqg;
      wa.tier              = wa.tier              || 'Interim Target 2';
      wa.tier_reasoning    = wa.tier_reasoning    || '';
      wa.pm25_range_estimate = wa.pm25_range_estimate || '';
    }

    // Lab tests (Stojanowska 2022 methods table)
    if (!parsed.lab_tests) parsed.lab_tests = null;
    else {
      const lt = parsed.lab_tests;
      lt.priority_test   = lt.priority_test   || 'ICP-MS';
      lt.priority_reason = lt.priority_reason || '';
      lt.additional_tests = Array.isArray(lt.additional_tests) ? lt.additional_tests : [];
      lt.urgency         = lt.urgency         || 'Routine';
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
}
