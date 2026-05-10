import { useState, useEffect } from 'react';
import { Home, Calendar, Trophy, BarChart2, Activity, Wind, Star, Menu, X, Bot, Send, ChevronDown } from 'lucide-react';

const TABS = [
  ["overview",  Home,      "Home"],
  ["schedule",  Calendar,  "Schedule"],
  ["standings", Trophy,    "Standings"],
  ["results",   BarChart2, "Results"],
  ["batting",   Activity,  "Batting"],
  ["bowling",   Wind,      "Bowling"],
  ["rankings",  Star,      "Rankings"],
  ["chat",      Bot,       "Ask AI"],
  ["feedback",  Send,      "Feedback"],
];

export default function NavBar({ slug, leagueName, season, activeTab, onTabClick, playerName, onClosePlayer, teamName, onCloseTeam, loading, onRefresh, onFeedback }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leagues, setLeagues] = useState([]);
  const [seasonOpen, setSeasonOpen] = useState(false);

  useEffect(() => {
    fetch('/api/leagues')
      .then(r => r.json())
      .then(data => {
        const entries = Object.entries(data || {})
          .sort((a, b) => (b[1].updatedAt || '').localeCompare(a[1].updatedAt || ''))
          .map(([s, info]) => ({ slug: s, ...info }));
        setLeagues(entries);
      })
      .catch(() => {});
  }, []);

  const switchSeason = (newSlug) => {
    setSeasonOpen(false);
    if (newSlug === slug) return;
    try {
      window.location.href = '/' + newSlug;
    } catch {}
  };

  const goHome   = () => { window.location.href = '/'; };
  const goLeague = () => {
    if (playerName && onClosePlayer) onClosePlayer();
    if (teamName   && onCloseTeam)   onCloseTeam();
    if (onTabClick) onTabClick('overview');
  };

  const handleTab = (key) => {
    setDrawerOpen(false);
    if (playerName && onClosePlayer) onClosePlayer();
    if (teamName   && onCloseTeam)   onCloseTeam();
    if (onTabClick) onTabClick(key);
  };

  return (
    <>
      <div className="nav-bar">
        <div className="nav-row-1">
          {/* Mobile hamburger */}
          {slug && (
            <button className="nav-hamburger" onClick={() => setDrawerOpen(o => !o)} aria-label="Menu">
              {drawerOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
            </button>
          )}

          <div className="nav-brand" onClick={goHome} title="CricSeason home">
            <span className="nav-brand-icon">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="10.5" fill="#dc2626"/>
                <path d="M1.5 11Q11 7.5 20.5 11" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                <path d="M1.5 11Q11 14.5 20.5 11" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                <path d="M5.5 8.5L6.2 7.4M8.8 7L9.4 5.9M12 6.5L12.6 5.4M15.2 7L15.8 7.8" stroke="white" strokeWidth="0.9" strokeLinecap="round" opacity="0.85"/>
                <path d="M5.5 13.5L6.2 14.6M8.8 15L9.4 16.1M12 15.5L12.6 16.6M15.2 15L15.8 14.2" stroke="white" strokeWidth="0.9" strokeLinecap="round" opacity="0.85"/>
              </svg>
            </span>
            <span className="nav-brand-name">
              <span className="nav-brand-cric">Cric</span><span className="nav-brand-season">Season</span>
            </span>
          </div>

          {slug && leagueName && (
            <>
              <span className="nav-sep">›</span>
              <div className="nav-league nav-league-link" onClick={goLeague} title="Season home">
                {leagueName}{season ? ` · ${season}` : ''}
              </div>
              {leagues.length > 1 && (
                <div className="nav-season-switcher">
                  <button
                    className="nav-season-btn"
                    onClick={() => setSeasonOpen(o => !o)}
                    title="Switch season"
                  >
                    <ChevronDown size={14} strokeWidth={2} />
                  </button>
                  {seasonOpen && (
                    <>
                      <div className="nav-season-overlay" onClick={() => setSeasonOpen(false)} />
                      <div className="nav-season-dropdown">
                        {leagues.map(l => (
                          <button
                            key={l.slug}
                            className={`nav-season-item${l.slug === slug ? ' active' : ''}${l.historical ? ' historical' : ''}`}
                            onClick={() => switchSeason(l.slug)}
                          >
                            <span>{l.season || l.slug}</span>
                            {l.historical && <span className="nav-season-badge">past</span>}
                            {l.slug === slug && <span className="nav-season-current-dot" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          <div className="nav-actions">
            {onRefresh && (
              <button className="nav-btn" onClick={onRefresh} disabled={loading} title="Refresh">
                {loading ? '…' : '↻'}
              </button>
            )}
          </div>
        </div>

        {(playerName || teamName) && (
          <div className="nav-player-crumb">
            <button className="nav-back-btn" onClick={playerName ? onClosePlayer : onCloseTeam}>←</button>
            <span className="nav-player-name" style={{color:'var(--text-muted)',fontWeight:500}}>
              {playerName ? 'Player Profile' : 'Team Profile'}
            </span>
          </div>
        )}
      </div>

      {/* Mobile nav drawer */}
      {drawerOpen && (
        <>
          <div className="nav-drawer-overlay" onClick={() => setDrawerOpen(false)} />
          <div className="nav-drawer">
            {TABS.map(([key, Icon, label]) => (
              <button
                key={key}
                className={`nav-drawer-item${activeTab === key ? ' active' : ''}`}
                onClick={() => handleTab(key)}
              >
                <Icon size={16} strokeWidth={1.8} />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
