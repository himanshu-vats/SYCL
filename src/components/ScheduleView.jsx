import { useState } from 'react';
import { parseDate, isAM } from '../utils/schedule.js';

export default function ScheduleView({ matches, division, onDrilldown }) {
  const [teamFilter, setTeamFilter] = useState("");
  const [subTab, setSubTab] = useState("upcoming");
  const isCombined = division === 'combined';
  const dm = isCombined ? matches : matches.filter(m => m.division === division);
  const teams = [...new Set(dm.flatMap(m => [m.team1, m.team2]))].sort();
  const today = new Date(); today.setHours(0,0,0,0);

  const isUpcoming = m => { const d = parseDate(m.date); return !d || d >= today; };
  const matchesTeam = m => !teamFilter || m.team1 === teamFilter || m.team2 === teamFilter;
  const cmpAsc = (a,b) => {
    const da = parseDate(a.date), db = parseDate(b.date);
    if (da && db && da-db !== 0) return da-db;
    return (a.time||"").localeCompare(b.time||"");
  };

  const upcoming = dm.filter(m => matchesTeam(m) && isUpcoming(m)).sort(cmpAsc);
  const past     = dm.filter(m => matchesTeam(m) && !isUpcoming(m) && parseDate(m.date)).sort((a,b) => -cmpAsc(a,b));

  const groupByDate = ms => {
    const g = {};
    ms.forEach(m => { const k = m.date||"TBD"; if(!g[k]) g[k]=[]; g[k].push(m); });
    return Object.entries(g);
  };

  const matchRow = m => (
    <tr key={m.id}>
      <td className="num-cell mob-hide" style={{color:"var(--text-muted)",width:40}}>{m.id}</td>
      <td style={{width:80}}>
        <span className={`badge ${isAM(m.time)===true?"badge-am":isAM(m.time)===false?"badge-pm":""}`}>{m.time||"TBD"}</span>
      </td>
      <td className="team-name clickable" onClick={() => onDrilldown({type:'team',name:m.team1})}>{m.team1}</td>
      <td className="team-name clickable" onClick={() => onDrilldown({type:'team',name:m.team2})}>{m.team2}</td>
      <td className="mob-hide" style={{color:"var(--text-muted)",fontSize:12}}>{m.ground||"—"}</td>
      <td className="mob-hide" style={{color:"var(--text-muted)",fontSize:12}}>{m.umpire1||"—"}</td>
      <td style={{fontSize:12,color:m.result||m.winner?"var(--text-primary)":"var(--text-muted)"}}>{m.result||m.winner||"—"}</td>
    </tr>
  );

  const dateRows = (ms, isPast) => groupByDate(ms).flatMap(([date, grp]) => {
    const d = parseDate(date);
    return [
      <tr key={`h-${date}-${isPast}`}>
        <td colSpan={7} className="date-group">
          {date}{d && ` · ${d.toLocaleDateString("en-US",{weekday:"long"})}`}
          {isPast && <span style={{marginLeft:8,opacity:0.6}}>played</span>}
        </td>
      </tr>,
      ...grp.map(matchRow)
    ];
  });

  const visibleRows = subTab === "upcoming" ? upcoming : past;

  function shareOnWhatsApp() {
    const list = subTab === "upcoming" ? upcoming : past;
    if (!list.length) return;
    const label = subTab === "upcoming" ? "Upcoming Fixtures" : "Past Fixtures";
    let text = `🏏 SYCL — ${division}\n${label}\n\n`;
    const grouped = groupByDate(list);
    grouped.forEach(([date, grp]) => {
      const d = parseDate(date);
      const dayLabel = d
        ? d.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" })
        : date || "TBD";
      text += `📅 ${dayLabel}\n`;
      grp.forEach(m => {
        const time = m.time ? `⏰ ${m.time}  ` : "";
        const ground = m.ground ? `  📍 ${m.ground}` : "";
        text += `  ${time}${m.team1} vs ${m.team2}${ground}\n`;
      });
      text += "\n";
    });
    text = text.trimEnd() + "\n\n🔗 " + window.location.origin;
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
  }

  return (
    <div>
      <div className="sub-tab-bar" style={{display:"flex",alignItems:"center",gap:6}}>
        <button className={`sub-tab-btn ${subTab==="upcoming"?"active":""}`} onClick={()=>setSubTab("upcoming")}>
          Upcoming <span className="sub-count">{upcoming.length}</span>
        </button>
        <button className={`sub-tab-btn ${subTab==="past"?"active":""}`} onClick={()=>setSubTab("past")}>
          Past <span className="sub-count">{past.length}</span>
        </button>
        <div style={{flex:1}}/>
        {visibleRows.length > 0 && (
          <button onClick={shareOnWhatsApp} style={{
            display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",
            background:"#25D366",color:"#fff",border:"none",borderRadius:7,
            fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0,
            boxShadow:"0 1px 4px rgba(37,211,102,0.35)",transition:"background 0.12s"
          }}
            onMouseEnter={e=>e.currentTarget.style.background="#1ebe5d"}
            onMouseLeave={e=>e.currentTarget.style.background="#25D366"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Share
          </button>
        )}
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
        <span style={{fontSize:11,color:"var(--text-muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>Team</span>
        <select className="team-select" value={teamFilter} onChange={e=>setTeamFilter(e.target.value)}>
          <option value="">All teams</option>
          {teams.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        {teamFilter && <button className="small-btn" onClick={()=>setTeamFilter("")}>✕</button>}
      </div>
      <div className="insight-callout"><span className="insight-callout-icon">💡</span><span>Click any <strong>player name</strong> to see full stats, milestones &amp; insights · Click any <strong>team name</strong> to see team profile</span></div>
      <div className="scroll-x">
        <table>
          <thead><tr>
            <th className="mob-hide">#</th><th>Time</th><th>Home</th><th>Away</th>
            <th className="mob-hide">Ground</th><th className="mob-hide">Umpire</th><th>Result</th>
          </tr></thead>
          <tbody>
            {visibleRows.length===0 && (
              <tr><td colSpan={7} className="empty-state">No matches found.</td></tr>
            )}
            {dateRows(visibleRows, subTab === "past")}
          </tbody>
        </table>
      </div>
    </div>
  );
}
