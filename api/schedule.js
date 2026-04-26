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
    const doc = await db.collection('leagues').doc(slug).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'No data' });
      return;
    }

    const data = doc.data();
    if (!data.matches?.length) {
      res.status(404).json({ error: 'No matches' });
      return;
    }

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
};
