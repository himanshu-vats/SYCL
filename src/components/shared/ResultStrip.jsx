import { parseDate } from '../../utils/schedule.js';

export default function ResultStrip({ results, division }) {
  const matches = (results?.matches || []).filter(m => !division || m.division === division);
  if (!matches.length) return null;
  let played = matches.length, wins = 0, abd = 0;
  matches.forEach(m => {
    const r = (m.result||'').toLowerCase();
    if (r.includes('abandon') || r.includes('no result')) abd++;
    else if (m.team1Score?.won || m.team2Score?.won) wins++;
  });
  const latest = [...matches].sort((a,b) => { const da=parseDate(a.date),db=parseDate(b.date); return da&&db?db-da:0; })[0];
  return (
    <div className="result-strip">
      <div className="rs-card"><div className="rs-val rs-played">{played}</div><div className="rs-lbl">Played</div></div>
      <div className="rs-card"><div className="rs-val rs-wins">{wins}</div><div className="rs-lbl">Completed</div></div>
      <div className="rs-card"><div className="rs-val rs-abd">{abd}</div><div className="rs-lbl">Abandoned</div></div>
      {latest && <div className="rs-card" style={{flex:3,textAlign:'left'}}>
        <div style={{fontSize:9.5,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:4}}>Latest Result</div>
        <div style={{fontWeight:700,fontSize:13}}>{latest.team1} v {latest.team2}</div>
        <div style={{fontSize:12,color:'var(--text-secondary)',marginTop:2}}>{latest.result||'—'}</div>
        <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{latest.date}{latest.division ? ` · ${latest.division}` : ''}</div>
      </div>}
    </div>
  );
}
