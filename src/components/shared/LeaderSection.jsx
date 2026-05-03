import LeaderCard from './LeaderCard.jsx';

export default function LeaderSection({ rows, statKey, label, nameKey = 'player', teamKey = 'team', fmt, ascending, onDrilldown, drilldownType = 'player' }) {
  if (!rows?.length) return null;
  const sorted = [...rows]
    .filter(r => r[statKey] !== undefined && r[statKey] !== '—' && r[statKey] !== null)
    .sort((a, b) => ascending
      ? (parseFloat(a[statKey]) || 9999) - (parseFloat(b[statKey]) || 9999)
      : (parseFloat(b[statKey]) || 0) - (parseFloat(a[statKey]) || 0)
    );
  const top = sorted.slice(0, 3);
  if (!top.length) return null;
  const ref = parseFloat(top[0][statKey]) || 1;
  return (
    <div className="leader-row">
      {top.map((r, i) => (
        <LeaderCard key={r[nameKey] + i} rank={i} label={label}
          stat={fmt ? fmt(r[statKey]) : r[statKey]}
          name={r[nameKey]} sub={r[teamKey]}
          pct={ascending
            ? (ref / (parseFloat(r[statKey]) || 1)) * 100
            : ((parseFloat(r[statKey]) || 0) / ref) * 100
          }
          onClick={onDrilldown ? () => onDrilldown({type: drilldownType, name: r[nameKey]}) : undefined}
        />
      ))}
    </div>
  );
}
