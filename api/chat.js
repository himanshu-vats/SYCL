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

    // ── System prompt ─────────────────────────────────────────────
    const SYSTEM = `You are the SYCL Season Insight AI for ${data.leagueName || 'Seattle Youth Cricket League'} ${data.season || ''}.
Answer ONLY questions about this cricket league and cricket improvement. Politely decline anything unrelated to cricket or this league.
Use ONLY the league data provided — never invent or estimate stats. If a stat isn't in the data, say so honestly.
Be warm, encouraging, and concise (under 150 words).
When a player is discussed, encourage viewing their full profile in the Season Insight app.
When asked about improving cricket skills, suggest https://play.cricket.com.au or YouTube technique videos.`;

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
        max_tokens: 280,
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
    lines.push('PLAYER STATS:');
    for (const playerName of mentionedPlayers.slice(0, 2)) {
      const bRows = allBat.filter(p  => (p.player || '').toLowerCase() === playerName.toLowerCase());
      const wRows = allBowl.filter(p => (p.player || '').toLowerCase() === playerName.toLowerCase());
      if (bRows.length) {
        lines.push(`${playerName} — Batting:`);
        bRows.forEach(r => lines.push(`  [${r._div}] ${r.mat}M ${r.inns}I ${r.runs}R avg:${r.avg} SR:${r.sr} HS:${r.hs} 50s:${r.fifties ?? 0} 100s:${r.hundreds ?? 0}`));
      }
      if (wRows.length) {
        lines.push(`${playerName} — Bowling:`);
        wRows.forEach(r => lines.push(`  [${r._div}] ${r.mat}M ${r.wickets}W econ:${r.econ} avg:${r.avg} best:${r.bbf}`));
      }
    }
    return lines.join('\n');
  }

  // Division lookup
  const divMap = { u11a: 'U11A', u11b: 'U11B', u13a: 'U13A', u13b: 'U13B', u15a: 'U15A', u15b: 'U15B', emerging: 'Emerging Stars' };
  const matchedDiv = Object.entries(divMap).find(([k]) => q.includes(k) || q.includes(k.replace(/u(\d)/i, 'under $1')))?.[1];

  if (matchedDiv) {
    const raw  = data.standings?.[matchedDiv];
    const rows = Array.isArray(raw) ? raw : (raw?.rows || []);
    lines.push(`${matchedDiv} STANDINGS:`);
    rows.forEach((t, i) => lines.push(`  ${i + 1}. ${t.team} — P${t.played ?? '?'} W${t.won ?? '?'} L${t.lost ?? '?'} Pts${t.pts ?? '?'}`));
    const divBat = (Array.isArray(data.batting?.[matchedDiv]) ? data.batting[matchedDiv] : [])
      .sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0)).slice(0, 4);
    if (divBat.length) { lines.push(`Top Batters:`); divBat.forEach(p => lines.push(`  ${p.player} (${p.team}): ${p.runs}R avg:${p.avg} SR:${p.sr}`)); }
    const divBowl = (Array.isArray(data.bowling?.[matchedDiv]) ? data.bowling[matchedDiv] : [])
      .sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0)).slice(0, 4);
    if (divBowl.length) { lines.push(`Top Bowlers:`); divBowl.forEach(p => lines.push(`  ${p.player} (${p.team}): ${p.wickets}W econ:${p.econ}`)); }
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
  if (/batting|run|scorer|centur|fift|averag|batsman|boundary|six|four/.test(q)) {
    lines.push('TOP BATTERS (combined across all divisions):');
    leaderBat.sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0)).slice(0, 8)
      .forEach((p, i) => lines.push(`  ${i + 1}. ${p.player} (${p.team}): ${p.runs}R avg:${p.avg} SR:${p.sr} HS:${p.hs}`));
    return lines.join('\n');
  }

  // Bowling leaderboard
  if (/bowl|wicket|econ|spell|over/.test(q)) {
    lines.push('TOP BOWLERS (combined across all divisions):');
    leaderBowl.sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0)).slice(0, 8)
      .forEach((p, i) => lines.push(`  ${i + 1}. ${p.player} (${p.team}): ${p.wickets}W econ:${p.econ} avg:${p.avg}`));
    return lines.join('\n');
  }

  // Upcoming schedule
  if (/next|upcoming|schedul|when|fixture|weekend/.test(q)) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const upcoming = (data.matches || [])
      .filter(m => { const d = new Date(m.date); return !isNaN(d) && d >= today && !m.result && !m.winner; })
      .sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 6);
    lines.push('UPCOMING FIXTURES:');
    upcoming.forEach(m => lines.push(`  [${m.division}] ${m.team1} vs ${m.team2} — ${m.date}${m.time ? ` ${m.time}` : ''}`));
    return lines.join('\n');
  }

  // General overview
  const allResults = data.results?.matches || [];
  lines.push(`SEASON OVERVIEW — ${data.leagueName} ${data.season}`);
  lines.push(`Progress: ${allResults.length}/${(data.matches || []).length} matches played`);
  lines.push('');
  lines.push('DIVISION LEADERS:');
  ['U11A', 'U11B', 'U13A', 'U13B', 'U15A', 'U15B', 'Emerging Stars'].forEach(div => {
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
