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
    const doc = await db.collection('leagues').doc(slug).get();
    if (!doc.exists) {
      res.json({ matchIds: [], count: 0, lastSync: null });
      return;
    }

    const data = doc.data();
    const innings = Array.isArray(data.playerInnings) ? data.playerInnings : [];

    // Unique match IDs that have at least one innings recorded
    const matchIdSet = new Set();
    innings.forEach(inn => {
      if (inn && inn.matchId) matchIdSet.add(String(inn.matchId));
    });

    res.json({
      matchIds: [...matchIdSet],
      count: matchIdSet.size,
      lastSync: data.updatedAt || null,
    });
  } catch (e) {
    console.error('synced-matches error:', e);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
