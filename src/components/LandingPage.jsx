import { useState, useEffect, useRef } from 'react';
import AiQuestionTeaser from './AiQuestionTeaser.jsx';

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

function getState(league) {
  const pct = league.matchCount ? Math.round((league.completedCount || 0) / league.matchCount * 100) : null;
  if (pct !== null && pct >= 98) return 'concluded';
  if ((league.completedCount || 0) > 0) return 'active';
  return 'upcoming';
}

function SeasonRow({ league }) {
  const state = getState(league);
  const completion = league.matchCount
    ? Math.round((league.completedCount || 0) / league.matchCount * 100)
    : null;

  const stateLabel = state === 'concluded' ? 'Complete'
    : state === 'active' ? 'In Progress'
    : 'Upcoming';

  const prefetch = () => {
    try {
      sessionStorage.setItem('cs_prefetch', JSON.stringify({
        slug: league.slug, leagueName: league.name, season: league.season,
        teamCount: league.teamCount, matchCount: league.matchCount,
        completedCount: league.completedCount, divisionCount: league.divisionCount,
        updatedAt: league.updatedAt,
      }));
    } catch {}
  };

  const quickLinks = [
    { label: 'Standings', tab: 'standings' },
    { label: 'Batting',   tab: 'batting'   },
    { label: 'Bowling',   tab: 'bowling'   },
    { label: 'Schedule',  tab: 'schedule'  },
    { label: 'Ask AI',    tab: 'chat'      },
  ];

  return (
    <a
      className={`lp-season-row${state === 'active' ? ' lp-row-active' : ''}`}
      href={`/${league.slug}`}
      onClick={prefetch}
    >
      <div className="lp-row-main">
        <div className="lp-row-name">{league.season || 'Season'}</div>
        <div className={`lp-row-status lp-status-${state}`}>
          <span className="lp-dot" />
          {stateLabel}{state === 'active' && completion !== null ? ` · ${completion}%` : ''}
        </div>
        {completion !== null && (
          <div className="lp-row-bar">
            <div className="lp-row-bar-fill" style={{width:`${Math.min(completion,100)}%`}} />
          </div>
        )}
      </div>
      <div className="lp-row-links" onClick={e => e.stopPropagation()}>
        {quickLinks.map(({ label, tab }) => (
          <a
            key={tab}
            className="lp-row-link"
            href={`/${league.slug}#tab=${tab}`}
            onClick={e => { e.stopPropagation(); prefetch(); }}
          >
            {label}
          </a>
        ))}
      </div>
    </a>
  );
}

function LeagueColumn({ leagueName, seasons }) {
  const code = leagueName.length <= 6
    ? leagueName.toUpperCase()
    : leagueName.split(' ').map(w => w[0]).join('').slice(0, 5).toUpperCase();
  const activeSeason = seasons.find(l => getState(l) === 'active');

  return (
    <div className="lp-league-col">
      <div className="lp-col-header">
        <span className="lp-col-code">{code}</span>
        {activeSeason && <span className="lp-live-badge">LIVE</span>}
      </div>
      <div className="lp-col-seasons">
        {seasons.map(l => <SeasonRow key={l.slug} league={l} />)}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [leagues, setLeagues] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [theme, setTheme] = useTheme();
  const [pendingAiQ, setPendingAiQ] = useState(null);
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
  const leagueNames = Object.keys(grouped).sort((a, b) =>
    new Date(grouped[b][0]?.updatedAt || 0) - new Date(grouped[a][0]?.updatedAt || 0)
  );

  const totals = leagueList.reduce((acc, l) => ({
    matches: acc.matches + (l.matchCount || 0),
    teams:   acc.teams   + (l.teamCount  || 0),
    seasons: acc.seasons + 1,
  }), { matches: 0, teams: 0, seasons: 0 });

  const filteredLeagueNames = leagueNames.filter(name => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return name.toLowerCase().includes(q) ||
      (grouped[name] || []).some(l => (l.season || '').toLowerCase().includes(q));
  });

  const getCode = n => n.length <= 6 ? n.toUpperCase() : n.split(' ').map(w => w[0]).join('').slice(0, 5).toUpperCase();

  const scrollToLeague = (name) => {
    const id = getCode(name).toLowerCase();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
                onChange={e => setSearchQ(e.target.value)}
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

      {/* LEAGUE JUMP NAV — scrolls to section */}
      {!loading && leagueNames.length > 1 && (
        <nav className="cs-tabbar" aria-label="Leagues">
          <div className="cs-wrap">
            <div className="cs-tabbar-inner" role="tablist">
              {leagueNames.map(name => {
                const code = getCode(name);
                const activeSeason = (grouped[name] || []).find(l => getState(l) === 'active');
                return (
                  <button
                    key={name}
                    className="cs-tab"
                    onClick={() => scrollToLeague(name)}
                  >
                    {code}
                    <span className="cs-tab-code">{name.split(' ').slice(0,2).join(' ')}</span>
                    {activeSeason && <span className="cs-tab-live" />}
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
              <p className="cs-hero-sub">Standings, leaderboards, AI insights — built for kids, parents and coaches.</p>
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

          {/* AI TEASER */}
          {!loading && leagueList.length > 0 && (
            <>
              {pendingAiQ === null ? (
                <AiQuestionTeaser
                  onAsk={(q) => {
                    if (!q) {
                      const target = leagueList.find(l => getState(l) === 'active') || leagueList[0];
                      window.location.href = `/${target.slug}#tab=chat`;
                      return;
                    }
                    if (leagueList.length === 1) {
                      window.location.href = `/${leagueList[0].slug}#tab=chat&q=${encodeURIComponent(q)}`;
                      return;
                    }
                    setPendingAiQ(q);
                  }}
                  questions={[
                    'When is my child\'s next match?',
                    'What matches are coming up this weekend?',
                    'Who are the top run scorers this season?',
                    'Who takes the most wickets across all divisions?',
                  ]}
                />
              ) : (
                <div className="aqt-wrap">
                  <div className="aqt-header">
                    <span className="aqt-icon">✦</span>
                    <span className="aqt-label">Which season are you asking about?</span>
                  </div>
                  <p className="aqt-context-q">"{pendingAiQ}"</p>
                  <div className="aqt-chips">
                    {leagueList.slice(0, 6).map(l => (
                      <button key={l.slug} className="aqt-chip"
                        onClick={() => { window.location.href = `/${l.slug}#tab=chat&q=${encodeURIComponent(pendingAiQ)}`; }}>
                        {l.name} · {l.season}
                      </button>
                    ))}
                  </div>
                  <button className="aqt-open-link" onClick={() => setPendingAiQ(null)}>← Back</button>
                </div>
              )}
            </>
          )}

          {/* CONTENT */}
          {loading ? (
            <div className="cs-loading">Loading seasons…</div>
          ) : leagueList.length === 0 ? (
            <div className="cs-empty">
              <div style={{fontSize:48,marginBottom:16}}>🏏</div>
              <h2>No leagues synced yet</h2>
              <p>Sync your first season from CricClubs to start analyzing.</p>
              <a href="/admin" className="cs-empty-btn">Open Admin →</a>
            </div>
          ) : (
            <div className="lp-columns">
              {filteredLeagueNames.map(name => (
                <LeagueColumn
                  key={name}
                  leagueName={name}
                  seasons={grouped[name] || []}
                />
              ))}
              {filteredLeagueNames.length === 0 && (
                <p style={{color:'var(--cs-muted)',fontSize:14,padding:'24px 0'}}>No leagues match "{searchQ}".</p>
              )}
            </div>
          )}
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
