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

  team: `You are a cricket analyst writing a team profile summary for youth cricket. Analyze the team's data and write an insightful 5–7 sentence analysis that:
1. Summarizes the team's season form — wins, losses, momentum, and where they sit in the division
2. Identifies the batting backbone — who scores the runs and what makes them effective
3. Identifies the bowling attack — who takes wickets and who keeps it tight
4. Notes any standout individual contributions or team patterns (strong chasing? good at defending?)
5. Assesses their prospects — can they challenge for top spot, or what do they need to improve?
Use specific names and numbers. Write for parents of players on this team. No markdown headers or bullet points — flowing prose only.`,

  division: `You are a cricket analyst writing a division summary for youth cricket parents and coaches. Analyze all the division data provided and write an insightful 5–7 sentence analysis that:
1. Opens with the defining story of this division — is it a runaway leader, a tight race, or total chaos?
2. Describes the title race with specific points, games in hand, and what each contender needs
3. Names the division's standout individual performers (batter and bowler) with their key numbers
4. Notes any team on a hot streak or a worrying slide, and what's driving it
5. Highlights the most important upcoming fixture in this division and why it matters
6. Closes with a prediction or storyline to watch for the rest of the division season
Be specific. Write with the energy of a local sports journalist who watched every game. No markdown headers or bullet points — flowing prose only.`,

  overview: `You are a cricket analyst writing the season homepage summary for a youth cricket league. Analyze all the data provided and write an insightful 6–8 sentence summary that:
1. Opens with a compelling one-sentence state-of-the-season hook — what is the defining story of this season so far?
2. Covers the title races across divisions — who leads, how tight is it, any dominant team or shock leader?
3. Highlights 2–3 standout individual performers (batter and bowler) with specific numbers that tell their story
4. Notes any interesting team narratives — a team on a hot streak, a surprise package, or a defending champion under pressure
5. Comments on the style of cricket being played — high-scoring, tight bowling contests, or a mix?
6. Closes with what to watch for in the coming weeks — key fixtures, milestone chasers, title deciders
Write for parents and coaches who love this league. Be specific with names, numbers, and division context. Make it feel like an editorial, not a report card. No markdown headers or bullet points — flowing prose only.`,

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
        mat: 0, inns: 0, no: 0, runs: 0,
        // bowling fields (actual Firestore field names)
        wickets: 0, fiveW: 0,
        // batting fields
        fours: 0, sixes: 0, fifties: 0, hundreds: 0,
        _balls: 0, _runsBowled: 0,
      });
    }
    const e = map.get(k);
    e.mat     += parseInt(p.mat)     || 0;
    e.inns    += parseInt(p.inns)    || 0;
    e.no      += parseInt(p.no)      || 0;
    e.runs    += parseInt(p.runs)    || 0;
    e.wickets += parseInt(p.wickets) || 0;   // bowling: actual field name
    e.fiveW   += parseInt(p.fiveW)   || 0;
    e.fours   += parseInt(p.fours)   || 0;
    e.sixes   += parseInt(p.sixes)   || 0;
    e.fifties  += parseInt(p.fifties)  || 0;
    e.hundreds += parseInt(p.hundreds) || 0;
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
    case 'overview':  return overviewContext(data);
    case 'team':      return teamContext(key, data);
    case 'division':  return divisionContext(key, data);
    case 'standings': return standingsContext(key, data);
    case 'batting':   return battingContext(key, data);
    case 'bowling':   return bowlingContext(key, data);
    case 'results':   return resultsContext(key, data);
    case 'player':    return playerContext(key, data);
    default: return '';
  }
}

