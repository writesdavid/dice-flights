require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.AVIATIONSTACK_KEY;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const AIRLINES = [
  { name: 'Delta',     iata: 'DL' },
  { name: 'United',    iata: 'UA' },
  { name: 'American',  iata: 'AA' },
  { name: 'Southwest', iata: 'WN' },
  { name: 'Alaska',    iata: 'AS' },
  { name: 'JetBlue',   iata: 'B6' },
  { name: 'Spirit',    iata: 'NK' },
  { name: 'Frontier',  iata: 'F9' },
];

const cache = { data: null, lastFetched: null };

async function fetchAirlineStats(airline) {
  const url = `http://api.aviationstack.com/v1/flights?access_key=${API_KEY}&airline_iata=${airline.iata}&flight_status=active&limit=100`;
  let flights = [];

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.data && Array.isArray(json.data)) {
      flights = json.data;
    }
  } catch (err) {
    console.error(`Failed to fetch ${airline.iata}:`, err.message);
  }

  const total = flights.length;

  if (total === 0) {
    return { ...airline, total: 0, delayed: 0, on_time_pct: null, avg_delay_mins: null, score: null };
  }

  const delayedFlights = flights.filter(f => {
    const delay = f.departure && f.departure.delay != null ? f.departure.delay : 0;
    return delay > 15;
  });

  const delayed = delayedFlights.length;
  const on_time_pct = ((total - delayed) / total) * 100;

  const totalDelayMins = delayedFlights.reduce((sum, f) => {
    return sum + (f.departure && f.departure.delay != null ? f.departure.delay : 0);
  }, 0);
  const avg_delay_mins = delayed > 0 ? totalDelayMins / delayed : 0;

  // Score: on-time % weighted 70%, delay penalty weighted 30%
  // avg_delay_mins capped at 120 for normalization
  const delayFactor = Math.max(0, 1 - avg_delay_mins / 120);
  const score = on_time_pct * 0.7 + delayFactor * 30;

  return { ...airline, total, delayed, on_time_pct, avg_delay_mins, score };
}

async function fetchAllAirlines() {
  console.log('Fetching airline data from AviationStack...');
  const results = await Promise.all(AIRLINES.map(fetchAirlineStats));

  // Rank by score descending (nulls go last)
  const ranked = results
    .slice()
    .sort((a, b) => {
      if (a.score === null && b.score === null) return 0;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    })
    .map((airline, i) => ({ ...airline, rank: i + 1 }));

  cache.data = ranked;
  cache.lastFetched = new Date().toISOString();
  console.log(`Fetched airline data at ${cache.lastFetched}`);
}

// Startup fetch
fetchAllAirlines();

// Refresh every 12 hours
setInterval(fetchAllAirlines, CACHE_TTL_MS);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/airlines', (req, res) => {
  if (!cache.data) {
    return res.status(503).json({ error: 'Data not yet available. Try again shortly.' });
  }
  res.json({ airlines: cache.data, lastFetched: cache.lastFetched });
});

app.listen(PORT, () => {
  console.log(`Dice Flights running at http://localhost:${PORT}`);
});
