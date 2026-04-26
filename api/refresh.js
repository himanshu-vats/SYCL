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

  const slug = req.body?.league || 'default';
  const { matches } = req.body || {};
  if (!Array.isArray(matches) || !matches.length) {
    res.status(400).json({ error: 'No match data provided' });
    return;
  }

  try {
    const now = new Date().toISOString();
    await db.collection('leagues').doc(slug).update({
      matches: matches,
      matchCount: matches.length,
      updatedAt: now
    });

    res.json({ message: `${matches.length} matches saved.`, updatedAt: now });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