function teamContext(teamName, data) {
  const lines = [`TEAM PROFILE SUMMARY — ${teamName}\n`];

  // Recent results
  const allResults = data.results?.matches || [];
  const teamResults = allResults
    .filter(r => r.team1 === teamName || r.team2 === teamName)
    .slice(-6);
  if (teamResults.length) {
    const wins = teamResults.filter(r => r.result?.toLowerCase().startsWith(teamName.toLowerCase())).length;
    lines.push(`Record (last ${teamResults.length} games): ${wins}W ${teamResults.length - wins}L`);
    lines.push('Recent results:');
    teamResults.forEach(r => lines.push(`  ${r.result || `${r.team1} vs ${r.team2}`}`));
    lines.push('');
  }

  // Standing in division
  const divMatches = (data.matches || []).filter(m => m.team1 === teamName || m.team2 === teamName);
  const division = divMatches[0]?.division;
  if (division) {
    const raw = data.standings?.[division];
    const rows = Array.isArray(raw) ? raw : (raw?.rows || []);
    const pos = rows.findIndex(r => r.team === teamName);
    if (pos >= 0) {
      const t = rows[pos];
      lines.push(`Division: ${division} — Position ${pos + 1} of ${rows.length} (${t.pts} pts, ${t.won}W ${t.lost}L)\n`);
    }
  }

  // Top batters
  const allBat = Object.entries(data.batting || {})
    .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([, rows]) => Array.isArray(rows) ? rows : []);
  const batters = allBat.filter(p => p.team === teamName)
    .sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0)).slice(0, 4);
  if (batters.length) {
    lines.push('Top batters:');
    batters.forEach(p => lines.push(`  ${p.player}: ${p.runs} runs, avg ${p.avg}, SR ${p.sr}, HS ${p.hs}`));
    lines.push('');
  }

  // Top bowlers
  const allBowl = Object.entries(data.bowling || {})
    .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([, rows]) => Array.isArray(rows) ? rows : []);
  const bowlers = allBowl.filter(p => p.team === teamName)
    .sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0)).slice(0, 4);
  if (bowlers.length) {
    lines.push('Top bowlers:');
    bowlers.forEach(p => lines.push(`  ${p.player}: ${p.wickets} wkts, econ ${p.econ}, avg ${p.avg}, best ${p.bbf}`));
    lines.push('');
  }

  lines.push('Write the team profile summary now.');
  return lines.join('\n');
}

function divisionContext(division, data) {
  const lines = [`DIVISION SUMMARY — ${division}\n`];

  // Standings
  const raw = data.standings?.[division];
  const rows = Array.isArray(raw) ? raw : (raw?.rows || []);
  if (rows.length) {
    lines.push('Current standings:');
    rows.forEach((t, i) => {
      lines.push(`  ${i + 1}. ${t.team} — P${t.played ?? '?'} W${t.won ?? '?'} L${t.lost ?? '?'} Pts${t.pts ?? '?'}${t.nrr ? ` NRR${t.nrr}` : ''}`);
    });
    lines.push('');
  }

  // Top 4 batters in this division
  const batters = getStats(data.batting, division, 'bat')
    .sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0)).slice(0, 4);
  if (batters.length) {
    lines.push('Top batters:');
    batters.forEach(p => lines.push(`  ${p.player} (${p.team}): ${p.runs} runs, avg ${p.avg}`));
    lines.push('');
  }

  // Top 4 bowlers
  const bowlers = getStats(data.bowling, division, 'bowl')
    .sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0)).slice(0, 4);
  if (bowlers.length) {
    lines.push('Top bowlers:');
    bowlers.forEach(p => lines.push(`  ${p.player} (${p.team}): ${p.wickets} wkts, econ ${p.econ}`));
    lines.push('');
  }

  // Recent results
  const recent = (data.results?.matches || []).filter(r => r.division === division).slice(-6);
  if (recent.length) {
    lines.push('Recent results:');
    recent.forEach(r => lines.push(`  ${r.result || `${r.team1} vs ${r.team2}`}`));
    lines.push('');
  }

  // Upcoming fixtures
  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = (data.matches || [])
    .filter(m => m.division === division && !m.result && !m.winner)
    .filter(m => { const d = new Date(m.date); return !isNaN(d) && d >= today; })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);
  if (upcoming.length) {
    lines.push('Upcoming fixtures:');
    upcoming.forEach(m => lines.push(`  ${m.team1} vs ${m.team2} — ${m.date}`));
    lines.push('');
  }

  lines.push('Write the division summary now.');
  return lines.join('\n');
}

