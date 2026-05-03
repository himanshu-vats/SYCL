import { useState } from 'react';
import SortableTh from './shared/SortableTh.jsx';
import FormGuide from './shared/FormGuide.jsx';
import StreakBadge from './shared/StreakBadge.jsx';
import { RANK_CLASS, RANK_MEDAL } from '../constants.js';
import { computeStandings } from '../utils/standings.js';
import { sortRows } from '../utils/form.js';

export default function StandingsView({ matches, division, standings, results, onDrilldown }) {
  const [sortCol, setSortCol] = useState('pts');
  const [sortDir, setSortDir] = useState('desc');
  const [filter, setFilter] = useState('');

  const ccRows = standings?.[division]?.rows;
  const ts = standings?.[division]?.updatedAt;
  function toggleSort(col) { sortCol === col ? setSortDir(d => d==='asc'?'desc':'asc') : (setSortCol(col), setSortDir('asc')); }
  const Th = (p) => <SortableTh sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} {...p}/>;

  const hasResults = results?.matches?.some(m => m.division === division);

  if (ccRows?.length > 0) {
    const q = filter.toLowerCase();
    const raw = filter ? ccRows.filter(s => s.team?.toLowerCase().includes(q)) : ccRows;
    const rows = sortRows(raw, sortCol, sortDir);
    const leader = rows[0];
    return (
      <div>
        {leader && (
          <div className="leader-row">
            <div className="leader-card gold">
              <div className="leader-label"><span className="leader-medal">🏆</span>Division Leader</div>
              <div className="leader-stat">{leader.pts} pts</div>
              <div className="leader-name clickable" onClick={() => onDrilldown({type:'team',name:leader.team})}>{leader.team}</div>
              <div className="leader-sub">{leader.won}W · {leader.lost}L{leader.nr>0?` · ${leader.nr}NR`:''} · Win% {leader.winPct}</div>
              {hasResults && <div style={{marginTop:10}}><FormGuide results={results} team={leader.team}/></div>}
              <div className="leader-bar"><div className="leader-bar-fill" style={{width:'100%'}}></div></div>
            </div>
            {rows[1] && <div className="leader-card silver">
              <div className="leader-label"><span className="leader-medal">🥈</span>2nd Place</div>
              <div className="leader-stat">{rows[1].pts} pts</div>
              <div className="leader-name clickable" onClick={() => onDrilldown({type:'team',name:rows[1].team})}>{rows[1].team}</div>
              <div className="leader-sub">{rows[1].won}W · {rows[1].lost}L · {leader.pts - rows[1].pts} pts behind</div>
              {hasResults && <div style={{marginTop:10}}><FormGuide results={results} team={rows[1].team}/></div>}
              <div className="leader-bar"><div className="leader-bar-fill" style={{width:`${(rows[1].pts/leader.pts)*100}%`}}></div></div>
            </div>}
            {rows[2] && <div className="leader-card bronze">
              <div className="leader-label"><span className="leader-medal">🥉</span>3rd Place</div>
              <div className="leader-stat">{rows[2].pts} pts</div>
              <div className="leader-name clickable" onClick={() => onDrilldown({type:'team',name:rows[2].team})}>{rows[2].team}</div>
              <div className="leader-sub">{rows[2].won}W · {rows[2].lost}L · {leader.pts - rows[2].pts} pts behind</div>
              {hasResults && <div style={{marginTop:10}}><FormGuide results={results} team={rows[2].team}/></div>}
              <div className="leader-bar"><div className="leader-bar-fill" style={{width:`${(rows[2].pts/leader.pts)*100}%`}}></div></div>
            </div>}
          </div>
        )}
        <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>
          Source: CricClubs · Updated {new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} at {new Date(ts).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
          <input type="text" placeholder="Filter team…" value={filter} onChange={e=>setFilter(e.target.value)}
            style={{padding:'4px 10px',fontSize:12,border:'1.5px solid var(--border)',borderRadius:6,background:'var(--bg-100)',color:'var(--text-primary)',width:170,outline:'none'}}/>
          {filter && <button className="small-btn" onClick={()=>setFilter('')}>✕</button>}
        </div>
        <div className="scroll-x">
          <table>
            <thead><tr>
              <th style={{width:32}}>#</th>
              <Th col="team">Team</Th>
              <Th col="played" style={{textAlign:"center"}} title="Matches played">P</Th>
              <Th col="won" style={{textAlign:"center"}} title="Wins">W</Th>
              <Th col="lost" style={{textAlign:"center"}} title="Losses">L</Th>
              <Th col="nr" style={{textAlign:"center"}} title="No result" className="mob-hide">N/R</Th>
              <Th col="pts" style={{textAlign:"center"}} title="Points">Pts</Th>
              <Th col="nrr" style={{textAlign:"center"}} title="Net Run Rate" className="mob-hide">NRR</Th>
              <Th col="winPct" style={{textAlign:"center"}} title="Win percentage" className="mob-hide">Win%</Th>
              {hasResults && <th title="Last 5 results">Form</th>}
              {hasResults && <th title="Current streak" className="mob-hide">Streak</th>}
            </tr></thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.team}>
                  <td className="num-cell" style={{
                    color: i===0?"#c9a227":i===1?"#8e8e8e":i===2?"#a0785a":"var(--text-muted)",
                    fontWeight: i<3?800:undefined
                  }}>{i+1}</td>
                  <td className="team-name clickable" onClick={() => onDrilldown({type:'team',name:s.team})}>{s.team}</td>
                  <td className="num-cell">{s.played}</td>
                  <td className="num-cell">{s.won}</td>
                  <td className="num-cell">{s.lost}</td>
                  <td className="num-cell mob-hide">{s.nr}</td>
                  <td className="num-cell points-cell">{s.pts}</td>
                  <td className="num-cell mob-hide" style={{fontWeight:600}}>{s.nrr}</td>
                  <td className="num-cell mob-hide">{s.winPct}</td>
                  {hasResults && <td><FormGuide results={results} team={s.team}/></td>}
                  {hasResults && <td className="mob-hide"><StreakBadge results={results} team={s.team}/></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const dm = matches.filter(m => m.division === division);
  const teams = [...new Set(dm.flatMap(m => [m.team1, m.team2]))].sort();
  const computed = computeStandings(dm, teams);
  if (!computed.some(s => s.played > 0)) return (
    <div className="empty-state">No results recorded yet for this division.</div>
  );
  const rows2 = sortRows(computed, sortCol === 'pts' ? 'points' : sortCol, sortDir);
  const leader2 = rows2[0];
  return (
    <div>
      {leader2 && leader2.points > 0 && (
        <div className="leader-row">
          {rows2.filter(s => s.points > 0).slice(0,3).map((s, i) => (
            <div key={s.team} className={`leader-card ${RANK_CLASS[i]}`}>
              <div className="leader-label"><span className="leader-medal">{RANK_MEDAL[i]}</span>{i===0?'Leader':`${i+1}${['','st','nd','rd'][i+1]||'th'} Place`}</div>
              <div className="leader-stat">{s.points} pts</div>
              <div className="leader-name">{s.team}</div>
              <div className="leader-sub">{s.won}W · {s.lost}L</div>
              <div className="leader-bar"><div className="leader-bar-fill" style={{width:`${(s.points/(leader2.points||1))*100}%`}}></div></div>
            </div>
          ))}
        </div>
      )}
      <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:10}}>
        Computed from match results — sync from CricClubs for official standings with NRR
      </div>
      <div className="scroll-x">
        <table>
          <thead><tr>
            <th style={{width:32}}>#</th>
            <Th col="team">Team</Th>
            <Th col="played" style={{textAlign:"center"}}>P</Th>
            <Th col="won" style={{textAlign:"center"}}>W</Th>
            <Th col="lost" style={{textAlign:"center"}}>L</Th>
            <Th col="abandoned" style={{textAlign:"center"}}>Abd</Th>
            <Th col="forfeited" style={{textAlign:"center"}}>Fft</Th>
            <Th col="points" style={{textAlign:"center"}}>Pts</Th>
          </tr></thead>
          <tbody>
            {rows2.map((s, i) => (
              <tr key={s.team}>
                <td className="num-cell" style={{color:"var(--text-muted)"}}>{i+1}</td>
                <td className="team-name clickable" onClick={() => onDrilldown({type:'team',name:s.team})}>{s.team}</td>
                <td className="num-cell">{s.played}</td><td className="num-cell">{s.won}</td>
                <td className="num-cell">{s.lost}</td><td className="num-cell">{s.abandoned}</td>
                <td className="num-cell">{s.forfeited}</td>
                <td className="num-cell points-cell">{s.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
