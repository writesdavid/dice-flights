// BTS historical performance: 65%
// News sentiment (Google News RSS): 35%
// No API keys required for either source.

const WEIGHTS = { bts: 0.65, news: 0.35 };

function computeScore(bts, reddit, news) {
  // reddit param kept for API compatibility but ignored
  const sources = [
    { value: bts.score,  weight: WEIGHTS.bts },
    { value: news.score, weight: WEIGHTS.news },
  ];

  const available = sources.filter(s => s.value !== null);
  if (available.length === 0) return null;

  const totalWeight = available.reduce((s, v) => s + v.weight, 0);
  const score = available.reduce((s, v) => s + (v.value * v.weight / totalWeight), 0);
  return Math.round(score);
}

module.exports = { computeScore };
