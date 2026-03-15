const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/bts_stats.json');

function loadBtsData() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error('BTS data file missing. Run: node scripts/update-bts.js');
    return null;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function computeBtsScore(iata, btsData) {
  if (!btsData) return { score: null, detail: 'No BTS data' };

  const carrier = btsData.carriers[iata];
  if (!carrier || !carrier.monthly || carrier.monthly.length === 0) {
    return { score: null, detail: 'No data for carrier' };
  }

  const months = carrier.monthly;

  const avgOnTime = months.reduce((s, m) => s + m.onTimePct, 0) / months.length;
  const avgCancel = months.reduce((s, m) => s + m.cancelPct, 0) / months.length;

  // Trend: compare oldest half vs newest half of on-time %
  const half = Math.ceil(months.length / 2);
  const olderAvg = months.slice(0, half).reduce((s, m) => s + m.onTimePct, 0) / half;
  const newerAvg = months.slice(-half).reduce((s, m) => s + m.onTimePct, 0) / half;
  const trendDelta = newerAvg - olderAvg;

  // Normalize to 0-100
  // On-time: 60% = 0, 96% = 100
  const onTimeScore  = Math.max(0, Math.min(100, ((avgOnTime - 60) / 36) * 100));
  // Cancel: 0% = 100, 6%+ = 0
  const cancelScore  = Math.max(0, Math.min(100, ((6 - avgCancel) / 6) * 100));
  // Trend bonus: -5 to +5
  const trendBonus   = Math.max(-5, Math.min(5, trendDelta));

  const score = Math.round(onTimeScore * 0.75 + cancelScore * 0.25 + trendBonus);

  const trendStr = trendDelta > 1.5 ? 'improving' : trendDelta < -1.5 ? 'declining' : 'stable';
  const detail = `${Math.round(avgOnTime * 10) / 10}% on-time · ${Math.round(avgCancel * 10) / 10}% cancelled · ${trendStr}`;

  return {
    score: Math.max(0, Math.min(100, score)),
    detail,
    raw: { avgOnTimePct: avgOnTime, avgCancelPct: avgCancel, trendDelta, monthsCovered: months.length },
  };
}

module.exports = { loadBtsData, computeBtsScore };
