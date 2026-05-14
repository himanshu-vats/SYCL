import { useState, useEffect, useRef } from 'react';

const ARROW_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:11,height:11}}>
    <path d="M7 17 17 7"/><path d="M9 7h8v8"/>
  </svg>
);

const SEARCH_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14,flexShrink:0}}>
    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
  </svg>
);

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('cs_theme') || 'dark'; } catch { return 'dark'; }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('cs_theme', theme); } catch {}
  }, [theme]);
  return [theme, setTheme];
}

function SeasonCard({ league }) {
  const now = Date.now();
  const updatedMs = league.updatedAt ? now - new Date(league.updatedAt).getTime() : null;
  const completion = league.matchCount
    ? Math.round((league.completedCount || 0) / league.matchCount * 100)
    : null;

  const state = completion === 100 ? 'concluded'
    : (league.completedCount || 0) > 0 ? 'live'
    : 'upcoming';

  const stateLabel = state === 'concluded' ? 'Concluded'
    : state === 'live' ? 'Live'
    : 'Upcoming';

  const formatAgo = (ms) => {
    if (ms === null) return '—';
    const h = Math.floor(ms / 3600000);
    const d = Math.floor(ms / 86400000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    if (d === 1) return 'yesterday';
    if (d < 7) return `${d}d ago`;
    return `${Math.floor(d / 7)}w ago`;
  };

  return (
    <a
      className={`cs-season-card${state === 'concluded' ? '' : state === 'live' ? ' cs-featured' : ''}`}
      data-state={state}
      href={`/${league.slug}`}
    >
      <div className="cs-card-top">
        <span className="cs-status" data-state={state}>
          <span className="cs-dot" />
          {stateLabel}{state === 'live' && completion !== null ? ` · ${completion}%` : ''}
        </span>
        <span className="cs-arrow">{ARROW_SVG}</span>
      </div>
      <h3 className="cs-card-title">{league.season || 'Season'}</h3>
      <div className="cs-card-dates">Updated {formatAgo(updatedMs)}</div>
      {(league.divisionCount || league.teamCount || league.matchCount) ? (
        <div className="cs-stats-inline">
          {league.divisionCount ? <div className="cs-si"><span className="cs-si-lbl">Divs</span><span className="cs-si-val">{league.divisionCount}</span></div> : null}
          {league.teamCount ? <div className="cs-si"><span className="cs-si-lbl">Teams</span><span className="cs-si-val">{league.teamCount}</span></div> : null}
          {league.matchCount ? (
            <div className="cs-si">
              <span className="cs-si-lbl">Matches</span>
              <span className="cs-si-val">
                {league.completedCount || 0}
                <span className="cs-si-of">/{league.matchCount}</span>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      {completion !== null && (
        <div className="cs-progress-block">
          <div className="cs-progress-meta">
            <span>Season progress</span>
            <span className="cs-pct">{completion}%</span>
          </div>
          <div className="cs-bar"><span style={{width:`${completion}%`}} /></div>
        </div>
      )}
    </a>
  );
}

function LeagueSummaryCard({ leagueName, seasons, onSelect }) {
  const latest = seasons[0];
  const totalTeams = seasons.reduce((s, l) => s + (l.teamCount || 0), 0);
  const liveSeasons = seasons.filter(l => {
    const pct = l.matchCount ? Math.round((l.completedCount || 0) / l.matchCount * 100) : null;
    return pct !== null && pct > 0 && pct < 100;
  }).length;
  const now = Date.now();
  const updatedMs = latest?.updatedAt ? now - new Date(latest.updatedAt).getTime() : null;
  const formatAgo = (ms) => {
    if (ms === null) return '—';
    const h = Math.floor(ms / 3600000);
    const d = Math.floor(ms / 86400000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    if (d === 1) return 'yesterday';
    if (d < 7) return `${d}d ago`;
    return `${Math.floor(d / 7)}w ago`;
  };

  const code = leagueName.length <= 6 ? leagueName.toUpperCase() : leagueName.split(' ').map(w => w[0]).join('').slice(0, 5).toUpperCase();

  return (
    <button className="cs-league-summary" onClick={() => onSelect(leagueName)}>
      <div className="cs-ls-top">
        <div className="cs-ls-code">{code}</div>
        <span className="cs-ls-arrow">→</span>
      </div>
      <div className="cs-ls-name">{leagueName}</div>
      <div className="cs-ls-row">
        <div><div className="cs-ls-lbl">Seasons</div><div className="cs-ls-val">{String(seasons.length).padStart(2,'0')}</div></div>
        <div><div className="cs-ls-lbl">Teams</div><div className="cs-ls-val">{totalTeams || '—'}</div></div>
        <div><div className="cs-ls-lbl">Live</div><div className="cs-ls-val">{String(liveSeasons).padStart(2,'0')}</div></div>
      </div>
      <div className="cs-ls-foot">
        <span className="cs-ls-status">
          {liveSeasons > 0 && <span className="cs-dot" style={{background:'var(--cs-live)'}} />}
          {latest?.season || 'No seasons'}
        </span>
        <span>Updated {formatAgo(updatedMs)}</span>
      </div>
    </button>
  );
}

function LeaguePanel({ leagueName, seasons, onBack }) {
  const [filter, setFilter] = useState('all');
  const code = leagueName.length <= 6 ? leagueName.toUpperCase() : leagueName.split(' ').map(w => w[0]).join('').slice(0, 5).toUpperCase();

  const filtered = seasons.filter(l => {
    if (filter === 'all') return true;
    const pct = l.matchCount ? Math.round((l.completedCount || 0) / l.matchCount * 100) : null;
    const state = pct === 100 ? 'concluded' : (l.completedCount || 0) > 0 ? 'live' : 'upcoming';
    return state === filter;
  });

  return (
    <section className="cs-panel cs-panel-active">
      <div className="cs-panel-head">
        <div className="cs-panel-code">{code}</div>
        <div className="cs-panel-meta">
          <p className="cs-panel-name">{leagueName}</p>
          <div className="cs-panel-tags">
            <span className="cs-tag cs-tag-accent">Cricket</span>
            <span className="cs-tag">{seasons.length} seasons</span>
          </div>
        </div>
        <button className="cs-panel-back" onClick={onBack}>← All leagues</button>
      </div>

      <div className="cs-panel-body">
        <aside className="cs-rail">
          <div className="cs-rail-hd">Quick links</div>
          {seasons.slice(0, 1).map(l => (
            <a key={l.slug} href={`/${l.slug}`}>
              <span>Current season</span><span className="cs-rail-count">›</span>
            </a>
          ))}
          {seasons.slice(0,1).map(l => (
            <a key={l.slug + '-s'} href={`/${l.slug}?tab=standings`}>
              <span>Standings</span>
              <span className="cs-rail-count">{l.divisionCount ? `${l.divisionCount} div.` : '›'}</span>
            </a>
          ))}
          {seasons.slice(0,1).map(l => (
            <a key={l.slug + '-b'} href={`/${l.slug}?tab=batting`}>
              <span>Leaderboards</span><span className="cs-rail-count">Bat · Bowl</span>
            </a>
          ))}
          {seasons.slice(0,1).map(l => (
            <a key={l.slug + '-sc'} href={`/${l.slug}?tab=schedule`}>
              <span>Schedule</span><span className="cs-rail-count">›</span>
            </a>
          ))}
        </aside>

        <div>
          <div className="cs-seasons-hd">
            <h2>Seasons</h2>
            <div className="cs-chips">
              {[['all','All'],['live','Live'],['upcoming','Upcoming'],['concluded','Past']].map(([val, label]) => (
                <button
                  key={val}
                  className="cs-chip"
                  aria-pressed={filter === val}
                  onClick={() => setFilter(val)}
                >
                  {val !== 'all' && <span className="cs-dot" style={{
                    background: val === 'live' ? 'var(--cs-live)' : val === 'upcoming' ? 'var(--cs-upcoming)' : 'var(--cs-muted)',
                    marginRight: 5
                  }} />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="cs-season-grid">
            {filtered.length > 0
              ? filtered.map(l => <SeasonCard key={l.slug} league={l} />)
              : <p style={{color:'var(--cs-muted)',fontSize:14}}>No seasons match this filter.</p>
            }
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const [leagues, setLeagues] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [theme, setTheme] = useTheme();
  const searchRef = useRef(null);

  useEffect(() => {
    fetch('/api/leagues')
      .then(r => r.ok ? r.json() : {})
      .then(d => { setLeagues(d || {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const leagueList = Object.entries(leagues).map(([slug, meta]) => ({ slug, ...meta }));

  const grouped = {};
  leagueList.forEach(l => {
    const name = l.name || 'Unknown';
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(l);
  });
  Object.keys(grouped).forEach(name => {
    grouped[name].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  });
  const leagueNames = Object.keys(grouped).sort((a, b) => {
    return new Date(grouped[b][0]?.updatedAt || 0) - new Date(grouped[a][0]?.updatedAt || 0);
  });

  const totals = leagueList.reduce((acc, l) => ({
    matches: acc.matches + (l.matchCount || 0),
    teams: acc.teams + (l.teamCount || 0),
    seasons: acc.seasons + 1,
  }), { matches: 0, teams: 0, seasons: 0 });

  const filteredLeagueNames = leagueNames.filter(name => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    const seasons = grouped[name] || [];
    return name.toLowerCase().includes(q) ||
      seasons.some(l => (l.season || '').toLowerCase().includes(q));
  });

  const activeLeagueName = leagueNames.find(n => {
    const code = n.split(' ').map(w => w[0]).join('').slice(0, 5).toUpperCase();
    return code.toLowerCase() === activeTab;
  });

  return (
    <div className="cs-root" data-theme={theme}>
      {/* NAV */}
      <header className="cs-nav">
        <div className="cs-wrap cs-nav-inner">
          <a className="cs-logo" href="/">
            <span className="cs-ball" aria-hidden="true" />
            <span>cricseason<span className="cs-dot-info">.info</span></span>
          </a>
          <div className="cs-nav-right">
            <label className="cs-search-mini">
              {SEARCH_SVG}
              <input
                ref={searchRef}
                type="search"
                placeholder="Search leagues, seasons…"
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); if (activeTab !== 'all') setActiveTab('all'); }}
                autoComplete="off"
              />
            </label>
            <button
              className="cs-icon-btn"
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
                  <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* LEAGUE TABS */}
      {!loading && leagueNames.length > 0 && (
        <nav className="cs-tabbar" aria-label="Leagues">
          <div className="cs-wrap">
            <div className="cs-tabbar-inner" role="tablist">
              <button
                className="cs-tab"
                role="tab"
                aria-selected={activeTab === 'all'}
                onClick={() => setActiveTab('all')}
              >
                All leagues
                <span className="cs-tab-code">{String(leagueNames.length).padStart(2,'0')}</span>
              </button>
              {leagueNames.map(name => {
                const code = name.split(' ').map(w => w[0]).join('').slice(0,5).toUpperCase();
                const tabKey = code.toLowerCase();
                return (
                  <button
                    key={name}
                    className="cs-tab"
                    role="tab"
                    aria-selected={activeTab === tabKey}
                    onClick={() => setActiveTab(tabKey)}
                  >
                    {code}
                    <span className="cs-tab-code">{name.split(' ').slice(0,2).join(' ')}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}

      <main>
        <div className="cs-wrap">
          {/* HERO */}
          <section className="cs-hero-strip">
            <div>
              <h1 className="cs-hero-h1">Cricket analytics for <em>your</em> league.</h1>
              <p className="cs-hero-sub">Pick a league, pick a season — standings, leaderboards, AI predictions and season insights, built for kids, parents and coaches.</p>
            </div>
            {!loading && leagueList.length > 0 && (
              <div className="cs-hero-stats" aria-label="Portal totals">
                <div className="cs-hero-cell"><div className="cs-hero-lbl">Leagues</div><div className="cs-hero-val">{String(leagueNames.length).padStart(2,'0')}</div></div>
                <div className="cs-hero-cell"><div className="cs-hero-lbl">Seasons</div><div className="cs-hero-val">{String(totals.seasons).padStart(2,'0')}</div></div>
                <div className="cs-hero-cell"><div className="cs-hero-lbl">Teams</div><div className="cs-hero-val">{totals.teams || '—'}</div></div>
                <div className="cs-hero-cell"><div className="cs-hero-lbl">Matches</div><div className="cs-hero-val">{totals.matches || '—'}</div></div>
              </div>
            )}
          </section>

          {loading ? (
            <div className="cs-loading">Loading seasons…</div>
          ) : leagueList.length === 0 ? (
            <div className="cs-empty">
              <div style={{fontSize:48,marginBottom:16}}>🏏</div>
              <h2>No leagues synced yet</h2>
              <p>Sync your first season from CricClubs to start analyzing player performance, standings, and results.</p>
              <a href="/admin" className="cs-empty-btn">Open Admin →</a>
            </div>
          ) : activeTab === 'all' ? (
            /* ALL LEAGUES PANEL */
            <section className="cs-panel cs-panel-active">
              <div className="cs-seasons-hd">
                <h2>Choose a league</h2>
              </div>
              <div className="cs-leagues-grid">
                {filteredLeagueNames.map(name => (
                  <LeagueSummaryCard
                    key={name}
                    leagueName={name}
                    seasons={grouped[name]}
                    onSelect={(n) => {
                      const code = n.split(' ').map(w => w[0]).join('').slice(0,5).toUpperCase();
                      setActiveTab(code.toLowerCase());
                    }}
                  />
                ))}
                {filteredLeagueNames.length === 0 && (
                  <p style={{color:'var(--cs-muted)',fontSize:14,gridColumn:'1/-1'}}>No leagues match "{searchQ}".</p>
                )}
              </div>
            </section>
          ) : activeLeagueName ? (
            /* SPECIFIC LEAGUE PANEL */
            <LeaguePanel
              leagueName={activeLeagueName}
              seasons={grouped[activeLeagueName] || []}
              onBack={() => setActiveTab('all')}
            />
          ) : null}
        </div>
      </main>

      <footer className="cs-foot">
        <div className="cs-wrap cs-foot-inner">
          <div className="cs-foot-copy">© {new Date().getFullYear()} cricseason.info · AI cricket analytics</div>
          <nav className="cs-foot-nav">
            <a href="/admin">Admin</a>
            <a href="mailto:hello@cricseason.info">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
