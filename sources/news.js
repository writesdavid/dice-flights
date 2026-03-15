const fetch = require('node-fetch');

const NEGATIVE = [
  'cancel', 'delay', 'strike', 'lawsuit', 'incident', 'outage', 'stranded',
  'complaint', 'fail', 'fine', 'penalty', 'grounded', 'crash', 'turbulence',
  'death', 'injury', 'investigation', 'fraud', 'overbooked', 'diverted',
  'shutdown', 'bankrupt', 'chaos', 'nightmare', 'worst', 'problem', 'issue',
];

const POSITIVE = [
  'award', 'best', 'expands', 'new route', 'improved', 'record', 'on time',
  'upgrade', 'leading', 'top', 'growth', 'milestone', 'reliable', 'praised',
  'recognized', 'winner', 'satisfaction',
];

function scoreHeadline(title) {
  const lower = title.toLowerCase();
  return {
    pos: POSITIVE.filter(w => lower.includes(w)).length,
    neg: NEGATIVE.filter(w => lower.includes(w)).length,
  };
}

async function getNewsScore(airlineName) {
  try {
    const q = encodeURIComponent(`"${airlineName}" airline`);
    const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 10000,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    // Extract titles from RSS items (skip the feed title at index 0)
    const titles = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/g)]
      .map(m => (m[1] || m[2] || '').trim())
      .filter(t => t && t !== 'Google News')
      .slice(0, 15);

    if (titles.length === 0) return { score: 72, detail: 'No recent news' };

    let pos = 0, neg = 0;
    for (const title of titles) {
      const s = scoreHeadline(title);
      pos += s.pos;
      neg += s.neg;
    }

    const total = pos + neg;
    // Neutral coverage (no keyword matches) → 72 baseline
    // All-negative → floor at 15 so it doesn't dominate the composite score
    const raw = total === 0 ? 72 : Math.round((pos / total) * 100);
    const score = Math.max(15, raw);
    const detail = `${titles.length} articles · ${neg} negative`;

    return { score, detail };
  } catch (e) {
    console.error(`News error (${airlineName}):`, e.message);
    return { score: null, detail: 'Unavailable' };
  }
}

module.exports = { getNewsScore };
