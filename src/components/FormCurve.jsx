export default function FormCurve({ innings, statKey = 'runs', label = '', lookback = 10 }) {
  if (!innings || innings.length < 2) return null;
  const recent = innings.slice(-lookback);
  const values = recent.map(i => parseFloat(i[statKey]) || 0);
  const dataMax = Math.max(...values, 1);
  const dataMin = Math.min(...values);
  const yPadFactor = 0.15;
  const range = Math.max(1, dataMax - dataMin);
  const yMax = dataMax + range * yPadFactor;
  const yMin = Math.max(0, dataMin - range * yPadFactor);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const latest = values[values.length - 1];

  const W = 480, H = 200;
  const padTop = 28, padRight = 32, padBottom = 30, padLeft = 36;
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;
  const xFor = (i) => padLeft + (recent.length === 1 ? innerW / 2 : (i * innerW / (recent.length - 1)));
  const yFor = (v) => padTop + innerH - ((v - yMin) / Math.max(1, yMax - yMin)) * innerH;
  const points = values.map((v, i) => ({ x: xFor(i), y: yFor(v), v, inn: recent[i] }));
  const polyline = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const areaPath =
    `M ${points[0].x},${padTop + innerH} ` +
    points.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
    ` L ${points[points.length - 1].x},${padTop + innerH} Z`;

  const avgY = yFor(avg);
  const trendUp = values.length >= 3 && values[values.length - 1] > values[values.length - 3];

  const dateLabel = (inn, idx) => {
    const d = inn._date instanceof Date ? inn._date : null;
    if (d && !isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `#${idx + 1}`;
  };

  const xLabelIdxSet = new Set();
  xLabelIdxSet.add(0);
  xLabelIdxSet.add(recent.length - 1);
  if (recent.length >= 5) xLabelIdxSet.add(Math.floor(recent.length / 2));

  const fmtVal = (v) => Number.isInteger(v) ? String(v) : v.toFixed(1);

  return (
    <div className="form-curve">
      <div className="form-curve-header">
        <span className="form-curve-title">Form — last {recent.length} innings</span>
        <span className="form-curve-meta">avg {fmtVal(avg)} {label}</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="form-curve-svg">
        <defs>
          <linearGradient id={`fc-grad-${statKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <text x={padLeft - 6} y={padTop + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)" fontFamily="Inter, sans-serif">{fmtVal(dataMax)}</text>
        <text x={padLeft - 6} y={padTop + innerH} textAnchor="end" fontSize="11" fill="var(--text-muted)" fontFamily="Inter, sans-serif">{fmtVal(dataMin)}</text>
        <line x1={padLeft} y1={avgY} x2={W - padRight} y2={avgY} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
        <text x={W - padRight + 4} y={avgY + 4} textAnchor="start" fontSize="10" fill="var(--text-muted)" fontFamily="Inter, sans-serif">avg</text>
        <path d={areaPath} fill={`url(#fc-grad-${statKey})`} />
        <polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={polyline} />
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          const labelY = p.y < padTop + 14 ? p.y + 16 : p.y - 8;
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={isLast ? 4.5 : 3} fill={isLast ? 'var(--accent)' : 'var(--bg-100)'} stroke="var(--accent)" strokeWidth={isLast ? 0 : 1.6} />
              <text x={p.x} y={labelY} textAnchor="middle" fontSize="10" fontWeight={isLast ? '700' : '500'} fill={isLast ? 'var(--accent)' : 'var(--text-secondary)'} fontFamily="Inter, sans-serif">{fmtVal(p.v)}</text>
            </g>
          );
        })}
        {points.map((p, i) => xLabelIdxSet.has(i) ? (
          <text key={`x-${i}`} x={p.x} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="Inter, sans-serif">{dateLabel(p.inn, i)}</text>
        ) : null)}
      </svg>
      <div className="form-curve-footer">
        <span>Latest: <strong>{fmtVal(latest)}</strong> {trendUp ? '📈' : ''}</span>
        <span>Best: <strong>{fmtVal(dataMax)}</strong></span>
      </div>
    </div>
  );
}
