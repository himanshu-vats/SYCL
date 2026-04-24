module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');

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
    const raw = gist.files?.['schedule.json']?.content;
    if (!raw) { res.status(404).json({ error: 'No data' }); return; }

    const data = JSON.parse(raw);
    if (!data.matches?.length) { res.status(404).json({ error: 'No matches' }); return; }

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
};
