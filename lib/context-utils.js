const { db } = require('./firebase');

/**
 * Load data from the current league and up to `count` recent historical seasons.
 * Returns [{ slug, season, data, isCurrent }], newest first.
 */
async function loadMultiSeasonData(currentLeague, count = 2) {
  const indexSnap = await db.collection('meta').doc('leagues-index').get();
  const index = indexSnap.data() || {};

  // Collect historical slugs (excluding current), sorted by updatedAt descending
  const historicalSlugs = Object.entries(index)
    .filter(([slug, info]) => slug !== currentLeague && (info.historical === true))
    .sort((a, b) => (b[1].updatedAt || '').localeCompare(a[1].updatedAt || ''))
    .slice(0, count)
    .map(([slug]) => slug);

  const allSlugs = [currentLeague, ...historicalSlugs];

  const docs = await Promise.all(
    allSlugs.map(slug => db.collection('leagues').doc(slug).get())
  );

  return docs
    .filter(d => d.exists)
    .map((d, i) => {
      const data = d.data();
      return {
        slug: allSlugs[i],
        season: data.season || '',
        data,
        isCurrent: i === 0,
      };
    });
}

/**
 * Extract per-season batting and bowling rows for a specific player.
 * Returns [{ slug, season, battingRows, bowlingRows }] sorted by season desc.
 */
function getPlayerStatsAcrossSeasons(seasons, playerName) {
  const norm = (s) => (s || '').toLowerCase().trim();
  const target = norm(playerName);

  return seasons.map(s => {
    const batting = s.data.batting || {};
    const bowling = s.data.bowling || {};

    const battingRows = [];
    const bowlingRows = [];

    Object.keys(batting).forEach(div => {
      if (div === 'updatedAt') return;
      const rows = Array.isArray(batting[div]) ? batting[div] : [];
      rows.forEach(r => {
        if (norm(r.player) === target) battingRows.push({ ...r, division: div });
      });
    });

    Object.keys(bowling).forEach(div => {
      if (div === 'updatedAt') return;
      const rows = Array.isArray(bowling[div]) ? bowling[div] : [];
      rows.forEach(r => {
        if (norm(r.player) === target) bowlingRows.push({ ...r, division: div });
      });
    });

    return {
      slug: s.slug,
      season: s.season,
      isCurrent: s.isCurrent,
      battingRows,
      bowlingRows,
    };
  });
}

/**
 * Extract per-season results and standings info for a specific team.
 * Returns [{ slug, season, results, standingsEntry, topBatters, topBowlers }].
 */
function getTeamStatsAcrossSeasons(seasons, teamName) {
  const norm = (s) => (s || '').toLowerCase().trim();
  const target = norm(teamName);

  return seasons.map(s => {
    const results = s.data.results || {};
    const resultsArr = Array.isArray(results.matches) ? results.matches : [];
    const teamResults = resultsArr.filter(r =>
      norm(r.team1) === target || norm(r.team2) === target
    );

    const standings = s.data.standings || {};
    let standingsEntry = null;
    Object.keys(standings).forEach(div => {
      if (div === 'updatedAt') return;
      const rows = Array.isArray(standings[div]?.rows) ? standings[div].rows : [];
      const entry = rows.find(r => norm(r.team) === target);
      if (entry) standingsEntry = { ...entry, division: div };
    });

    // Top batters for this team (by runs)
    const batting = s.data.batting || {};
    const teamBatters = [];
    Object.keys(batting).forEach(div => {
      if (div === 'updatedAt') return;
      (Array.isArray(batting[div]) ? batting[div] : []).forEach(r => {
        if (norm(r.team) === target) teamBatters.push(r);
      });
    });
    teamBatters.sort((a, b) => (b.runs || 0) - (a.runs || 0));

    // Top bowlers for this team (by wickets)
    const bowling = s.data.bowling || {};
    const teamBowlers = [];
    Object.keys(bowling).forEach(div => {
      if (div === 'updatedAt') return;
      (Array.isArray(bowling[div]) ? bowling[div] : []).forEach(r => {
        if (norm(r.team) === target) teamBowlers.push(r);
      });
    });
    teamBowlers.sort((a, b) => (b.wickets || 0) - (a.wickets || 0));

    return {
      slug: s.slug,
      season: s.season,
      isCurrent: s.isCurrent,
      teamResults: teamResults.slice(-8),
      standingsEntry,
      topBatters: teamBatters.slice(0, 5),
      topBowlers: teamBowlers.slice(0, 5),
    };
  });
}

/**
 * Build a compact text summary of all available seasons for AI prompting.
 * Returns a string like:
 *   "Spring 2026 (current): 156 matches, 7 divisions. Spring 2025: 142 matches, 6 divisions."
 */
function formatSeasonsForPrompt(seasons) {
  return seasons.map(s => {
    const d = s.data;
    const matches = Array.isArray(d.matches) ? d.matches.length : 0;
    const divCount = d.standings
      ? Object.keys(d.standings).filter(k => k !== 'updatedAt').length
      : 0;
    const label = s.isCurrent ? `${s.season} (current)` : s.season;
    return `${label}: ${matches} matches, ${divCount} divisions`;
  }).join('. ');
}

module.exports = {
  loadMultiSeasonData,
  getPlayerStatsAcrossSeasons,
  getTeamStatsAcrossSeasons,
  formatSeasonsForPrompt,
};
