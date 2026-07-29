# Viral Short Video Script + Image Prompt AI (Render Free Plan)

এই সার্ভিসটা একটা হালকা (lightweight) Node.js/Express API। এটা নিজে কোনো ভারী AI মডেল রান করে না
(তাই RAM 0.1 CPU / 400-450MB তে ফিট করে) — বরং এটা একটা **ফ্রি এবং দ্রুত LLM API (Groq)** কে কল করে
স্ক্রিপ্ট + image prompt জেনারেট করে। ফলে Render Free Plan-এ ১০০% চলবে, কোনো GPU লাগবে না।

## এটা কী দেয়়
`POST /api/generate` এ topic পাঠালে এটা রিটার্ন করে:
- Title, Hook (প্রথম ২ সেকেন্ডের attention-grabbing লাইন)
- Scene-by-scene script (voiceover + on-screen text + timeframe)
- প্রতিটা scene-এর জন্য আলাদা image generation prompt (English, 9:16 vertical composition বর্ণনাসহ)
- Caption, hashtags, CTA

---

## ধাপ ১: Groq থেকে ফ্রি API Key নিন
Groq দ্রুত, সম্পূর্ণ ফ্রি LLM inference দেয় (কোনো ক্রেডিট কার্ড লাগে না)।
1. https://console.groq.com/keys এ যান, সাইন আপ করুন
2. একটা নতুন API key তৈরি করুন, কপি করে রাখুন

## ধাপ ২: এই কোড GitHub-এ আপলোড করুন
1. GitHub-এ নতুন একটা repo বানান (public/private দুটোই চলবে)
2. এই ফোল্ডারের সব ফাইল push করুন

## ধাপ ৩: Render-এ Deploy করুন
### Option A — Blueprint দিয়ে (সবচেয়ে সহজ, `render.yaml` ব্যবহার করে)
1. https://dashboard.render.com/blueprints এ যান
2. "New Blueprint Instance" → আপনার GitHub repo সিলেক্ট করুন
3. Render নিজে থেকে `render.yaml` পড়ে **Web Service** বানিয়ে ফেলবে (Free plan)
4. যখন `GROQ_API_KEY` এবং `MY_API_KEY` চাইবে, বসিয়ে দিন
5. Deploy চাপুন

### Option B — ম্যানুয়ালি Web Service বানিয়ে
1. Render Dashboard → "New +" → **Web Service**
2. আপনার GitHub repo কানেক্ট করুন
3. সেটিংস:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. Environment Variables যোগ করুন:
   - `GROQ_API_KEY` = আপনার Groq key
   - `GROQ_MODEL` = `llama-3.3-70b-versatile`
   - `MY_API_KEY` = যেকোনো একটা random secret string (n8n থেকে কল করার সময় লাগবে)
5. "Create Web Service" চাপুন

Deploy শেষ হলে আপনি একটা URL পাবেন, যেমন:
`https://viral-short-ai.onrender.com`

> ⚠️ Render Free Plan-এ ১৫ মিনিট idle থাকলে সার্ভিস "sleep" করে, পরের রিকোয়েস্টে ~৩০-৫০ সেকেন্ড লাগতে
> পারে জেগে উঠতে। এটা normal, ফ্রি প্ল্যানের সীমাবদ্ধতা। চাইলে UptimeRobot/cron দিয়ে প্রতি ১০ মিনিটে
> `GET /health` কল করে "জাগিয়ে" রাখতে পারেন।

---

## ধাপ ৪: n8n দিয়ে কল করা

n8n-এ একটা **HTTP Request** নোড বসান, নিচের সেটিংস দিন:

- **Method**: POST
- **URL**: `https://your-app-name.onrender.com/api/generate`
- **Headers**:
  - `Content-Type: application/json`
  - `x-api-key: আপনার MY_API_KEY এর value` (যদি সেট করে থাকেন)
- **Body (JSON)**:
```json
{
  "topic": "কিভাবে সকালে উঠে সফল মানুষরা দিন শুরু করে",
  "language": "bn",
  "durationSec": 30
}
```

### রেসপন্স উদাহরণ:
```json
{
  "success": true,
  "result": {
    "title": "...",
    "hook": "...",
    "caption": "...",
    "hashtags": ["#shorts", "#viral"],
    "scenes": [
      {
        "scene_number": 1,
        "timeframe": "0-5s",
        "voiceover": "...",
        "on_screen_text": "...",
        "image_prompt": "vertical 9:16, cinematic close-up of..."
      }
    ],
    "cta": "..."
  }
}
```

n8n-এ এরপর `result.scenes` কে Split In Batches / Loop নোড দিয়ে লুপ করে প্রতিটা `image_prompt`
আরেকটা image-generation node (যেমন Stability AI, Leonardo, ComfyUI ইত্যাদির ফ্রি tier) এ পাঠাতে পারেন।

---

## লোকালি টেস্ট করার জন্য
```bash
npm install
cp .env.example .env   # তারপর .env এ আপনার GROQ_API_KEY বসান
npm start
```
তারপর:
```bash
curl -X POST http://localhost:10000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"topic":"3 morning habits that changed my life","language":"en","durationSec":30}'
```

---

## Resource ব্যবহার (কেন এটা Free Plan-এ চলবে)
- এই Node/Express অ্যাপ idle অবস্থায় ~৫০-৮০MB RAM নেয়, লোডেও ১৫০MB পার হয় না — তাই 400-450MB
  লিমিটে অনায়াসে ফিট করে।
- ভারী AI compute (LLM inference) Groq-এর সার্ভারে হয়, আপনার Render instance শুধু একটা পাতলা
  proxy/orchestrator — তাই 0.1 CPU-তেও সমস্যা হয় না, GPU লাগেই না।
