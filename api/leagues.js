const { db } = require('../lib/firebase');

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60');

  try {
    const doc = await db.collection('meta').doc('leagues-index').get();
    res.json(doc.exists ? doc.data() : {});
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
};
