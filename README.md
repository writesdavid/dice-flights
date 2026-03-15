# Dice Flights

Roll the dice. See which US airline is actually delivering right now.

Not safe — reliable. On time. Getting you where you're going when they said they would.

The winner changes. No airline is consistently good. That's the point.

---

## What it does

Pulls active flight data for 8 US carriers from AviationStack every 12 hours. Scores each airline on on-time performance and average delay. Ranks them. You roll the dice to reveal the standings.

**Airlines tracked:** Delta, United, American, Southwest, Alaska, JetBlue, Spirit, Frontier

**Scoring:**
- On-time = departure delay under 15 minutes (industry standard)
- Score = `on_time_pct × 0.7 + (1 - avg_delay/120) × 30`
- Higher is better

---

## Run it locally

You need Node.js and an AviationStack API key (free tier: 500 calls/month).

```bash
git clone https://github.com/writesdavid/dice-flights.git
cd dice-flights
npm install
cp .env.example .env
# add your AviationStack key to .env
node server.js
```

Open `http://localhost:3000`.

Get a free AviationStack key at [aviationstack.com](https://aviationstack.com).

---

## Deploy your own

### Render (free)

1. Fork this repo
2. Sign up at [render.com](https://render.com)
3. New → Web Service → connect your fork
4. Set:
   - Build command: `npm install`
   - Start command: `node server.js`
5. Add env var: `AVIATIONSTACK_KEY=your_key`
6. Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Railway

1. Fork this repo
2. Sign up at [railway.app](https://railway.app)
3. New Project → Deploy from GitHub repo
4. Add env var: `AVIATIONSTACK_KEY=your_key`

---

## Stack

- Node.js + Express
- AviationStack API (free tier)
- Vanilla JS, no framework, no build step
