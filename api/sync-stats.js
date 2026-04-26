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
  const { batting, bowling, rankings } = req.body || {};
  if (!batting && !bowling && !rankings) {
    res.status(400).json({ error: 'No stats data provided' });
    return;
  }

  try {
    const now = new Date().toISOString();
    const update = {};
    if (batting) update.batting = { ...batting, updatedAt: now };
    if (bowling) update.bowling = { ...bowling, updatedAt: now };
    if (rankings) update.rankings = { ...rankings, updatedAt: now };

    await db.collection('leagues').doc(slug).update(update);

    const synced = [batting && 'batting', bowling && 'bowling', rankings && 'rankings'].filter(Boolean);
    res.json({ message: `Stats synced: ${synced.join(', ')}.`, updatedAt: now });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
