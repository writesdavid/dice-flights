const fetch = require('node-fetch');

const AIRLINE_HUBS = {
  DL: ['ATL', 'JFK', 'LAX', 'MSP', 'DTW', 'SEA', 'SLC'],
  UA: ['ORD', 'EWR', 'IAH', 'DEN', 'SFO'],
  AA: ['DFW', 'CLT', 'PHL', 'PHX', 'MIA'],
  WN: ['MDW', 'DAL', 'BWI', 'LAS', 'PHX'],
  AS: ['SEA', 'PDX', 'SFO', 'LAX'],
  B6: ['JFK', 'BOS', 'FLL', 'LGB'],
  NK: ['FLL', 'ATL', 'MCO', 'ORD'],
  F9: ['DEN', 'ORD', 'ATL', 'MCO'],
};

// Parse all delayed/stopped airports from FAA NAS Status XML
function parseNasStatus(xml) {
  const airports = {}; // { IATA: { groundStop: bool, maxDelay: number } }

  // Ground stops
  const gsBlock = xml.match(/<Ground_Stop_List>([\s\S]*?)<\/Ground_Stop_List>/);
  if (gsBlock) {
    const arpts = [...gsBlock[1].matchAll(/<ARPT>(\w+)<\/ARPT>/g)];
    for (const m of arpts) {
      airports[m[1]] = { groundStop: true, maxDelay: 999 };
    }
  }

  // General delays
  const delayBlock = xml.match(/<Arrival_Departure_Delay_List>([\s\S]*?)<\/Arrival_Departure_Delay_List>/);
  if (delayBlock) {
    const entries = [...delayBlock[1].matchAll(/<Delay>([\s\S]*?)<\/Delay>/g)];
    for (const entry of entries) {
      const arptMatch = entry[1].match(/<ARPT>(\w+)<\/ARPT>/);
      const maxMatch = entry[1].match(/<Max>(\d+)\s*minutes<\/Max>/);
      if (!arptMatch) continue;
      const code = arptMatch[1];
      const maxDelay = maxMatch ? parseInt(maxMatch[1]) : 30;
      if (!airports[code] || airports[code].maxDelay < maxDelay) {
        airports[code] = { groundStop: false, maxDelay };
      }
    }
  }

  return airports;
}

function airportScore(info) {
  if (!info) return 100;
  if (info.groundStop) return 0;
  const d = info.maxDelay;
  if (d >= 90) return 15;
  if (d >= 60) return 35;
  if (d >= 45) return 55;
  if (d >= 30) return 70;
  if (d >= 15) return 82;
  return 92;
}

let nasCache = { data: null, fetchedAt: 0 };
const NAS_TTL = 10 * 60 * 1000; // re-fetch every 10 min

async function getNasStatus() {
  if (nasCache.data && Date.now() - nasCache.fetchedAt < NAS_TTL) {
    return nasCache.data;
  }
  try {
    const res = await fetch('https://nasstatus.faa.gov/api/airport-status-information');
    const xml = await res.text();
    const parsed = parseNasStatus(xml);
    nasCache = { data: parsed, fetchedAt: Date.now() };
    return parsed;
  } catch (e) {
    console.error('FAA fetch error:', e.message);
    return nasCache.data || null;
  }
}

async function getFaaScore(iata) {
  const nasStatus = await getNasStatus();
  if (!nasStatus) return { score: null, detail: 'FAA data unavailable' };

  const hubs = AIRLINE_HUBS[iata] || [];
  const scores = hubs.map(h => airportScore(nasStatus[h]));
  const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

  const affected = hubs.filter(h => nasStatus[h]);
  const gsHubs = affected.filter(h => nasStatus[h].groundStop);
  const delayHubs = affected.filter(h => !nasStatus[h].groundStop);

  let detail;
  if (affected.length === 0) {
    detail = 'No delays at hubs';
  } else {
    const parts = [];
    if (gsHubs.length) parts.push(`Ground stop: ${gsHubs.join(', ')}`);
    if (delayHubs.length) parts.push(`Delays: ${delayHubs.map(h => `${h} ${nasStatus[h].maxDelay}m`).join(', ')}`);
    detail = parts.join(' · ');
  }

  return { score: avg, detail };
}

module.exports = { getFaaScore };
