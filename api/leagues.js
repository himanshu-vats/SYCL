module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60');

  if (!process.env.GIST_ID || !process.env.GITHUB_TOKEN) {
    res.status(503).json({ error: 'Not configured' });
    return;
  }

  try {
    const r = await fetch(`https://api.github.com/gists/${process.env.GIST_ID}`, {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'SYCL-Dashboard/1.0'
      }
    });

    if (!r.ok) { res.status(404).json({ error: 'No data' }); return; }

    const gist = await r.json();
    let indexData = {};
    const raw = gist.files?.['leagues-index.json']?.content;
    if (raw) {
      try { indexData = JSON.parse(raw); } catch {}
    }

    res.json(indexData);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
};
