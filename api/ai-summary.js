const { db } = require('../lib/firebase');
const { loadMultiSeasonData, getPlayerStatsAcrossSeasons, getTeamStatsAcrossSeasons, formatSeasonsForPrompt } = require('../lib/context-utils');

const SYSTEM_PROMPTS = {
  standings: `You are a cricket analyst covering a youth cricket league. Analyze the standings data and write an insightful 5–7 sentence analysis that:
1. Describes the title race outcome — who won the division, the exact points gap, and how commanding the victory was
2. Identifies teams that overperformed or underperformed vs expectations, with specific W/L evidence
3. Highlights any team that finished strongly vs any that faded at the end
4. Notes any surprising final positions given the team's batting or bowling strength
5. Closes with the defining story of this division's season — what will be remembered?
If the season is still in progress, name the single most important upcoming fixture that could swing the division.
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
1. Opens with the defining story of this division — who won it, how convincingly, and what made this division memorable?
2. Describes the final standings with specific points and what separated the champions from the rest
3. Names the division's standout individual performers (batter and bowler) with their key numbers
4. Notes any team that surprised — either overachieved or underperformed vs expectations
5. Highlights the most exciting or decisive match(es) of the division
6. Closes with a verdict on the division — what will fans remember about this season?
If the season is still in progress, mention the most important upcoming fixture instead of a retrospective close.
Be specific. Write with the energy of a local sports journalist who watched every game. No markdown headers or bullet points — flowing prose only.`,

  overview: `You are a cricket analyst writing the season homepage summary for a youth cricket league. Analyze all the data provided and write an insightful 6–8 sentence summary that:
1. Opens with a compelling hook — if the season is complete, declare the champions and the defining story; if in progress, state what hangs in the balance
2. Covers the title outcomes (or races) across all divisions — who won, how dominant, any surprise champion?
3. Highlights 2–3 standout individual performers (batter and bowler) with specific numbers that define their season
4. Notes compelling team narratives — a dominant champion, a surprise package, or a team that showed great character
5. Comments on the style of cricket played across the season — high-scoring, tight bowling contests, or a mix?
6. If season complete: closes with a season verdict — what made Spring 2026 memorable and what storylines will be talked about. If in progress: closes with key fixtures and title deciders to watch.
Write for parents and coaches who love this league. Be specific with names, numbers, and division context. Make it feel like an editorial, not a report card. No markdown headers or bullet points — flowing prose only.`,

  player: `You are a cricket analyst writing a detailed player profile for youth cricket. Analyze the player's stats and write an insightful 5–7 sentence analysis that:
1. Characterizes their batting or bowling style from the numbers (aggressive striker? anchor? wicket-taking vs economy bowler?)
2. Compares their key metrics to what is considered strong for this level (avg 30+ is excellent, econ under 6 is tight etc.)
3. Identifies their single greatest strength and one area that could elevate their game further
4. If multi-division or multi-season data exists, describes their progression and improvement arc
5. Summarizes their overall value to their team — are they a match-winner, an anchor, or a consistent contributor?
Be specific with numbers. Write for parents and coaches who care about this player's development. No markdown headers or bullet points — flowing prose only.`,

  'team-scout': `You are a cricket scout writing an opponent analysis for youth cricket coaches and team managers. Analyze the team's data and produce a structured report with these exact markdown sections:

## Team Overview
- Season record in context (improving, consistent, or struggling)
- Division standing and trajectory

## Strengths
- 3-4 specific strengths (batting depth, bowling attack, fielding, chasing ability)
- Name specific players and their numbers for each strength

## Weaknesses
- 2-3 areas where this team can be exploited
- Specific evidence with player names and numbers

## Key Players
- Top 2 batters: what makes them dangerous, their preferred style, and a potential weakness
- Top 2 bowlers: their effectiveness, what conditions suit them, and how to play them

## Tactical Notes
- How to bowl to each of their top 3 batters (attack stumps? short ball? wide line? spin early?)
- Which bowlers to target and in what situations
- Field placement suggestions against their top scorer

Write for a coach preparing their team to face this opponent. Use specific stats.`,

  'player-deep': `You are a talent analyst writing a development report for a youth cricket player. Analyze the player's data across seasons and produce:

## Playing Style
- Batting archetype (aggressive striker, anchor, mixed) with evidence from the numbers
- If they bowl: bowling role (strike bowler, containing defender, all-rounder)
- How their style has evolved across seasons if multi-season data exists

## Season Progression
- Key stats per season in a clear progression (runs/wickets, average, strike rate/economy)
- Notable improvements or areas of decline
- If only one season of data exists, compare their trajectory within the season

## Strengths
- 2-3 specific things they do best, with numbers

## Areas to Develop
- 2 specific areas where improvement would most elevate their game
- Why these matter for their role

## Player Comparison
- Compare to 1-2 other similar players in the league (similar style, age, role)
- What separates them from peers

## Role & Value
- What batting position or bowling phase suits them best
- Are they a match-winner, reliable contributor, or developing talent?
- Their importance to their team's success

Write for a coach and parent who want to understand this player's development path.`,

  'match-strategy': `You are a match analyst writing a strategy brief before a youth cricket fixture. Analyze both teams and produce:

## Head-to-Head
- Past meetings this season and across seasons
- Who has the upper hand and why

## Recent Form
- Each team's last 4-5 results with brief assessment
- Which team enters with momentum

## Key Matchups
- How Team A's top batters have performed against Team B's bowlers (use specific innings data if available)
- How Team B's top batters have performed against Team A's bowlers
- The single most important individual battle that could decide the match

## Win Factors
- 3 things Team A must do to win
- 3 things Team B must do to win
- Which conditions or scenarios favor each team

## Prediction
- Which team holds the edge and why
- A brief game scenario (e.g., "If Team A bats first and posts 130+, they defend. If Team B chases, their middle order depth gives them the edge.")

Write with the precision of a strategist. Use specific player names and numbers.`,

  'match-report': `You are a cricket analyst writing a post-match recap for a youth cricket fixture. Analyze the match data and produce a structured report with these exact markdown sections:

## Match Summary
- Brief overview: who won, by how much, and the defining phase of the match
- How each team's innings unfolded (strong start, middle collapse, late surge, etc.)

## Key Performers
- Top batter from each team with specific numbers and match impact
- Top bowler from each team with specific numbers and match impact
- Any standout all-round contributions

## Turning Points
- 2-3 critical moments that swung the match
- Specific overs, wickets, or partnerships that changed momentum

## Team Performance
- Batting assessment: which team batted better, where runs were gained or lost
- Bowling assessment: which bowlers controlled the game, who leaked runs
- Fielding notes if discernible from the data

## What It Means
- How this result affects standings or team momentum
- What each team should take away from this performance

Write with the energy of a match reporter who was there. Use specific player names and numbers.`,

  'season-insights': `You are a cricket journalist reflecting on a youth cricket league across multiple seasons. Analyze the multi-season data and produce:

## Most Improved Players
- 3-4 players whose stats have jumped significantly from previous season to current
- Specific before/after numbers (e.g., "avg jumped from 14.2 to 31.5")
- What changed in their game

## Breakout Performers
- Players who stepped into bigger roles this season
- How their output changed

## Record Watch
- League records broken or threatened this season
- Individual milestones (e.g., "3 batters on track for 400+ runs")

## League Trends
- Is run-scoring up or down across seasons?
- Are bowlers becoming more or less dominant?
- Which divisions are most competitive?

## Team Trajectories
- Teams that are building (improving season-over-season)
- Teams that are plateauing or declining
- Any programs consistently producing top talent

Write with insight and context that only multi-season analysis can reveal. Use specific names and numbers.`,
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
  const isMatchType = type === 'match-strategy' || type === 'match-report';

  let cached = null;
  let data = null;

  try {
    if (isMatchType) {
      // Load league data + cache in parallel to validate cached teams
      const [snap, cachedDoc] = await Promise.all([
        leagueRef.get(),
        bust === 'true' ? Promise.resolve(null) : cacheRef.get(),
      ]);
      if (!snap.exists) return res.status(404).json({ error: 'League not found' });
      data = snap.data();
      cached = cachedDoc;

      // Validate cached summary against current match teams
      const match = (data.matches || []).find(m => String(m.id) === String(key));
      if (cached && cached.exists && match) {
        const cd = cached.data();
        if (cd.team1 === match.team1 && cd.team2 === match.team2) {
          return res.json({ insight: cd.insight, generatedAt: cd.generatedAt, cached: true });
        }
      }
    } else {
      // Non-match types: return cached version unless bust=true
      cached = await cacheRef.get();
      if (cached.exists && bust !== 'true') {
        const { insight, generatedAt } = cached.data();
        return res.json({ insight, generatedAt, cached: true });
      }
    }

    // Not cached (or stale for match types) — return null unless caller wants generation
    if (generate !== 'true') {
      return res.json({ insight: null });
    }

    // Load league data if not already loaded (non-match types)
    if (!data) {
      const snap = await leagueRef.get();
      if (!snap.exists) return res.status(404).json({ error: 'League not found' });
      data = snap.data();
    }

    const context = await buildContext(type, key, data, league);

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: ['team-scout', 'player-deep', 'match-strategy', 'season-insights', 'match-report'].includes(type) ? 800 : 600,
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

    // Include team1/team2 in cache for match types so stale entries can be detected
    const cachePayload = { insight, generatedAt, type, key };
    if (isMatchType) {
      const match = (data.matches || []).find(m => String(m.id) === String(key));
      if (match) { cachePayload.team1 = match.team1; cachePayload.team2 = match.team2; }
    }
    await cacheRef.set(cachePayload);
    return res.json({ insight, generatedAt, cached: false });
  } catch (e) {
    console.error('ai-summary error:', e);
    return res.status(500).json({ error: 'Failed to generate summary' });
  }
};

