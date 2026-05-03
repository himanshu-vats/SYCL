import { useEffect } from 'react';
import PlayerPanel from './PlayerPanel.jsx';
import TeamPanel from './TeamPanel.jsx';

export default function DrilldownPanel({ drilldown, data, onClose, onDrilldown }) {
  useEffect(() => {
    if (!drilldown) return;
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drilldown]);

  if (!drilldown) return null;
  const pd = { batting:data.batting, bowling:data.bowling, rankings:data.rankings, results:data.results, matches:data.matches };
  return (
    <>
      <div className="panel-overlay" onClick={onClose}/>
      <div className="panel-drawer">
        {drilldown.type === 'player'
          ? <PlayerPanel name={drilldown.name} {...pd} onClose={onClose} onDrilldown={onDrilldown}/>
          : <TeamPanel   name={drilldown.name} {...pd} onClose={onClose} onDrilldown={onDrilldown}/>}
      </div>
    </>
  );
}
