const { db } = require('../lib/firebase');

const NOTIFY_EMAIL = process.env.FEEDBACK_NOTIFY_EMAIL || 'himanshu.vats@outlook.com';
const RESEND_KEY   = process.env.RESEND_API_KEY;

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // AI message feedback (thumbs up/down) — kind: 'ai'
  const { kind } = req.body || {};
  if (kind === 'ai') {
    const { slug, sessionId, messageIndex, question, answer, vote, reasons = [] } = req.body;
    if (!slug || !vote) { res.status(400).json({ error: 'slug and vote required' }); return; }
    try {
      await db.collection('aiFeedback').add({
        slug, sessionId: sessionId || null, messageIndex: messageIndex ?? null,
        question: question || '', answer: answer ? answer.slice(0, 500) : '',
        vote, reasons, createdAt: new Date().toISOString(),
      });
      return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  const { message, type, page, league, name } = req.body || {};

  if (!message || !message.trim()) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const entry = {
    message:     message.trim().slice(0, 2000),
    type:        type || 'general',
    page:        page || 'unknown',
    league:      league || null,
    name:        (name || '').trim().slice(0, 100) || null,
    submittedAt: new Date().toISOString(),
  };

  try {
    await db.collection('feedback').add(entry);

    // Send email notification — must be awaited before responding or Vercel kills the function
    if (RESEND_KEY) {
      const typeLabel = { suggestion: '💡 Suggestion', 'data-wrong': '📊 Data looks wrong', broken: '🔧 Something broken', general: '💬 Feedback' }[entry.type] || '💬 Feedback';
      try {
        const emailResp = await fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
          body: JSON.stringify({
            from:    'SYCL Feedback <onboarding@resend.dev>',
            to:      [NOTIFY_EMAIL],
            subject: `${typeLabel} — ${entry.league || 'SYCL'} Season Insight`,
            html: `
              <p><strong>Type:</strong> ${entry.type}</p>
              <p><strong>From:</strong> ${entry.name || 'Anonymous'}</p>
              <p><strong>League:</strong> ${entry.league || '—'}</p>
              <p><strong>Page:</strong> ${entry.page}</p>
              <hr/>
              <p style="font-size:16px">${entry.message.replace(/\n/g, '<br>')}</p>
              <hr/>
              <p style="color:#888;font-size:12px">Submitted at ${entry.submittedAt}</p>
            `,
          }),
        });
        if (!emailResp.ok) {
          const errBody = await emailResp.text();
          console.error('resend error:', emailResp.status, errBody);
        }
      } catch (emailErr) {
        console.error('email notify error:', emailErr);
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('feedback error:', e);
    res.status(500).json({ error: 'Server error' });
  }
};
