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

  if (!process.env.GIST_ID || !process.env.GITHUB_TOKEN) {
    res.status(503).json({ error: 'Not configured' });
    return;
  }

  const { batting, bowling, rankings } = req.body || {};
  if (!batting && !bowling && !rankings) {
    res.status(400).json({ error: 'No stats data provided' });
    return;
  }

  try {
    const getR = await fetch(`https://api.github.com/gists/${process.env.GIST_ID}`, {
      headers: { Authorization: `token ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'SYCL-Dashboard/1.0' }
    });
    if (!getR.ok) { res.status(502).json({ error: `GitHub API error: ${getR.status}` }); return; }

    const gist = await getR.json();
    let data = {};
    try { data = JSON.parse(gist.files?.['schedule.json']?.content || '{}'); } catch {}

    const now = new Date().toISOString();
    if (batting) data.batting = { ...batting, updatedAt: now };
    if (bowling) data.bowling = { ...bowling, updatedAt: now };
    if (rankings) data.rankings = { ...rankings, updatedAt: now };

    const putR = await fetch(`https://api.github.com/gists/${process.env.GIST_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SYCL-Dashboard/1.0'
      },
      body: JSON.stringify({ files: { 'schedule.json': { content: JSON.stringify(data) } } })
    });
    if (!putR.ok) { res.status(502).json({ error: `GitHub API error: ${putR.status}` }); return; }

    const synced = [batting && 'batting', bowling && 'bowling', rankings && 'rankings'].filter(Boolean);
    res.json({ message: `Stats synced: ${synced.join(', ')}.`, updatedAt: now });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
