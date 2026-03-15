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
  const annuals = btsData.annuals && btsData.annuals[iata];

  if (!carrier || !carrier.monthly || carrier.monthly.length === 0) {
    return { score: null, detail: 'No data for carrier' };
  }

  const months = carrier.monthly;

  // On-time and cancellation averages
  const avgOnTime = months.reduce((s, m) => s + m.onTimePct, 0) / months.length;
  const avgCancel = months.reduce((s, m) => s + m.cancelPct, 0) / months.length;

  // Trend: newest half vs oldest half
  const half = Math.ceil(months.length / 2);
  const olderAvg = months.slice(0, half).reduce((s, m) => s + m.onTimePct, 0) / half;
  const newerAvg = months.slice(-half).reduce((s, m) => s + m.onTimePct, 0) / half;
  const trendDelta = newerAvg - olderAvg;

  // Normalize components 0-100
  const onTimeScore    = Math.max(0, Math.min(100, ((avgOnTime - 60) / 36) * 100));
  const cancelScore    = Math.max(0, Math.min(100, ((6 - avgCancel) / 6) * 100));
  const trendBonus     = Math.max(-5, Math.min(5, trendDelta));

  // Annuals: baggage + complaints + carrier-caused cancellations
  let baggageScore = 50, complaintScore = 50, carrierCancelScore = 50;
  if (annuals) {
    baggageScore      = Math.max(0, Math.min(100, ((8 - annuals.baggagePer100) / 8) * 100));
    complaintScore    = Math.max(0, Math.min(100, ((18 - annuals.complaintsPer100k) / 18) * 100));
    carrierCancelScore = Math.max(0, Math.min(100, ((3 - annuals.carrierCancelPct) / 3) * 100));
  }

  const score = Math.round(
    onTimeScore    * 0.40 +
    cancelScore    * 0.15 +
    baggageScore   * 0.15 +
    complaintScore * 0.20 +
    carrierCancelScore * 0.10 +
    trendBonus
  );

  const trendStr = trendDelta > 1.5 ? 'improving' : trendDelta < -1.5 ? 'declining' : 'stable';
  const detail = `${Math.round(avgOnTime * 10) / 10}% on-time · ${annuals ? annuals.baggagePer100 + ' bags/100 · ' + annuals.complaintsPer100k + ' complaints/100k' : ''} · ${trendStr}`;

  return {
    score: Math.max(0, Math.min(100, score)),
    detail,
    raw: {
      avgOnTimePct: avgOnTime,
      avgCancelPct: avgCancel,
      trendDelta,
      monthsCovered: months.length,
      ...annuals,
    },
  };
}

module.exports = { loadBtsData, computeBtsScore };
