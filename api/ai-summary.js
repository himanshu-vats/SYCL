const { db } = require('../lib/firebase');

const SYSTEM_PROMPTS = {
  standings: `You are a cricket analyst covering a youth cricket league. Analyze the standings data and write an insightful 5–7 sentence analysis that:
1. Describes the title race — exact points gap, whether the leader can be caught, games in hand
2. Identifies teams in form vs teams in free-fall, with specific W/L evidence
3. Estimates what the 2nd/3rd placed teams need (wins required) to overtake the leader
4. Notes any surprising positions given the team's batting or bowling strength
5. Names the single most important upcoming fixture that could swing the division
Be analytical and specific with numbers. Write for parents and coaches who follow every game. No markdown headers or bullet points — flowing prose only.`,

  batting: `You are a cricket analyst covering a youth cricket league. Analyze the batting leaderboard and write an insightful 5–7 sentence analysis that:
1. Identifies the dominant performer(s) and what makes their numbers exceptional vs the field
2. Contrasts strike rate vs average leaders — who is explosive vs who is consistent?
3. Notes which teams produce the most run-scorers (batting depth)
4. Calls out any outlier stats that deserve attention (freakish average, extraordinary high score, player appearing for multiple teams)
5. Comments on the overall run-scoring environment — is this a high-scoring division?
6. Mentions any player who looks close to a milestone (400 runs, century etc.)
Use specific numbers throughout. No markdown headers or bullet points — flowing prose only.`,

  bowling: `You are a cricket analyst covering a youth cricket league. Analyze the bowling leaderboard and write an insightful 5–7 sentence analysis that:
1. Contrasts the wicket-takers vs the economy leaders — who provides best overall value?
2. Identifies which team has the most dangerous bowling attack as a unit
3. Highlights any bowler with an exceptional combination of wickets AND economy
4. Notes extremes — best economy, most wickets, best bowling figures
5. Comments on whether the conditions favor batters or bowlers based on economy rates
6. Names the bowler you'd want bowling the final over in a tight match, and why
Use specific numbers throughout. No markdown headers or bullet points — flowing prose only.`,

  results: `You are a cricket analyst covering youth cricket. Analyze the match results and write an insightful 5–7 sentence analysis that:
1. Identifies the most dominant team based on winning margins across recent games
2. Highlights the most exciting/closest finish and what made it special
3. Notes any upsets — lower-standing team beating a higher-standing one
4. Identifies teams currently on winning or losing streaks
5. Compares the run environments — are games high-scoring (140+) or low-scoring tight affairs?
6. Draws a conclusion about what these results tell us about the season's direction
Use match specifics and team names. No markdown headers or bullet points — flowing prose only.`,

  player: `You are a cricket analyst writing a detailed player profile for youth cricket. Analyze the player's stats and write an insightful 5–7 sentence analysis that:
1. Characterizes their batting or bowling style from the numbers (aggressive striker? anchor? wicket-taking vs economy bowler?)
2. Compares their key metrics to what is considered strong for this level (avg 30+ is excellent, econ under 6 is tight etc.)
3. Identifies their single greatest strength and one area that could elevate their game further
4. If multi-division or multi-season data exists, describes their progression and improvement arc
5. Summarizes their overall value to their team — are they a match-winner, an anchor, or a consistent contributor?
Be specific with numbers. Write for parents and coaches who care about this player's development. No markdown headers or bullet points — flowing prose only.`,
};

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// For a single division: return that division's array.
// For 'combined': flatten all divisions and aggregate per-player totals
// so the numbers match what the frontend's aggregateBatting/aggregateBowling shows.
function getStats(obj, division, role) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  const isCombined = !division || division === 'combined';

  if (!isCombined) return obj[division] || [];

  // Flatten all real divisions (skip meta keys)
  const all = Object.entries(obj)
    .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([, rows]) => Array.isArray(rows) ? rows : []);

  // Aggregate by player name
  const map = new Map();
  for (const p of all) {
    const name = (p.player || p.Player || '').trim();
    if (!name) continue;
    const k = name.toLowerCase();
    if (!map.has(k)) {
      map.set(k, {
        player: name,
        team: p.team || p.Team || '',
        mat:   0, inns: 0, no: 0, runs: 0,
        wkts:  0, fours: 0, sixes: 0, fifties: 0, hundreds: 0,
        _balls: 0, _runsBowled: 0,
      });
    }
    const e = map.get(k);
    e.mat   += parseInt(p.mat)   || 0;
    e.inns  += parseInt(p.inns)  || 0;
    e.no    += parseInt(p.no)    || 0;
    e.runs  += parseInt(p.runs)  || 0;
    e.wkts  += parseInt(p.wkts)  || 0;
    e.fours += parseInt(p.fours ?? p['4s']) || 0;
    e.sixes += parseInt(p.sixes ?? p['6s']) || 0;
    e.fifties  += parseInt(p.fifties  ?? p['50s']) || 0;
    e.hundreds += parseInt(p.hundreds ?? p['100s']) || 0;
    // For economy: accumulate runs and balls to recalculate
    if (p.econ && p.overs) {
      const ov = parseFloat(p.overs) || 0;
      const balls = Math.floor(ov) * 6 + Math.round((ov % 1) * 10);
      e._balls += balls;
      e._runsBowled += parseInt(p.runs) || 0;
    }
  }

  return [...map.values()].map(e => ({
    ...e,
    avg:  e.inns - e.no > 0 ? (e.runs / (e.inns - e.no)).toFixed(1) : (e.runs > 0 ? 'N/O' : '0'),
    econ: e._balls > 0 ? (e._runsBowled / e._balls * 6).toFixed(2) : '—',
  }));
}

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { league, type, key, generate, bust } = req.query;
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
    // Return cached version unless bust=true forces regeneration
    const cached = await cacheRef.get();
    if (cached.exists && bust !== 'true') {
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
        max_tokens: 600,
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
  // Standings can be stored as { rows: [...], updatedAt } or as a plain array
  const raw = data.standings?.[division];
  const rows = Array.isArray(raw) ? raw : (raw?.rows || []);
  const lines = [`STANDINGS SUMMARY — Division: ${division}\n`];

  if (rows.length) {
    lines.push('Current standings:');
    rows.forEach((t, i) => {
      lines.push(`  ${i + 1}. ${t.team} — P${t.played ?? '?'} W${t.won ?? '?'} L${t.lost ?? '?'} Pts${t.pts ?? '?'}${t.nrr ? ` NRR${t.nrr}` : ''}`);
    });
    lines.push('');
  }

  const batters = getStats(data.batting, division, 'bat')
    .sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0)).slice(0, 5);
  if (batters.length) {
    lines.push('Top batters:');
    batters.forEach(p => lines.push(`  ${p.player ?? p.Player} (${p.team ?? p.Team}): ${p.runs} runs, avg ${p.avg}`));
    lines.push('');
  }

  const bowlers = getStats(data.bowling, division, 'bowl')
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
  const rows = getStats(data.batting, division, 'bat')
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
  const rows = getStats(data.bowling, division, 'bowl')
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

  // Filter out non-array values (updatedAt, combined) before flattening
  const allBat = Object.entries(data.batting || {})
    .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([div, rows]) => Array.isArray(rows) ? rows.map(r => ({ ...r, _div: div })) : []);
  const allBowl = Object.entries(data.bowling || {})
    .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([div, rows]) => Array.isArray(rows) ? rows.map(r => ({ ...r, _div: div })) : []);

  const batRows  = allBat.filter(p  => (p.player ?? p.Player ?? '').toLowerCase().trim() === lower);
  const bowlRows = allBowl.filter(p => (p.player ?? p.Player ?? '').toLowerCase().trim() === lower);

  const lines = [`PLAYER PROFILE SUMMARY — ${name}\n`];

  if (batRows.length) {
    lines.push('Batting stats (per division this season):');
    batRows.forEach(p => {
      lines.push(`  ${p._div}: ${p.mat} matches, ${p.inns} innings, ${p.runs} runs, avg ${p.avg}, SR ${p.sr}, HS ${p.hs ?? p.HS}, 50s ${p.fifties ?? 0}, 100s ${p.hundreds ?? 0}`);
    });
    lines.push('');
  }

  if (bowlRows.length) {
    lines.push('Bowling stats (per division this season):');
    bowlRows.forEach(p => {
      lines.push(`  ${p._div}: ${p.mat} matches, ${p.wkts} wkts, econ ${p.econ}, avg ${p.avg}, best ${p.bbf ?? p.BBF}`);
    });
    lines.push('');
  }

  lines.push('\nWrite the player profile summary now.');
  return lines.join('\n');
}
