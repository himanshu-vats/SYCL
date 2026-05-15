import { useState, useEffect } from 'react';
import { Home, Calendar, Trophy, BarChart2, Activity, Wind, Star, Bot, Send, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const TABS = [
  ["overview",  Home,      "Home"],
  ["schedule",  Calendar,  "Schedule"],
  ["standings", Trophy,    "Standings"],
  ["results",   BarChart2, "Results"],
  ["batting",   Activity,  "Batting"],
  ["bowling",   Wind,      "Bowling"],
  ["rankings",  Star,      "Rankings"],
  ["chat",      Bot,       "Ask AI"],
];

export default function SideNav({ activeTab, onTabClick, collapsed = false }) {
  const isActive = (key) => activeTab === key;
  const [manualCollapsed, setManualCollapsed] = useState(false);
  const [chatVisited, setChatVisited] = useState(() => {
    try { return !!localStorage.getItem('cs_chat_visited'); } catch { return false; }
  });

  useEffect(() => {
    if (activeTab === 'chat' && !chatVisited) {
      setChatVisited(true);
      try { localStorage.setItem('cs_chat_visited', '1'); } catch {}
    }
  }, [activeTab, chatVisited]);

  const isCollapsed = collapsed || manualCollapsed;

  return (
    <nav className={`side-nav${isCollapsed ? ' side-nav-collapsed' : ''}`}>
      <ul className="side-nav-list">
        {TABS.map(([key, Icon, label]) => (
          <li key={key}>
            <button
              className={`side-nav-item${isActive(key) ? ' active' : ''}`}
              onClick={() => onTabClick(key)}
              title={isCollapsed ? label : undefined}
            >
              <Icon size={15} strokeWidth={1.8} className="side-nav-icon" />
              {!isCollapsed && <span className="side-nav-label">{label}</span>}
              {!isCollapsed && key === 'chat' && !chatVisited && !isActive(key) && (
                <span className="side-nav-pulse" />
              )}
            </button>
          </li>
        ))}
        <li>
          <button
            className={`side-nav-item${isActive('feedback') ? ' active' : ''}`}
            onClick={() => onTabClick('feedback')}
            title={isCollapsed ? 'Feedback' : undefined}
          >
            <Send size={15} strokeWidth={1.8} className="side-nav-icon" />
            {!isCollapsed && <span className="side-nav-label">Feedback</span>}
          </button>
        </li>
      </ul>
      {/* Toggle button at bottom */}
      <button
        className="side-nav-item side-nav-toggle-btn"
        onClick={() => setManualCollapsed(c => !c)}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{marginTop:'auto'}}
      >
        {isCollapsed
          ? <PanelLeftOpen size={15} strokeWidth={1.8} className="side-nav-icon" />
          : <PanelLeftClose size={15} strokeWidth={1.8} className="side-nav-icon" />
        }
        {!isCollapsed && <span className="side-nav-label">Collapse</span>}
      </button>
    </nav>
  );
}
