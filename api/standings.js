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
  const { division, rows, divisions } = req.body || {};

  // Build update map: either { divisions: { Name: { rows } } } or legacy { division, rows }
  const updates = {};
  if (divisions && typeof divisions === 'object') {
    Object.entries(divisions).forEach(([name, val]) => {
      if (name && Array.isArray(val?.rows) && val.rows.length) updates[name] = val.rows;
    });
  } else if (division && Array.isArray(rows) && rows.length) {
    updates[division] = rows;
  }

  if (!Object.keys(updates).length) {
    res.status(400).json({ error: 'Provide divisions map or division+rows' });
    return;
  }

  try {
    const now = new Date().toISOString();
    const standing = {};
    Object.entries(updates).forEach(([name, divRows]) => {
      standing[name] = { rows: divRows, updatedAt: now };
    });

    await db.collection('leagues').doc(slug).update({ standings: standing });

    const names = Object.keys(updates);
    res.json({ message: `${names.length} division(s) synced: ${names.join(', ')}.`, updatedAt: now });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
