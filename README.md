# 🕸️ SilkSense — AI Spider Web Air Quality Analyzer

> AI-powered air quality screening using spider web photographs as passive samplers.  
> **Powered by Google Gemini 2.5 Flash — Best free vision model (no credit card needed)**

---

## 🧠 What is SilkSense?

SilkSense is a web application that analyzes photographs of spider webs to screen for air pollution. Spider webs act as natural passive air samplers — they trap airborne particles, heavy metals, and pollutants over weeks. SilkSense uses Google Gemini's multimodal vision AI to assess pollution levels from a photo, grounded in peer-reviewed biomonitoring literature.

**Project by:** K Karunya · S Nandhitha · S T Pragadheeshwaran  
**Guides:** Dr. Vincent Joseph K L · Dr. Mary Rosanna N T  
**Institution:** Rajalakshmi Engineering College — AI in Chemical Engineering

---

## 🚀 Deploy to Vercel in 5 Minutes

### Step 1 — Get Your FREE Gemini API Key (no credit card)

1. Go to **https://aistudio.google.com**
2. Click **"Get API Key"** → **"Create API key in new project"**
3. Copy the key — it starts with `AIza...`
4. Free tier gives you **~500 requests/day** — more than enough for a demo

> ℹ️ **Why Gemini 2.5 Flash?** It's Google's best free multimodal vision model as of 2025–26. It supports image + text input, returns JSON, and is fast. Gemini 1.5 Flash is deprecated (shutdown June 2026). Gemini 2.5 Flash is the stable, supported replacement.

---

### Step 2 — Push to GitHub

1. Create a new GitHub repository (public or private)
2. Upload the entire `silksense-vercel/` folder contents:
   ```
   /api/analyze.js
   /public/index.html
   vercel.json
   README.md
   ```
3. Commit and push

---

### Step 3 — Deploy on Vercel

1. Go to **https://vercel.com** → Sign up / log in with GitHub (free)
2. Click **"Add New Project"** → Select your GitHub repo
3. Vercel will auto-detect the structure — **do not change Framework Preset** (leave as "Other")
4. Before clicking Deploy, go to **"Environment Variables"** and add:

   | Name | Value |
   |------|-------|
   | `GEMINI_API_KEY` | `AIzaSy...your-key-here` |

5. Click **"Deploy"** ✅

Your app will be live at: `https://your-project-name.vercel.app`

---

### Step 4 — Test It

1. Open your Vercel URL
2. Upload a spider web photo
3. Fill in location details (city, site type, etc.)
4. Click **"Analyze"**
5. Get your AI-powered pollution assessment + download PDF report

---

## 📁 Project Structure

```
silksense-vercel/
├── api/
│   └── analyze.js        ← Vercel serverless function (calls Gemini securely)
├── public/
│   └── index.html        ← Complete single-page frontend
├── vercel.json           ← Routing: /api/* → serverless, /* → public/
└── README.md             ← This file
```

---

## 🔒 How the API Key is Protected

```
User's Browser
      ↓  (uploads image)
   Frontend  →  POST /api/analyze  →  Vercel Serverless Function
                                              ↓
                                   reads GEMINI_API_KEY
                                   from environment variable
                                              ↓
                                    Gemini 2.5 Flash API
                                              ↓
                                     JSON result back
```

The API key **never appears in the frontend HTML or JavaScript**. It lives only in Vercel's encrypted environment variables. Users cannot see or steal it.

---

## 🤖 AI Model Details

| Property | Value |
|----------|-------|
| Model | `gemini-2.5-flash` |
| Provider | Google AI (Gemini API) |
| Input | Image (JPEG/PNG/WEBP up to 20MB) + text prompt |
| Output | Structured JSON with pollution assessment |
| Temperature | 0.2 (consistent, factual) |
| Free tier | ~500 requests/day per project |
| Context window | 1M tokens |

---

## 📚 Scientific Literature Basis

| Reference | Relevance |
|-----------|-----------|
| Stojanowska et al. (2022), *Integr Environ Assess Manag* | Spider webs as validated passive air samplers for PM and heavy metals |
| Muzamil et al. (2024), *Water Air Soil Pollut* | Spatial correlation of web-trapped metals with urban pollution sources |
| Chakma et al. (2017), *IEEE ICIP* | Image-based PM₂.₅ estimation using deep CNNs |
| Cheng et al. (2021), *Adv Intell Syst* | Computer vision for fibrous material characterization |
| Su et al. (2018), *J R Soc Interface* | Computational image analysis of spider web structure |
| Alotaibi & Nassif (2024), *Discover AI* | AI/ML in environmental monitoring — comprehensive review |

---

## ⚠️ Disclaimer

SilkSense is a **screening tool** for research and educational purposes. It does not replace laboratory analysis (ICP-MS, SEM-EDX, XRF). Results should be interpreted as qualitative indicators, not precise measurements. Always confirm with certified analytical methods for regulatory or health decisions.

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| `GEMINI_API_KEY not configured` | Add the env variable in Vercel → Project → Settings → Environment Variables |
| `Gemini API error 400` | Image may be too large or unreadable. Try a smaller/clearer photo |
| `404 on /api/analyze` | Check vercel.json is in root, not inside /public or /api |
| Analysis returns `Insufficient Image Quality` | Retake photo with better lighting and clearer web (see imaging tips in app) |
| Vercel build fails | Make sure `analyze.js` is inside `/api/` folder exactly |

---

## 🔄 Local Development (optional)

```bash
npm install -g vercel
vercel dev
# Then open http://localhost:3000
# Set GEMINI_API_KEY in .env.local
```