// ── Context builders ─────────────────────────────────────────────────────────

async function buildContext(type, key, data, leagueSlug) {
  switch (type) {
    case 'overview':       return overviewContext(data);
    case 'team':           return teamContext(key, data);
    case 'division':       return divisionContext(key, data);
    case 'standings':      return standingsContext(key, data);
    case 'batting':        return battingContext(key, data);
    case 'bowling':        return bowlingContext(key, data);
    case 'results':        return resultsContext(key, data);
    case 'player':         return playerContext(key, data);
    case 'team-scout':     return teamScoutContext(key, data, leagueSlug);
    case 'player-deep':    return playerDeepContext(key, data, leagueSlug);
    case 'match-strategy': return matchStrategyContext(key, data, leagueSlug);
    case 'season-insights': return seasonInsightsContext(key, data, leagueSlug);
    case 'match-report':    return matchReportContext(key, data, leagueSlug);
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
  const _now = new Date(); _now.setHours(0,0,0,0);
  const seasonComplete = total > 0 && !allMatches.some(m => { const d = new Date(m.date); return !isNaN(d) && d >= _now; });
  lines.push(seasonComplete
    ? `SEASON STATUS: COMPLETE. All ${total} matches have been played. Final standings are official. There are NO upcoming fixtures — do NOT mention upcoming matches.\n`
    : `Season progress: ${done} of ${total} matches played (${total > 0 ? Math.round(done/total*100) : 0}%)\n`);

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

// ── New scouting & strategy context builders ─────────────────────────────

async function teamScoutContext(teamName, data, leagueSlug) {
  const lines = [`TEAM SCOUTING REPORT — ${teamName}\n`];
  const league = data;

  // Current season info
  const allResults = league.results?.matches || [];
  const teamResults = allResults
    .filter(r => r.team1 === teamName || r.team2 === teamName)
    .slice(-10);
  if (teamResults.length) {
    const wins = teamResults.filter(r =>
      r.result?.toLowerCase().startsWith(teamName.toLowerCase())).length;
    lines.push(`Season record (last ${teamResults.length}): ${wins}W ${teamResults.length - wins}L`);
    lines.push('Recent results:');
    teamResults.forEach(r => lines.push(`  ${r.result || `${r.team1} vs ${r.team2}`}`));
    lines.push('');
  }

  // Opponent breakdown: wins/losses per opponent
  const oppMap = new Map();
  teamResults.forEach(r => {
    const opp = r.team1 === teamName ? r.team2 : r.team1;
    if (!opp) return;
    if (!oppMap.has(opp)) oppMap.set(opp, { wins: 0, losses: 0 });
    const entry = oppMap.get(opp);
    if (r.result?.toLowerCase().startsWith(teamName.toLowerCase())) entry.wins++;
    else entry.losses++;
  });
  if (oppMap.size) {
    lines.push('Record by opponent:');
    [...oppMap.entries()].sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses)).forEach(([opp, rec]) => {
      lines.push(`  vs ${opp}: ${rec.wins}W ${rec.losses}L`);
    });
    lines.push('');
  }

  // Standings position
  const divMatches = (league.matches || []).filter(m => m.team1 === teamName || m.team2 === teamName);
  const division = divMatches[0]?.division;
  if (division) {
    const raw = league.standings?.[division];
    const rows = Array.isArray(raw) ? raw : (raw?.rows || []);
    const pos = rows.findIndex(r => r.team === teamName);
    if (pos >= 0) {
      const t = rows[pos];
      lines.push(`Division: ${division} — Position ${pos + 1} of ${rows.length} (${t.pts} pts, ${t.won}W ${t.lost}L)\n`);
    }
  }

  // Chasing vs defending record
  const chasingResults = teamResults.filter(r => {
    if (r.result?.toLowerCase().startsWith(teamName.toLowerCase())) return r.team2 === teamName;
    return r.team1 === teamName;
  });
  const defendingResults = teamResults.filter(r => {
    if (r.result?.toLowerCase().startsWith(teamName.toLowerCase())) return r.team1 === teamName;
    return r.team2 === teamName;
  });
  lines.push(`Chasing wins: ${chasingResults.length}, Defending wins: ${defendingResults.length}\n`);

  // Top batters
  const allBat = Object.entries(league.batting || {})
    .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([, rows]) => Array.isArray(rows) ? rows : []);
  const batters = allBat.filter(p => p.team === teamName)
    .sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0)).slice(0, 5);
  if (batters.length) {
    lines.push('Top batters:');
    batters.forEach(p => lines.push(`  ${p.player}: ${p.runs} runs, avg ${p.avg}, SR ${p.sr}, HS ${p.hs}`));
    lines.push('');
  }

  // Top bowlers
  const allBowl = Object.entries(league.bowling || {})
    .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([, rows]) => Array.isArray(rows) ? rows : []);
  const bowlers = allBowl.filter(p => p.team === teamName)
    .sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0)).slice(0, 5);
  if (bowlers.length) {
    lines.push('Top bowlers:');
    bowlers.forEach(p => lines.push(`  ${p.player}: ${p.wickets} wkts, econ ${p.econ}, avg ${p.avg}, best ${p.bbf}`));
    lines.push('');
  }

  // Multi-season context if available
  try {
    const seasons = await loadMultiSeasonData(leagueSlug, 1);
    if (seasons.length > 1) {
      const teamAcross = getTeamStatsAcrossSeasons(seasons, teamName);
      lines.push('MULTI-SEASON CONTEXT:');
      lines.push(formatSeasonsForPrompt(seasons));
      teamAcross.forEach(ts => {
        if (!ts.isCurrent && ts.standingsEntry) {
          lines.push(`  ${ts.season}: Position ${ts.standingsEntry.division}, ${ts.standingsEntry.won || 0}W ${ts.standingsEntry.lost || 0}L`);
        }
      });
      lines.push('');
    }
  } catch (_) { /* historical data unavailable — skip */ }

  lines.push('Produce the team scouting report now with all sections as specified.');
  return lines.join('\n');
}

