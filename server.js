require('dotenv').config();
const express = require('express');
const path = require('path');
const { loadBtsData, computeBtsScore } = require('./sources/bts');
const { getFaaScore } = require('./sources/faa');
const { getWeatherScore } = require('./sources/weather');
const { getNewsScore } = require('./sources/news');
const { computeScore } = require('./scorer');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

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

const btsData = loadBtsData();
if (btsData) console.log(`BTS data loaded: ${btsData.period}`);
else console.warn('No BTS data — scores will rely on live signals only');

const cache = { data: null, lastFetched: null, refreshing: false };

async function buildRankings() {
  const [faaResults, weatherResults, newsResults] = await Promise.all([
    Promise.all(AIRLINES.map(a => getFaaScore(a.iata))),
    Promise.all(AIRLINES.map(a => getWeatherScore(a.iata))),
    Promise.all(AIRLINES.map(a => getNewsScore(a.name))),
  ]);

  const results = AIRLINES.map((airline, i) => {
    const bts     = computeBtsScore(airline.iata, btsData);
    const faa     = faaResults[i];
    const weather = weatherResults[i];
    const news    = newsResults[i];
    const score   = computeScore(bts, faa, weather, news);
    return { ...airline, score, signals: { bts, faa, weather, news } };
  });

  return results
    .sort((a, b) => {
      if (a.score === null && b.score === null) return 0;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    })
    .map((a, i) => ({ ...a, rank: i + 1 }));
}

async function refresh() {
  if (cache.refreshing) return;
  cache.refreshing = true;
  console.log('Refreshing signals...');
  try {
    cache.data = await buildRankings();
    cache.lastFetched = new Date().toISOString();
    console.log('Done:', cache.data.map(a => `${a.rank}.${a.name}:${a.score}`).join(' '));
  } catch (e) {
    console.error('Refresh error:', e.message);
  } finally {
    cache.refreshing = false;
  }
}

function isCacheStale() {
  if (!cache.lastFetched) return true;
  return Date.now() - new Date(cache.lastFetched).getTime() > CACHE_TTL_MS;
}

// Eager refresh on traditional servers; lazy on serverless (no persistent process)
if (!process.env.VERCEL) {
  refresh();
  setInterval(refresh, CACHE_TTL_MS);
}

app.get('/api/airlines', async (req, res) => {
  // On Vercel (or stale cache): fetch on demand
  if (!cache.data || isCacheStale()) {
    await refresh();
  }
  if (!cache.data) return res.status(503).json({ error: 'Loading — try again in a moment.' });
  res.json({ airlines: cache.data, lastFetched: cache.lastFetched, btsPeriod: btsData?.period });
});

app.use(express.static(path.join(__dirname, 'public')));

// Required for Vercel — export the app instead of just calling listen
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Dice Flights running at http://localhost:${PORT}`));
}

module.exports = app;
