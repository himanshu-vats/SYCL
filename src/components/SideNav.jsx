const TABS = [
  ["overview",  "⌂",  "Home"],
  ["schedule",  "📅", "Schedule"],
  ["standings", "🏆", "Standings"],
  ["results",   "📊", "Results"],
  ["batting",   "🏏", "Batting"],
  ["bowling",   "⚡", "Bowling"],
  ["rankings",  "⭐", "Rankings"],
  ["balance",   "⚖",  "Balance"],
];

export default function SideNav({ activeTab, onTabClick, divisions, selectedDivision, onDivisionChange, playerName, teamName }) {
  const showDivision = divisions?.length > 0 && activeTab !== 'overview';
  const showCombined = activeTab !== 'standings' && activeTab !== 'balance';

  const handleTab = (key) => {
    if (playerName || teamName) return;
    onTabClick(key);
  };

  return (
    <nav className="side-nav">
      <ul className="side-nav-list">
        {TABS.map(([key, icon, label]) => (
          <li key={key}>
            <button
              className={`side-nav-item${activeTab === key && !playerName && !teamName ? ' active' : ''}`}
              onClick={() => handleTab(key)}
            >
              <span className="side-nav-icon">{icon}</span>
              <span className="side-nav-label">{label}</span>
            </button>
          </li>
        ))}
      </ul>

      {showDivision && (
        <div className="side-nav-divs">
          <div className="side-nav-div-heading">Division</div>
          {showCombined && (
            <button
              className={`side-nav-div-btn${!selectedDivision || selectedDivision === 'combined' ? ' active' : ''}`}
              onClick={() => onDivisionChange('combined')}
            >All Divisions</button>
          )}
          {divisions.map(d => (
            <button
              key={d}
              className={`side-nav-div-btn${selectedDivision === d ? ' active' : ''}`}
              onClick={() => onDivisionChange(d)}
            >{d}</button>
          ))}
        </div>
      )}
    </nav>
  );
}
