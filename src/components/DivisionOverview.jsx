import { useMemo } from 'react';
import { parseDate, isAM } from '../utils/schedule.js';
import FormGuide from './shared/FormGuide.jsx';

export default function DivisionOverview({ data, division, onTabClick, onDrilldown, onAllDivisions }) {
  // ── Filter data for this division ──
  const divMatches = useMemo(() =>
    (data.matches || []).filter(m => m.division === division),
    [data.matches, division]
  );

  const divResults = useMemo(() =>
    (data.results?.matches || []).filter(m => m.division === division),
    [data.results, division]
  );

  const standingsRows = useMemo(() =>
    data.standings?.[division]?.rows || [],
    [data.standings, division]
  );

  const battingRows = useMemo(() =>
    data.batting?.[division] || [],
    [data.batting, division]
  );

  const bowlingRows = useMemo(() =>
    data.bowling?.[division] || [],
    [data.bowling, division]
  );

  // ── Derived stats ──
  const teams = useMemo(() =>
    [...new Set(divMatches.flatMap(m => [m.team1, m.team2]).filter(Boolean))].sort(),
    [divMatches]
  );

  const totalMatches = divMatches.length;
  const completedMatches = divResults.length;

  const winLeaders = useMemo(() => {
    if (!standingsRows.length) return [];
    const maxWins = Math.max(...standingsRows.map(r => r.won || 0));
    return standingsRows.filter(r => (r.won || 0) === maxWins).map(r => r.team);
  }, [standingsRows]);

  // ── Top 4 standings ──
  const top4 = standingsRows.slice(0, 4);

  // ── Next 3 upcoming matches ──
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const nextMatches = useMemo(() =>
    divMatches
      .filter(m => { const d = parseDate(m.date); return d && d >= today; })
      .sort((a, b) => { const da = parseDate(a.date), db = parseDate(b.date); return (da && db) ? da - db : 0; })
      .slice(0, 3),
    [divMatches]
  );

  // ── Last 3 completed results ──
  const recentResults = useMemo(() =>
    divResults
      .filter(m => m.result || m.winner)
      .sort((a, b) => { const da = parseDate(a.date), db = parseDate(b.date); return (da && db) ? db - da : 0; })
      .slice(0, 3),
    [divResults]
  );

  // ── Top 5 batters (by runs) ──
  const topBatters = useMemo(() =>
    [...battingRows].sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0)).slice(0, 5),
    [battingRows]
  );

  // ── Top 5 bowlers (by wickets) ──
  const topBowlers = useMemo(() =>
    [...bowlingRows].sort((a, b) => (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0)).slice(0, 5),
    [bowlingRows]
  );

  // ── Balance snapshot ──
  const balanceIssues = useMemo(() => {
    const filtered = divMatches.filter(m => {
      if (m.date && (m.date.startsWith('05/09') || m.date.startsWith('05/10'))) return false;
      return true;
    });

    const selfUmpiring = filtered.filter(m =>
      (m.umpire1 && (m.umpire1 === m.team1 || m.umpire1 === m.team2)) ||
      (m.umpire2 && (m.umpire2 === m.team1 || m.umpire2 === m.team2))
    ).length;

    const teamNames = [...new Set(filtered.flatMap(m => [m.team1, m.team2]).filter(Boolean))].sort();
    const stats = {};
    teamNames.forEach(t => { stats[t] = { am: 0, pm: 0 }; });
    filtered.forEach(m => {
      if (!stats[m.team1] || !stats[m.team2]) return;
      const am = isAM(m.time);
      if (am === true) { stats[m.team1].am++; stats[m.team2].am++; }
      else if (am === false) { stats[m.team1].pm++; stats[m.team2].pm++; }
    });

    const sorted = arr => [...arr].sort((a, b) => a - b);
    const median = arr => {
      if (!arr.length) return 0;
      const s = sorted(arr);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
    };

    const amVals = teamNames.map(t => stats[t].am);
    const pmVals = teamNames.map(t => stats[t].pm);
    const medAm = median(amVals);
    const medPm = median(pmVals);

    let ampmImbalance = 0;
    teamNames.forEach(t => {
      if (Math.abs(stats[t].am - medAm) >= 2) ampmImbalance++;
      if (Math.abs(stats[t].pm - medPm) >= 2) ampmImbalance++;
    });

    const groundGroups = {};
    filtered.forEach(m => {
      const key = `${m.date || '?'}|${m.time || '?'}|${m.ground || '?'}`;
      if (!groundGroups[key]) groundGroups[key] = [];
      groundGroups[key].push(m);
    });
    const groundConflicts = Object.values(groundGroups).filter(g => g.length >= 2).length;

    return { selfUmpiring, ampmImbalance, groundConflicts };
  }, [divMatches]);

  // ── Formatters ──
  const fmtDate = s => {
    const d = parseDate(s);
    if (!d) return s;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const hasResults = divResults.length > 0;

  return (
    <div>
      <style>{`
        .do-breadcrumb { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
        .do-breadcrumb-sep { color: var(--text-muted); }
        .do-header { margin-bottom: 20px; }
        .do-title { font-size: 22px; font-weight: 800; color: var(--text-primary); margin-bottom: 4px; }
        .do-stats { font-size: 13px; color: var(--text-secondary); }
        .do-section { margin-bottom: 20px; }
        .do-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .do-col { min-width: 0; }
        .do-card { background: var(--bg-100); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; }
        .do-match-row { padding: 8px 0; border-bottom: 1px solid var(--border); }
        .do-match-row:last-child { border-bottom: none; }
        .do-match-date { font-size: 12px; color: var(--text-muted); }
        .do-match-teams { font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 2px 0; }
        .do-match-ground { font-size: 11px; color: var(--text-muted); }
        .do-result-row { padding: 8px 0; border-bottom: 1px solid var(--border); }
        .do-result-row:last-child { border-bottom: none; }
        .do-result-winner { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .do-result-margin { font-size: 12px; color: var(--text-secondary); }
        .do-result-date { font-size: 11px; color: var(--text-muted); }
        .do-cta { display: block; text-align: right; font-size: 12px; font-weight: 600; color: var(--accent); margin-top: 10px; cursor: pointer; user-select: none; }
        .do-cta:hover { text-decoration: underline; }
        .do-balance { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; padding: 4px 0; }
        .do-balance-stat { text-align: center; }
        .do-balance-val { font-size: 22px; font-weight: 700; }
        .do-balance-lbl { font-size: 11px; color: var(--text-muted); }
        .do-balance-val.ok { color: var(--clr-ok); }
        .do-balance-val.warn { color: var(--clr-warn); }
        .do-balance-val.bad { color: var(--clr-bad); }
        @media (max-width: 640px) {
          .do-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── Breadcrumb ── */}
      <div className="do-breadcrumb">
        <span className="clickable" onClick={onAllDivisions}>All Divisions</span>
        <span className="do-breadcrumb-sep">→</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{division}</span>
      </div>

      {/* ── Division Header ── */}
      <div className="do-header">
        <div className="do-title">{division}</div>
        <div className="do-stats">
          {teams.length} Teams · {completedMatches} Played · {totalMatches} Scheduled
          {winLeaders.length > 0 && (
            <> · Win leader{winLeaders.length > 1 ? 's' : ''}: <strong>{winLeaders.join(', ')}</strong></>
          )}
        </div>
      </div>

      {/* ── Standings Snapshot ── */}
      {top4.length > 0 && (
        <div className="do-section">
          <div className="section-label">Standings</div>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>#</th>
                  <th>Team</th>
                  <th style={{ textAlign: 'center' }}>P</th>
                  <th style={{ textAlign: 'center' }}>W</th>
                  <th style={{ textAlign: 'center' }}>L</th>
                  <th style={{ textAlign: 'center' }}>PTS</th>
                  {hasResults && <th>Form</th>}
                </tr>
              </thead>
              <tbody>
                {top4.map((s, i) => (
                  <tr key={s.team}>
                    <td className="num-cell" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td className="team-name clickable" onClick={() => onDrilldown({ type: 'team', name: s.team })}>{s.team}</td>
                    <td className="num-cell">{s.played}</td>
                    <td className="num-cell">{s.won}</td>
                    <td className="num-cell">{s.lost}</td>
                    <td className="num-cell points-cell">{s.pts}</td>
                    {hasResults && (
                      <td><FormGuide results={data.results} team={s.team} division={division} played={s.played} /></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="do-cta" onClick={() => onTabClick('standings')}>Full Standings →</span>
        </div>
      )}

      {/* ── Next Matches + Recent Results ── */}
      <div className="do-section do-grid">
        <div className="do-col">
          <div className="section-label">Next Matches</div>
          <div className="do-card">
            {nextMatches.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>
                No upcoming matches
              </div>
            )}
            {nextMatches.map(m => (
              <div key={m.id} className="do-match-row">
                <div className="do-match-date">
                  {fmtDate(m.date)}
                  <span className={`badge ${isAM(m.time) ? 'badge-am' : 'badge-pm'}`} style={{ marginLeft: 8, fontSize: 10 }}>
                    {m.time || 'TBD'}
                  </span>
                </div>
                <div className="do-match-teams">
                  <span className="clickable" onClick={() => onDrilldown({ type: 'team', name: m.team1 })}>{m.team1}</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, margin: '0 6px' }}>vs</span>
                  <span className="clickable" onClick={() => onDrilldown({ type: 'team', name: m.team2 })}>{m.team2}</span>
                </div>
                {m.ground && <div className="do-match-ground">{m.ground}</div>}
              </div>
            ))}
          </div>
          <span className="do-cta" onClick={() => onTabClick('schedule')}>Full Schedule →</span>
        </div>

        <div className="do-col">
          <div className="section-label">Recent Results</div>
          <div className="do-card">
            {recentResults.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>
                No results yet
              </div>
            )}
            {recentResults.map(m => {
              const winner = m.winner || (m.team1Score?.won ? m.team1 : m.team2Score?.won ? m.team2 : null);
              return (
                <div key={m.id} className="do-result-row">
                  <div className="do-result-winner">
                    <span className="clickable" onClick={() => onDrilldown({ type: 'team', name: m.team1 })}>{m.team1}</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, margin: '0 4px' }}>vs</span>
                    <span className="clickable" onClick={() => onDrilldown({ type: 'team', name: m.team2 })}>{m.team2}</span>
                  </div>
                  <div className="do-result-margin">
                    {winner && <><strong>{winner}</strong> won</>}
                    {m.result ? ` · ${m.result.replace(/^.*? won by /, '')}` : ''}
                  </div>
                  <div className="do-result-date">{fmtDate(m.date)}</div>
                </div>
              );
            })}
          </div>
          <span className="do-cta" onClick={() => onTabClick('results')}>All Results →</span>
        </div>
      </div>

      {/* ── Top Batters + Top Bowlers ── */}
      <div className="do-section do-grid">
        <div className="do-col">
          <div className="section-label">Top Batters</div>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>#</th>
                  <th>Player</th>
                  <th className="mob-hide">Team</th>
                  <th style={{ textAlign: 'center' }}>Runs</th>
                  <th style={{ textAlign: 'center' }}>Avg</th>
                </tr>
              </thead>
              <tbody>
                {topBatters.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>
                      No batting data
                    </td>
                  </tr>
                )}
                {topBatters.map((r, i) => (
                  <tr key={r.player + i}>
                    <td className="num-cell" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td className="team-name clickable" style={{ fontWeight: 500 }} onClick={() => onDrilldown({ type: 'player', name: r.player })}>{r.player}</td>
                    <td className="mob-hide" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.team}</td>
                    <td className="num-cell points-cell">{r.runs}</td>
                    <td className="num-cell">{r.avg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="do-cta" onClick={() => onTabClick('batting')}>Full Batting →</span>
        </div>

        <div className="do-col">
          <div className="section-label">Top Bowlers</div>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>#</th>
                  <th>Player</th>
                  <th className="mob-hide">Team</th>
                  <th style={{ textAlign: 'center' }}>Wkts</th>
                  <th style={{ textAlign: 'center' }}>Econ</th>
                </tr>
              </thead>
              <tbody>
                {topBowlers.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>
                      No bowling data
                    </td>
                  </tr>
                )}
                {topBowlers.map((r, i) => (
                  <tr key={r.player + i}>
                    <td className="num-cell" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td className="team-name clickable" style={{ fontWeight: 500 }} onClick={() => onDrilldown({ type: 'player', name: r.player })}>{r.player}</td>
                    <td className="mob-hide" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.team}</td>
                    <td className="num-cell points-cell">{r.wickets}</td>
                    <td className="num-cell">{Number(r.econ).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="do-cta" onClick={() => onTabClick('bowling')}>Full Bowling →</span>
        </div>
      </div>

      {/* ── Balance Snapshot ── */}
      <div className="do-section">
        <div className="section-label">Scheduling Balance</div>
        <div className="do-card">
          <div className="do-balance">
            <div className="do-balance-stat">
              <div className={`do-balance-val ${balanceIssues.selfUmpiring > 0 ? 'bad' : 'ok'}`}>
                {balanceIssues.selfUmpiring}
              </div>
              <div className="do-balance-lbl">Self-Umpiring</div>
            </div>
            <div className="do-balance-stat">
              <div className={`do-balance-val ${balanceIssues.ampmImbalance === 0 ? 'ok' : balanceIssues.ampmImbalance <= 3 ? 'warn' : 'bad'}`}>
                {balanceIssues.ampmImbalance}
              </div>
              <div className="do-balance-lbl">AM/PM Issues</div>
            </div>
            <div className="do-balance-stat">
              <div className={`do-balance-val ${balanceIssues.groundConflicts > 0 ? 'bad' : 'ok'}`}>
                {balanceIssues.groundConflicts}
              </div>
              <div className="do-balance-lbl">Ground Conflicts</div>
            </div>
          </div>
        </div>
        <span className="do-cta" onClick={() => onTabClick('balance')}>View Balance →</span>
      </div>
    </div>
  );
}
