export default function NavBar({ slug, leagueName, season, activeTab, onTabClick, playerName, onClosePlayer, teamName, onCloseTeam, loading, onRefresh, theme, onThemeToggle, onFeedback }) {
  const TABS = [["overview","⌂ Home"],["schedule","Schedule"],["standings","Standings"],["results","Results"],["batting","Batting"],["bowling","Bowling"],["rankings","Rankings"],["balance","Balance"]];
  const goHome = () => { window.location.href = '/'; };
  const goLeague = () => {
    if (playerName && onClosePlayer) onClosePlayer();
    if (teamName && onCloseTeam) onCloseTeam();
    if (onTabClick) onTabClick('overview');
  };
  return (
    <div className="nav-bar">
      <div className="nav-row-1">
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
          {onRefresh && <button className="nav-btn" onClick={onRefresh} disabled={loading} title="Refresh">{loading ? '…' : '↻'}</button>}
          {slug && <a href={`/${slug}/admin`} className="nav-btn">Admin</a>}
          {onThemeToggle && <button className="nav-btn nav-btn-theme" onClick={onThemeToggle} title="Toggle theme">{theme === 'light' ? '☾' : '☀'}</button>}
          {onFeedback && <button className="nav-btn nav-btn-feedback" onClick={onFeedback} title="Send feedback">💬</button>}
        </div>
      </div>
      {slug && (
        <div className="nav-row-2 mobile-only">
          {TABS.map(([k, l]) => (
            <button key={k}
              className={`nav-tab${activeTab === k && !playerName && !teamName ? ' active' : ''}`}
              onClick={() => { if (playerName && onClosePlayer) onClosePlayer(); if (teamName && onCloseTeam) onCloseTeam(); if (onTabClick) onTabClick(k); }}>
              {l}
            </button>
          ))}
        </div>
      )}
      {playerName && (
        <div className="nav-player-crumb">
          <button className="nav-back-btn" onClick={onClosePlayer}>←</button>
          <span className="nav-player-name">{playerName}</span>
        </div>
      )}
      {teamName && !playerName && (
        <div className="nav-player-crumb">
          <button className="nav-back-btn" onClick={onCloseTeam}>←</button>
          <span className="nav-player-name">🏏 {teamName}</span>
        </div>
      )}
    </div>
  );
}
