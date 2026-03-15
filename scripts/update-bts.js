/**
 * update-bts.js — Refresh airline on-time data from BTS
 *
 * Run: node scripts/update-bts.js
 *
 * Tries automated download first. If BTS blocks it (requires browser session),
 * prints manual download instructions.
 */

const fetch = require('node-fetch');
const unzipper = require('unzipper');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, '../data/bts_stats.json');
const TARGET = ['DL', 'UA', 'AA', 'WN', 'AS', 'B6', 'G4', 'F9'];

function getMonthsToFetch(n = 6) {
  const months = [];
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() - 1; // BTS lags ~60 days
  for (let i = 0; i < n + 2; i++) {
    if (month < 0) { month = 11; year--; }
    months.push({ year, month: month + 1 });
    month--;
  }
  return months;
}

async function fetchMonthStats(year, month) {
  const mm = String(month).padStart(2, '0');
  const url = `https://transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_${year}_${mm}.zip`;
  process.stdout.write(`  Trying BTS ${year}-${mm}... `);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/zip, application/octet-stream, */*',
      'Referer': 'https://www.transtats.bts.gov/',
    },
    timeout: 90000,
  });

  // BTS returns HTML when blocking — check content type
  const ct = res.headers.get('content-type') || '';
  if (!res.ok || ct.includes('text/html')) {
    process.stdout.write(`blocked (${res.status})\n`);
    return null;
  }

  process.stdout.write('downloading... ');
  const carriers = {};

  await new Promise((resolve, reject) => {
    res.body
      .pipe(unzipper.ParseOne(/\.csv$/i))
      .pipe(csv())
      .on('data', row => {
        const carrier = row.UniqueCarrier || row.UNIQUE_CARRIER || row.OP_UNIQUE_CARRIER;
        if (!TARGET.includes(carrier)) return;
        if (!carriers[carrier]) carriers[carrier] = { total: 0, onTime: 0, cancelled: 0 };
        const c = carriers[carrier];
        c.total++;
        const cancelled = row.Cancelled || row.CANCELLED;
        if (cancelled === '1') { c.cancelled++; return; }
        const del15 = row.ArrDel15 || row.ARR_DEL15;
        if (del15 === '0') c.onTime++;
      })
      .on('end', resolve)
      .on('error', reject);
  });

  process.stdout.write('done\n');
  return { year, month, carriers };
}

function buildOutput(months) {
  const sorted = months.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  const carriers = {};

  for (const iata of TARGET) {
    const monthly = sorted
      .map(m => {
        const c = m.carriers[iata];
        if (!c || c.total < 50) return null;
        const flown = c.total - c.cancelled;
        return {
          year: m.year,
          month: m.month,
          onTimePct: Math.round((c.onTime / flown) * 1000) / 10,
          cancelPct: Math.round((c.cancelled / c.total) * 1000) / 10,
        };
      })
      .filter(Boolean);

    if (monthly.length > 0) {
      carriers[iata] = { monthly };
    }
  }

  const first = sorted[0];
  const last  = sorted[sorted.length - 1];
  const months_names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return {
    source: 'US DOT Bureau of Transportation Statistics — On-Time Reporting Carrier Performance',
    period: `${months_names[first.month - 1]} ${first.year} – ${months_names[last.month - 1]} ${last.year}`,
    lastUpdated: new Date().toISOString().split('T')[0],
    carriers,
  };
}

function printManualInstructions() {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BTS automated download requires a browser session.
Manual update takes about 5 minutes:

1. Go to: https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FGJ
2. Select fields: UniqueCarrier, Year, Month, ArrDel15, Cancelled
3. Download and unzip
4. Place the CSV at: data/raw_bts.csv
5. Run: node scripts/update-bts.js --from-file

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

async function fromFile() {
  const csvPath = path.join(__dirname, '../data/raw_bts.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('No data/raw_bts.csv found. Run without --from-file first to get instructions.');
    process.exit(1);
  }

  console.log('Processing data/raw_bts.csv...');
  const byMonth = {};

  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', row => {
        const carrier = row.UniqueCarrier || row.UNIQUE_CARRIER;
        if (!TARGET.includes(carrier)) return;
        const year  = parseInt(row.Year || row.YEAR);
        const month = parseInt(row.Month || row.MONTH);
        const key = `${year}-${month}`;
        if (!byMonth[key]) byMonth[key] = { year, month, carriers: {} };
        const m = byMonth[key];
        if (!m.carriers[carrier]) m.carriers[carrier] = { total: 0, onTime: 0, cancelled: 0 };
        const c = m.carriers[carrier];
        c.total++;
        if ((row.Cancelled || row.CANCELLED) === '1') { c.cancelled++; return; }
        if ((row.ArrDel15 || row.ARR_DEL15) === '0') c.onTime++;
      })
      .on('end', resolve)
      .on('error', reject);
  });

  const months = Object.values(byMonth);
  const output = buildOutput(months);
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(`Saved ${months.length} months to data/bts_stats.json`);
  months.forEach(m => {
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const counts = Object.entries(m.carriers).map(([k,v]) => `${k}:${v.total}`).join(' ');
    console.log(`  ${names[m.month-1]} ${m.year}: ${counts}`);
  });
}

async function main() {
  if (process.argv.includes('--from-file')) {
    return fromFile();
  }

  console.log('Attempting automated BTS download...\n');
  const toFetch = getMonthsToFetch(6);
  const results = [];

  for (const { year, month } of toFetch) {
    try {
      const data = await fetchMonthStats(year, month);
      if (data) {
        results.push(data);
        if (results.length >= 6) break;
      }
    } catch (e) {
      console.error(`  Error: ${e.message}`);
    }
  }

  if (results.length === 0) {
    printManualInstructions();
    process.exit(0);
  }

  const output = buildOutput(results);
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(`\nSaved ${results.length} months to data/bts_stats.json`);
  console.log(`Period: ${output.period}`);
}

main().catch(e => { console.error(e); process.exit(1); });
