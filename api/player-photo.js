const { db } = require('../lib/firebase');

const CLUB_ID = '10669';
const BASE    = 'https://cricclubs.com/SYCLYouth';

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { league, name, bust } = req.query;
  if (!league || !name) return res.status(400).json({ error: 'league and name required' });

  const docId    = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cacheRef = db.collection('leagues').doc(league).collection('playerPhotos').doc(docId);

  try {
    // Return cached result unless bust=true is passed
    const cached = await cacheRef.get();
    if (cached.exists && bust !== 'true') {
      return res.json({ photoUrl: cached.data().photoUrl ?? null, cached: true });
    }

    // ── Step 1: Search for player profile URL ────────────────────
    let profileUrl = null;
    const searchUrl = `${BASE}/searchPlayer.do?playerName=${encodeURIComponent(name)}&clubId=${CLUB_ID}`;

    const searchResp = await fetch(searchUrl);
    const searchHtml = await searchResp.text();

    // Look for user profile links in search results
    const linkRe = /href="(\/SYCLYouth\/user\/[^"?]+(?:\?[^"]*)?)"[^>]*>/gi;
    let m;
    while ((m = linkRe.exec(searchHtml)) !== null) {
      const href = m[1];
      // Prefer links that have the player name in them
      if (!profileUrl || href.toLowerCase().includes(encodeURIComponent(name.split(' ')[0]).toLowerCase())) {
        profileUrl = `https://cricclubs.com${href}`;
      }
      break; // take first match
    }

    // Fallback: try direct player search URL with GET
    if (!profileUrl) {
      profileUrl = `${BASE}/searchPlayer.do?playerName=${encodeURIComponent(name)}&clubId=${CLUB_ID}`;
    }

    // ── Step 2: Fetch profile page and extract og:image ──────────
    const profileResp = await fetch(profileUrl);
    const profileHtml = await profileResp.text();

    // Primary: og:image meta tag (always in <head>, server-rendered)
    // Matches: <meta property='og:image' content='https://media.cricclubs.com/...jpeg'/>
    const ogMatch = profileHtml.match(
      /<meta[^>]+property=['"]og:image['"][^>]+content=['"]([^'"]+)['"]/i
    ) || profileHtml.match(
      /<meta[^>]+content=['"]([^'"]+media\.cricclubs\.com\/documentsRep\/profilePics\/[^'"]+)['"]/i
    );

    let photoUrl = ogMatch ? ogMatch[1] : null;

    // Secondary: any img src pointing to profilePics
    if (!photoUrl) {
      const imgMatch = profileHtml.match(
        /src=['"]([^'"]*(?:media\.cricclubs\.com|cricclubs\.com)\/documentsRep\/profilePics\/[^'"]+)['"]/i
      );
      if (imgMatch) photoUrl = imgMatch[1];
    }

    await cacheRef.set({ photoUrl: photoUrl || null, updatedAt: new Date().toISOString() });
    return res.json({ photoUrl: photoUrl || null, cached: false });
  } catch (e) {
    console.error('player-photo error:', e);
    return res.status(500).json({ error: e.message });
  }
};
