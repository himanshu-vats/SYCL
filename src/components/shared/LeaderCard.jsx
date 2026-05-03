import { RANK_CLASS, RANK_MEDAL } from '../../constants.js';

export default function LeaderCard({ rank, label, stat, name, sub, pct, onClick }) {
  const cls = RANK_CLASS[rank] || '';
  return (
    <div className={`leader-card ${cls}`}>
      <div className="leader-label"><span className="leader-medal">{RANK_MEDAL[rank] || ''}</span>{label}</div>
      <div className="leader-stat">{stat}</div>
      <div className="leader-name">
        {onClick
          ? <span className="clickable" style={{color:'var(--accent)'}} onClick={onClick}>{name}</span>
          : name}
      </div>
      {sub && <div className="leader-sub">{sub}</div>}
      <div className="leader-bar" style={{marginTop:'auto',paddingTop:8}}><div className="leader-bar-fill" style={{width:`${pct}%`}}></div></div>
    </div>
  );
}
