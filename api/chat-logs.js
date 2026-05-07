const { db } = require('../lib/firebase');

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const pwd = req.headers['x-admin-password'];
  if (!pwd || pwd !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { league, limit = '50' } = req.query;
  if (!league) return res.status(400).json({ error: 'league required' });

  try {
    const snap = await db
      .collection('chatLogs').doc(league)
      .collection('sessions')
      .orderBy('updatedAt', 'desc')
      .limit(parseInt(limit) || 50)
      .get();

    const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ sessions });
  } catch (e) {
    console.error('chat-logs error:', e);
    return res.status(500).json({ error: e.message });
  }
};
