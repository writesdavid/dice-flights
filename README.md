# Dice Flights

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Roll the dice. See which US airline is actually delivering right now.

Not safe — reliable. On time. Getting you where you're going when they said they would.

The winner changes. No airline is consistently good. That's the point.

---

## Why I built this

I'm David Hamilton. I work in content design and I'm learning to build.

I got tired of booking flights based on price and vibes. Every airline claims to be reliable. None of them are consistently. The data exists — the US government publishes it — but nobody surfaces it in a way that's honest or useful.

So I built this. No affiliate links. No sponsored rankings. Just the numbers.

It's also a learning project. I'm transitioning from content design into engineering and AI infrastructure. Building things in public is how I'm doing it.

More at [writesdavid.substack.com](https://writesdavid.substack.com).

---

## What it does

Scores 8 US carriers on predicted reliability using four signals:

- **Track record** (50%) — DOT Bureau of Transportation Statistics data: on-time rate, cancellation rate, baggage mishandling, complaint rate, and trend direction over 10 months.
- **Right now** (15%) — FAA NAS Status: live ground delays and ground stops at each airline's hub airports.
- **This week** (15%) — Open-Meteo weather forecast at each airline's primary hub. If a storm is coming, the score reflects it.
- **In the news** (20%) — Google News headlines scored for negative signals (cancellations, delays, incidents) vs positive. Refreshed every 2 hours.

No API keys. No accounts. No third-party services.

**Airlines tracked:** Delta, United, American, Southwest, Alaska, JetBlue, Allegiant, Frontier

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
4. Build command: `npm install` · Start command: `node server.js`
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
- DOT/BTS on-time, baggage, and complaint data (bundled JSON, updated quarterly)
- FAA NAS Status API (no key)
- Open-Meteo weather forecast API (no key)
- Google News RSS (no key)
- Vanilla JS, no framework, no build step
