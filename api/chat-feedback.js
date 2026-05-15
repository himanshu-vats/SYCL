const { db } = require('../lib/firebase');

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const { slug, sessionId, messageIndex, question, answer, vote, reasons = [] } = req.body || {};
  if (!slug || !vote) { res.status(400).json({ error: 'slug and vote required' }); return; }

  try {
    await db.collection('aiFeedback').add({
      slug,
      sessionId: sessionId || null,
      messageIndex: messageIndex ?? null,
      question: question || '',
      answer: answer ? answer.slice(0, 500) : '',
      vote,
      reasons,
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('chat-feedback error:', e);
    res.status(500).json({ error: e.message });
  }
};
