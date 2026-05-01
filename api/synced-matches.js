const { db } = require('../lib/firebase');

/**
 * GET /api/synced-matches?league={slug}
 *
 * Returns the list of match IDs that already have scorecard data
 * stored for this league. Used by the bookmarklet to perform
 * DELTA SYNC — only fetching scorecards for matches it doesn't
 * have yet, instead of re-fetching all 50+ scorecards every time.
 *
 * Response:
 *   {
 *     matchIds: ["123", "456", ...],   // unique match IDs with at least 1 innings
 *     count: 42,
 *     lastSync: "2026-04-30T..."        // most recent updatedAt
 *   }
 */
module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store'); // delta-correctness > caching

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const slug = req.query.league;
  if (!slug) {
    res.status(400).json({ error: 'league param required' });
    return;
  }

  try {
    const docRef = db.collection('leagues').doc(slug);

    // Innings are stored per-match in the `matches` subcollection. Each subcoll
    // doc id IS the matchId — listDocuments() returns refs without reading
    // field data, so this is cheap (1 listDocuments call, no doc reads billed).
    const matchRefs = await docRef.collection('matches').listDocuments();
    const matchIds = matchRefs.map(ref => ref.id);

    // Fall back to parent doc's lastSync timestamp (legacy or empty cases).
    const parentSnap = await docRef.get();
    const lastSync = parentSnap.exists ? (parentSnap.data().updatedAt || null) : null;

    res.json({
      matchIds,
      count: matchIds.length,
      lastSync,
    });
  } catch (e) {
    console.error('synced-matches error:', e);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
