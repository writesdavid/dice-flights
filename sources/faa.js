const fetch = require('node-fetch');

// Primary hub per airline — where cascading delays hurt them most
const PRIMARY_HUBS = {
  DL: 'ATL', UA: 'ORD', AA: 'DFW',
  WN: 'MDW', AS: 'SEA', B6: 'JFK',
  G4: 'LAS', F9: 'DEN',
};

// All hubs per airline for broader signal
const ALL_HUBS = {
  DL: ['ATL', 'JFK', 'LAX', 'MSP', 'DTW', 'SEA', 'SLC'],
  UA: ['ORD', 'EWR', 'IAH', 'DEN', 'SFO'],
  AA: ['DFW', 'CLT', 'PHL', 'PHX', 'MIA'],
  WN: ['MDW', 'DAL', 'BWI', 'LAS', 'PHX'],
  AS: ['SEA', 'PDX', 'SFO', 'LAX'],
  B6: ['JFK', 'BOS', 'FLL', 'LGB'],
  G4: ['LAS', 'PIE', 'AZA', 'OAK'],
  F9: ['DEN', 'ORD', 'ATL', 'MCO'],
};

let nasCache = { data: null, fetchedAt: 0 };
const NAS_TTL = 10 * 60 * 1000;

// Parse a duration string like "3 hours and 36 minutes", "24 hours", "46 minutes" into minutes
function parseDurationMinutes(str) {
  if (!str) return null;
  const s = str.trim();
  let total = 0;
  const hours = s.match(/(\d+)\s*hour/);
  const mins  = s.match(/(\d+)\s*min/);
  if (hours) total += parseInt(hours[1]) * 60;
  if (mins)  total += parseInt(mins[1]);
  return total > 0 ? total : null;
}

function parseNasXml(xml) {
  const airports = {};

  // Ground Stop Programs — full stop, worst possible
  const gsBlock = xml.match(/<Ground_Stop_List>([\s\S]*?)<\/Ground_Stop_List>/);
  if (gsBlock) {
    for (const m of gsBlock[1].matchAll(/<ARPT>(\w+)<\/ARPT>/g)) {
      airports[m[1]] = { groundStop: true, maxDelay: 999 };
    }
  }

  // Ground Delay Programs — average delay reported in hours + minutes
  const gdBlock = xml.match(/<Ground_Delay_List>([\s\S]*?)<\/Ground_Delay_List>/);
  if (gdBlock) {
    for (const entry of gdBlock[1].matchAll(/<Ground_Delay>([\s\S]*?)<\/Ground_Delay>/g)) {
      const arpt = entry[1].match(/<ARPT>(\w+)<\/ARPT>/)?.[1];
      // Use <Max> first; fall back to <Avg>
      const maxStr = entry[1].match(/<Max>([\s\S]*?)<\/Max>/)?.[1];
      const avgStr = entry[1].match(/<Avg>([\s\S]*?)<\/Avg>/)?.[1];
      const delay  = parseDurationMinutes(maxStr) || parseDurationMinutes(avgStr) || 60;
      if (!arpt) continue;
      // Don't overwrite a ground stop
      if (!airports[arpt]) {
        airports[arpt] = { groundStop: false, maxDelay: delay };
      } else if (!airports[arpt].groundStop && airports[arpt].maxDelay < delay) {
        airports[arpt].maxDelay = delay;
      }
    }
  }

  // General Arrival/Departure Delay Info — delay in "X hours and Y minutes" or "Z minutes"
  const delayBlock = xml.match(/<Arrival_Departure_Delay_List>([\s\S]*?)<\/Arrival_Departure_Delay_List>/);
  if (delayBlock) {
    for (const entry of delayBlock[1].matchAll(/<Delay>([\s\S]*?)<\/Delay>/g)) {
      const arpt = entry[1].match(/<ARPT>(\w+)<\/ARPT>/)?.[1];
      const maxStr = entry[1].match(/<Max>([\s\S]*?)<\/Max>/)?.[1];
      const delay  = parseDurationMinutes(maxStr) || 30;
      if (!arpt) continue;
      if (!airports[arpt]) {
        airports[arpt] = { groundStop: false, maxDelay: delay };
      } else if (!airports[arpt].groundStop && airports[arpt].maxDelay < delay) {
        airports[arpt].maxDelay = delay;
      }
    }
  }

  return airports;
}

async function getNasStatus() {
  if (nasCache.data && Date.now() - nasCache.fetchedAt < NAS_TTL) return nasCache.data;
  try {
    const res = await fetch('https://nasstatus.faa.gov/api/airport-status-information', { timeout: 10000 });
    const xml = await res.text();
    nasCache = { data: parseNasXml(xml), fetchedAt: Date.now() };
    return nasCache.data;
  } catch (e) {
    console.error('FAA fetch error:', e.message);
    return nasCache.data || null;
  }
}

function hubScore(info) {
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

async function getFaaScore(iata) {
  const nas = await getNasStatus();
  if (!nas) return { score: null, detail: 'FAA unavailable' };

  const hubs = ALL_HUBS[iata] || [];
  const scores = hubs.map(h => hubScore(nas[h]));
  const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

  const primary = PRIMARY_HUBS[iata];
  const primaryInfo = nas[primary];
  const affected = hubs.filter(h => nas[h]);
  const gsHubs = affected.filter(h => nas[h].groundStop);
  const delayHubs = affected.filter(h => !nas[h].groundStop);

  let detail;
  if (affected.length === 0) {
    detail = `No delays at hubs`;
  } else {
    const parts = [];
    if (gsHubs.length)   parts.push(`Ground stop: ${gsHubs.join(', ')}`);
    if (delayHubs.length) parts.push(`Delays: ${delayHubs.map(h => `${h} ${nas[h].maxDelay}m`).join(', ')}`);
    detail = parts.join(' · ');
  }

  return { score: avg, detail };
}

module.exports = { getFaaScore };
