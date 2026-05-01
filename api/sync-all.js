const { db } = require('../lib/firebase');

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const pwd = req.headers['x-admin-password'] || req.body?.password;
  if (!pwd || pwd !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }

  const slug = req.body?.league || req.query?.league;
  if (!slug) {
    res.status(400).json({ error: 'league slug required' });
    return;
  }

  const { matches, results, standings, batting, bowling, rankings, playerInnings, leagueName, season } = req.body || {};

  const hasMatches  = Array.isArray(matches) && matches.length > 0;
  const hasResults  = Array.isArray(results) && results.length > 0;
  const hasStandings = standings && typeof standings === 'object' && Object.keys(standings).length > 0;
  const hasBatting  = batting && typeof batting === 'object' && Object.keys(batting).length > 0;
  const hasBowling  = bowling && typeof bowling === 'object' && Object.keys(bowling).length > 0;
  const hasRankings = rankings && typeof rankings === 'object' && Object.keys(rankings).length > 0;
  const hasInnings  = Array.isArray(playerInnings) && playerInnings.length > 0;

  if (!hasMatches && !hasResults && !hasStandings && !hasBatting && !hasBowling && !hasRankings && !hasInnings) {
    res.status(400).json({ error: 'No data provided' });
    return;
  }

  try {
    const now = new Date().toISOString();
    const docRef = db.collection('leagues').doc(slug);
    const existingFull = (await docRef.get()).data() || {};

    // ── Strip legacy `playerInnings` field from parent doc ──
    // Earlier syncs accidentally inlined innings into the parent document and
    // pushed it past Firestore's 1MB hard limit. Innings now live in a
    // per-match subcollection (see below). Destructure to drop it from the
    // parent write and let set() (without merge) wipe it from the doc.
    const { playerInnings: _legacyInnings, ...existing } = existingFull;

    const update = { ...existing, updatedAt: now };
    if (hasMatches) {
      update.matches = matches;
      update.matchCount = matches.length;
    }
    if (hasResults) {
      update.results = { matches: results, updatedAt: now };
    }
    if (hasStandings) {
      update.standings = { ...(existing.standings || {}) };
      Object.entries(standings).forEach(([name, divRows]) => {
        if (name && Array.isArray(divRows) && divRows.length) {
          update.standings[name] = { rows: divRows, updatedAt: now };
        }
      });
    }
    if (hasBatting)   update.batting = { ...batting, updatedAt: now };
    if (hasBowling)   update.bowling = { ...bowling, updatedAt: now };
    if (hasRankings)  update.rankings = { ...rankings, updatedAt: now };
    if (leagueName)   update.leagueName = leagueName;
    if (season)       update.season = season;

    await docRef.set(update);

    // ── Write innings to per-match subcollection: leagues/{slug}/matches/{matchId} ──
    // Each match gets its own document (~10-30 KB), well under the 1MB limit.
    // Incoming innings are merged with any existing innings for the same match,
    // deduped by composite key (matchId::player::team::role) — re-scrapes update
    // in place; previously-recorded innings from other syncs are preserved.
    let migratedFromLegacy = 0;
    if (hasInnings || (Array.isArray(_legacyInnings) && _legacyInnings.length)) {
      const inningsKey = (inn) =>
        `${inn.matchId}::${(inn.player||'').toLowerCase().trim()}::${(inn.team||'').toLowerCase().trim()}::${inn.role||''}`;

      // Merge incoming innings with any legacy innings still on the parent doc.
      // This one-time migration moves stranded data into the subcollection.
      const allIncoming = [];
      if (Array.isArray(_legacyInnings)) {
        allIncoming.push(..._legacyInnings);
        migratedFromLegacy = _legacyInnings.length;
      }
      if (hasInnings) allIncoming.push(...playerInnings);

      // Group by matchId
      const byMatch = new Map();
      allIncoming.forEach(inn => {
        if (!inn || !inn.matchId) return;
        const id = String(inn.matchId);
        if (!byMatch.has(id)) byMatch.set(id, []);
        byMatch.get(id).push(inn);
      });

      const matchesCol = docRef.collection('matches');

      // For each match: read existing subcoll doc, merge innings, write back.
      // Done in parallel — typically 0-10 match docs to update per delta sync.
      await Promise.all([...byMatch.entries()].map(async ([matchId, newInnings]) => {
        const matchDocRef = matchesCol.doc(matchId);
        const existingMatchDoc = await matchDocRef.get();
        const existingInnings = existingMatchDoc.exists && Array.isArray(existingMatchDoc.data().innings)
          ? existingMatchDoc.data().innings : [];

        const merged = new Map();
        existingInnings.forEach(inn => merged.set(inningsKey(inn), inn));
        newInnings.forEach(inn => {
          if (inn && inn.player) merged.set(inningsKey(inn), inn);
        });

        const innArr = [...merged.values()];
        const sample = innArr[0] || newInnings[0] || {};

        await matchDocRef.set({
          matchId: String(matchId),
          date: sample.date || '',
          division: sample.division || '',
          // team1/team2 helps queries without scanning innings array
          team1: sample.team || '',
          team2: sample.opponent || '',
          result: sample.result || '',
          innings: innArr,
          updatedAt: now,
        });
      }));
    }

    // Compute summary stats for the landing page cards
    const matchCount = hasMatches ? matches.length : (existing.matches?.length || 0);
    const resultsArr = hasResults ? results : (existing.results?.matches || []);
    const completedCount = Array.isArray(resultsArr) ? resultsArr.length : 0;

    const divisionSet = new Set();
    const teamSet = new Set();
    const sourceMatches = hasMatches ? matches : (existing.matches || []);
    sourceMatches.forEach(m => {
      if (m.division) divisionSet.add(m.division);
      if (m.team1) teamSet.add(m.team1);
      if (m.team2) teamSet.add(m.team2);
    });
    if (hasStandings) Object.keys(standings).forEach(d => divisionSet.add(d));

    // Update leagues-index with enriched metadata
    await db.collection('meta').doc('leagues-index').set(
      {
        [slug]: {
          name: leagueName || slug,
          season: season || '',
          updatedAt: now,
          matchCount,
          completedCount,
          divisionCount: divisionSet.size,
          teamCount: teamSet.size,
        }
      },
      { merge: true }
    );

    const parts = [];
    if (hasMatches)   parts.push(`${matches.length} fixtures`);
    if (hasResults)   parts.push(`${results.length} results`);
    if (hasStandings) parts.push(`standings (${Object.keys(standings).length} divs)`);
    if (hasBatting)   parts.push(`batting (${Object.keys(batting).length} divs)`);
    if (hasBowling)   parts.push(`bowling (${Object.keys(bowling).length} divs)`);
    if (hasRankings)  parts.push(`rankings (${Object.keys(rankings).length} divs)`);
    if (hasInnings) {
      const newMatchIds = new Set(playerInnings.map(i => i.matchId).filter(Boolean));
      parts.push(`${playerInnings.length} innings from ${newMatchIds.size} match${newMatchIds.size===1?'':'es'}`);
    }
    if (migratedFromLegacy > 0) {
      parts.push(`migrated ${migratedFromLegacy} legacy innings to subcollection`);
    }

    res.json({ message: `Synced: ${parts.join(', ')}.`, updatedAt: now });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
