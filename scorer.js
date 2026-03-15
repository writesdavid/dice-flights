// Signal weights
// BTS historical (on-time, cancellations, baggage, complaints, trend): 50%
// FAA live hub delays: 15%
// Weather forecast at primary hub: 15%
// News sentiment (Google News RSS): 20%

const WEIGHTS = { bts: 0.50, faa: 0.15, weather: 0.15, news: 0.20 };

function computeScore(bts, faa, weather, news) {
  const sources = [
    { value: bts?.score,     weight: WEIGHTS.bts },
    { value: faa?.score,     weight: WEIGHTS.faa },
    { value: weather?.score, weight: WEIGHTS.weather },
    { value: news?.score,    weight: WEIGHTS.news },
  ];

  const available = sources.filter(s => s.value !== null && s.value !== undefined);
  if (available.length === 0) return null;

  const totalWeight = available.reduce((s, v) => s + v.weight, 0);
  const score = available.reduce((s, v) => s + (v.value * v.weight / totalWeight), 0);
  return Math.round(score);
}

module.exports = { computeScore };
