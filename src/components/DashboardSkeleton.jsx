export default function DashboardSkeleton({ prefetch }) {
  const p = prefetch || {};
  const completion = p.matchCount
    ? Math.round((p.completedCount || 0) / p.matchCount * 100)
    : null;

  return (
    <div className="content-wrap dsk-wrap">
      {/* Season header */}
      <div className="dsk-header">
        <div>
          <div className="dsk-title">
            {p.leagueName && p.season
              ? `${p.leagueName} · ${p.season}`
              : <span className="dsk-shimmer" style={{width:200,height:22,display:'inline-block',borderRadius:6}} />
            }
          </div>
          {p.teamCount || p.matchCount ? (
            <div className="dsk-meta">
              {p.teamCount ? `${p.teamCount} Teams` : ''}
              {p.teamCount && p.matchCount ? ' · ' : ''}
              {p.matchCount ? `${p.matchCount} Matches` : ''}
            </div>
          ) : (
            <span className="dsk-shimmer" style={{width:160,height:14,display:'inline-block',borderRadius:4,marginTop:8}} />
          )}
        </div>
        <div className="dsk-loading-badge">
          <span className="dsk-spinner" />
          Loading season data…
        </div>
      </div>

      {/* Progress bar */}
      {completion !== null ? (
        <div className="dsk-progress-block">
          <div className="dsk-progress-meta">
            <span>Season Progress</span>
            <span>{completion}%</span>
          </div>
          <div className="dsk-progress-rail">
            <div className="dsk-progress-fill" style={{width:`${completion}%`}} />
          </div>
          <div className="dsk-progress-label">
            {p.completedCount || 0}/{p.matchCount} matches played
          </div>
        </div>
      ) : (
        <div className="dsk-shimmer" style={{height:6,borderRadius:4,margin:'16px 0 8px'}} />
      )}

      {/* Stat tiles */}
      <div className="dsk-stat-tiles">
        {[
          {label:'Teams', value: p.teamCount},
          {label:'Matches', value: p.matchCount},
          {label:'Completed', value: p.completedCount},
          {label:'Divisions', value: p.divisionCount},
        ].map(({label, value}) => (
          <div key={label} className="dsk-stat-tile">
            {value != null
              ? <div className="dsk-stat-val">{value}</div>
              : <div className="dsk-shimmer" style={{height:28,width:48,borderRadius:4,margin:'0 auto 4px'}} />
            }
            <div className="dsk-stat-lbl">{label}</div>
          </div>
        ))}
      </div>

      {/* Skeleton content cards */}
      <div className="dsk-cards">
        {[1,2,3].map(i => (
          <div key={i} className="dsk-card">
            <div className="dsk-shimmer" style={{height:16,width:'40%',borderRadius:4,marginBottom:12}} />
            <div className="dsk-shimmer" style={{height:12,width:'70%',borderRadius:4,marginBottom:8}} />
            <div className="dsk-shimmer" style={{height:12,width:'55%',borderRadius:4,marginBottom:8}} />
            <div className="dsk-shimmer" style={{height:12,width:'60%',borderRadius:4}} />
          </div>
        ))}
      </div>
    </div>
  );
}
