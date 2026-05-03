import { aggregateBatting, aggregateBowling } from '../utils/aggregation.js';
import { parseDate } from '../utils/schedule.js';

export default function PlayerPanel({ name, batting, bowling, rankings, results, matches, onClose, onDrilldown }) {
  const batRows = batting
    ? Object.entries(batting).filter(([k]) => k !== 'updatedAt' && k !== 'combined')
        .flatMap(([div, rows]) => Array.isArray(rows) ? rows.filter(r => String(r.player||'').toLowerCase() === name.toLowerCase()).map(r => ({...r, _div:div})) : [])
    : [];
  const bowlRows = bowling
    ? Object.entries(bowling).filter(([k]) => k !== 'updatedAt' && k !== 'combined')
        .flatMap(([div, rows]) => Array.isArray(rows) ? rows.filter(r => String(r.player||'').toLowerCase() === name.toLowerCase()).map(r => ({...r, _div:div})) : [])
    : [];
  const rankRows = rankings
    ? Object.entries(rankings).filter(([k]) => k !== 'updatedAt' && k !== 'combined')
        .flatMap(([div, rows]) => Array.isArray(rows) ? rows.filter(r => String(r.player||'').toLowerCase() === name.toLowerCase()).map(r => ({...r, _div:div})) : [])
    : [];

  const teams = [...new Set([...batRows, ...bowlRows].map(r => r.team).filter(Boolean))];
  const divs  = [...new Set([...batRows, ...bowlRows].map(r => r._div).filter(Boolean))];

  const bat  = aggregateBatting(batRows)[0]  || null;
  const bowl = aggregateBowling(bowlRows)[0] || null;
  const rankTotals = rankRows.reduce((acc, r) => ({
    total: acc.total + (Number(r.total)||0), batting: acc.batting + (Number(r.batting)||0),
    bowling: acc.bowling + (Number(r.bowling)||0), mom: Math.max(acc.mom, Number(r.mom)||0),
  }), { total:0, batting:0, bowling:0, mom:0 });

  const teamResults = (results?.matches||[])
    .filter(m => teams.some(t => m.team1===t || m.team2===t))
    .sort((a,b) => { const da=parseDate(a.date),db=parseDate(b.date); return da&&db?db-da:0; })
    .slice(0, 8);

  if (!bat && !bowl && !rankRows.length) return (
    <div className="panel-content">
      <div className="panel-header">
        <div><div className="panel-title">{name}</div></div>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>
      <div className="empty-state">No stats found for this player.</div>
    </div>
  );

  return (
    <div className="panel-content">
      <div className="panel-header">
        <div>
          <div className="panel-title">{name}</div>
          <div className="panel-sub">
            {teams.map((t,i) => <span key={t}>{i>0?', ':''}<span className="clickable" onClick={() => onDrilldown({type:'team',name:t})}>{t}</span></span>)}
            {divs.length ? <span> · {divs.join(', ')}</span> : null}
          </div>
        </div>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>

      {bat && <>
        <div className="section-label">Batting — Season</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(68px,1fr))',gap:8,marginBottom:batRows.length>1?12:20}}>
          {[['Runs',bat.runs],['Avg',bat.avg],['SR',bat.sr],['50s',bat.fifties],['100s',bat.hundreds],['HS',bat.hs],['6s',bat.sixes]].map(([l,v]) => (
            <div key={l} className="stat-tile"><div className="stat-tile-val">{v??'—'}</div><div className="stat-tile-lbl">{l}</div></div>
          ))}
        </div>
        {batRows.length > 1 && (
          <div className="scroll-x" style={{marginBottom:20}}>
            <table><thead><tr><th>Division</th><th>Mat</th><th>Inns</th><th>Runs</th><th>Avg</th><th>SR</th><th>50s</th><th>HS</th></tr></thead>
              <tbody>{batRows.map((r,i) => <tr key={i}><td style={{fontSize:12}}>{r._div}</td><td className="num-cell">{r.mat}</td><td className="num-cell">{r.inns}</td><td className="num-cell">{r.runs}</td><td className="num-cell">{r.avg}</td><td className="num-cell">{r.sr}</td><td className="num-cell">{r.fifties}</td><td className="num-cell">{r.hs}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </>}

      {bowl && <>
        <div className="section-label">Bowling — Season</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(68px,1fr))',gap:8,marginBottom:bowlRows.length>1?12:20}}>
          {[['Wkts',bowl.wickets],['Econ',bowl.econ],['Avg',bowl.avg],['BBF',bowl.bbf],['5W',bowl.fiveW],['Mdns',bowl.maidens]].map(([l,v]) => (
            <div key={l} className="stat-tile"><div className="stat-tile-val">{v??'—'}</div><div className="stat-tile-lbl">{l}</div></div>
          ))}
        </div>
        {bowlRows.length > 1 && (
          <div className="scroll-x" style={{marginBottom:20}}>
            <table><thead><tr><th>Division</th><th>Mat</th><th>Ovs</th><th>Wkts</th><th>Runs</th><th>Econ</th><th>BBF</th></tr></thead>
              <tbody>{bowlRows.map((r,i) => <tr key={i}><td style={{fontSize:12}}>{r._div}</td><td className="num-cell">{r.mat}</td><td className="num-cell">{r.overs}</td><td className="num-cell">{r.wickets}</td><td className="num-cell">{r.runs}</td><td className="num-cell">{r.econ}</td><td className="num-cell">{r.bbf}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </>}

      {rankTotals.total > 0 && <>
        <div className="section-label">Rankings Points</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(68px,1fr))',gap:8,marginBottom:20}}>
          {[['Total',rankTotals.total],['Batting',rankTotals.batting],['Bowling',rankTotals.bowling],['POM',rankTotals.mom]].map(([l,v]) => (
            <div key={l} className="stat-tile"><div className="stat-tile-val">{v}</div><div className="stat-tile-lbl">{l}</div></div>
          ))}
        </div>
      </>}

      {teamResults.length > 0 && <>
        <div className="section-label">Team's Recent Matches</div>
        <div>
          {teamResults.map((m, i) => {
            const myScore = teams.includes(m.team1) ? m.team1Score : m.team2Score;
            const r = (m.result||'').toLowerCase();
            const code = r.includes('abandon')||r.includes('no result') ? 'A' : myScore?.won===true ? 'W' : myScore?.won===false ? 'L' : 'NR';
            return (
              <div key={i} className="result-row">
                <span className={`fd fd-${code}`} style={{flexShrink:0}}>{code}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.team1} <span style={{opacity:0.45,fontWeight:400}}>v</span> {m.team2}</div>
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
