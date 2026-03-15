const fetch = require('node-fetch');

const USER_AGENT = 'dice-flights/1.0';

const NEGATIVE = [
  'delayed', 'cancelled', 'cancellation', 'stuck', 'terrible', 'awful', 'worst',
  'missed', 'lost baggage', 'stranded', 'diverted', 'overbooked', 'bumped',
  'horrible', 'nightmare', 'never again', 'refund', 'hours late', 'incompetent',
  'rude', 'disgusting', 'unacceptable', 'broken', 'fees', 'miserable',
];

const POSITIVE = [
  'on time', 'great', 'smooth', 'excellent', 'love', 'quick', 'easy', 'perfect',
  'amazing', 'best', 'comfortable', 'reliable', 'impressed', 'happy', 'friendly',
  'clean', 'upgraded', 'upgrade', 'recommend', 'flawless',
];

function scoreText(text) {
  const lower = text.toLowerCase();
  return {
    pos: POSITIVE.filter(w => lower.includes(w)).length,
    neg: NEGATIVE.filter(w => lower.includes(w)).length,
  };
}

async function getRedditScore(airlineName) {
  try {
    const q = encodeURIComponent(airlineName);
    const url = `https://www.reddit.com/r/flights+travel+flying/search.json?q=${q}&sort=new&t=week&limit=50&restrict_sr=1`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const posts = json.data?.children || [];

    if (posts.length === 0) return { score: 70, detail: 'No recent mentions' };

    let pos = 0, neg = 0;
    for (const p of posts) {
      const s = scoreText(p.data?.title || '');
      pos += s.pos;
      neg += s.neg;
    }

    const total = pos + neg;
    const score = total === 0 ? 70 : Math.round((pos / total) * 100);
    const detail = `${posts.length} posts · ${pos}↑ ${neg}↓`;

    return { score, detail };
  } catch (e) {
    console.error(`Reddit error (${airlineName}):`, e.message);
    return { score: null, detail: 'Unavailable' };
  }
}

module.exports = { getRedditScore };
