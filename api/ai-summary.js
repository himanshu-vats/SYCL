const { db } = require('../lib/firebase');

const SYSTEM_PROMPTS = {
  standings: 'You write concise cricket division analysis for youth cricket parents and coaches. Cover who leads, title race tension, who is struggling, and standout team stats. Under 140 words. No markdown headers.',
  batting:   'You write cricket batting leaderboard summaries for youth cricket parents and coaches. Highlight the standout performers, interesting stats, and what the numbers tell us about this division. Under 140 words. No markdown headers.',
  bowling:   'You write cricket bowling leaderboard summaries for youth cricket parents and coaches. Highlight the most dangerous bowlers, economy leaders, and what the numbers reveal. Under 140 words. No markdown headers.',
  results:   'You write match results summaries for youth cricket. Highlight notable wins, upsets, close finishes, and dominant performances. Under 140 words. No markdown headers.',
  player:    'You write player profile summaries for youth cricket. Highlight key achievements, career stats, strengths, and what makes this player interesting to watch. Under 140 words. No markdown headers.',
};

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function flattenStats(obj, division) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  if (division && division !== 'combined' && obj[division]) return obj[division];
  if (obj['combined']) return obj['combined'];
  return Object.values(obj).flat();
}

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { league, type, key, generate } = req.query;
  if (!league || !type || !key) {
    return res.status(400).json({ error: 'league, type, key required' });
  }
  if (!SYSTEM_PROMPTS[type]) {
    return res.status(400).json({ error: `Unknown type: ${type}` });
  }

  const docId = `${type}-${slugify(key)}`;
  const leagueRef = db.collection('leagues').doc(league);
  const cacheRef  = leagueRef.collection('aiSummary').doc(docId);

  try {
    // Always return cached version if it exists
    const cached = await cacheRef.get();
    if (cached.exists) {
      const { insight, generatedAt } = cached.data();
      return res.json({ insight, generatedAt, cached: true });
    }

    // Not cached — return null unless caller wants generation
    if (generate !== 'true') {
      return res.json({ insight: null });
    }

    // Load league data
    const snap = await leagueRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'League not found' });
    const data = snap.data();

    const context = buildContext(type, key, data);

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 400,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS[type] },
          { role: 'user',   content: context },
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`DeepSeek ${resp.status}: ${err}`);
    }

    const json    = await resp.json();
    const insight = json.choices?.[0]?.message?.content || '';
    const generatedAt = new Date().toISOString();

    await cacheRef.set({ insight, generatedAt, type, key });
    return res.json({ insight, generatedAt, cached: false });
  } catch (e) {
    console.error('ai-summary error:', e);
    return res.status(500).json({ error: 'Failed to generate summary' });
  }
};

// ── Context builders ─────────────────────────────────────────────────────────

function buildContext(type, key, data) {
  switch (type) {
    case 'standings': return standingsContext(key, data);
    case 'batting':   return battingContext(key, data);
    case 'bowling':   return bowlingContext(key, data);
    case 'results':   return resultsContext(key, data);
    case 'player':    return playerContext(key, data);
    default: return '';
  }
}

function standingsContext(division, data) {
  const rows = data.standings?.[division]?.rows || data.standings?.[division] || [];
  const lines = [`STANDINGS SUMMARY — Division: ${division}\n`];

  if (rows.length) {
    lines.push('Current standings:');
    rows.forEach((t, i) => {
      lines.push(`  ${i + 1}. ${t.team} — P${t.played ?? '?'} W${t.won ?? '?'} L${t.lost ?? '?'} Pts${t.pts ?? '?'}${t.nrr ? ` NRR${t.nrr}` : ''}`);
    });
    lines.push('');
  }

  const batters = flattenStats(data.batting, division)
    .sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0)).slice(0, 5);
  if (batters.length) {
    lines.push('Top batters:');
    batters.forEach(p => lines.push(`  ${p.player ?? p.Player} (${p.team ?? p.Team}): ${p.runs} runs, avg ${p.avg}`));
    lines.push('');
  }

  const bowlers = flattenStats(data.bowling, division)
    .sort((a, b) => (parseInt(b.wkts) || 0) - (parseInt(a.wkts) || 0)).slice(0, 5);
  if (bowlers.length) {
    lines.push('Top bowlers:');
    bowlers.forEach(p => lines.push(`  ${p.player ?? p.Player} (${p.team ?? p.Team}): ${p.wkts} wkts, econ ${p.econ}`));
    lines.push('');
  }

  const recent = (data.results?.matches || [])
    .filter(r => !division || division === 'combined' || r.division === division)
    .slice(-6);
  if (recent.length) {
    lines.push('Recent results:');
    recent.forEach(r => lines.push(`  ${r.result || `${r.team1} vs ${r.team2}`}`));
  }

  lines.push('\nWrite the division summary now.');
  return lines.join('\n');
}

