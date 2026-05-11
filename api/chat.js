const { db }       = require('../lib/firebase');
const { createHash } = require('crypto');

const DAILY_LIMIT     = 20;
const MAX_Q_LEN       = 300;
const ADMIN_CODE      = process.env.CHAT_ADMIN_CODE || 'SYCL_INSIDER';

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // GET /api/chat?league=xxx  → admin chat logs (password gated)
  if (req.method === 'GET') {
    const pwd = req.headers['x-admin-password'];
    if (!pwd || pwd !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
    const { league, limit = '50' } = req.query;
    if (!league) return res.status(400).json({ error: 'league required' });
    try {
      const snap = await db.collection('chatLogs').doc(league)
        .collection('sessions')
        .orderBy('updatedAt', 'desc')
        .limit(parseInt(limit) || 50)
        .get();
      return res.json({ sessions: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method !== 'POST') { res.status(405).end(); return; }

  const { league, question, sessionId, sessionInfo = {}, history = [] } = req.body || {};

  if (!league || !question?.trim()) return res.status(400).json({ error: 'league and question required' });
  if (!sessionInfo?.name)           return res.status(400).json({ error: 'Session info required' });
  if (question.length > MAX_Q_LEN)  return res.status(400).json({ error: 'Question too long (max 300 chars)' });

  const isUnlimited = sessionInfo.accessCode?.trim() === ADMIN_CODE;

  try {
    // ── Rate limiting ────────────────────────────────────────────
    const ip     = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16);
    const today  = new Date().toISOString().slice(0, 10);

    let questionsUsed = 0;
    if (!isUnlimited) {
      const usageRef  = db.collection('chatUsage').doc(`${ipHash}_${today}`);
      const usageSnap = await usageRef.get();
      questionsUsed   = usageSnap.exists ? (usageSnap.data().count || 0) : 0;

      if (questionsUsed >= DAILY_LIMIT) {
        return res.status(429).json({
          error:        'Daily limit reached',
          message:      "You've used all 20 free questions for today — come back tomorrow! 🏏",
          questionsLeft: 0,
        });
      }
      await usageRef.set(
        { count: questionsUsed + 1, ipHash, date: today, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    }

    // ── Off-topic guard (free — doesn't count against limit) ─────
    const CRICKET_RE = /cricket|player|batter|bowler|batsman|wicket|run|over|inning|match|team|division|standing|score|season|league|fixture|schedule|stat|average|century|fifty|economy|spell|sycl|u11|u13|u15|emerging|improve|drill|tip|who|how many|top|best|lead/i;
    const OFF_TOPIC_RE = /\b(stock|crypto|bitcoin|politic|news|weather|recipe|movie|film|music|song|footbal|soccer|basketball|baseball|tennis|golf|swimming|histor|geography|science|math|hack|password|invest|financ|bank|hotel|restaur|travel|flight|visa|joke|poem|essay|write me|code for|program)\b/i;
    if (!CRICKET_RE.test(question) && OFF_TOPIC_RE.test(question)) {
      return res.json({
        answer: "I can only help with SYCL cricket season questions — player stats, standings, upcoming matches, or how to improve your cricket. Try asking about a player, team, or division! 🏏",
        questionsLeft: isUnlimited ? 999 : DAILY_LIMIT - questionsUsed,
      });
    }

    // ── Load league data ─────────────────────────────────────────
    const snap = await db.collection('leagues').doc(league).get();
    if (!snap.exists) return res.status(404).json({ error: 'League not found' });
    const data = snap.data();

    // ── Build targeted context ───────────────────────────────────
    const context = buildContext(question, data);
    const divisionList = Object.keys(data.standings || {}).filter(k => k !== 'updatedAt').join(', ') || 'various divisions';

    // ── System prompt ─────────────────────────────────────────────
    const allMatches = data.matches || [];
    const allPlayed  = (data.results?.matches || []).length;
    const seasonDone = allMatches.length > 0 && allPlayed >= allMatches.length;
    const seasonStatus = seasonDone
      ? `The ${data.season || 'current'} season is NOW COMPLETE — all matches have been played. There are no upcoming fixtures. Final standings are decided by total points accumulated across all league matches (highest points = best rank). The top-2 teams in each division met in the final round to decide the champion.`
      : `Season in progress: ${allPlayed}/${allMatches.length} matches played.`;

    const SYSTEM = `You are the SYCL Season Insight AI for ${data.leagueName || 'Seattle Youth Cricket League'} — ${data.season || 'current season'}.
This league has the following divisions: ${divisionList}.
${seasonStatus}

Answer ONLY questions about this cricket league and cricket improvement. Politely decline anything unrelated.
Use ONLY the league data provided — never invent or estimate stats. If a stat isn't in the data, say so honestly.

RESPONSE STYLE — be thorough, detailed, and visually structured:
- Use markdown tables wherever stats are listed (standings, leaderboards, player stats). Example: | # | Player | Runs | Avg | SR | HS |
- Use bold (**text**) for player names, team names, and standout numbers.
- Use headers (### Title) to section your response when covering multiple topics.
- For player questions: full profile with a stats table (batting + bowling), division-by-division breakdown, milestones (50s, 100s, 5-fers), team's standing, recent team results, and a genuine qualitative assessment of their season. Be comprehensive.
- For leaderboard/standings questions: a ranked table of ALL players/teams with all key columns, plus analysis of the race, streaks, and what the numbers mean.
- For division questions: a standings table (all teams with P/W/L/Pts/NRR), top batters table, top bowlers table, recent results, and what's at stake.
- For season overview: all divisions with leaders, overall stat leaders, key storylines and milestones.
- For improvement/coaching questions: structured tips with bullet points, drills, and examples. Suggest https://play.cricket.com.au or specific YouTube search terms.
- Always end with a sharp insight or observation that goes beyond the numbers.
- When a player is discussed, remind them to check the full Season Insight profile for match-by-match breakdown.`;

    // ── Messages (keep last 2 exchanges = 4 messages for context) ─
    const chatMessages = [
      ...history.slice(-4).map(m => ({
        role:    m.role === 'ai' ? 'assistant' : 'user',
        content: m.content,
      })),
      { role: 'user', content: `${question.trim()}\n\n---\nLEAGUE DATA:\n${context}` },
    ];

    // ── Call DeepSeek ─────────────────────────────────────────────
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model:      'deepseek-chat',
        max_tokens: 1000,
        messages:   [{ role: 'system', content: SYSTEM }, ...chatMessages],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`DeepSeek ${resp.status}: ${err}`);
    }
    const json   = await resp.json();
    const answer = json.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not generate a response right now.';

    // ── Log Q&A to Firestore ──────────────────────────────────────
    if (sessionId) {
      const logRef  = db.collection('chatLogs').doc(league).collection('sessions').doc(String(sessionId));
      const logSnap = await logRef.get();
      const prev    = logSnap.exists ? (logSnap.data().messages || []) : [];
      const newMessages = [
        ...prev,
        { role: 'user', content: question.trim(), ts: new Date().toISOString() },
        { role: 'ai',   content: answer,           ts: new Date().toISOString() },
      ];
      await logRef.set({
        name:          sessionInfo.name,
        role:          sessionInfo.role || 'unknown',
        isUnlimited,
        ipHash,
        league,
        startedAt:     logSnap.exists ? logSnap.data().startedAt : new Date().toISOString(),
        updatedAt:     new Date().toISOString(),
        questionCount: Math.ceil(newMessages.length / 2),
        firstQuestion: prev.length === 0 ? question.trim() : (logSnap.data()?.firstQuestion || question.trim()),
        messages:      newMessages,
      });
    }

    return res.json({
      answer,
      questionsLeft: isUnlimited ? 999 : DAILY_LIMIT - questionsUsed - 1,
    });
  } catch (e) {
    console.error('chat error:', e);
    return res.status(500).json({ error: 'Failed to get response. Please try again.' });
  }
};

// ── Context builder ───────────────────────────────────────────────────────────
function buildContext(question, data) {
  const q     = question.toLowerCase();
  const lines = [];

  // Per-division rows for player lookup and individual stats
  const allBat  = flattenStats(data.batting);
  const allBowl = flattenStats(data.bowling);

  // Combined/aggregated rows for leaderboards (combined key = pre-summed across divisions)
  const leaderBat  = combinedStats(data.batting);
  const leaderBowl = combinedStats(data.bowling);

  // Find mentioned player (first-name fuzzy match)
  const mentionedPlayers = [];
  const seen = new Set();
  for (const p of allBat) {
    const name  = (p.player || '').trim();
    const first = name.toLowerCase().split(' ')[0];
    if (first.length > 2 && q.includes(first) && !seen.has(name)) {
      mentionedPlayers.push(name);
      seen.add(name);
    }
  }

  // Player stats context
  if (mentionedPlayers.length > 0) {
    for (const playerName of mentionedPlayers.slice(0, 2)) {
      const bRows = allBat.filter(p  => (p.player || '').toLowerCase() === playerName.toLowerCase());
      const wRows = allBowl.filter(p => (p.player || '').toLowerCase() === playerName.toLowerCase());

      lines.push(`=== PLAYER PROFILE: ${playerName} ===`);

      if (bRows.length) {
        const totalRuns = bRows.reduce((s, r) => s + (parseInt(r.runs) || 0), 0);
        const totalMat  = bRows.reduce((s, r) => s + (parseInt(r.mat)  || 0), 0);
        const totalInns = bRows.reduce((s, r) => s + (parseInt(r.inns) || 0), 0);
        const total50s  = bRows.reduce((s, r) => s + (parseInt(r.fifties)  || 0), 0);
        const total100s = bRows.reduce((s, r) => s + (parseInt(r.hundreds) || 0), 0);
        const bestHS    = bRows.reduce((best, r) => Math.max(best, parseInt(r.hs) || 0), 0);
        const overallAvg = totalInns > 0 ? (totalRuns / totalInns).toFixed(1) : 'N/A';
        lines.push(`BATTING SUMMARY: ${totalRuns} runs in ${totalMat} matches (${totalInns} innings) | Overall avg: ${overallAvg} | Best: ${bestHS} | 50s: ${total50s} | 100s: ${total100s}`);
        lines.push('Per-division breakdown:');
        bRows.forEach(r => lines.push(`  [${r._div}] Team: ${r.team} | ${r.mat}M ${r.inns}I ${r.no ?? 0}NO | ${r.runs}R | Avg: ${r.avg} | SR: ${r.sr} | HS: ${r.hs} | 4s: ${r.fours ?? '?'} | 6s: ${r.sixes ?? '?'} | 50s: ${r.fifties ?? 0} | 100s: ${r.hundreds ?? 0}`));
      } else {
        lines.push('BATTING: No batting data recorded.');
      }

      if (wRows.length) {
        const totalWkts = wRows.reduce((s, r) => s + (parseInt(r.wickets) || 0), 0);
        const totalOvrs = wRows.reduce((s, r) => s + (parseFloat(r.overs) || 0), 0);
        const total5w   = wRows.reduce((s, r) => s + (parseInt(r.fiveW) || 0), 0);
        lines.push(`BOWLING SUMMARY: ${totalWkts} wickets in ${totalOvrs.toFixed(1)} overs | 5-fers: ${total5w}`);
        lines.push('Per-division breakdown:');
        wRows.forEach(r => lines.push(`  [${r._div}] Team: ${r.team} | ${r.mat}M ${r.wickets}W | Econ: ${r.econ} | Avg: ${r.avg} | Best: ${r.bbf} | Overs: ${r.overs ?? '?'} | 5-fers: ${r.fiveW ?? 0}`));
      } else {
        lines.push('BOWLING: No bowling data recorded.');
      }

      // Recent results involving this player's team
      const playerTeams = [...new Set([...bRows.map(r => r.team), ...wRows.map(r => r.team)])].filter(Boolean);
      const recentTeamResults = (data.results?.matches || [])
        .filter(m => playerTeams.some(t => m.team1 === t || m.team2 === t))
        .slice(-5);
      if (recentTeamResults.length) {
        lines.push(`RECENT TEAM RESULTS (${playerTeams.join('/')}):`)
        recentTeamResults.forEach(r => lines.push(`  ${r.result || `${r.team1} vs ${r.team2}`} [${r.division}]`));
      }

      // Division standing for this player's team
      for (const team of playerTeams) {
        for (const div of Object.keys(data.standings || {}).filter(k => k !== 'updatedAt')) {
          const raw  = data.standings[div];
          const rows = Array.isArray(raw) ? raw : (raw?.rows || []);
          const pos  = rows.findIndex(t => t.team === team);
          if (pos !== -1) lines.push(`STANDING: ${team} is ${pos + 1}/${rows.length} in ${div} with ${rows[pos].pts} pts (${rows[pos].won}W ${rows[pos].lost}L)`);
        }
      }
    }
    return lines.join('\n');
  }

  // Division lookup — built dynamically from actual data keys (works for any league structure)
  const divKeys = Object.keys(data.standings || {}).filter(k => k !== 'updatedAt');
  const matchedDiv = divKeys.find(div => {
    const d = div.toLowerCase().replace(/\s+/g, '');
    return q.includes(d) || q.includes(div.toLowerCase()) ||
      q.includes(d.replace(/u(\d)/i, 'under$1')) ||
      q.includes(div.toLowerCase().replace(/u(\d)/i, 'under $1'));
  });

  if (matchedDiv) {
    const raw  = data.standings?.[matchedDiv];
    const rows = Array.isArray(raw) ? raw : (raw?.rows || []);
    lines.push(`=== ${matchedDiv} DIVISION ===`);
    lines.push('STANDINGS:');
    rows.forEach((t, i) => lines.push(`  ${i + 1}. ${t.team} | P:${t.played ?? '?'} W:${t.won ?? '?'} L:${t.lost ?? '?'} | Pts:${t.pts ?? '?'} | NRR:${t.nrr ?? '?'} | Form:${t.form ?? '?'}`));
    const divBat = (Array.isArray(data.batting?.[matchedDiv]) ? data.batting[matchedDiv] : [])
      .sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0)).slice(0, 8);
    if (divBat.length) {
      lines.push('\nTOP BATTERS:');
      divBat.forEach((p, i) => lines.push(`  ${i + 1}. ${p.player} (${p.team}): ${p.runs}R | avg:${p.avg} | SR:${p.sr} | HS:${p.hs} | 50s:${p.fifties ?? 0} | 100s:${p.hundreds ?? 0}`));
    }
    const divBowl = (Array.isArray(data.bowling?.[matchedDiv]) ? data.bowling[matchedDiv] : [])
      .sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0)).slice(0, 8);
    if (divBowl.length) {
      lines.push('\nTOP BOWLERS:');
      divBowl.forEach((p, i) => lines.push(`  ${i + 1}. ${p.player} (${p.team}): ${p.wickets}W | econ:${p.econ} | avg:${p.avg} | best:${p.bbf} | 5-fers:${p.fiveW ?? 0}`));
    }
    const divResults = (data.results?.matches || []).filter(m => m.division === matchedDiv).slice(-6);
    if (divResults.length) {
      lines.push('\nRECENT RESULTS:');
      divResults.forEach(r => lines.push(`  ${r.result || `${r.team1} vs ${r.team2}`}`));
    }
    const divUpcoming = (data.matches || []).filter(m => m.division === matchedDiv && !m.result && !m.winner)
      .sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4);
    if (divUpcoming.length) {
      lines.push('\nUPCOMING FIXTURES:');
      divUpcoming.forEach(m => lines.push(`  ${m.team1} vs ${m.team2} — ${m.date}${m.time ? ` ${m.time}` : ''}`));
    }
    return lines.join('\n');
  }

  // Results
  if (/result|match|game|played|won|lost|last week|recent|score/.test(q)) {
    const results = (data.results?.matches || []).slice(-8);
    lines.push('RECENT RESULTS:');
    results.forEach(r => lines.push(`  [${r.division}] ${r.result || `${r.team1} vs ${r.team2}`}`));
    return lines.join('\n');
  }

  // Batting leaderboard
  if (/batting|run|scorer|centur|fift|averag|batsman|boundary|six|6s\b|6'?s|four|4s\b/.test(q)) {
    lines.push('TOP BATTERS (combined across all divisions):');
    leaderBat.sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0)).slice(0, 15)
      .forEach((p, i) => lines.push(`  ${i + 1}. ${p.player} (${p.team}): ${p.runs}R | avg:${p.avg} | SR:${p.sr} | HS:${p.hs} | 50s:${p.fifties ?? 0} | 100s:${p.hundreds ?? 0} | mat:${p.mat}`));
    // Also show top by average (min 3 innings)
    const topAvg = leaderBat.filter(p => (parseInt(p.inns) || 0) >= 3)
      .sort((a, b) => (parseFloat(b.avg) || 0) - (parseFloat(a.avg) || 0)).slice(0, 5);
    if (topAvg.length) {
      lines.push('\nTOP AVERAGES (min 3 innings):');
      topAvg.forEach((p, i) => lines.push(`  ${i + 1}. ${p.player} (${p.team}): avg ${p.avg} in ${p.inns} innings (${p.runs}R)`));
    }
    return lines.join('\n');
  }

  // Bowling leaderboard
  if (/bowl|wicket|econ|spell|over/.test(q)) {
    lines.push('TOP BOWLERS (combined across all divisions):');
    leaderBowl.sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0)).slice(0, 15)
      .forEach((p, i) => lines.push(`  ${i + 1}. ${p.player} (${p.team}): ${p.wickets}W | econ:${p.econ} | avg:${p.avg} | best:${p.bbf} | mat:${p.mat} | 5-fers:${p.fiveW ?? 0}`));
    // Also top by economy (min 3 matches)
    const topEcon = leaderBowl.filter(p => (parseInt(p.mat) || 0) >= 3)
      .sort((a, b) => (parseFloat(a.econ) || 99) - (parseFloat(b.econ) || 99)).slice(0, 5);
    if (topEcon.length) {
      lines.push('\nBEST ECONOMY (min 3 matches):');
      topEcon.forEach((p, i) => lines.push(`  ${i + 1}. ${p.player} (${p.team}): econ ${p.econ} (${p.wickets}W in ${p.mat} matches)`));
    }
    return lines.join('\n');
  }

  // Upcoming schedule
  if (/next|upcoming|schedul|when|fixture|weekend/.test(q)) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const upcoming = (data.matches || [])
      .filter(m => { const d = new Date(m.date); return !isNaN(d) && d >= today && !m.result && !m.winner; })
      .sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 6);
    if (upcoming.length === 0) {
      lines.push('SEASON STATUS: The season is complete — all matches have been played. No upcoming fixtures remain.');
    } else {
      lines.push('UPCOMING FIXTURES:');
      upcoming.forEach(m => lines.push(`  [${m.division}] ${m.team1} vs ${m.team2} — ${m.date}${m.time ? ` ${m.time}` : ''}`));
    }
    return lines.join('\n');
  }

  // General overview
  const allResults = data.results?.matches || [];
  const totalMatches = (data.matches || []).length;
  const isComplete = totalMatches > 0 && allResults.length >= totalMatches;
  lines.push(`SEASON OVERVIEW — ${data.leagueName} ${data.season}`);
  lines.push(isComplete
    ? `Season COMPLETE: All ${totalMatches} matches played. Final standings are official.`
    : `Progress: ${allResults.length}/${totalMatches} matches played`);
  lines.push('');
  lines.push('DIVISION LEADERS:');
  divKeys.forEach(div => {
    const raw  = data.standings?.[div];
    const rows = Array.isArray(raw) ? raw : (raw?.rows || []);
    if (rows[0]) lines.push(`  ${div}: ${rows[0].team} (${rows[0].pts} pts, ${rows[0].won}W)`);
  });
  lines.push('');
  const topBat  = leaderBat.sort((a, b)  => (parseInt(b.runs)    || 0) - (parseInt(a.runs)    || 0)).slice(0, 3);
  const topBowl = leaderBowl.sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0)).slice(0, 3);
  if (topBat.length)  lines.push(`TOP SCORERS: ${topBat.map(p  => `${p.player} ${p.runs}R`).join(' | ')}`);
  if (topBowl.length) lines.push(`TOP BOWLERS: ${topBowl.map(p => `${p.player} ${p.wickets}W`).join(' | ')}`);
  return lines.join('\n');
}

function flattenStats(obj) {
  if (!obj) return [];
  return Object.entries(obj)
    .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([div, rows]) => Array.isArray(rows) ? rows.map(r => ({ ...r, _div: div })) : []);
}

// Returns pre-aggregated combined rows (or aggregates inline if combined key missing)
function combinedStats(obj) {
  if (!obj) return [];
  if (Array.isArray(obj.combined)) return obj.combined;
  // Fallback: aggregate per-division rows by player name
  const map = {};
  flattenStats(obj).forEach(r => {
    const key = (r.player || '').trim().toLowerCase();
    if (!key) return;
    if (!map[key]) { map[key] = { ...r }; return; }
    map[key].runs    = (parseInt(map[key].runs)    || 0) + (parseInt(r.runs)    || 0);
    map[key].wickets = (parseInt(map[key].wickets) || 0) + (parseInt(r.wickets) || 0);
    map[key].mat     = (parseInt(map[key].mat)     || 0) + (parseInt(r.mat)     || 0);
  });
  return Object.values(map);
}
