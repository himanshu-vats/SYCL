import { useState } from 'react';
import SortableTh from './shared/SortableTh.jsx';
import LeaderSection from './shared/LeaderSection.jsx';
import { aggregateBatting } from '../utils/aggregation.js';
import { sortRows } from '../utils/form.js';

export default function BattingView({ batting, division, onDrilldown }) {
  const [sortCol, setSortCol] = useState('runs');
  const [sortDir, setSortDir] = useState('desc');
  const [teamFilter, setTeamFilter] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const isCombined = division === 'combined';

  if (!batting) return <div className="empty-state">No batting data. Use Sync All in admin to fetch.</div>;

  const raw = isCombined
    ? aggregateBatting(Object.entries(batting).filter(([k]) => k !== 'updatedAt' && k !== 'combined').flatMap(([,r]) => Array.isArray(r) ? r : []))
    : (batting[division] || []);

  if (!raw.length) return <div className="empty-state">No batting data for this division. Use Sync All in admin to fetch.</div>;

  const ts = batting?.updatedAt;
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
      <div className="section-label">Batting Leaders</div>
      <LeaderSection rows={raw} statKey="runs" label="Most Runs" onDrilldown={onDrilldown}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
        <LeaderSection rows={raw} statKey="fifties" label="Most 50s" onDrilldown={onDrilldown}/>
        <LeaderSection rows={raw} statKey="sixes" label="Most 6s" onDrilldown={onDrilldown}/>
      </div>
      <div className="section-label">All Batters</div>
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
            <Th col="mat" style={{textAlign:"center"}} title="Matches" className="mob-hide">Mat</Th>
            <Th col="inns" style={{textAlign:"center"}} title="Innings" className="mob-hide">Inns</Th>
            <Th col="no" style={{textAlign:"center"}} title="Not Out" className="mob-hide">NO</Th>
            <Th col="runs" style={{textAlign:"center"}} title="Runs" className="points-cell">Runs</Th>
            <Th col="fours" style={{textAlign:"center"}} title="Fours" className="mob-hide">4s</Th>
            <Th col="sixes" style={{textAlign:"center"}} title="Sixes" className="mob-hide">6s</Th>
            <Th col="fifties" style={{textAlign:"center"}} title="Fifties" className="mob-hide">50s</Th>
            <Th col="hundreds" style={{textAlign:"center"}} title="Hundreds" className="mob-hide">100s</Th>
            <Th col="hs" style={{textAlign:"center"}} title="Highest Score">HS</Th>
            <Th col="sr" style={{textAlign:"center"}} title="Strike Rate" className="mob-hide">SR</Th>
            <Th col="avg" style={{textAlign:"center"}} title="Average">Avg</Th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.player + i}>
                <td className="num-cell" style={{color:"var(--text-muted)"}}>{i+1}</td>
                <td className="team-name clickable" style={{fontWeight:500}} onClick={() => onDrilldown({type:'player',name:r.player})}>{r.player}</td>
                <td className="clickable" style={{fontSize:12,color:"var(--text-secondary)"}} onClick={() => onDrilldown({type:'team',name:r.team})}>{r.team}</td>
                <td className="num-cell mob-hide">{r.mat}</td>
                <td className="num-cell mob-hide">{r.inns}</td>
                <td className="num-cell mob-hide">{r.no}</td>
                <td className="num-cell points-cell">{r.runs}</td>
                <td className="num-cell mob-hide">{r.fours}</td>
                <td className="num-cell mob-hide">{r.sixes}</td>
                <td className="num-cell mob-hide">{r.fifties}</td>
                <td className="num-cell mob-hide">{r.hundreds}</td>
                <td className="num-cell">{r.hs}</td>
                <td className="num-cell mob-hide">{r.sr}</td>
                <td className="num-cell">{r.avg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
