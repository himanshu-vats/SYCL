const { db } = require('../lib/firebase');

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');

  const slug = req.query.league;
  if (!slug) {
    res.status(400).json({ error: 'league param required' });
    return;
  }

  try {
    const docRef = db.collection('leagues').doc(slug);

    // Fetch parent doc + per-match subcollection in parallel.
    // Subcollection holds playerInnings per match (one doc per matchId) — this
    // sidesteps Firestore's 1MB-per-document limit that the old monolithic
    // structure hit when matches × players × stats grew large.
    const [parentSnap, matchesSnap] = await Promise.all([
      docRef.get(),
      docRef.collection('matches').get(),
    ]);

    if (!parentSnap.exists) {
      res.status(404).json({ error: 'No data' });
      return;
    }

    const data = parentSnap.data();
    // Allow leagues with results but no fixtures (e.g. no schedule page on CricClubs)
    if (!data.matches?.length && !data.results?.matches?.length) {
      res.status(404).json({ error: 'No matches' });
      return;
    }
    if (!data.matches) data.matches = [];

    // Flatten innings from all per-match subcollection docs into a single
    // playerInnings array — keeps the frontend contract identical to the
    // pre-migration shape, so PlayerProfilePage and friends need no change.
    const playerInnings = [];
    matchesSnap.forEach(matchDoc => {
      const innArr = matchDoc.data().innings;
      if (Array.isArray(innArr)) playerInnings.push(...innArr);
    });
    data.playerInnings = playerInnings;

    // Normalize division names — if batting/bowling/standings only have "Division 1"
    // but results have a real division name, remap to match results
    const resultDivisions = [...new Set((data.results?.matches || []).map(m => m.division).filter(Boolean))];
    if (resultDivisions.length === 1 && resultDivisions[0] !== 'Division 1') {
      const realDiv = resultDivisions[0];
      const remap = (obj) => {
        if (!obj || !obj['Division 1']) return obj;
        const out = { ...obj };
        out[realDiv] = out['Division 1'];
        delete out['Division 1'];
        return out;
      };
      if (data.batting) data.batting = remap(data.batting);
      if (data.bowling) data.bowling = remap(data.bowling);
      if (data.standings) data.standings = remap(data.standings);
      if (data.rankings) data.rankings = remap(data.rankings);
    }

    res.json(data);
  } catch (e) {
    console.error('schedule error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};
