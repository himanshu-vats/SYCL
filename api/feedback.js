const { db } = require('../lib/firebase');

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { message, type, page, league, name } = req.body || {};

  if (!message || !message.trim()) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
    await db.collection('feedback').add({
      message: message.trim().slice(0, 2000),
      type: type || 'general',
      page: page || 'unknown',
      league: league || null,
      name: (name || '').trim().slice(0, 100) || null,
      submittedAt: new Date().toISOString(),
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('feedback error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};
