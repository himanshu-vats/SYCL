const { db } = require('../lib/firebase');

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { league, matchId } = req.query;
  if (!league || !matchId) {
    return res.status(400).json({ error: 'league and matchId required' });
  }

  try {
    const leagueRef = db.collection('leagues').doc(league);

    // ── Check cache ──────────────────────────────────────────────
    const cacheRef = leagueRef.collection('preMatch').doc(String(matchId));
    const cached = await cacheRef.get();
    if (cached.exists) {
      const { insight, generatedAt } = cached.data();
      if (Date.now() - new Date(generatedAt).getTime() < CACHE_TTL_MS) {
        return res.json({ insight, generatedAt, cached: true });
      }
    }

    // ── Load league data ─────────────────────────────────────────
    const snap = await leagueRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'League not found' });
    const data = snap.data();

    // Find the match in the schedule
    const match = (data.matches || []).find(
      m => String(m.id) === String(matchId)
    );
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const { team1, team2, date, division } = match;

    // ── Build context ────────────────────────────────────────────
    const context = buildContext({ data, match, team1, team2, date, division });

    // ── Call DeepSeek ────────────────────────────────────────────
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 512,
        messages: [
          {
            role: 'system',
            content: 'You write punchy, engaging pre-match previews for youth cricket. Your audience is parents and coaches. Use a warm sports-journalism tone. Be specific with names and numbers. Keep it under 180 words.',
          },
          { role: 'user', content: context },
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`DeepSeek API error ${resp.status}: ${err}`);
    }

    const json = await resp.json();
    const insight = json.choices?.[0]?.message?.content || '';
    const generatedAt = new Date().toISOString();

    // ── Cache result ─────────────────────────────────────────────
    await cacheRef.set({ insight, generatedAt, matchId: String(matchId), team1, team2 });

    return res.json({ insight, generatedAt, cached: false });
  } catch (e) {
    console.error('pre-match error:', e);
    return res.status(500).json({ error: 'Failed to generate preview' });
  }
};

// ── Context builder ──────────────────────────────────────────────
function buildContext({ data, match, team1, team2, date, division }) {
  const lines = [];
  lines.push(`PRE-MATCH PREVIEW REQUEST`);
  lines.push(`Match: ${team1} vs ${team2} | Division: ${division} | Date: ${date || 'TBD'}\n`);

  // Standings
  const divStandings = (data.standings || {})[division] || [];
  if (divStandings.length) {
    lines.push('STANDINGS:');
    divStandings.slice(0, 8).forEach((t, i) => {
      const pts  = t.pts ?? t.points ?? t.Pts ?? '?';
      const w    = t.won ?? t.W ?? t.w ?? '?';
      const l    = t.lost ?? t.L ?? t.l ?? '?';
      const p    = t.played ?? t.P ?? t.p ?? '?';
      const nrr  = t.nrr ?? t.NRR ?? '';
      const team = t.team ?? t.Team ?? t.name ?? '';
      lines.push(`  ${i + 1}. ${team} — P${p} W${w} L${l} Pts${pts}${nrr ? ` NRR${nrr}` : ''}`);
    });
    lines.push('');
  }

  // Recent results for each team (last 4)
  const allResults = data.results?.matches || [];
  for (const team of [team1, team2]) {
    const recent = allResults
      .filter(r => r.team1 === team || r.team2 === team)
      .slice(-4);
    if (recent.length) {
      lines.push(`${team.toUpperCase()} — Recent form:`);
      recent.forEach(r => {
        const won = r.result && r.result.trim().toLowerCase().startsWith(team.trim().toLowerCase());
        const opp = r.team1 === team ? r.team2 : r.team1;
        const outcome = won ? 'WON' : 'LOST';
        lines.push(`  ${outcome} vs ${opp}${r.result ? ` (${r.result})` : ''}`);
      });
      lines.push('');
    }
  }

  // Top batters per team (top 3 by runs)
  const batting = flattenStats(data.batting, division);
  for (const team of [team1, team2]) {
    const batters = batting
      .filter(p => (p.team || p.Team) === team && (parseInt(p.mat) || 0) >= 1)
      .sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0))
      .slice(0, 3);
    if (batters.length) {
      lines.push(`${team.toUpperCase()} — Key batters:`);
      batters.forEach(p => {
        const name = p.player || p.Player || '';
        const runs = p.runs || 0;
        const avg  = p.avg || '—';
        const hs   = p.hs || p.HS || '—';
        lines.push(`  ${name}: ${runs} runs, avg ${avg}, HS ${hs}`);
      });
      lines.push('');
    }
  }

  // Top bowlers per team (top 3 by wickets)
  const bowling = flattenStats(data.bowling, division);
  for (const team of [team1, team2]) {
    const bowlers = bowling
      .filter(p => (p.team || p.Team) === team && (parseInt(p.mat) || 0) >= 1)
      .sort((a, b) => (parseInt(b.wkts) || 0) - (parseInt(a.wkts) || 0))
      .slice(0, 3);
    if (bowlers.length) {
      lines.push(`${team.toUpperCase()} — Key bowlers:`);
      bowlers.forEach(p => {
        const name = p.player || p.Player || '';
        const wkts = p.wkts || 0;
        const econ = p.econ || '—';
        const bbf  = p.bbf || p.BBF || '—';
        lines.push(`  ${name}: ${wkts} wkts, econ ${econ}, best ${bbf}`);
      });
      lines.push('');
    }
  }

  // Head-to-head (this season)
  const h2h = allResults.filter(r =>
    (r.team1 === team1 && r.team2 === team2) ||
    (r.team1 === team2 && r.team2 === team1)
  );
  if (h2h.length) {
    lines.push('HEAD-TO-HEAD (this season):');
    h2h.forEach(r => lines.push(`  ${r.result || `${r.team1} vs ${r.team2}`}`));
    lines.push('');
  }

  lines.push('Write the pre-match preview now.');
  return lines.join('\n');
}

// Handle batting/bowling stored as { divisionName: [...] } or flat array
function flattenStats(statsObj, division) {
  if (!statsObj) return [];
  if (Array.isArray(statsObj)) return statsObj;
  // Try exact division first, then 'combined', then merge all
  if (statsObj[division]) return statsObj[division];
  if (statsObj['combined']) return statsObj['combined'];
  return Object.values(statsObj).flat();
}