async function playerDeepContext(name, data, leagueSlug) {
  const lines = [`PLAYER DEEP ANALYSIS — ${name}\n`];

  // Current season data (reuse existing playerContext pattern)
  const lower = name.toLowerCase().trim();
  const allBat = Object.entries(data.batting || {})
    .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([div, rows]) => Array.isArray(rows) ? rows.map(r => ({ ...r, _div: div })) : []);
  const allBowl = Object.entries(data.bowling || {})
    .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([div, rows]) => Array.isArray(rows) ? rows.map(r => ({ ...r, _div: div })) : []);

  const batRows = allBat.filter(p => (p.player || '').toLowerCase().trim() === lower);
  const bowlRows = allBowl.filter(p => (p.player || '').toLowerCase().trim() === lower);

  lines.push('CURRENT SEASON STATS:');
  if (batRows.length) {
    lines.push('Batting:');
    batRows.forEach(p => {
      lines.push(`  ${p._div}: ${p.mat} mat, ${p.inns} inns, ${p.runs} runs, avg ${p.avg}, SR ${p.sr}, HS ${p.hs || '—'}, 50s ${p.fifties || 0}, 100s ${p.hundreds || 0}`);
    });
  }
  if (bowlRows.length) {
    lines.push('Bowling:');
    bowlRows.forEach(p => {
      lines.push(`  ${p._div}: ${p.mat} mat, ${p.wickets} wkts, econ ${p.econ}, avg ${p.avg}, best ${p.bbf || '—'}`);
    });
  }
  lines.push('');

  // Multi-season context
  try {
    const seasons = await loadMultiSeasonData(leagueSlug, 2);
    if (seasons.length > 1) {
      const across = getPlayerStatsAcrossSeasons(seasons, name);
      const hasHistory = across.some(s => !s.isCurrent && (s.battingRows.length > 0 || s.bowlingRows.length > 0));
      if (hasHistory) {
        lines.push('HISTORICAL SEASONS:');
        lines.push(formatSeasonsForPrompt(seasons));
        across.forEach(ps => {
          if (ps.battingRows.length > 0) {
            const b = ps.battingRows[0];
            lines.push(`  ${ps.season}${ps.isCurrent ? ' (current)' : ''}: ${b.runs || 0} runs, avg ${b.avg || '—'}, SR ${b.sr || '—'} in ${b.mat || 0} matches`);
          }
          if (ps.bowlingRows.length > 0) {
            const bw = ps.bowlingRows[0];
            lines.push(`  ${ps.season}${ps.isCurrent ? ' (current)' : ''}: ${bw.wickets || 0} wkts, econ ${bw.econ || '—'}, avg ${bw.avg || '—'} in ${bw.mat || 0} matches`);
          }
        });
        lines.push('');
      }
    }
  } catch (_) { /* historical data unavailable */ }

  lines.push('Produce the player development report now with all sections as specified.');
  return lines.join('\n');
}

