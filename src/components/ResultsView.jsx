import { useState } from 'react';
import SortableTh from './shared/SortableTh.jsx';
import ResultStrip from './shared/ResultStrip.jsx';
import { sortRows } from '../utils/form.js';

export default function ResultsView({ results, division, onDrilldown }) {
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [teamFilter, setTeamFilter] = useState('');
  const [divFilter, setDivFilter] = useState(() => (division && division !== 'combined') ? division : '');

  const matches = results?.matches || [];
  if (!matches.length) return (
    <div className="empty-state">No match results yet. Use the Sync All bookmarklet from the CricClubs Match Results page.</div>
  );

  const ts = results?.updatedAt;
  function toggleSort(col) { sortCol === col ? setSortDir(d => d==='asc'?'desc':'asc') : (setSortCol(col), setSortDir('asc')); }
  const teamOptions = [...new Set(matches.flatMap(m => [m.team1,m.team2]).filter(Boolean))].sort();
  const divOptions  = [...new Set(matches.map(m => m.division).filter(Boolean))].sort();
  const filtered = matches.filter(m =>
    (!teamFilter || m.team1===teamFilter || m.team2===teamFilter) &&
    (!divFilter  || m.division===divFilter)
  );
  const rows = sortRows(filtered, sortCol, sortDir);
  const Th = (p) => <SortableTh sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} {...p}/>;
  return (
    <div>
      <ResultStrip results={results}/>
      <div className="section-label">Match Results</div>
      {ts && <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>Source: CricClubs · Updated {new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>}
      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
        <select className="team-select" value={teamFilter} onChange={e=>setTeamFilter(e.target.value)}>
          <option value="">All Teams</option>
          {teamOptions.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <select className="team-select" value={divFilter} onChange={e=>setDivFilter(e.target.value)}>
          <option value="">All Divisions</option>
          {divOptions.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
        {(teamFilter||divFilter) && <button className="small-btn" onClick={()=>{setTeamFilter('');setDivFilter('');}}>✕</button>}
        <span style={{fontSize:11,color:"var(--text-muted)",marginLeft:"auto"}}>{rows.length} result{rows.length!==1?'s':''}</span>
      </div>
      <div className="insight-callout"><span className="insight-callout-icon">💡</span><span>Click any <strong>player name</strong> to see full stats, milestones &amp; insights · Click any <strong>team name</strong> to see team profile</span></div>
      <div className="scroll-x">
        <table>
          <thead><tr>
            <Th col="date" style={{whiteSpace:"nowrap"}}>Date</Th>
            <Th col="division" className="mob-hide">Division</Th>
            <Th col="team1">Home</Th>
            <Th col="team2">Away</Th>
            <th className="mob-hide">Score</th>
            <Th col="result">Result</Th>
            <th className="mob-hide"></th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.matchId || i}>
                <td style={{fontSize:12,color:"var(--text-muted)",whiteSpace:"nowrap"}}>{r.date}</td>
                <td className="mob-hide" style={{fontSize:11,color:"var(--text-secondary)"}}>{r.division}</td>
                <td className="team-name clickable" onClick={() => onDrilldown({type:'team',name:r.team1})}>
                  {r.team1}{r.team1Score?.won && <span style={{marginLeft:4,fontSize:8,color:"var(--clr-ok)"}}>●</span>}
                </td>
                <td className="team-name clickable" onClick={() => onDrilldown({type:'team',name:r.team2})}>
                  {r.team2}{r.team2Score?.won && <span style={{marginLeft:4,fontSize:8,color:"var(--clr-ok)"}}>●</span>}
                </td>
                <td className="mob-hide" style={{fontSize:12,whiteSpace:"nowrap",color:"var(--text-secondary)"}}>
                  {r.team1Score ? <span>{r.team1Score.score}{r.team1Score.overs && <span style={{fontSize:10,color:"var(--text-muted)"}}> ({r.team1Score.overs})</span>}</span> : null}
                  {r.team1Score && r.team2Score ? <span style={{color:"var(--text-muted)",margin:"0 4px"}}>·</span> : null}
                  {r.team2Score ? <span>{r.team2Score.score}{r.team2Score.overs && <span style={{fontSize:10,color:"var(--text-muted)"}}> ({r.team2Score.overs})</span>}</span> : null}
                  {!r.team1Score && !r.team2Score ? "—" : null}
                </td>
                <td style={{fontSize:12}}>{r.result}</td>
                <td className="mob-hide">{r.scorecard ? <a href={r.scorecard} target="_blank" rel="noopener" style={{fontSize:11,color:"var(--a-500)",whiteSpace:"nowrap"}}>Scorecard ↗</a> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
