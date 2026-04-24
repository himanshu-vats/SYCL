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

  const { matches } = req.body || {};
  if (!Array.isArray(matches) || !matches.length) {
    res.status(400).json({ error: 'No match data provided' });
    return;
  }

  const data = { matches, updatedAt: new Date().toISOString(), matchCount: matches.length };

  const r = await fetch(`https://api.github.com/gists/${process.env.GIST_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'SYCL-Dashboard/1.0'
    },
    body: JSON.stringify({ files: { 'schedule.json': { content: JSON.stringify(data) } } })
  });

  if (!r.ok) { res.status(502).json({ error: `GitHub API error: ${r.status}` }); return; }

  res.json({ message: `${matches.length} matches saved.`, updatedAt: data.updatedAt });
};