async function matchStrategyContext(matchId, data, leagueSlug) {
  const lines = [`MATCH STRATEGY BRIEF — Match ID: ${matchId}\n`];

  // Find the match in schedule
  const match = (data.matches || []).find(m => String(m.id) === String(matchId));
  if (!match) {
    lines.push('Match not found in schedule.');
    return lines.join('\n');
  }

  const { team1, team2, division, date } = match;
  lines.push(`Fixture: ${team1} vs ${team2} — Division ${division}, ${date || 'TBD'}\n`);

  // Team standings in division
  if (division) {
    const raw = data.standings?.[division];
    const rows = Array.isArray(raw) ? raw : (raw?.rows || []);
    [team1, team2].forEach(team => {
      const pos = rows.findIndex(r => r.team === team);
      if (pos >= 0) {
        const t = rows[pos];
        lines.push(`${team}: Position ${pos + 1} of ${rows.length} — ${t.pts} pts, ${t.won}W ${t.lost}L`);
      }
    });
    lines.push('');
  }

  // Head-to-head results (all seasons if available)
  const allResults = data.results?.matches || [];
  const h2h = allResults.filter(r =>
    (r.team1 === team1 && r.team2 === team2) || (r.team1 === team2 && r.team2 === team1)
  );
  if (h2h.length) {
    lines.push('HEAD-TO-HEAD THIS SEASON:');
    h2h.forEach(r => lines.push(`  ${r.result || `${r.team1} vs ${r.team2}`}`));
    const aWins = h2h.filter(r => r.result?.toLowerCase().startsWith(team1.toLowerCase())).length;
    const bWins = h2h.filter(r => r.result?.toLowerCase().startsWith(team2.toLowerCase())).length;
    lines.push(`  Edge: ${team1} ${aWins} — ${team2} ${bWins}\n`);
  }

  // Recent form
  const lastN = (team, n) => allResults
    .filter(r => r.team1 === team || r.team2 === team)
    .slice(-n)
    .map(r => r.result?.toLowerCase().startsWith(team.toLowerCase()) ? 'W' : 'L')
    .join('');
  lines.push(`Recent form: ${team1} [${lastN(team1, 5)}]  ${team2} [${lastN(team2, 5)}]\n`);

  // Key batters and bowlers for each team
  const allBat = Object.entries(data.batting || {})
    .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([, rows]) => Array.isArray(rows) ? rows : []);
  const allBowl = Object.entries(data.bowling || {})
    .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([, rows]) => Array.isArray(rows) ? rows : []);

  [team1, team2].forEach(team => {
    const batters = allBat.filter(p => p.team === team)
      .sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0)).slice(0, 3);
    if (batters.length) {
      lines.push(`${team} key batters:`);
      batters.forEach(p => lines.push(`  ${p.player}: ${p.runs} runs, avg ${p.avg}, SR ${p.sr}`));
    }
    const bowlers = allBowl.filter(p => p.team === team)
      .sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0)).slice(0, 3);
    if (bowlers.length) {
      lines.push(`${team} key bowlers:`);
      bowlers.forEach(p => lines.push(`  ${p.player}: ${p.wickets} wkts, econ ${p.econ}`));
    }
    lines.push('');
  });

  // Try to get batter-vs-bowler data from innings subcollection
  try {
    const matchRefs = (data.matches || []).filter(m => m.team1 === team1 && m.team2 === team2);
    if (matchRefs.length) {
      lines.push('BATTER-VS-BOWLER DATA (from previous meetings):');
      for (const prevMatch of matchRefs.slice(0, 2)) {
        const innDoc = await db.collection('leagues').doc(leagueSlug)
          .collection('matches').doc(String(prevMatch.id)).get();
        if (innDoc.exists && Array.isArray(innDoc.data().innings)) {
          const inns = innDoc.data().innings;
          // Show batter vs bowler snippets
          const batters = [...new Set(inns.filter(i => i.role === 'bat').map(i => i.player))];
          batters.slice(0, 4).forEach(batter => {
            const batInns = inns.filter(i => i.role === 'bat' && i.player === batter);
            const bowlers = [...new Set(inns.filter(i => i.role === 'bowl').map(i => i.player))];
            batInns.slice(0, 2).forEach(bi => {
              lines.push(`  ${bi.player}: ${bi.runs}r ${bi.balls}b, dismissal: ${bi.dismissal || 'not out'}`);
            });
          });
        }
      }
      lines.push('');
    }
  } catch (_) { /* innings data unavailable */ }

  lines.push('Produce the match strategy brief now with all specified sections.');
  return lines.join('\n');
}

