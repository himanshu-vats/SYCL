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
    const getR = await fetch(`https://api.github.com/gists/${process.env.GIST_ID}`, {
      headers: { Authorization: `token ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'SYCL-Dashboard/1.0' }
    });
    if (!getR.ok) { res.status(502).json({ error: `GitHub API error: ${getR.status}` }); return; }

    const gist = await getR.json();
    let data = {};
    try { data = JSON.parse(gist.files?.['schedule.json']?.content || '{}'); } catch {}

    const now = new Date().toISOString();
    if (!data.standings) data.standings = {};
    Object.entries(updates).forEach(([name, divRows]) => {
      data.standings[name] = { rows: divRows, updatedAt: now };
    });

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

    const names = Object.keys(updates);
    res.json({ message: `${names.length} division(s) synced: ${names.join(', ')}.`, updatedAt: now });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
