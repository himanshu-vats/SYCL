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

  const { matches, results, standings, batting, bowling, rankings, leagueName, season } = req.body || {};

  const hasMatches  = Array.isArray(matches) && matches.length > 0;
  const hasResults  = Array.isArray(results) && results.length > 0;
  const hasStandings = standings && typeof standings === 'object' && Object.keys(standings).length > 0;
  const hasBatting  = batting && typeof batting === 'object' && Object.keys(batting).length > 0;
  const hasBowling  = bowling && typeof bowling === 'object' && Object.keys(bowling).length > 0;
  const hasRankings = rankings && typeof rankings === 'object' && Object.keys(rankings).length > 0;

  if (!hasMatches && !hasResults && !hasStandings && !hasBatting && !hasBowling && !hasRankings) {
    res.status(400).json({ error: 'No data provided' });
    return;
  }

  try {
    const now = new Date().toISOString();
    const docRef = db.collection('leagues').doc(slug);
    const existing = (await docRef.get()).data() || {};

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

    res.json({ message: `Synced: ${parts.join(', ')}.`, updatedAt: now });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
