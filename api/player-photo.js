const { db } = require('../lib/firebase');

const CLUB_ID = '10669';
const BASE    = 'https://cricclubs.com/SYCLYouth';

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { league, name } = req.query;
  if (!league || !name) return res.status(400).json({ error: 'league and name required' });

  const docId    = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cacheRef = db.collection('leagues').doc(league).collection('playerPhotos').doc(docId);

  try {
    const cached = await cacheRef.get();
    if (cached.exists) {
      return res.json({ photoUrl: cached.data().photoUrl ?? null, cached: true });
    }

    // ── Try CricClubs member search ──────────────────────────────
    // CricClubs has a player search endpoint used by their search box
    const searchUrl = `${BASE}/searchPlayer.do?playerName=${encodeURIComponent(name)}&clubId=${CLUB_ID}`;
    let profileUrl = null;

    try {
      const searchResp = await fetch(searchUrl);
      const searchHtml = await searchResp.text();
      // Look for user profile links
      const linkMatch = searchHtml.match(/href="(\/SYCLYouth\/user\/[^"?]+[^"]*)"[^>]*>/i);
      if (linkMatch) {
        profileUrl = `https://cricclubs.com${linkMatch[1]}`;
      }
    } catch (_) {}

    // ── Fallback: try player profile URL with name directly ────────
    if (!profileUrl) {
      // CricClubs allows direct access: /user/search?playerName=Name&clubId=X
      const directUrl = `${BASE}/viewPlayer.do?playerName=${encodeURIComponent(name)}&clubId=${CLUB_ID}`;
      profileUrl = directUrl;
    }

    // ── Fetch the player profile page ────────────────────────────
    const profileResp = await fetch(profileUrl);
    const profileHtml = await profileResp.text();

    // Photo URL patterns CricClubs uses:
    // src="https://cricclubs.com/documentsRep/profilePics/UUID.jpeg"
    // or background-image: url('...')
    const patterns = [
      /src="(https:\/\/cricclubs\.com\/documentsRep\/profilePics\/[^"]+)"/,
      /src="(\/documentsRep\/profilePics\/[^"]+)"/,
      /profilePics\/([a-f0-9-]+\.(?:jpeg|jpg|png))/i,
    ];

    let photoUrl = null;
    for (const re of patterns) {
      const m = profileHtml.match(re);
      if (m) {
        photoUrl = m[1].startsWith('http') ? m[1] : `https://cricclubs.com${m[1].startsWith('/') ? m[1] : '/documentsRep/profilePics/' + m[1]}`;
        break;
      }
    }

    await cacheRef.set({ photoUrl, updatedAt: new Date().toISOString() });
    return res.json({ photoUrl, cached: false });
  } catch (e) {
    console.error('player-photo error:', e);
    return res.status(500).json({ error: 'Failed to fetch photo' });
  }
};
