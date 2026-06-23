# Northland Market Intelligence

Real-time market surveillance and research tool for Northland's development pipeline.
Powered by Fable 5 via a secure server-side proxy — API key never exposed to the browser.

---

## Deploy to Vercel (4 steps, ~5 minutes)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "initial"
# create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/northland-intel.git
git push -u origin main
```

### 2. Import to Vercel
- Go to vercel.com → New Project → Import from GitHub
- Select this repo
- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`
- Click Deploy

### 3. Add your API key
- In Vercel dashboard → Your project → Settings → Environment Variables
- Add: `ANTHROPIC_API_KEY` = your key (starts with `sk-ant-...`)
- Redeploy (Deployments tab → ⋯ → Redeploy)

### 4. Share the URL
Vercel gives you a permanent URL like `northland-intel.vercel.app`.
Send that to whoever needs access — no install required.

---

## Local dev
```bash
npm install
# create .env.local with:
# ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

---

## Architecture
- `src/` — React + Vite frontend
- `api/claude.js` — Vercel serverless function (proxy, holds API key)
- `vercel.json` — routes `/api/*` to serverless, everything else to React
- Data persists in browser localStorage (per user, per device)
