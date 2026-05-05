import { isAM } from '../utils/schedule.js';

function median(arr) {
  const filtered = arr.filter(v => v !== undefined && v !== null);
  if (filtered.length === 0) return 0;
  const sorted = [...filtered].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function isUpcoming(dateStr) {
  if (!dateStr) return false;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return false;
  const m = parseInt(parts[0], 10);
  const d = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (!m || !d || !y) return false;
  return y * 10000 + m * 100 + d > 20260505;
}

export default function BalanceView({ matches, division }) {
  const filtered = matches.filter(m => {
    if (division !== 'combined' && m.division !== division) return false;
    return true;
  });

  const teamNames = [...new Set(filtered.flatMap(m => [m.team1, m.team2]))].sort();

  const stats = {};
  teamNames.forEach(t => {
    stats[t] = { home: 0, away: 0, am: 0, pm: 0, umpired: 0 };
  });

  filtered.forEach(m => {
    if (!stats[m.team1] || !stats[m.team2]) return;
    stats[m.team1].home++;
    stats[m.team2].away++;
    const am = isAM(m.time);
    if (am === true) {
      stats[m.team1].am++;
      stats[m.team2].am++;
    } else if (am === false) {
      stats[m.team1].pm++;
      stats[m.team2].pm++;
    }
    if (m.umpire1 && stats[m.umpire1]) stats[m.umpire1].umpired++;
    if (m.umpire2 && stats[m.umpire2]) stats[m.umpire2].umpired++;
  });

  const totalInScope = matches.filter(m => division === 'combined' || m.division === division).length;
  const completed = filtered.filter(m => m.result || m.winner || m.status === 'completed').length;
  const seasonPct = totalInScope > 0 ? completed / totalInScope : 0;

  const homeVals = teamNames.map(t => stats[t].home);
  const awayVals = teamNames.map(t => stats[t].away);
  const amVals = teamNames.map(t => stats[t].am);
  const pmVals = teamNames.map(t => stats[t].pm);
  const umpVals = teamNames.map(t => stats[t].umpired);
  const medAm = median(amVals);
  const medPm = median(pmVals);
  const medUmp = median(umpVals);

  // Issues: Self-Umpiring
  const selfUmpiring = filtered.filter(m =>
    isUpcoming(m.date) && (
      (m.umpire1 && (m.umpire1 === m.team1 || m.umpire1 === m.team2)) ||
      (m.umpire2 && (m.umpire2 === m.team1 || m.umpire2 === m.team2))
    )
  );

  // Issues: AM/PM Imbalance
  const ampmIssues = [];
  teamNames.forEach(t => {
    const s = stats[t];
    const amDiff = Math.abs(s.am - medAm);
    const pmDiff = Math.abs(s.pm - medPm);
    if (amDiff >= 2) ampmIssues.push({ team: t, type: 'AM', count: s.am, median: medAm, severity: 'red' });
    else if (amDiff > 1) ampmIssues.push({ team: t, type: 'AM', count: s.am, median: medAm, severity: 'amber' });
    if (pmDiff >= 2) ampmIssues.push({ team: t, type: 'PM', count: s.pm, median: medPm, severity: 'red' });
    else if (pmDiff > 1) ampmIssues.push({ team: t, type: 'PM', count: s.pm, median: medPm, severity: 'amber' });
  });

  // Issues: Ground Conflicts (full unfiltered matches)
  const groundGroups = {};
  matches.forEach(m => {
    const key = `${m.date || '?'}|${m.time || '?'}|${m.ground || '?'}`;
    if (!groundGroups[key]) groundGroups[key] = [];
    groundGroups[key].push(m);
  });
  const groundConflicts = Object.values(groundGroups).filter(g => g.length >= 2 && g.some(m => isUpcoming(m.date)));

  // Cell flagging
  const haStyle = (team, side) => {
    const diff = Math.abs(stats[team].home - stats[team].away);
    if (diff >= 3) return { background: 'var(--badge-bad-bg)', color: 'var(--badge-bad-fg)' };
    if (diff >= 2) return { background: 'var(--badge-warn-bg)', color: 'var(--badge-warn-fg)' };
    return {};
  };

  const ampmStyle = (team, type) => {
    const val = type === 'am' ? stats[team].am : stats[team].pm;
    const med = type === 'am' ? medAm : medPm;
    const diff = Math.abs(val - med);
    if (diff >= 2) return { background: 'var(--badge-bad-bg)', color: 'var(--badge-bad-fg)' };
    if (diff > 1) return { background: 'var(--badge-warn-bg)', color: 'var(--badge-warn-fg)' };
    return {};
  };

  const umpStyle = (team) => {
    const val = stats[team].umpired;
    if (val === 0 && seasonPct > 0.5) return { background: 'var(--badge-bad-bg)', color: 'var(--badge-bad-fg)' };
    const diff = val - medUmp;
    if (diff >= 2) return { background: 'var(--badge-bad-bg)', color: 'var(--badge-bad-fg)' };
    if (diff > 1) return { background: 'var(--badge-warn-bg)', color: 'var(--badge-warn-fg)' };
    return {};
  };

  return (
    <div>
      <style>{`
        .bv-issue-section { margin-bottom: 20px; }
        .bv-issue-header {
          font-size: 13px; font-weight: 700; color: var(--text-primary);
          margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
        }
        .bv-issue-count {
          background: var(--bg-200); color: var(--text-muted);
          font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 600;
        }
        .bv-conflict-card {
          background: var(--bg-100); border: 1px solid var(--border);
          border-radius: 8px; padding: 12px 14px; margin-bottom: 8px;
        }
        .bv-conflict-matches {
          display: flex; flex-direction: column; gap: 3px; margin-top: 6px;
        }
        .bv-conflict-match { font-size: 12px; color: var(--text-secondary); }
        .bv-ok { text-align: center; padding: 32px; color: var(--clr-ok); font-size: 14px; font-weight: 600; }
      `}</style>

      {filtered.length === 0 && (
        <div className="empty-state">No matches found for this view.</div>
      )}

      {filtered.length > 0 && (
        <>
          <div className="section-label">Balance Table</div>
          <div className="scroll-x" style={{ marginBottom: 24 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>#</th>
                  <th>Team</th>
                  <th className="num-cell">Home</th>
                  <th className="num-cell">Away</th>
                  <th className="num-cell">AM</th>
                  <th className="num-cell">PM</th>
                  <th className="num-cell">Umpired</th>
                </tr>
              </thead>
              <tbody>
                {teamNames.map((t, i) => (
                  <tr key={t}>
                    <td className="num-cell" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td className="team-name">{t}</td>
                    <td className="num-cell" style={haStyle(t, 'home')}>{stats[t].home}</td>
                    <td className="num-cell" style={haStyle(t, 'away')}>{stats[t].away}</td>
                    <td className="num-cell" style={ampmStyle(t, 'am')}>{stats[t].am}</td>
                    <td className="num-cell" style={ampmStyle(t, 'pm')}>{stats[t].pm}</td>
                    <td className="num-cell" style={umpStyle(t)}>{stats[t].umpired}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-label">Issues</div>

          {selfUmpiring.length === 0 && ampmIssues.length === 0 && groundConflicts.length === 0 && (
            <div className="bv-ok">✓ No issues detected</div>
          )}

          {selfUmpiring.length > 0 && (
            <div className="bv-issue-section">
              <div className="bv-issue-header">
                🔴 Self-Umpiring <span className="bv-issue-count">{selfUmpiring.length}</span>
              </div>
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Division</th>
                      <th>Match</th>
                      <th>Ground</th>
                      <th>Offending Umpire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selfUmpiring.map(m => {
                      const offenders = [m.umpire1, m.umpire2].filter(u =>
                        u && (u === m.team1 || u === m.team2)
                      );
                      return (
                        <tr key={m.id}>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.date}</td>
                          <td>
                            <span className="badge" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                              {m.division}
                            </span>
                          </td>
                          <td className="team-name">{m.team1} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs</span> {m.team2}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.ground || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--clr-bad)', fontWeight: 600 }}>
                            {offenders.join(', ')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {ampmIssues.length > 0 && (
            <div className="bv-issue-section">
              <div className="bv-issue-header">
                <span>
                  {ampmIssues.some(i => i.severity === 'red') ? '🔴' : '⚠️'} AM/PM Imbalance
                </span>
                <span className="bv-issue-count">{ampmIssues.length}</span>
              </div>
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>Slot</th>
                      <th className="num-cell">Count</th>
                      <th className="num-cell">Median</th>
                      <th className="num-cell">Deviation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ampmIssues.map((iss, i) => (
                      <tr key={`${iss.team}-${iss.type}-${i}`}>
                        <td className="team-name">{iss.team}</td>
                        <td>
                          <span className={`badge ${iss.type === 'AM' ? 'badge-am' : 'badge-pm'}`}>{iss.type}</span>
                        </td>
                        <td className="num-cell">{iss.count}</td>
                        <td className="num-cell" style={{ color: 'var(--text-muted)' }}>{iss.median}</td>
                        <td className="num-cell" style={{
                          color: iss.severity === 'red' ? 'var(--clr-bad)' : 'var(--clr-warn)',
                          fontWeight: 600
                        }}>
                          {iss.count > iss.median ? '+' : ''}{iss.count - iss.median}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {groundConflicts.length > 0 && (
            <div className="bv-issue-section">
              <div className="bv-issue-header">
                🔴 Ground Conflicts <span className="bv-issue-count">{groundConflicts.length}</span>
              </div>
              {groundConflicts.map((group, i) => (
                <div key={i} className="bv-conflict-card">
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {group[0].date} &middot; {group[0].time} &middot; {group[0].ground || 'Unknown Ground'}
                  </div>
                  <div className="bv-conflict-matches">
                    {group.map(m => (
                      <div key={m.id} className="bv-conflict-match">
                        <span className="badge" style={{
                          background: 'var(--accent-light)', color: 'var(--accent)',
                          marginRight: 8, fontSize: 10
                        }}>
                          {m.division}
                        </span>
                        {m.team1} vs {m.team2}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
