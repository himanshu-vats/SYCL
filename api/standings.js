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

  // Manage-data actions (delete-season, delete-field) merged here to stay within Vercel function limit
  const { action } = req.body || {};
  if (action === 'delete-season' || action === 'delete-field') {
    const { slug, field } = req.body || {};
    if (!slug) { res.status(400).json({ error: 'slug required' }); return; }
    try {
      if (action === 'delete-season') {
        const docRef = db.collection('leagues').doc(slug);
        const matchesSnap = await docRef.collection('matches').get();
        const b1 = db.batch(); matchesSnap.docs.forEach(d => b1.delete(d.ref)); if (matchesSnap.docs.length) await b1.commit();
        const aiSnap = await docRef.collection('aiSummary').get();
        const b2 = db.batch(); aiSnap.docs.forEach(d => b2.delete(d.ref)); if (aiSnap.docs.length) await b2.commit();
        await docRef.delete();
        // Remove from leagues-index — use FieldPath to handle slugs with special chars
        try {
          const admin = require('firebase-admin');
          await db.collection('meta').doc('leagues-index').update(
            new admin.firestore.FieldPath(slug), admin.firestore.FieldValue.delete()
          );
        } catch(e) { /* not in index, that's fine */ }
        return res.json({ message: `Season "${slug}" deleted.` });
      }
      if (action === 'delete-field') {
        const allowed = ['standings', 'batting', 'bowling', 'rankings', 'results', 'matches'];
        if (!allowed.includes(field)) { res.status(400).json({ error: `Invalid field. Allowed: ${allowed.join(', ')}` }); return; }
        await db.collection('leagues').doc(slug).update({ [field]: require('firebase-admin').firestore.FieldValue.delete() });
        return res.json({ message: `${field} deleted from "${slug}".` });
      }
    } catch(e) { return res.status(500).json({ error: e.message }); }
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
