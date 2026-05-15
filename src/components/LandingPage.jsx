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

function formatAgo(updatedAt) {
  if (!updatedAt) return '—';
  const ms = Date.now() - new Date(updatedAt).getTime();
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(ms / 86400000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function getState(league) {
  const pct = league.matchCount ? Math.round((league.completedCount || 0) / league.matchCount * 100) : null;
  if (pct !== null && pct >= 98) return 'concluded';
  if ((league.completedCount || 0) > 0) return 'active';
  return 'upcoming';
}

function SeasonCard({ league }) {
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
    { label: 'Overview',  tab: 'overview'  },
    { label: 'Schedule',  tab: 'schedule'  },
    { label: 'Standings', tab: 'standings' },
    { label: 'Batting',   tab: 'batting'   },
    { label: 'Bowling',   tab: 'bowling'   },
    { label: 'Ask AI',    tab: 'chat'      },
  ];

  return (
    <div className={`lp-season-card${state === 'active' ? ' lp-season-active' : ''}`}>
      {/* Card header — click goes to overview */}
      <a
        className="lp-season-head"
        href={`/${league.slug}`}
        onClick={prefetch}
      >
        <div className="lp-season-head-top">
          <span className={`lp-season-status lp-status-${state}`}>
            <span className="lp-dot" />
            {stateLabel}{state === 'active' && completion !== null ? ` · ${completion}%` : ''}
          </span>
          <span className="lp-season-ago">{formatAgo(league.updatedAt)}</span>
        </div>
        <div className="lp-season-name">{league.season || 'Season'}</div>
        {completion !== null && (
          <div className="lp-season-bar">
            <div className="lp-season-bar-fill" style={{width: `${Math.min(completion, 100)}%`}} />
          </div>
        )}
        <div className="lp-season-meta">
          {league.divisionCount ? <span>{league.divisionCount} div</span> : null}
          {league.teamCount ? <span>{league.teamCount} teams</span> : null}
          {league.matchCount ? <span>{league.completedCount || 0}/{league.matchCount} matches</span> : null}
        </div>
      </a>

      {/* Quick-link rows — each is one click to that tab */}
      <div className="lp-season-links">
        {quickLinks.map(({ label, tab }) => (
          <a
            key={tab}
            className="lp-season-link"
            href={`/${league.slug}#tab=${tab}`}
            onClick={prefetch}
          >
            <span>{label}</span>
            <span className="lp-link-arrow">›</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function LeagueSection({ leagueName, seasons }) {
  const code = leagueName.length <= 6
    ? leagueName.toUpperCase()
    : leagueName.split(' ').map(w => w[0]).join('').slice(0, 5).toUpperCase();

  const activeSeason = seasons.find(l => getState(l) === 'active');
  const sectionId = code.toLowerCase();

  return (
    <section className="lp-league-section" id={sectionId}>
      <div className="lp-league-header">
        <div className="lp-league-header-left">
          <span className="lp-league-code">{code}</span>
          <span className="lp-league-name">{leagueName}</span>
          {activeSeason && <span className="lp-live-badge">LIVE</span>}
        </div>
        <span className="lp-league-count">{seasons.length} season{seasons.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="lp-season-grid">
        {seasons.map(l => <SeasonCard key={l.slug} league={l} />)}
      </div>
    </section>
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
                    'Who are the top run scorers this season?',
                    'Which team is on the longest winning streak?',
                    'What matches are coming up next?',
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
            <div className="lp-leagues">
              {filteredLeagueNames.map(name => (
                <LeagueSection
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
