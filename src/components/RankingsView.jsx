import { useState } from 'react';
import SortableTh from './shared/SortableTh.jsx';
import { aggregateRankings } from '../utils/aggregation.js';
import { sortRows } from '../utils/form.js';

export default function RankingsView({ rankings, division, onDrilldown }) {
  const [sortCol, setSortCol] = useState('total');
  const [sortDir, setSortDir] = useState('desc');
  const [teamFilter, setTeamFilter] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const isCombined = division === 'combined';

  if (!rankings) return <div className="empty-state">No rankings data. Use Sync All in admin to fetch.</div>;

  const raw = isCombined
    ? aggregateRankings(Object.entries(rankings).filter(([k]) => k !== 'updatedAt' && k !== 'combined').flatMap(([,r]) => Array.isArray(r) ? r : []))
    : (rankings[division] || []);

  if (!raw.length) return <div className="empty-state">No rankings data for this division. Use Sync All in admin to fetch.</div>;

  const ts = rankings?.updatedAt;
  function toggleSort(col) { sortCol === col ? setSortDir(d => d==='asc'?'desc':'asc') : (setSortCol(col), setSortDir('asc')); }
  const teamOptions = [...new Set(raw.map(r => r.team).filter(Boolean))].sort();
  const top3 = [...raw].sort((a,b) => (Number(b.total)||0) - (Number(a.total)||0)).slice(0,3);
  const filtered = raw.filter(r =>
    (!teamFilter || r.team===teamFilter) &&
    (!playerSearch || r.player?.toLowerCase().includes(playerSearch.toLowerCase()))
  );
  const rows = sortRows(filtered, sortCol, sortDir);
  const Th = (p) => <SortableTh sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} {...p}/>;
  return (
    <div>
      {top3.length > 0 && (
        <div className="podium-row">
          {top3.map((r, i) => (
            <div key={r.player} className="podium-card" onClick={() => onDrilldown({type:'player', name:r.player})}>
              <div className="podium-medal">{['🥇','🥈','🥉'][i]}</div>
              <div className="podium-name">{r.player}</div>
              <div className="podium-team">{r.team}</div>
              <div className="podium-pts">{r.total} pts</div>
            </div>
          ))}
        </div>
      )}
      <div className="insight-callout"><span className="insight-callout-icon">💡</span><span>Click any <strong>player name</strong> to see full stats, milestones &amp; insights · Click any <strong>team name</strong> to see team profile</span></div>
      <div className="section-label">Full Rankings</div>
      {ts && <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>Source: CricClubs · Updated {new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>}
      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
        <select className="team-select" value={teamFilter} onChange={e=>{setTeamFilter(e.target.value);setPlayerSearch('');}}>
          <option value="">All Teams</option>
          {teamOptions.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <input className="player-search" type="text" placeholder="Search player…" value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)} />
        {(teamFilter||playerSearch) && <button className="small-btn" onClick={()=>{setTeamFilter('');setPlayerSearch('');}}>✕</button>}
        <span style={{fontSize:11,color:"var(--text-muted)",marginLeft:"auto"}}>{rows.length} players</span>
      </div>
      <div className="scroll-x">
        <table>
          <thead><tr>
            <th style={{width:32}}>#</th>
            <Th col="player">Player</Th>
            <Th col="team">Team</Th>
            <Th col="matches" style={{textAlign:"center"}} className="mob-hide">Mat</Th>
            <Th col="batting" style={{textAlign:"center"}} className="mob-hide">Bat Pts</Th>
            <Th col="bowling" style={{textAlign:"center"}} className="mob-hide">Bowl Pts</Th>
            <Th col="fielding" style={{textAlign:"center"}} className="mob-hide">Field Pts</Th>
            <Th col="mom" style={{textAlign:"center"}} className="mob-hide">POM Pts</Th>
            <Th col="total" style={{textAlign:"center"}} className="points-cell">Total</Th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.player + i}>
                <td className="num-cell" style={{color:"var(--text-muted)"}}>{i+1}</td>
                <td className="team-name clickable" style={{fontWeight:500}} onClick={() => onDrilldown({type:'player',name:r.player})}>{r.player}</td>
                <td className="clickable" style={{fontSize:12,color:"var(--text-secondary)"}} onClick={() => onDrilldown({type:'team',name:r.team})}>{r.team}</td>
                <td className="num-cell mob-hide">{r.matches}</td>
                <td className="num-cell mob-hide">{r.batting}</td>
                <td className="num-cell mob-hide">{r.bowling}</td>
                <td className="num-cell mob-hide">{r.fielding}</td>
                <td className="num-cell mob-hide">{r.mom}</td>
                <td className="num-cell points-cell">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
