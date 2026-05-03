export default function SeasonOverview({ data, lastRefresh, onDrilldown, onTabClick, onDivision }) {
  const { matches = [], results, batting, bowling, rankings } = data;
  const today = new Date(); today.setHours(0,0,0,0);
  const parseD = s => { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d; };

  const allResults = results?.matches || [];
  const completed  = allResults.length;
  const total      = matches.length;
  const pct        = total > 0 ? Math.round(completed / total * 100) : 0;

  const upcoming = [...matches]
    .filter(m => { const d = parseD(m.date); return d && d >= today; })
    .sort((a,b) => parseD(a.date) - parseD(b.date))
    .slice(0, 5);

  const recentResults = [...allResults]
    .sort((a,b) => parseD(b.date) - parseD(a.date))
    .slice(0, 5);

  const allBatters = batting ? Object.entries(batting)
    .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([,rows]) => Array.isArray(rows) ? rows : []) : [];
  const allBowlers = bowling ? Object.entries(bowling)
    .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([,rows]) => Array.isArray(rows) ? rows : []) : [];
  const allRanked  = rankings ? Object.entries(rankings)
    .filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([,rows]) => Array.isArray(rows) ? rows : []) : [];

  const topBatter  = allBatters.sort((a,b) => (parseInt(b.runs)||0) - (parseInt(a.runs)||0))[0];
  const topBowler  = allBowlers.sort((a,b) => (parseInt(b.wickets)||0) - (parseInt(a.wickets)||0))[0];
  const topRanked  = allRanked.sort((a,b)  => (parseInt(b.total)||0) - (parseInt(a.total)||0))[0];

  const fmtDate = d => { if (!d) return ''; const dt = parseD(d); if (!dt) return d; return dt.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'}); };

  return (
    <div className="overview-page">
      <div className="ov-section">
        <div className="ov-progress-header">
          <span className="ov-progress-label">Season Progress</span>
          <span className="ov-progress-pct">{completed} of {total} matches played</span>
        </div>
        <div className="ov-progress-bar">
          <div className="ov-progress-fill" style={{width: `${pct}%`}} />
        </div>
        {lastRefresh && <div className="ov-updated">Last updated {new Date(lastRefresh).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>}
      </div>

      <div className="ov-grid">
        <div className="ov-col">
          {upcoming.length > 0 && (
            <div className="ov-section">
              <div className="ov-section-title">Upcoming Matches</div>
              {upcoming.map((m, i) => (
                <div key={i} className="ov-match-row">
                  <div className="ov-match-date">{fmtDate(m.date)}</div>
                  <div className="ov-match-div">{m.division}</div>
                  <div className="ov-match-teams">
                    <span className="clickable" onClick={() => onDrilldown({type:'team',name:m.team1})}>{m.team1}</span>
                    <span className="ov-vs">vs</span>
                    <span className="clickable" onClick={() => onDrilldown({type:'team',name:m.team2})}>{m.team2}</span>
                  </div>
                </div>
              ))}
              <button className="ov-more-btn" onClick={() => { onDivision('combined'); onTabClick('schedule'); }}>View full schedule →</button>
            </div>
          )}

          {recentResults.length > 0 && (
            <div className="ov-section">
              <div className="ov-section-title">Recent Results</div>
              {recentResults.map((m, i) => (
                <div key={i} className="ov-result-row">
                  <div className="ov-result-div">{m.division}</div>
                  <div className="ov-result-detail">
                    <span>{m.team1} vs {m.team2}</span>
                    {m.result && <span className="ov-result-winner">· {m.result}</span>}
                  </div>
                  <div className="ov-result-date">{fmtDate(m.date)}</div>
                </div>
              ))}
              <button className="ov-more-btn" onClick={() => { onDivision('combined'); onTabClick('results'); }}>View all results →</button>
            </div>
          )}
        </div>

        <div className="ov-col">
          <div className="ov-section">
            <div className="ov-section-title">Season Stars</div>
            {[
              { emoji:'🏏', label:'Top Scorer',       player: topBatter?.player, team: topBatter?.team,  stat: topBatter?.runs,    unit:'runs' },
              { emoji:'🎯', label:'Top Wicket-Taker', player: topBowler?.player, team: topBowler?.team,  stat: topBowler?.wickets, unit:'wkts' },
              { emoji:'⭐', label:'Points Leader',    player: topRanked?.player, team: topRanked?.team,  stat: topRanked?.total,   unit:'pts' },
            ].filter(s => s.player).map(s => (
              <div key={s.label} className="ov-star-row" onClick={() => onDrilldown({type:'player', name:s.player})}>
                <div className="ov-star-emoji">{s.emoji}</div>
                <div className="ov-star-info">
                  <div className="ov-star-label">{s.label}</div>
                  <div className="ov-star-name">{s.player}</div>
                  <div className="ov-star-team">{s.team}</div>
                </div>
                <div className="ov-star-stat">{s.stat}<span className="ov-star-unit"> {s.unit}</span></div>
              </div>
            ))}
            <button className="ov-more-btn" onClick={() => { onDivision('combined'); onTabClick('batting'); }}>View full stats →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
