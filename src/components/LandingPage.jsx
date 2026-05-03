import { useState, useEffect } from 'react';

export default function LandingPage() {
  const [leagues, setLeagues] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leagues')
      .then(r => r.ok ? r.json() : {})
      .then(d => { setLeagues(d || {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const leagueList = Object.entries(leagues).map(([slug, meta]) => ({ slug, ...meta }));

  const groupedLeagues = {};
  leagueList.forEach(league => {
    const leagueName = league.name || 'Unknown';
    if (!groupedLeagues[leagueName]) groupedLeagues[leagueName] = [];
    groupedLeagues[leagueName].push(league);
  });
  Object.keys(groupedLeagues).forEach(name => {
    groupedLeagues[name].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  });

  const sortedLeagueNames = Object.keys(groupedLeagues).sort((a, b) => {
    const aLatest = new Date(groupedLeagues[a][0]?.updatedAt || 0);
    const bLatest = new Date(groupedLeagues[b][0]?.updatedAt || 0);
    return bLatest - aLatest;
  });

  const totals = leagueList.reduce((acc, l) => ({
    matches: acc.matches + (l.matchCount || 0),
    completed: acc.completed + (l.completedCount || 0),
    divisions: acc.divisions + (l.divisionCount || 0),
    teams: acc.teams + (l.teamCount || 0),
  }), { matches: 0, completed: 0, divisions: 0, teams: 0 });

  const now = new Date();
  const isRecent = (date) => (now - new Date(date)) < 7 * 24 * 60 * 60 * 1000;
  const formatTimeAgo = (date) => {
    if (!date) return '—';
    const ms = now - new Date(date);
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days/7)}w ago`;
    return new Date(date).toLocaleDateString('en-US', {month:'short', day:'numeric'});
  };

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-page)'}}>
      {!loading && leagueList.length > 0 && (
        <div className="landing-hero-stats">
          {[
            {label:'Leagues', value: sortedLeagueNames.length},
            {label:'Seasons', value: leagueList.length},
            {label:'Divisions', value: totals.divisions || '—'},
            {label:'Matches', value: totals.matches || '—'},
          ].map(stat => (
            <div key={stat.label} className="landing-hero-stat">
              <div style={{fontSize:'var(--text-xl)', fontWeight:'var(--weight-black)', color:'var(--text-primary)', lineHeight:1}}>
                {stat.value}
              </div>
              <div style={{fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:'var(--space-1)', textTransform:'uppercase', letterSpacing:'0.06em'}}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{maxWidth:1200, margin:'0 auto', padding:'var(--space-10) var(--space-6) var(--space-12)'}}>
        {loading ? (
          <div style={{textAlign:'center', color:'var(--text-muted)', padding:'var(--space-16) var(--space-4)', fontSize:'var(--text-base)'}}>
            Loading seasons…
          </div>
        ) : leagueList.length > 0 ? (
          <div>
            {sortedLeagueNames.map(leagueName => (
              <section key={leagueName} style={{marginBottom:'var(--space-12)'}}>
                <div style={{
                  display:'flex', alignItems:'baseline', justifyContent:'space-between',
                  paddingBottom:'var(--space-3)', marginBottom:'var(--space-5)',
                  borderBottom:'2px solid var(--border)'
                }}>
                  <h2 style={{fontSize:'var(--text-lg)', fontWeight:'var(--weight-black)', color:'var(--text-primary)', margin:0, letterSpacing:'-0.01em'}}>
                    {leagueName}
                  </h2>
                  <div style={{fontSize:'var(--text-sm)', color:'var(--text-muted)', fontWeight:'var(--weight-medium)'}}>
                    {groupedLeagues[leagueName].length} {groupedLeagues[leagueName].length > 1 ? 'seasons' : 'season'}
                  </div>
                </div>

                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'var(--space-4)'}}>
                  {groupedLeagues[leagueName].map(league => {
                    const completion = league.matchCount
                      ? Math.round((league.completedCount || 0) / league.matchCount * 100)
                      : null;
                    const showStats = league.matchCount || league.divisionCount || league.teamCount;

                    return (
                      <a key={league.slug} href={`/${league.slug}`} style={{
                        display:'block', padding:'var(--space-5)',
                        background:'var(--bg-100)',
                        border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
                        textDecoration:'none', color:'var(--text-primary)',
                        transition:'all 0.2s ease',
                        position:'relative', overflow:'hidden'
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.borderColor='var(--accent)';
                        e.currentTarget.style.transform='translateY(-2px)';
                        e.currentTarget.style.boxShadow='var(--shadow-md)';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.borderColor='var(--border)';
                        e.currentTarget.style.transform='translateY(0)';
                        e.currentTarget.style.boxShadow='none';
                      }}>
                        <div style={{position:'absolute', top:0, left:0, right:0, height:3, background:'var(--header-bg)'}} />
                        <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'var(--space-3)', marginBottom:'var(--space-4)', marginTop:'var(--space-1)'}}>
                          <div>
                            <div style={{fontSize:'var(--text-md)', fontWeight:'var(--weight-bold)', color:'var(--text-primary)', lineHeight:'var(--leading-tight)'}}>
                              {league.season || 'Season'}
                            </div>
                            <div style={{fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:'var(--space-1)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:'var(--weight-semibold)'}}>
                              Updated {formatTimeAgo(league.updatedAt)}
                            </div>
                          </div>
                          {isRecent(league.updatedAt) && (
                            <span style={{background:'var(--clr-ok)', color:'var(--bg-100)', fontSize:'var(--text-xs)', fontWeight:'var(--weight-bold)', padding:'2px 8px', borderRadius:'var(--radius-pill)', letterSpacing:'0.04em', flexShrink:0}}>NEW</span>
                          )}
                        </div>

                        {showStats ? (
                          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'var(--space-3)', padding:'var(--space-3) 0', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)', marginBottom:'var(--space-3)'}}>
                            {[['Divisions', league.divisionCount], ['Teams', league.teamCount], ['Matches', league.matchCount]].map(([lbl, val]) => (
                              <div key={lbl}>
                                <div style={{fontSize:'var(--text-md)', fontWeight:'var(--weight-bold)', color:'var(--accent)', lineHeight:1}}>{val || '—'}</div>
                                <div style={{fontSize:10, color:'var(--text-muted)', marginTop:2, textTransform:'uppercase', letterSpacing:'0.05em'}}>{lbl}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{fontSize:'var(--text-sm)', color:'var(--text-muted)', padding:'var(--space-2) 0', marginBottom:'var(--space-3)', fontStyle:'italic'}}>
                            Re-sync from /admin to see stats
                          </div>
                        )}

                        {completion !== null && (
                          <div style={{marginBottom:'var(--space-3)'}}>
                            <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--text-xs)', color:'var(--text-secondary)', marginBottom:'var(--space-1)'}}>
                              <span>Season Progress</span>
                              <span style={{fontWeight:'var(--weight-semibold)'}}>{completion}%</span>
                            </div>
                            <div style={{height:6, background:'var(--bg-300)', borderRadius:'var(--radius-pill)', overflow:'hidden'}}>
                              <div style={{height:'100%', width:`${completion}%`, background: completion === 100 ? 'var(--clr-ok)' : 'var(--accent)', borderRadius:'var(--radius-pill)', transition:'width 0.5s ease'}} />
                            </div>
                          </div>
                        )}

                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'var(--text-sm)', color:'var(--accent)', fontWeight:'var(--weight-semibold)', paddingTop:'var(--space-2)'}}>
                          <span>View season analysis</span>
                          <span>→</span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div style={{maxWidth:560, margin:'var(--space-12) auto', background:'var(--bg-100)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'var(--space-10)', textAlign:'center'}}>
            <div style={{fontSize:48, marginBottom:'var(--space-4)'}}>🏏</div>
            <h2 style={{fontSize:'var(--text-lg)', fontWeight:'var(--weight-bold)', color:'var(--text-primary)', margin:'0 0 var(--space-3) 0'}}>
              No leagues synced yet
            </h2>
            <p style={{fontSize:'var(--text-base)', color:'var(--text-secondary)', margin:'0 0 var(--space-6) 0', lineHeight:'var(--leading-normal)'}}>
              Sync your first season from CricClubs to start analyzing player performance, team standings, and match results.
            </p>
            <a href="/admin" style={{display:'inline-block', padding:'var(--space-3) var(--space-5)', background:'var(--accent)', color:'var(--bg-100)', borderRadius:'var(--radius-md)', textDecoration:'none', fontSize:'var(--text-base)', fontWeight:'var(--weight-semibold)'}}>
              Open Admin →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
