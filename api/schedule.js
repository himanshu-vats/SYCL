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
    if (!data.matches?.length) {
      res.status(404).json({ error: 'No matches' });
      return;
    }

    // Flatten innings from all per-match subcollection docs into a single
    // playerInnings array — keeps the frontend contract identical to the
    // pre-migration shape, so PlayerProfilePage and friends need no change.
    const playerInnings = [];
    matchesSnap.forEach(matchDoc => {
      const innArr = matchDoc.data().innings;
      if (Array.isArray(innArr)) playerInnings.push(...innArr);
    });
    data.playerInnings = playerInnings;

    res.json(data);
  } catch (e) {
    console.error('schedule error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};
