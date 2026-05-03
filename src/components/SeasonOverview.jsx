import { useState, useMemo } from 'react';

export default function SeasonOverview({ data, lastRefresh, onDrilldown, onTabClick, onDivision }) {
  const { matches = [], results, batting, bowling, rankings, standings } = data;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const parseD = s => { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d; };
  const fmtDate = d => { if (!d) return ''; const dt = parseD(d); if (!dt) return d; return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
  const fmtTime = t => t || 'TBD';

  // ── Player search state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('');

  // ── Derive divisions in canonical order ──
  const divOrder = ["Emerging Stars", "U11A", "U11B", "U13A", "U13B", "U15A", "U15B"];
  const allDivisions = useMemo(() => {
    const divs = [...new Set(matches.map(m => m.division).filter(Boolean))];
    return divs.sort((a, b) => {
      const ai = divOrder.indexOf(a), bi = divOrder.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [matches]);

  // ── All results ──
  const allResults = results?.matches || [];
  const completed = allResults.length;
  const total = matches.length;
  const pct = total > 0 ? Math.round(completed / total * 100) : 0;

  // ── All batters / bowlers / ranked (for overall card) ──
  const allBatters = useMemo(() => {
    if (!batting) return [];
    return Object.entries(batting)
      .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
      .flatMap(([, rows]) => Array.isArray(rows) ? rows : []);
  }, [batting]);

  const allBowlers = useMemo(() => {
    if (!bowling) return [];
    return Object.entries(bowling)
      .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
      .flatMap(([, rows]) => Array.isArray(rows) ? rows : []);
  }, [bowling]);

  const allRanked = useMemo(() => {
    if (!rankings) return [];
    return Object.entries(rankings)
      .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
      .flatMap(([, rows]) => Array.isArray(rows) ? rows : []);
  }, [rankings]);

  // ── Overall season stats ──
  const seasonTotals = useMemo(() => {
    const batters = allBatters;
    const bowlers = allBowlers;
    return {
      totalRuns: batters.reduce((s, r) => s + (parseInt(r.runs) || 0), 0),
      totalWickets: bowlers.reduce((s, r) => s + (parseInt(r.wickets) || 0), 0),
      totalSixes: batters.reduce((s, r) => s + (parseInt(r.sixes) || 0), 0),
      totalFours: batters.reduce((s, r) => s + (parseInt(r.fours) || 0), 0),
      totalCenturies: batters.reduce((s, r) => s + (parseInt(r.hundreds) || 0), 0),
      totalFiveW: bowlers.reduce((s, r) => s + (parseInt(r.fiveW) || 0), 0),
    };
  }, [allBatters, allBowlers]);

  const topBatter = useMemo(() => allBatters.sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0))[0] || null, [allBatters]);
  const topBowler = useMemo(() => allBowlers.sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0))[0] || null, [allBowlers]);
  const topRanked = useMemo(() => allRanked.sort((a, b) => (parseInt(b.total) || 0) - (parseInt(a.total) || 0))[0] || null, [allRanked]);

  // ── Per-division helpers ──
  function getDivisionMatches(div) {
    return matches.filter(m => m.division === div);
  }

  function getDivisionResults(div) {
    return allResults.filter(m => m.division === div);
  }

  function getDivisionTeams(div) {
    const dm = getDivisionMatches(div);
    return [...new Set(dm.flatMap(m => [m.team1, m.team2]).filter(Boolean))].sort();
  }

  function getDivisionProgress(div) {
    const dm = getDivisionMatches(div);
    const dr = getDivisionResults(div);
    const total = dm.length;
    const done = dr.length;
    return { total, done, pct: total > 0 ? Math.round(done / total * 100) : 0 };
  }

  function getDivisionLeader(div) {
    const rows = standings?.[div]?.rows;
    if (rows?.length) return rows[0];
    return null;
  }

  function getDivisionTopBatter(div) {
    if (!batting?.[div]) return null;
    const rows = Array.isArray(batting[div]) ? batting[div] : [];
    return rows.sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0))[0] || null;
  }

  function getDivisionTopBowler(div) {
    if (!bowling?.[div]) return null;
    const rows = Array.isArray(bowling[div]) ? bowling[div] : [];
    return rows.sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0))[0] || null;
  }

  function getDivisionNextMatch(div) {
    const dm = getDivisionMatches(div)
      .filter(m => { const d = parseD(m.date); return d && d >= today; })
      .sort((a, b) => { const da = parseD(a.date), db = parseD(b.date); return (da && db) ? da - db : 0; });
    return dm[0] || null;
  }

  function getDivisionFormGuide(div) {
    const dr = getDivisionResults(div).sort((a, b) => { const da = parseD(a.date), db = parseD(b.date); return (da && db) ? db - da : 0; });
    // Return last 3 results with winner info
    return dr.slice(0, 3).map(r => ({
      team1: r.team1,
      team2: r.team2,
      winner: r.team1Score?.won ? r.team1 : r.team2Score?.won ? r.team2 : null,
      result: r.result,
    }));
  }

  // ── Filtered divisions (for team filter) ──
  const filteredDivisions = useMemo(() => {
    if (!teamFilter) return allDivisions;
    return allDivisions.filter(div => {
      const teams = getDivisionTeams(div);
      return teams.includes(teamFilter);
    });
  }, [allDivisions, teamFilter]);

  const allTeams = useMemo(() => {
    const teams = new Set();
    matches.forEach(m => { if (m.team1) teams.add(m.team1); if (m.team2) teams.add(m.team2); });
    return [...teams].sort();
  }, [matches]);

  // ── Player search results ──
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const seen = new Set();
    const results = [];
    // Search across all batters
    allBatters.forEach(r => {
      if (r.player && r.player.toLowerCase().includes(q) && !seen.has(r.player)) {
        seen.add(r.player);
        results.push({ name: r.player, team: r.team, type: 'batter', stat: `${r.runs} runs` });
      }
    });
    // Search across all bowlers
    allBowlers.forEach(r => {
      if (r.player && r.player.toLowerCase().includes(q) && !seen.has(r.player)) {
        seen.add(r.player);
        results.push({ name: r.player, team: r.team, type: 'bowler', stat: `${r.wickets} wkts` });
      }
    });
    return results.slice(0, 10);
  }, [searchQuery, allBatters, allBowlers]);

  // ── Navigate to a division's full view ──
  const goToDivision = (div) => {
    onDivision(div);
    onTabClick('standings');
  };

  // ── Render a single division card ──
  const DivisionCard = ({ div }) => {
    const progress = getDivisionProgress(div);
    const leader = getDivisionLeader(div);
    const topBat = getDivisionTopBatter(div);
    const topBowl = getDivisionTopBowler(div);
    const nextMatch = getDivisionNextMatch(div);
    const teams = getDivisionTeams(div);
    const form = getDivisionFormGuide(div);

    return (
      <div className="div-card">
        {/* Card header */}
        <div className="div-card-header">
          <div className="div-card-title">{div}</div>
          <div className="div-card-meta">{teams.length} teams · {progress.total} matches</div>
        </div>

        {/* Progress bar */}
        <div className="div-card-progress-wrap">
          <div className="div-card-progress-bar">
            <div className="div-card-progress-fill" style={{ width: `${progress.pct}%` }} />
          </div>
          <div className="div-card-progress-label">{progress.done}/{progress.total} played</div>
        </div>

        {/* Division leader */}
        {leader && (
          <div className="div-card-section">
            <div className="div-card-section-label">🏆 Division Leader</div>
            <div className="div-card-leader-row" onClick={() => onDrilldown({ type: 'team', name: leader.team })}>
              <span className="div-card-leader-name">{leader.team}</span>
              <span className="div-card-leader-pts">{leader.pts} pts</span>
            </div>
          </div>
        )}

        {/* Top performers */}
        <div className="div-card-performers">
          {topBat && (
            <div className="div-card-performer" onClick={() => onDrilldown({ type: 'player', name: topBat.player })}>
              <span className="div-card-performer-emoji">🏏</span>
              <span className="div-card-performer-name">{topBat.player}</span>
              <span className="div-card-performer-stat">{topBat.runs} runs</span>
            </div>
          )}
          {topBowl && (
            <div className="div-card-performer" onClick={() => onDrilldown({ type: 'player', name: topBowl.player })}>
              <span className="div-card-performer-emoji">🎯</span>
              <span className="div-card-performer-name">{topBowl.player}</span>
              <span className="div-card-performer-stat">{topBowl.wickets} wkts</span>
            </div>
          )}
        </div>

        {/* Next match */}
        {nextMatch && (
          <div className="div-card-section">
            <div className="div-card-section-label">📅 Next Match</div>
            <div className="div-card-next-row">
              <div className="div-card-next-date">{fmtDate(nextMatch.date)} · {fmtTime(nextMatch.time)}</div>
              <div className="div-card-next-teams">
                <span className="clickable" onClick={() => onDrilldown({ type: 'team', name: nextMatch.team1 })}>{nextMatch.team1}</span>
                <span className="div-card-vs">vs</span>
                <span className="clickable" onClick={() => onDrilldown({ type: 'team', name: nextMatch.team2 })}>{nextMatch.team2}</span>
              </div>
              {nextMatch.ground && <div className="div-card-next-ground">📍 {nextMatch.ground}</div>}
            </div>
          </div>
        )}

        {/* Recent form snippet */}
        {form.length > 0 && (
          <div className="div-card-form-row">
            {form.map((f, i) => {
              const isWin = f.winner === f.team1 || f.winner === f.team2;
              return (
                <span key={i} className={`div-card-form-dot ${f.winner ? (isWin ? 'dot-win' : 'dot-loss') : 'dot-nr'}`}>
                  {f.winner ? (isWin ? 'W' : 'L') : '—'}
                </span>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <button className="div-card-cta" onClick={() => goToDivision(div)}>
          View Division →
        </button>
      </div>
    );
  };

  return (
    <div className="overview-page">
      {/* ── Season Header ── */}
      <div className="ov-season-header">
        <div className="ov-season-header-top">
          <div className="ov-season-title">{data.leagueName || 'Season'}{data.season ? ` · ${data.season}` : ''}</div>
          <div className="ov-season-meta">
            {allDivisions.length} Divisions · {allTeams.length} Teams · {total} Matches · {completed} Played ({pct}%)
          </div>
          {lastRefresh && (
            <div className="ov-season-updated">🕐 Updated {new Date(lastRefresh).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          )}
        </div>

        {/* Search + Filter bar */}
        <div className="ov-search-bar">
          <div className="ov-search-wrap">
            <span className="ov-search-icon">🔍</span>
            <input
              className="ov-search-input"
              type="text"
              placeholder="Find a player…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="ov-search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
            {/* Search dropdown */}
            {searchResults.length > 0 && (
              <div className="ov-search-dropdown">
                {searchResults.map((r, i) => (
                  <div key={i} className="ov-search-result" onClick={() => { onDrilldown({ type: 'player', name: r.name }); setSearchQuery(''); }}>
                    <span className="ov-search-result-name">{r.name}</span>
                    <span className="ov-search-result-team">{r.team}</span>
                    <span className="ov-search-result-stat">{r.stat}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <select className="ov-team-select" value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
            <option value="">All Teams</option>
            {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {teamFilter && <button className="ov-filter-clear" onClick={() => setTeamFilter('')}>✕</button>}
        </div>
      </div>

      {/* ── Division Cards Grid ── */}
      <div className="div-card-grid">
        {/* Overall Season Card */}
        <div className="div-card div-card-overall">
          <div className="div-card-header">
            <div className="div-card-title">🌟 Overall Season</div>
            <div className="div-card-meta">{allDivisions.length} divisions · {allTeams.length} teams</div>
          </div>

          {/* Season totals */}
          <div className="div-card-overall-totals">
            <div className="div-card-overall-total">
              <div className="div-card-overall-total-val">{seasonTotals.totalRuns.toLocaleString()}</div>
              <div className="div-card-overall-total-lbl">Total Runs</div>
            </div>
            <div className="div-card-overall-total">
              <div className="div-card-overall-total-val">{seasonTotals.totalWickets}</div>
              <div className="div-card-overall-total-lbl">Wickets</div>
            </div>
            <div className="div-card-overall-total">
              <div className="div-card-overall-total-val">{seasonTotals.totalSixes}</div>
              <div className="div-card-overall-total-lbl">Sixes</div>
            </div>
            <div className="div-card-overall-total">
              <div className="div-card-overall-total-val">{seasonTotals.totalFours}</div>
              <div className="div-card-overall-total-lbl">Fours</div>
            </div>
          </div>

          {/* Season milestones */}
          <div className="div-card-overall-milestones">
            {seasonTotals.totalCenturies > 0 && <span className="div-card-milestone">💯 {seasonTotals.totalCenturies} Centur{seasonTotals.totalCenturies === 1 ? 'y' : 'ies'}</span>}
            {seasonTotals.totalFiveW > 0 && <span className="div-card-milestone">🎯 {seasonTotals.totalFiveW} 5-Wicket Haul{seasonTotals.totalFiveW > 1 ? 's' : ''}</span>}
          </div>

          {/* Top performers */}
          <div className="div-card-section">
            <div className="div-card-section-label">🏆 Season Leaders</div>
            <div className="div-card-performers">
              {topBatter && (
                <div className="div-card-performer" onClick={() => onDrilldown({ type: 'player', name: topBatter.player })}>
                  <span className="div-card-performer-emoji">🏏</span>
                  <span className="div-card-performer-name">{topBatter.player}</span>
                  <span className="div-card-performer-stat">{topBatter.runs} runs</span>
                </div>
              )}
              {topBowler && (
                <div className="div-card-performer" onClick={() => onDrilldown({ type: 'player', name: topBowler.player })}>
                  <span className="div-card-performer-emoji">🎯</span>
                  <span className="div-card-performer-name">{topBowler.player}</span>
                  <span className="div-card-performer-stat">{topBowler.wickets} wkts</span>
                </div>
              )}
              {topRanked && (
                <div className="div-card-performer" onClick={() => onDrilldown({ type: 'player', name: topRanked.player })}>
                  <span className="div-card-performer-emoji">⭐</span>
                  <span className="div-card-performer-name">{topRanked.player}</span>
                  <span className="div-card-performer-stat">{topRanked.total} pts</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="div-card-progress-wrap">
            <div className="div-card-progress-bar">
              <div className="div-card-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="div-card-progress-label">{completed}/{total} matches played</div>
          </div>

          {/* CTA */}
          <button className="div-card-cta" onClick={() => goToDivision('combined')}>
            View All Divisions →
          </button>
        </div>

        {/* Per-division cards */}
        {filteredDivisions.map(div => (
          <DivisionCard key={div} div={div} />
        ))}
      </div>

      {/* ── Recent Activity ── */}
      <div className="ov-activity-bar">
        <span className="ov-activity-icon">📊</span>
        <span className="ov-activity-text">
          {lastRefresh ? `Data updated ${new Date(lastRefresh).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Loading…'}
          {results?.updatedAt && ` · ${allResults.length} results synced`}
          {batting?.updatedAt && ' · Stats available'}
        </span>
      </div>
    </div>
  );
}
