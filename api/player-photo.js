const { db } = require('../lib/firebase');

const CLUB_ID = '10669';
const BASE    = 'https://cricclubs.com/SYCLYouth';

// Series to search for the player link (most recent first)
const SEARCH_SERIES = [218, 173, 163, 159, 149, 130, 122, 110, 94, 87, 83];

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { league, name } = req.query;
  if (!league || !name) return res.status(400).json({ error: 'league and name required' });

  const docId   = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cacheRef = db.collection('leagues').doc(league).collection('playerPhotos').doc(docId);

  try {
    // Return cached result (including null = "no photo found")
    const cached = await cacheRef.get();
    if (cached.exists) {
      return res.json({ photoUrl: cached.data().photoUrl ?? null, cached: true });
    }

    // ── Find the player's CricClubs profile link ──────────────────
    let profileUrl = null;
    const escapedName = escapeRegExp(name.trim());

    for (const seriesId of SEARCH_SERIES) {
      const resp = await fetch(
        `${BASE}/battingRecords.do?divisions=all&league=${seriesId}&clubId=${CLUB_ID}`
      );
      const html = await resp.text();

      // Player links look like: href="/SYCLYouth/user/TOKEN?playerName=..."
      const re = new RegExp(`href="(/SYCLYouth/user/[^"?]+\\?[^"]*playerName=[^"]*)"[^>]*>[^<]*${escapedName}[^<]*<`, 'i');
      const m  = html.match(re);
      if (m) {
        profileUrl = `https://cricclubs.com${m[1]}`;
        break;
      }
    }

    if (!profileUrl) {
      await cacheRef.set({ photoUrl: null, updatedAt: new Date().toISOString() });
      return res.json({ photoUrl: null });
    }

    // ── Fetch the player profile page ────────────────────────────
    const profileResp = await fetch(profileUrl);
    const profileHtml = await profileResp.text();

    // Photo URL pattern: src="https://cricclubs.com/documentsRep/profilePics/UUID.jpeg"
    const imgMatch = profileHtml.match(
      /src="(https:\/\/cricclubs\.com\/documentsRep\/profilePics\/[^"]+)"/
    );
    const photoUrl = imgMatch ? imgMatch[1] : null;

    await cacheRef.set({ photoUrl, updatedAt: new Date().toISOString() });
    return res.json({ photoUrl, cached: false });
  } catch (e) {
    console.error('player-photo error:', e);
    return res.status(500).json({ error: 'Failed to fetch photo' });
  }
};

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
