import { parseDate } from '../../utils/schedule.js';

export default function NextMatchCard({ matches, division }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const dm = division ? matches.filter(m => m.division === division) : matches;
  const cmp = (a, b) => { const da = parseDate(a.date), db = parseDate(b.date); if (da && db && da-db !== 0) return da-db; return (a.time||'').localeCompare(b.time||''); };
  const upcoming = dm.filter(m => { const d = parseDate(m.date); return !d || d >= today; }).sort(cmp);
  const next = upcoming[0];
  if (!next) return null;
  const d = parseDate(next.date);
  return (
    <div className="next-match-card">
      <div className="nmc-date-box">
        <div className="nmc-date-day">{d ? d.getDate() : '?'}</div>
        <div className="nmc-date-month">{d ? d.toLocaleDateString('en-US',{month:'short'}) : ''}</div>
      </div>
      <div className="nmc-body">
        <div className="nmc-label">Next Match{d ? ` · ${d.toLocaleDateString('en-US',{weekday:'long'})}` : ''}</div>
        <div className="nmc-teams">{next.team1} <span style={{opacity:0.55,fontWeight:400,fontSize:14}}>vs</span> {next.team2}</div>
        <div className="nmc-meta">
          {next.time && <span>⏰ {next.time}</span>}
          {next.ground && <span>📍 {next.ground}</span>}
        </div>
      </div>
      <div className="nmc-count">
        <div className="nmc-count-val">{upcoming.length}</div>
        <div className="nmc-count-lbl">Upcoming</div>
      </div>
    </div>
  );
}
