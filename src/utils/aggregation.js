export function parseBBF(bbf) {
  if (!bbf) return [0, 999];
  const parts = String(bbf).split('/');
  return [parseInt(parts[0]) || 0, parseInt(parts[1]) || 999];
}

export function addOvers(a, b) {
  const toBalls = ov => { const p = String(ov||0).split('.'); return parseInt(p[0]||0)*6 + parseInt(p[1]||0); };
  const fromBalls = b => `${Math.floor(b/6)}.${b%6}`;
  return fromBalls(toBalls(a) + toBalls(b));
}

export function aggregateBatting(rows) {
  const map = new Map();
  rows.forEach(r => {
    const key = String(r.player||'').trim().toLowerCase();
    if (!map.has(key)) { map.set(key, { ...r }); return; }
    const m = map.get(key);
    m.mat = (m.mat||0) + (r.mat||0);
    m.inns = (m.inns||0) + (r.inns||0);
    m.no = (m.no||0) + (r.no||0);
    m.runs = (m.runs||0) + (r.runs||0);
    m.fours = (m.fours||0) + (r.fours||0);
    m.sixes = (m.sixes||0) + (r.sixes||0);
    m.fifties = (m.fifties||0) + (r.fifties||0);
    m.hundreds = (m.hundreds||0) + (r.hundreds||0);
    if ((parseInt(r.hs)||0) > (parseInt(m.hs)||0)) m.hs = r.hs;
    const denom = m.inns - m.no;
    m.avg = denom > 0 ? (m.runs / denom).toFixed(2) : (m.runs > 0 ? 'N/O' : '—');
    m.sr = '—';
  });
  return [...map.values()].map(m => {
    m.boundaryRuns = (m.fours || 0) * 4 + (m.sixes || 0) * 6;
    m.boundaryPct = m.runs > 0 ? Math.round(m.boundaryRuns / m.runs * 100) : '—';
    return m;
  });
}

export function aggregateBowling(rows) {
  const map = new Map();
  rows.forEach(r => {
    const key = String(r.player||'').trim().toLowerCase();
    if (!map.has(key)) { map.set(key, { ...r }); return; }
    const m = map.get(key);
    m.mat = (m.mat||0) + (r.mat||0);
    m.runs = (m.runs||0) + (r.runs||0);
    m.wickets = (m.wickets||0) + (r.wickets||0);
    m.maidens = (m.maidens||0) + (r.maidens||0);
    m.dots = (m.dots||0) + (r.dots||0);
    m.fiveW = (m.fiveW||0) + (r.fiveW||0);
    m.wides = (m.wides||0) + (r.wides||0);
    m.noballs = (m.noballs||0) + (r.noballs||0);
    m.overs = addOvers(m.overs, r.overs);
    const [w2, ru2] = parseBBF(r.bbf), [w1, ru1] = parseBBF(m.bbf);
    if (w2 > w1 || (w2 === w1 && ru2 < ru1)) m.bbf = r.bbf;
    const toBalls = ov => { const p = String(ov||0).split('.'); return parseInt(p[0]||0)*6+parseInt(p[1]||0); };
    const balls = toBalls(m.overs);
    m.avg = m.wickets > 0 ? (m.runs / m.wickets).toFixed(2) : '—';
    m.econ = balls > 0 ? (m.runs / (balls/6)).toFixed(2) : '—';
    m.sr = m.wickets > 0 ? (balls / m.wickets).toFixed(1) : '—';
    m.dotPct = balls > 0 ? Math.round((m.dots||0) / balls * 100) : '—';
    m.extrasPer6 = balls > 0 ? +(((m.wides||0) + (m.noballs||0)) / balls * 6).toFixed(1) : '—';
  });
  return [...map.values()];
}

export function aggregateRankings(rows) {
  const map = new Map();
  rows.forEach(r => {
    const key = String(r.player||'').trim().toLowerCase();
    if (!map.has(key)) { map.set(key, { ...r }); return; }
    const m = map.get(key);
    m.matches = (m.matches||0) + (r.matches||0);
    m.batting = (m.batting||0) + (r.batting||0);
    m.bowling = (m.bowling||0) + (r.bowling||0);
    m.fielding = (m.fielding||0) + (r.fielding||0);
    m.other = (m.other||0) + (r.other||0);
    m.mom = (m.mom||0) + (r.mom||0);
    m.total = (m.total||0) + (r.total||0);
  });
  return [...map.values()];
}
