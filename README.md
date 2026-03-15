# Dice Flights

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Roll the dice. See which US airline is actually delivering right now.

Not safe — reliable. On time. Getting you where you're going when they said they would.

The winner changes. No airline is consistently good. That's the point.

---

## What it does

Scores 8 US carriers on predicted reliability using two signals:

- **DOT on-time performance** (65%) — 10 months of official government data from the Bureau of Transportation Statistics, bundled in the repo. Tracks on-time rate, cancellation rate, and whether each airline is improving or declining.
- **News sentiment** (35%) — live headlines from Google News, scored for negative signals (cancellations, delays, incidents) vs positive. Refreshed every 2 hours.

No API keys. No accounts. No third-party services.

**Airlines tracked:** Delta, United, American, Southwest, Alaska, JetBlue, Spirit, Frontier

---

## Run it locally

You need Node.js — that's it.

```bash
git clone https://github.com/writesdavid/dice-flights.git
cd dice-flights
npm install
node server.js
```

Open `http://localhost:3000` and roll.

---

## Deploy your own

### Render (free)

1. Fork this repo
2. Sign up at [render.com](https://render.com)
3. New → Web Service → connect your fork
4. Set:
   - Build command: `npm install`
   - Start command: `node server.js`
5. Deploy — no env vars needed

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Railway

1. Fork this repo
2. Sign up at [railway.app](https://railway.app)
3. New Project → Deploy from GitHub repo
4. Deploy — no env vars needed

---

## Refresh the data

The bundled DOT data covers January–October 2024. To update it:

```bash
node scripts/update-bts.js
```

If BTS blocks the automated download (they require a browser session), the script prints manual instructions. Takes about 5 minutes. Worth doing quarterly.

---

## Stack

- Node.js + Express
- DOT/BTS on-time data (bundled JSON, updated quarterly)
- Google News RSS (no key)
- Vanilla JS, no framework, no build step
