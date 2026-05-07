import { Home, Calendar, Trophy, BarChart2, Activity, Wind, Star, Bot, MessageSquare } from 'lucide-react';

const TABS = [
  ["overview",  Home,          "Home"],
  ["schedule",  Calendar,      "Schedule"],
  ["standings", Trophy,        "Standings"],
  ["results",   BarChart2,     "Results"],
  ["batting",   Activity,      "Batting"],
  ["bowling",   Wind,          "Bowling"],
  ["rankings",  Star,          "Rankings"],
  ["chat",      Bot,           "Ask AI"],
];

export default function SideNav({ activeTab, onTabClick, divisions, selectedDivision, onDivisionChange, playerName, teamName, onFeedback }) {
  const showDivision = divisions?.length > 0 && activeTab !== 'overview' && activeTab !== 'chat';
  const showCombined = activeTab !== 'standings';
  const isActive = (key) => activeTab === key && !playerName && !teamName;

  return (
    <nav className="side-nav">
      <ul className="side-nav-list">
        {TABS.map(([key, Icon, label]) => (
          <li key={key}>
            <button
              className={`side-nav-item${isActive(key) ? ' active' : ''}`}
              onClick={() => onTabClick(key)}
            >
              <Icon size={15} strokeWidth={1.8} className="side-nav-icon" />
              <span className="side-nav-label">{label}</span>
            </button>
          </li>
        ))}
        {onFeedback && (
          <li>
            <button className="side-nav-item" onClick={onFeedback}>
              <MessageSquare size={15} strokeWidth={1.8} className="side-nav-icon" />
              <span className="side-nav-label">Feedback</span>
            </button>
          </li>
        )}
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
