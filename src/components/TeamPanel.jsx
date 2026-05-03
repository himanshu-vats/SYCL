import { aggregateBatting, aggregateBowling } from '../utils/aggregation.js';
import { parseDate } from '../utils/schedule.js';
import { computeFormGuide, computeStreak } from '../utils/form.js';

export default function TeamPanel({ name, matches, results, batting, bowling, onClose, onDrilldown }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const teamMatches = matches.filter(m => m.team1===name || m.team2===name);
  const upcoming = teamMatches
    .filter(m => { const d=parseDate(m.date); return !d||d>=today; })
    .sort((a,b) => { const da=parseDate(a.date),db=parseDate(b.date); return da&&db?da-db:0; });
  const teamResults = (results?.matches||[])
    .filter(m => m.team1===name || m.team2===name)
    .sort((a,b) => { const da=parseDate(a.date),db=parseDate(b.date); return da&&db?db-da:0; });

  const divs = [...new Set(teamMatches.map(m => m.division))];
  const form = computeFormGuide(results, name, 10);
  const streak = computeStreak(form);
  const wins = form.filter(f=>f==='W').length;
  const losses = form.filter(f=>f==='L').length;
  const abds = form.filter(f=>f==='A').length;

  const teamBatRows = batting
    ? Object.entries(batting).filter(([k]) => k!=='updatedAt'&&k!=='combined')
        .flatMap(([,rows]) => Array.isArray(rows) ? rows.filter(r => r.team===name) : [])
    : [];
  const topBatters = aggregateBatting(teamBatRows).sort((a,b) => (Number(b.runs)||0)-(Number(a.runs)||0)).slice(0,5);

  const teamBowlRows = bowling
    ? Object.entries(bowling).filter(([k]) => k!=='updatedAt'&&k!=='combined')
        .flatMap(([,rows]) => Array.isArray(rows) ? rows.filter(r => r.team===name) : [])
    : [];
  const topBowlers = aggregateBowling(teamBowlRows).sort((a,b) => (Number(b.wickets)||0)-(Number(a.wickets)||0)).slice(0,5);

  return (
    <div className="panel-content">
      <div className="panel-header">
        <div>
          <div className="panel-title">{name}</div>
          <div className="panel-sub">{divs.join(', ')}</div>
        </div>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>

      {form.length > 0 && <>
        <div className="section-label">Season Record</div>
        <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
          <div className="form-guide">{form.map((c,i) => <span key={i} className={`fd fd-${c}`}>{c}</span>)}</div>
          {streak && <span className={`streak-badge streak-${streak.code}`}>{streak.code}{streak.count}</span>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:20}}>
          <div className="stat-tile"><div className="stat-tile-val" style={{color:'#17bf63'}}>{wins}</div><div className="stat-tile-lbl">Won</div></div>
          <div className="stat-tile"><div className="stat-tile-val" style={{color:'#e0245e'}}>{losses}</div><div className="stat-tile-lbl">Lost</div></div>
          <div className="stat-tile"><div className="stat-tile-val" style={{color:'#f0a500'}}>{abds}</div><div className="stat-tile-lbl">Abd</div></div>
        </div>
      </>}

      {topBatters.length > 0 && <>
        <div className="section-label">Top Batters</div>
        <div style={{marginBottom:20}}>
          {topBatters.map((r,i) => (
            <div key={i} className="result-row" style={{cursor:'pointer'}} onClick={() => onDrilldown({type:'player',name:r.player})}>
              <span style={{fontSize:12,fontWeight:800,color:'var(--text-muted)',width:18,textAlign:'center',flexShrink:0}}>{i+1}</span>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:'var(--accent)'}}>{r.player}</div></div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontWeight:800,fontSize:15,fontFamily:"'JetBrains Mono',monospace"}}>{r.runs}</div>
                <div style={{fontSize:10,color:'var(--text-muted)'}}>runs</div>
              </div>
            </div>
          ))}
        </div>
      </>}

      {topBowlers.length > 0 && <>
        <div className="section-label">Top Bowlers</div>
        <div style={{marginBottom:20}}>
          {topBowlers.map((r,i) => (
            <div key={i} className="result-row" style={{cursor:'pointer'}} onClick={() => onDrilldown({type:'player',name:r.player})}>
              <span style={{fontSize:12,fontWeight:800,color:'var(--text-muted)',width:18,textAlign:'center',flexShrink:0}}>{i+1}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13,color:'var(--accent)'}}>{r.player}</div>
                {r.econ !== '—' && <div style={{fontSize:11,color:'var(--text-muted)'}}>Econ {r.econ}</div>}
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontWeight:800,fontSize:15,fontFamily:"'JetBrains Mono',monospace"}}>{r.wickets}</div>
                <div style={{fontSize:10,color:'var(--text-muted)'}}>wkts</div>
              </div>
            </div>
          ))}
        </div>
      </>}

      {upcoming.length > 0 && <>
        <div className="section-label">Upcoming Fixtures</div>
        <div style={{marginBottom:20}}>
          {upcoming.slice(0,5).map((m,i) => {
            const opp = m.team1===name ? m.team2 : m.team1;
            const home = m.team1===name;
            const d = parseDate(m.date);
            return (
              <div key={i} className="fixture-row">
                <div style={{textAlign:'center',flexShrink:0,minWidth:36}}>
                  <div style={{fontSize:16,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{d?d.getDate():'?'}</div>
                  <div style={{fontSize:9,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase'}}>{d?d.toLocaleDateString('en-US',{month:'short'}):''}</div>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13}}>
                    <span style={{color:'var(--text-muted)',fontSize:10,marginRight:4}}>{home?'vs':'@'}</span>
                    <span className="clickable" onClick={() => onDrilldown({type:'team',name:opp})}>{opp}</span>
                  </div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{m.time||'TBD'}{m.ground?` · ${m.ground}`:''}</div>
                </div>
              </div>
            );
          })}
        </div>
      </>}

      {teamResults.length > 0 && <>
        <div className="section-label">Recent Results</div>
        <div>
          {teamResults.slice(0,8).map((m,i) => {
            const myScore = m.team1===name ? m.team1Score : m.team2Score;
            const r = (m.result||'').toLowerCase();
            const code = r.includes('abandon')||r.includes('no result') ? 'A' : myScore?.won===true ? 'W' : myScore?.won===false ? 'L' : 'NR';
            const opp = m.team1===name ? m.team2 : m.team1;
            return (
              <div key={i} className="result-row">
                <span className={`fd fd-${code}`} style={{flexShrink:0}}>{code}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13}}>vs <span className="clickable" onClick={e=>{e.stopPropagation();onDrilldown({type:'team',name:opp});}}>{opp}</span></div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{m.date} · {m.result||'—'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </>}
    </div>
  );
}
