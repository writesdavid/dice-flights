const fetch = require('node-fetch');

// Primary hub coordinates — where weather cascades through the network
const HUB_COORDS = {
  DL: { hub: 'ATL', lat: 33.6407, lon: -84.4277, tz: 'America/New_York' },
  UA: { hub: 'ORD', lat: 41.9742, lon: -87.9073, tz: 'America/Chicago' },
  AA: { hub: 'DFW', lat: 32.8998, lon: -97.0403, tz: 'America/Chicago' },
  WN: { hub: 'MDW', lat: 41.7868, lon: -87.7522, tz: 'America/Chicago' },
  AS: { hub: 'SEA', lat: 47.4502, lon: -122.3088, tz: 'America/Los_Angeles' },
  B6: { hub: 'JFK', lat: 40.6413, lon: -73.7781, tz: 'America/New_York' },
  G4: { hub: 'LAS', lat: 36.0840, lon: -115.1537, tz: 'America/Los_Angeles' },
  F9: { hub: 'DEN', lat: 39.8561, lon: -104.6737, tz: 'America/Denver' },
};

// WMO weather interpretation codes → impact score (100 = no impact)
function wmoScore(code) {
  if (code <= 3)  return 100; // clear to overcast
  if (code <= 48) return 60;  // fog
  if (code <= 55) return 75;  // drizzle
  if (code <= 63) return 65;  // light-moderate rain
  if (code === 65) return 48; // heavy rain
  if (code <= 73) return 42;  // light-moderate snow
  if (code <= 77) return 22;  // heavy snow / snow grains
  if (code <= 82) return 62;  // rain showers
  if (code <= 86) return 35;  // snow showers
  if (code === 95) return 28; // thunderstorm
  return 18;                  // severe storms
}

function wmoLabel(code) {
  if (code === 0)  return 'Clear';
  if (code <= 2)   return 'Mostly clear';
  if (code === 3)  return 'Overcast';
  if (code <= 48)  return 'Fog';
  if (code <= 55)  return 'Drizzle';
  if (code <= 63)  return 'Rain';
  if (code === 65) return 'Heavy rain';
  if (code <= 73)  return 'Snow';
  if (code <= 77)  return 'Heavy snow';
  if (code <= 82)  return 'Showers';
  if (code <= 86)  return 'Snow showers';
  if (code === 95) return 'Thunderstorms';
  return 'Severe storms';
}

async function getWeatherScore(iata) {
  const loc = HUB_COORDS[iata];
  if (!loc) return { score: null, detail: 'No hub data' };

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=weathercode,precipitation_sum&timezone=${encodeURIComponent(loc.tz)}&forecast_days=4`;
    const res = await fetch(url, { timeout: 8000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const codes = json.daily?.weathercode || [];
    const precip = json.daily?.precipitation_sum || [];

    // Indices: 0=today, 1=tomorrow, 2=day after, 3=day 3
    // Weight toward nearest days
    const weights = [0.10, 0.45, 0.30, 0.15];
    const relevant = codes.slice(0, 4);

    const score = Math.round(
      relevant.reduce((s, code, i) => s + wmoScore(code) * (weights[i] || 0), 0)
    );

    // Build a human readable 3-day summary
    const tomorrow = relevant[1] !== undefined ? wmoLabel(relevant[1]) : null;
    const day2     = relevant[2] !== undefined ? wmoLabel(relevant[2]) : null;
    const days = [tomorrow, day2].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
    const precipTomorrow = precip[1] != null ? Math.round(precip[1] * 10) / 10 : null;

    let detail = `${loc.hub}: `;
    if (days.length === 1 && days[0] === 'Clear') {
      detail += 'Clear next 3 days';
    } else {
      detail += days.join(' → ');
      if (precipTomorrow && precipTomorrow > 0) detail += ` (${precipTomorrow}mm tomorrow)`;
    }

    return { score, detail, hub: loc.hub };
  } catch (e) {
    console.error(`Weather error (${iata}):`, e.message);
    return { score: null, detail: 'Forecast unavailable' };
  }
}

module.exports = { getWeatherScore };