async function seasonInsightsContext(key, data, leagueSlug) {
  const lines = [`MULTI-SEASON INSIGHTS\n`];

  // Current season overview stats
  const allMatches = data.matches || [];
  const allResults = data.results?.matches || [];
  const total = allMatches.length;
  const done = allResults.length;
  lines.push(`Current season: ${data.season || ''} — ${done}/${total} matches played`);
  lines.push(`League: ${data.leagueName || ''}\n`);

  // Standings snapshot
  const divs = Object.keys(data.standings || {}).filter(k => k !== 'updatedAt');
  if (divs.length) {
    lines.push('CURRENT STANDINGS:');
    for (const div of divs) {
      const raw = data.standings[div];
      const rows = Array.isArray(raw) ? raw : (raw?.rows || []);
      if (rows.length) {
        lines.push(`  ${div}: ${rows.slice(0, 3).map(r => `${r.team}(${r.pts}pts)`).join(', ')}`);
      }
    }
    lines.push('');
  }

  // Current stat leaders
  const allBat = getStats(data.batting, 'combined', 'bat')
    .sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0)).slice(0, 5);
  if (allBat.length) {
    lines.push('Top run-scorers:');
    allBat.forEach(p => lines.push(`  ${p.player}: ${p.runs} runs, avg ${p.avg}`));
    lines.push('');
  }

  const allBowl = getStats(data.bowling, 'combined', 'bowl')
    .sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0)).slice(0, 5);
  if (allBowl.length) {
    lines.push('Top wicket-takers:');
    allBowl.forEach(p => lines.push(`  ${p.player}: ${p.wickets} wkts, econ ${p.econ}`));
    lines.push('');
  }

  // Multi-season data
  try {
    const seasons = await loadMultiSeasonData(leagueSlug, 2);
    if (seasons.length > 1) {
      lines.push('AVAILABLE SEASONS:');
      lines.push(formatSeasonsForPrompt(seasons));
      lines.push('');

      // Compare stat leaders across seasons
      const historicalSeasons = seasons.filter(s => !s.isCurrent);
      for (const hs of historicalSeasons) {
        const hBat = getStats(hs.data.batting, 'combined', 'bat')
          .sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0)).slice(0, 3);
        const hBowl = getStats(hs.data.bowling, 'combined', 'bowl')
          .sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0)).slice(0, 3);
        lines.push(`${hs.season} top batters: ${hBat.map(p => `${p.player}(${p.runs}r)`).join(', ')}`);
        lines.push(`${hs.season} top bowlers: ${hBowl.map(p => `${p.player}(${p.wickets}w)`).join(', ')}`);
      }
      lines.push('');

      // Find players who appear in current + past — potential "most improved"
      const currentBatMap = new Map();
      Object.entries(data.batting || {}).filter(([k]) => k !== 'updatedAt' && k !== 'combined')
        .flatMap(([, rows]) => Array.isArray(rows) ? rows : [])
        .forEach(r => { if (r.player && r.runs) currentBatMap.set(r.player.toLowerCase(), parseInt(r.runs) || 0); });

      const pastBatMap = new Map();
      for (const hs of historicalSeasons) {
        Object.entries(hs.data.batting || {}).filter(([k]) => k !== 'updatedAt' && k !== 'combined')
          .flatMap(([, rows]) => Array.isArray(rows) ? rows : [])
          .forEach(r => { if (r.player && r.runs) pastBatMap.set(r.player.toLowerCase(), parseInt(r.runs) || 0); });
      }

      const improved = [];
      currentBatMap.forEach((runs, name) => {
        const pastRuns = pastBatMap.get(name);
        if (pastRuns && pastRuns > 0) {
          improved.push({ name, currentRuns: runs, pastRuns, jump: runs - pastRuns, pct: Math.round((runs - pastRuns) / pastRuns * 100) });
        }
      });
      improved.sort((a, b) => b.jump - a.jump);
      if (improved.length) {
        lines.push('PLAYERS WITH BOTH CURRENT AND PAST SEASON DATA (potential most improved candidates):');
        improved.slice(0, 10).forEach(p => {
          lines.push(`  ${p.name}: ${p.pastRuns}r → ${p.currentRuns}r (${p.pct >= 0 ? '+' : ''}${p.pct}%)`);
        });
        lines.push('');
      }
    }
  } catch (_) { /* historical data unavailable */ }

  lines.push('Produce the multi-season insights report now with all specified sections.');
  return lines.join('\n');
}

