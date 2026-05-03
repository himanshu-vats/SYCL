import { parseDate } from '../utils/schedule.js';
import { computeFormGuide, computeStreak } from '../utils/form.js';
import { aggregateBatting, aggregateBowling } from '../utils/aggregation.js';

export default function TeamProfilePage({ name, data, onClose, onDrilldown }) {
  const { matches = [], results, batting, bowling } = data;
  const today = new Date(); today.setHours(0,0,0,0);

  const teamMatches = matches.filter(m => m.team1 === name || m.team2 === name);
  const divs = [...new Set(teamMatches.map(m => m.division))].filter(Boolean);

  const allResults = (results?.matches || []).filter(m => m.team1 === name || m.team2 === name);
  const recentResults = [...allResults].sort((a, b) => {
    const da = parseDate(a.date), db = parseDate(b.date);
    return da && db ? db - da : 0;
  });

  const upcoming = [...teamMatches]
    .filter(m => { const d = parseDate(m.date); return d && d >= today; })
    .sort((a, b) => { const da = parseDate(a.date), db = parseDate(b.date); return da && db ? da - db : 0; });

  const form = computeFormGuide(results, name, 15);
  const streak = computeStreak(form);
  const wins   = form.filter(f => f === 'W').length;
  const losses = form.filter(f => f === 'L').length;
  const abds   = form.filter(f => f === 'A').length;
  const played = wins + losses + abds;
  const winPct = played > 0 ? Math.round(wins / played * 100) : 0;

  const teamBatRows = batting
    ? Object.entries(batting).filter(([k]) => k !== 'updatedAt' && k !== 'combined')
        .flatMap(([, rows]) => Array.isArray(rows) ? rows.filter(r => r.team === name) : [])
    : [];
  const topBatters = aggregateBatting(teamBatRows).sort((a, b) => (Number(b.runs) || 0) - (Number(a.runs) || 0));

  const teamBowlRows = bowling
    ? Object.entries(bowling).filter(([k]) => k !== 'updatedAt' && k !== 'combined')
        .flatMap(([, rows]) => Array.isArray(rows) ? rows.filter(r => r.team === name) : [])
    : [];
  const topBowlers = aggregateBowling(teamBowlRows).sort((a, b) => (Number(b.wickets) || 0) - (Number(a.wickets) || 0));

  const fmtDate = d => {
    if (!d) return '';
    const dt = parseDate(d);
    return dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : d;
  };

  return (
    <div className="team-profile-page">
      <div className="tp-header">
        <button className="tp-back" onClick={onClose}>← Back</button>
        <div className="tp-name">{name}</div>
        {divs.length > 0 && <div className="tp-divs">{divs.join(' · ')}</div>}
        {form.length > 0 && (
          <div className="tp-form">
            <div className="form-guide">
              {form.map((c, i) => <span key={i} className={`fd fd-${c}`}>{c}</span>)}
            </div>
            {streak && <span className={`streak-badge streak-${streak.code}`}>{streak.code}{streak.count}</span>}
          </div>
        )}
      </div>

      <div className="tp-stats-bar">
        <div className="tp-stat"><div className="tp-stat-val">{played}</div><div className="tp-stat-lbl">Played</div></div>
        <div className="tp-stat"><div className="tp-stat-val" style={{color:'#17bf63'}}>{wins}</div><div className="tp-stat-lbl">Won</div></div>
        <div className="tp-stat"><div className="tp-stat-val" style={{color:'#e0245e'}}>{losses}</div><div className="tp-stat-lbl">Lost</div></div>
        {abds > 0 && <div className="tp-stat"><div className="tp-stat-val" style={{color:'#f0a500'}}>{abds}</div><div className="tp-stat-lbl">Abd</div></div>}
        <div className="tp-stat"><div className="tp-stat-val">{winPct}%</div><div className="tp-stat-lbl">Win %</div></div>
      </div>

      <div className="tp-body">
        <div className="tp-grid">
          {topBatters.length > 0 && (
            <div className="tp-section">
              <div className="tp-section-title">Batters</div>
              <table className="tp-table">
                <thead>
                  <tr><th>Player</th><th>Mat</th><th>Runs</th><th>HS</th><th>Avg</th><th>SR</th><th>6s</th></tr>
                </thead>
                <tbody>
                  {topBatters.map((r, i) => (
                    <tr key={i}>
                      <td className="clickable" onClick={() => onDrilldown({type:'player',name:r.player})}>{r.player}</td>
                      <td>{r.matches}</td>
                      <td style={{fontWeight:700}}>{r.runs}</td>
                      <td>{r.hs}</td>
                      <td>{r.avg}</td>
                      <td>{r.sr}</td>
                      <td>{r.sixes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {topBowlers.length > 0 && (
            <div className="tp-section">
              <div className="tp-section-title">Bowlers</div>
              <table className="tp-table">
                <thead>
                  <tr><th>Player</th><th>Mat</th><th>Wkts</th><th>Econ</th><th>Avg</th><th>Best</th></tr>
                </thead>
                <tbody>
                  {topBowlers.map((r, i) => (
                    <tr key={i}>
                      <td className="clickable" onClick={() => onDrilldown({type:'player',name:r.player})}>{r.player}</td>
                      <td>{r.matches}</td>
                      <td style={{fontWeight:700}}>{r.wickets}</td>
                      <td>{r.econ}</td>
                      <td>{r.avg}</td>
                      <td>{r.best}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="tp-grid">
          {recentResults.length > 0 && (
            <div className="tp-section">
              <div className="tp-section-title">Recent Results</div>
              {recentResults.slice(0, 8).map((m, i) => {
                const myScore  = m.team1 === name ? m.team1Score : m.team2Score;
                const oppScore = m.team1 === name ? m.team2Score : m.team1Score;
                const opp = m.team1 === name ? m.team2 : m.team1;
                const r = (m.result || '').toLowerCase();
                const code = r.includes('abandon') || r.includes('no result') ? 'A'
                  : myScore?.won === true ? 'W'
                  : myScore?.won === false ? 'L' : 'NR';
                const myStr  = myScore  ? `${myScore.runs ?? '?'}/${myScore.wickets ?? '?'} (${myScore.overs ?? '?'})` : '';
                const oppStr = oppScore ? `${oppScore.runs ?? '?'}/${oppScore.wickets ?? '?'} (${oppScore.overs ?? '?'})` : '';
                return (
                  <div key={i} className="tp-result-row">
                    <span className={`fd fd-${code}`}>{code}</span>
                    <div className="tp-result-detail">
                      <div>vs <span className="clickable" onClick={() => onDrilldown({type:'team',name:opp})}>{opp}</span></div>
                      {myStr && <div className="tp-result-score">{myStr}{oppStr ? ` vs ${oppStr}` : ''}</div>}
                      <div className="tp-result-meta">{fmtDate(m.date)} · {m.division}{m.result ? ` · ${m.result}` : ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="tp-section">
              <div className="tp-section-title">Upcoming Fixtures</div>
              {upcoming.slice(0, 6).map((m, i) => {
                const opp = m.team1 === name ? m.team2 : m.team1;
                const d = parseDate(m.date);
                return (
                  <div key={i} className="tp-fixture-row">
                    <div className="tp-fixture-date">
                      <div>{d ? d.getDate() : '?'}</div>
                      <div>{d ? d.toLocaleDateString('en-US', {month:'short'}) : ''}</div>
                    </div>
                    <div className="tp-fixture-detail">
                      <div>vs <span className="clickable" onClick={() => onDrilldown({type:'team',name:opp})}>{opp}</span></div>
                      <div className="tp-fixture-meta">{m.division} · {m.time || 'TBD'}{m.ground ? ` · ${m.ground}` : ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
