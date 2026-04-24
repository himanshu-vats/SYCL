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

  const { results, standings, batting, bowling, rankings } = req.body || {};

  const hasResults  = Array.isArray(results) && results.length > 0;
  const hasStandings = standings && typeof standings === 'object' && Object.keys(standings).length > 0;
  const hasBatting  = batting && typeof batting === 'object' && Object.keys(batting).length > 0;
  const hasBowling  = bowling && typeof bowling === 'object' && Object.keys(bowling).length > 0;
  const hasRankings = rankings && typeof rankings === 'object' && Object.keys(rankings).length > 0;

  if (!hasResults && !hasStandings && !hasBatting && !hasBowling && !hasRankings) {
    res.status(400).json({ error: 'No data provided' });
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

    if (hasResults) {
      data.results = { matches: results, updatedAt: now };
    }
    if (hasStandings) {
      if (!data.standings) data.standings = {};
      Object.entries(standings).forEach(([name, divRows]) => {
        if (name && Array.isArray(divRows) && divRows.length) {
          data.standings[name] = { rows: divRows, updatedAt: now };
        }
      });
    }
    if (hasBatting)  data.batting  = { ...batting,  updatedAt: now };
    if (hasBowling)  data.bowling  = { ...bowling,  updatedAt: now };
    if (hasRankings) data.rankings = { ...rankings, updatedAt: now };

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

    const parts = [];
    if (hasResults)   parts.push(`${results.length} results`);
    if (hasStandings) parts.push(`standings (${Object.keys(standings).length} divs)`);
    if (hasBatting)   parts.push(`batting (${Object.keys(batting).length} divs)`);
    if (hasBowling)   parts.push(`bowling (${Object.keys(bowling).length} divs)`);
    if (hasRankings)  parts.push(`rankings (${Object.keys(rankings).length} divs)`);

    res.json({ message: `Synced: ${parts.join(', ')}.`, updatedAt: now });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