async function matchReportContext(matchId, data, leagueSlug) {
  const lines = [`MATCH REPORT — Match ID: ${matchId}\n`];

  // Find match in parent doc
  const match = (data.matches || []).find(m => String(m.id) === String(matchId));
  if (!match) {
    lines.push('Match not found in schedule.');
    return lines.join('\n');
  }

  const { team1, team2, division, date, result, team1Score, team2Score } = match;
  lines.push(`${team1} vs ${team2} — ${division}, ${date || 'TBD'}`);
  lines.push(`Result: ${result || 'N/A'}`);
  if (team1Score) lines.push(`${team1}: ${team1Score.score} (${team1Score.overs || '?'} overs)`);
  if (team2Score) lines.push(`${team2}: ${team2Score.score} (${team2Score.overs || '?'} overs)`);
  lines.push('');

  // Read innings from match subcollection
  try {
    const innDoc = await db.collection('leagues').doc(leagueSlug)
      .collection('matches').doc(String(matchId)).get();
    const innings = innDoc.exists && Array.isArray(innDoc.data().innings)
      ? innDoc.data().innings : [];

    if (innings.length) {
      const batInnings = innings.filter(i => i.role === 'bat');
      if (batInnings.length) {
        lines.push('BATTING INNINGS:');
        batInnings.sort((a, b) => (b.runs || 0) - (a.runs || 0));
        batInnings.forEach(i => {
          lines.push(`  ${i.player} (${i.team}): ${i.runs || 0}${i.notOut ? '*' : ''} (${i.balls || 0}b, ${i.fours || 0}×4, ${i.sixes || 0}×6, SR ${i.sr || 0}) — ${i.dismissal || 'not out'}`);
        });
        lines.push('');
      }

      const bowlInnings = innings.filter(i => i.role === 'bowl');
      if (bowlInnings.length) {
        lines.push('BOWLING FIGURES:');
        bowlInnings.sort((a, b) => (b.wickets || 0) - (a.wickets || 0) || (a.econ || 99) - (b.econ || 99));
        bowlInnings.forEach(i => {
          lines.push(`  ${i.player} (${i.team}): ${i.overs || '?'}ov, ${i.maidens || 0}m, ${i.runs || 0}r, ${i.wickets || 0}w, econ ${i.econ || 0}`);
        });
        lines.push('');
      }
    }
  } catch (_) { /* innings data unavailable */ }

  lines.push('Produce the post-match recap now with all sections as specified.');
  return lines.join('\n');
}
