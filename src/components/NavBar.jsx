import { useState } from 'react';
import { Home, Calendar, Trophy, BarChart2, Activity, Wind, Star, Scale, Menu, X } from 'lucide-react';

const TABS = [
  ["overview",  Home,      "Home"],
  ["schedule",  Calendar,  "Schedule"],
  ["standings", Trophy,    "Standings"],
  ["results",   BarChart2, "Results"],
  ["batting",   Activity,  "Batting"],
  ["bowling",   Wind,      "Bowling"],
  ["rankings",  Star,      "Rankings"],
  ["balance",   Scale,     "Balance"],
];

export default function NavBar({ slug, leagueName, season, activeTab, onTabClick, playerName, onClosePlayer, teamName, onCloseTeam, loading, onRefresh, onFeedback }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

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

          <div className="nav-brand" onClick={goHome} title="All leagues">
            <span className="nav-brand-icon">🏏</span>
            <span className="nav-brand-name">Season Insight</span>
          </div>

          {slug && leagueName && (
            <>
              <span className="nav-sep">›</span>
              <div className="nav-league nav-league-link" onClick={goLeague} title="Season home">
                {leagueName}{season ? ` · ${season}` : ''}
              </div>
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