function battingContext(division, data) {
  const isCombined = !division || division === 'combined';
  const label = isCombined ? 'All Divisions' : division;
  const rows = flattenStats(data.batting, division)
    .sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0)).slice(0, 12);

  const lines = [`BATTING LEADERBOARD SUMMARY — ${label}\n`, 'Top batters:'];
  rows.forEach((p, i) => {
    lines.push(`  ${i + 1}. ${p.player ?? p.Player} (${p.team ?? p.Team}): ${p.mat} matches, ${p.runs} runs, avg ${p.avg}, SR ${p.sr}, HS ${p.hs ?? p.HS}`);
  });
  lines.push('\nWrite the batting summary now.');
  return lines.join('\n');
}

function bowlingContext(division, data) {
  const isCombined = !division || division === 'combined';
  const label = isCombined ? 'All Divisions' : division;
  const rows = flattenStats(data.bowling, division)
    .sort((a, b) => (parseInt(b.wkts) || 0) - (parseInt(a.wkts) || 0)).slice(0, 12);

  const lines = [`BOWLING LEADERBOARD SUMMARY — ${label}\n`, 'Top bowlers:'];
  rows.forEach((p, i) => {
    lines.push(`  ${i + 1}. ${p.player ?? p.Player} (${p.team ?? p.Team}): ${p.mat} matches, ${p.wkts} wkts, econ ${p.econ}, avg ${p.avg}, best ${p.bbf ?? p.BBF}`);
  });
  lines.push('\nWrite the bowling summary now.');
  return lines.join('\n');
}

function resultsContext(division, data) {
  const isCombined = !division || division === 'combined';
  const label = isCombined ? 'All Divisions' : division;
  const matches = (data.results?.matches || [])
    .filter(r => isCombined || r.division === division)
    .slice(-15);

  const lines = [`RESULTS SUMMARY — ${label}\n`, 'Recent results (newest last):'];
  matches.forEach(r => lines.push(`  ${r.date || ''} — ${r.result || `${r.team1} vs ${r.team2}`}`));
  lines.push('\nWrite the results summary now.');
  return lines.join('\n');
}

function playerContext(name, data) {
  const lower = name.toLowerCase().trim();
  const allBat = Object.values(data.batting || {}).flat();
  const allBowl = Object.values(data.bowling || {}).flat();

  const batRows = allBat.filter(p => (p.player ?? p.Player ?? '').toLowerCase().trim() === lower);
  const bowlRows = allBowl.filter(p => (p.player ?? p.Player ?? '').toLowerCase().trim() === lower);

  const lines = [`PLAYER PROFILE SUMMARY — ${name}\n`];

  if (batRows.length) {
    lines.push('Batting (this season, per division):');
    batRows.forEach(p => {
      lines.push(`  ${p.division || 'Division unknown'}: ${p.mat} matches, ${p.inns} innings, ${p.runs} runs, avg ${p.avg}, SR ${p.sr}, HS ${p.hs ?? p.HS}, 50s ${p.fifties ?? 0}, 100s ${p.hundreds ?? 0}`);
    });
    lines.push('');
  }

  if (bowlRows.length) {
    lines.push('Bowling (this season, per division):');
    bowlRows.forEach(p => {
      lines.push(`  ${p.division || 'Division unknown'}: ${p.mat} matches, ${p.wkts} wkts, econ ${p.econ}, avg ${p.avg}, best ${p.bbf ?? p.BBF}`);
    });
    lines.push('');
  }

  lines.push('\nWrite the player profile summary now.');
  return lines.join('\n');
}