function overviewContext(data) {
  const lines = [`LEAGUE SEASON OVERVIEW — ${data.leagueName || 'League'}${data.season ? ` · ${data.season}` : ''}\n`];

  // Season progress
  const allMatches = data.matches || [];
  const allResults = data.results?.matches || [];
  const total = allMatches.length;
  const done  = allResults.length;
  lines.push(`Season progress: ${done} of ${total} matches played (${total > 0 ? Math.round(done/total*100) : 0}%)\n`);

  // Standings per division — leader + closest rival
  const divs = Object.keys(data.standings || {});
  if (divs.length) {
    lines.push('DIVISION STANDINGS SNAPSHOT:');
    for (const div of divs) {
      const raw = data.standings[div];
      const rows = Array.isArray(raw) ? raw : (raw?.rows || []);
      if (!rows.length) continue;
      const leader = rows[0];
      const second = rows[1];
      const gap = second ? `, ${(parseInt(leader.pts) - parseInt(second.pts)) || 0} pts ahead of ${second.team}` : '';
      lines.push(`  ${div}: ${leader.team} leads (${leader.pts} pts, ${leader.won}W${gap})`);
    }
    lines.push('');
  }

  // Top 3 run-scorers across all divisions
  const allBat = getStats(data.batting, 'combined', 'bat')
    .sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0)).slice(0, 3);
  if (allBat.length) {
    lines.push('TOP RUN-SCORERS (all divisions):');
    allBat.forEach(p => lines.push(`  ${p.player} (${p.team}): ${p.runs} runs, avg ${p.avg}`));
    lines.push('');
  }

  // Top 3 wicket-takers across all divisions
  const allBowl = getStats(data.bowling, 'combined', 'bowl')
    .sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0)).slice(0, 3);
  if (allBowl.length) {
    lines.push('TOP WICKET-TAKERS (all divisions):');
    allBowl.forEach(p => lines.push(`  ${p.player} (${p.team}): ${p.wickets} wkts, econ ${p.econ}`));
    lines.push('');
  }

  // Recent results (last 8)
  const recent = allResults.slice(-8);
  if (recent.length) {
    lines.push('RECENT RESULTS:');
    recent.forEach(r => lines.push(`  ${r.division ? `[${r.division}]` : ''} ${r.result || `${r.team1} vs ${r.team2}`}`));
    lines.push('');
  }

  // Next 5 upcoming fixtures
  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = allMatches
    .filter(m => { const d = new Date(m.date); return !isNaN(d) && d >= today && !m.result && !m.winner; })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);
  if (upcoming.length) {
    lines.push('UPCOMING FIXTURES:');
    upcoming.forEach(m => lines.push(`  [${m.division}] ${m.team1} vs ${m.team2} — ${m.date}`));
    lines.push('');
  }

  lines.push('Write the season overview summary now.');
  return lines.join('\n');
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
    .sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0)).slice(0, 5);
  if (bowlers.length) {
    lines.push('Top bowlers:');
    bowlers.forEach(p => lines.push(`  ${p.player ?? p.Player} (${p.team ?? p.Team}): ${p.wickets} wkts, econ ${p.econ}`));
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
    const hs = p.hs || p.HS || '—';
    lines.push(`  ${i + 1}. ${p.player ?? p.Player} (${p.team ?? p.Team}): ${p.mat} matches, ${p.runs} runs, avg ${p.avg}${p.sr ? `, SR ${p.sr}` : ''}${hs !== '—' ? `, HS ${hs}` : ''}`);
  });
  lines.push('\nWrite the batting summary now.');
  return lines.join('\n');
}

function bowlingContext(division, data) {
  const isCombined = !division || division === 'combined';
  const label = isCombined ? 'All Divisions' : division;
  const rows = getStats(data.bowling, division, 'bowl')
    .sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0)).slice(0, 12);

  const lines = [`BOWLING LEADERBOARD SUMMARY — ${label}\n`, 'Top bowlers:'];
  rows.forEach((p, i) => {
    lines.push(`  ${i + 1}. ${p.player ?? p.Player} (${p.team ?? p.Team}): ${p.mat} matches, ${p.wickets} wkts, econ ${p.econ}, avg ${p.avg}, best ${p.bbf}`);
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
      lines.push(`  ${p._div}: ${p.mat} matches, ${p.wickets} wkts, econ ${p.econ}, avg ${p.avg}, best ${p.bbf}`);
    });
    lines.push('');
  }

  lines.push('\nWrite the player profile summary now.');
  return lines.join('\n');
}
