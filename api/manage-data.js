const { db } = require('../lib/firebase');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const pwd = req.headers['x-admin-password'];
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { action, slug, field } = req.body || {};
  if (!slug) { res.status(400).json({ error: 'slug required' }); return; }

  try {
    if (action === 'delete-season') {
      // Delete the league doc + all subcollections + remove from leagues-index
      const docRef = db.collection('leagues').doc(slug);

      // Delete matches subcollection
      const matchesSnap = await docRef.collection('matches').get();
      const batch1 = db.batch();
      matchesSnap.docs.forEach(d => batch1.delete(d.ref));
      if (matchesSnap.docs.length) await batch1.commit();

      // Delete aiSummary subcollection
      const aiSnap = await docRef.collection('aiSummary').get();
      const batch2 = db.batch();
      aiSnap.docs.forEach(d => batch2.delete(d.ref));
      if (aiSnap.docs.length) await batch2.commit();

      // Delete parent doc
      await docRef.delete();

      // Remove from leagues-index
      await db.collection('meta').doc('leagues-index').update({
        [slug]: require('firebase-admin').firestore.FieldValue.delete()
      });

      res.json({ message: `Season "${slug}" deleted.` });

    } else if (action === 'delete-field') {
      const allowed = ['standings', 'batting', 'bowling', 'rankings', 'results', 'matches'];
      if (!allowed.includes(field)) {
        res.status(400).json({ error: `Invalid field. Allowed: ${allowed.join(', ')}` });
        return;
      }
      await db.collection('leagues').doc(slug).update({
        [field]: require('firebase-admin').firestore.FieldValue.delete()
      });
      res.json({ message: `${field} data deleted from "${slug}".` });

    } else {
      res.status(400).json({ error: 'Unknown action' });
    }
  } catch(e) {
    console.error('manage-data error:', e);
    res.status(500).json({ error: e.message });
  }
};
