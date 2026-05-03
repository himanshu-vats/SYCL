import { useState } from 'react';
import SortableTh from './shared/SortableTh.jsx';
import LeaderSection from './shared/LeaderSection.jsx';
import { aggregateBowling } from '../utils/aggregation.js';
import { sortRows } from '../utils/form.js';

export default function BowlingView({ bowling, division, onDrilldown }) {
  const [sortCol, setSortCol] = useState('wickets');
  const [sortDir, setSortDir] = useState('desc');
  const [teamFilter, setTeamFilter] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const isCombined = division === 'combined';

  if (!bowling) return <div className="empty-state">No bowling data. Use Sync All in admin to fetch.</div>;

  const raw = isCombined
    ? aggregateBowling(Object.entries(bowling).filter(([k]) => k !== 'updatedAt' && k !== 'combined').flatMap(([,r]) => Array.isArray(r) ? r : []))
    : (bowling[division] || []);

  if (!raw.length) return <div className="empty-state">No bowling data for this division. Use Sync All in admin to fetch.</div>;

  const ts = bowling?.updatedAt;
  function toggleSort(col) { sortCol === col ? setSortDir(d => d==='asc'?'desc':'asc') : (setSortCol(col), setSortDir('asc')); }
  const teamOptions = [...new Set(raw.map(r => r.team).filter(Boolean))].sort();
  const filtered = raw.filter(r =>
    (!teamFilter || r.team===teamFilter) &&
    (!playerSearch || r.player?.toLowerCase().includes(playerSearch.toLowerCase()))
  );
  const rows = sortRows(filtered, sortCol, sortDir);
  const Th = (p) => <SortableTh sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} {...p}/>;
  return (
    <div>
      <div className="insight-callout"><span className="insight-callout-icon">💡</span><span>Click any <strong>player name</strong> to see full stats, milestones &amp; insights · Click any <strong>team name</strong> to see team profile</span></div>
      <div className="section-label">Bowling Leaders</div>
      <LeaderSection rows={raw} statKey="wickets" label="Most Wickets" onDrilldown={onDrilldown}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
        <LeaderSection rows={raw} statKey="econ" label="Best Economy" ascending={true} fmt={v => Number(v).toFixed(2)} onDrilldown={onDrilldown}/>
        <LeaderSection rows={raw} statKey="fiveW" label="5-Wicket Hauls" onDrilldown={onDrilldown}/>
      </div>
      <div className="section-label">All Bowlers</div>
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
            <Th col="mat" style={{textAlign:"center"}} className="mob-hide">Mat</Th>
            <Th col="overs" style={{textAlign:"center"}} className="mob-hide">Ovs</Th>
            <Th col="runs" style={{textAlign:"center"}} className="mob-hide">Runs</Th>
            <Th col="wickets" style={{textAlign:"center"}} className="points-cell">Wkts</Th>
            <Th col="bbf" style={{textAlign:"center"}}>BBF</Th>
            <Th col="maidens" style={{textAlign:"center"}} className="mob-hide">Mdns</Th>
            <Th col="dots" style={{textAlign:"center"}} className="mob-hide">Dots</Th>
            <Th col="econ" style={{textAlign:"center"}}>Econ</Th>
            <Th col="avg" style={{textAlign:"center"}} className="mob-hide">Avg</Th>
            <Th col="sr" style={{textAlign:"center"}} className="mob-hide">SR</Th>
            <Th col="fiveW" style={{textAlign:"center"}} className="mob-hide">5W</Th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.player + i}>
                <td className="num-cell" style={{color:"var(--text-muted)"}}>{i+1}</td>
                <td className="team-name clickable" style={{fontWeight:500}} onClick={() => onDrilldown({type:'player',name:r.player})}>{r.player}</td>
                <td className="clickable" style={{fontSize:12,color:"var(--text-secondary)"}} onClick={() => onDrilldown({type:'team',name:r.team})}>{r.team}</td>
                <td className="num-cell mob-hide">{r.mat}</td>
                <td className="num-cell mob-hide">{r.overs}</td>
                <td className="num-cell mob-hide">{r.runs}</td>
                <td className="num-cell points-cell">{r.wickets}</td>
                <td className="num-cell" style={{fontWeight:600}}>{r.bbf}</td>
                <td className="num-cell mob-hide">{r.maidens}</td>
                <td className="num-cell mob-hide">{r.dots}</td>
                <td className="num-cell" style={{fontWeight:600}}>{r.econ}</td>
                <td className="num-cell mob-hide">{r.avg}</td>
                <td className="num-cell mob-hide">{r.sr}</td>
                <td className="num-cell mob-hide">{r.fiveW}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
