import { useState, useEffect } from 'react';
import { Home, Calendar, Trophy, BarChart2, Activity, Wind, Star, Bot, Send } from 'lucide-react';

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
  const [chatVisited, setChatVisited] = useState(() => {
    try { return !!localStorage.getItem('cs_chat_visited'); } catch { return false; }
  });

  useEffect(() => {
    if (activeTab === 'chat' && !chatVisited) {
      setChatVisited(true);
      try { localStorage.setItem('cs_chat_visited', '1'); } catch {}
    }
  }, [activeTab, chatVisited]);

  return (
    <nav className={`side-nav${collapsed ? ' side-nav-collapsed' : ''}`}>
      <ul className="side-nav-list">
        {TABS.map(([key, Icon, label]) => (
          <li key={key}>
            <button
              className={`side-nav-item${isActive(key) ? ' active' : ''}`}
              onClick={() => onTabClick(key)}
              title={collapsed ? label : undefined}
            >
              <Icon size={15} strokeWidth={1.8} className="side-nav-icon" />
              {!collapsed && <span className="side-nav-label">{label}</span>}
              {!collapsed && key === 'chat' && !chatVisited && !isActive(key) && (
                <span className="side-nav-pulse" />
              )}
            </button>
          </li>
        ))}
        <li>
          <button
            className={`side-nav-item${isActive('feedback') ? ' active' : ''}`}
            onClick={() => onTabClick('feedback')}
            title={collapsed ? 'Feedback' : undefined}
          >
            <Send size={15} strokeWidth={1.8} className="side-nav-icon" />
            {!collapsed && <span className="side-nav-label">Feedback</span>}
          </button>
        </li>
      </ul>
    </nav>
  );
}
