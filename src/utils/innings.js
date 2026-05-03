export function parseInningsDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function getPlayerInningsHistory(innings, name, role) {
  if (!Array.isArray(innings) || !name) return [];
  const lower = name.toLowerCase().trim();
  return innings
    .filter(i => i && i.player && i.player.toLowerCase().trim() === lower && i.role === role)
    .map(i => ({ ...i, _date: parseInningsDate(i.date) }))
    .sort((a, b) => {
      if (a._date && b._date) return a._date - b._date;
      if (a._date) return -1;
      if (b._date) return 1;
      return 0;
    });
}

export function computeBestBattingInnings(innings, name) {
  const history = getPlayerInningsHistory(innings, name, 'bat')
    .filter(i => (i.runs || 0) > 0 || i.notOut);
  if (history.length === 0) return null;

  const scored = history.map(inn => {
    const balls = parseInt(inn.balls) || 0;
    const runs = parseInt(inn.runs) || 0;
    const sr = balls > 0 ? (runs / balls) * 100 : 0;
    const won = inn.result && /\bwon\b|\bwin\b/i.test(inn.result);
    let impact = runs;
    if (inn.notOut)         impact += 8;
    if (won)                impact += 6;
    if (runs >= 30)         impact += 5;
    if (runs >= 50)         impact += 10;
    if (runs >= 100)        impact += 25;
    if (sr >= 130)          impact += 4;
    if (sr >= 160)          impact += 4;
    if ((inn.sixes || 0) >= 3) impact += 4;
    return { ...inn, _impact: impact, _sr: sr };
  });

  scored.sort((a, b) => b._impact - a._impact);
  return scored[0];
}

export function computeBestBowlingSpell(innings, name) {
  const history = getPlayerInningsHistory(innings, name, 'bowl')
    .filter(i => (parseInt(i.wickets)||0) > 0);
  if (history.length === 0) return null;

  const oversToBalls = ov => { const p = String(ov||0).split('.'); return (parseInt(p[0]||0)*6) + parseInt(p[1]||0); };

  const scored = history.map(inn => {
    const balls = oversToBalls(inn.overs);
    const econ = balls > 0 ? (inn.runs * 6 / balls) : 99;
    let impact = (inn.wickets || 0) * 10;
    impact += (inn.maidens || 0) * 2;
    if (econ < 4)  impact += 6;
    if (econ < 3)  impact += 4;
    if (inn.wickets >= 3) impact += 5;
    if (inn.wickets >= 5) impact += 15;
    const won = inn.result && /\bwon\b|\bwin\b/i.test(inn.result);
    if (won) impact += 4;
    return { ...inn, _impact: impact, _econ: econ };
  });

  scored.sort((a, b) => b._impact - a._impact);
  return scored[0];
}

export function formatMatchDate(s) {
  const d = parseInningsDate(s);
  if (!d) return s || '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function detectCurrentStreak(history, role) {
  if (!history || history.length < 2) return null;
  const isHot = (inn) => role === 'bat' ? (parseInt(inn.runs)||0) >= 25 : (parseInt(inn.wickets)||0) >= 2;
  const isCold = (inn) => role === 'bat' ? (parseInt(inn.runs)||0) < 10 : (parseInt(inn.wickets)||0) === 0;

  let hotLen = 0, coldLen = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (isHot(history[i])) { if (coldLen) break; hotLen++; }
    else { break; }
  }
  if (hotLen < 2) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (isCold(history[i])) coldLen++;
      else break;
    }
  }

  if (hotLen >= 2) {
    return {
      type: 'hot',
      length: hotLen,
      label: role === 'bat'
        ? `${hotLen} in a row with 25+ runs`
        : `${hotLen} in a row with 2+ wickets`,
      emoji: '🔥',
    };
  }
  if (coldLen >= 2) {
    return {
      type: 'cold',
      length: coldLen,
      label: role === 'bat'
        ? `Under 10 runs in last ${coldLen}`
        : `Wicketless in last ${coldLen} spells`,
      emoji: '🌧️',
    };
  }
  return null;
}

export function computeOpponentBattingStats(history) {
  if (!history || !history.length) return [];
  const map = new Map();
  history.forEach(inn => {
    const opp = (inn.opponent || '').trim();
    if (!opp) return;
    if (!map.has(opp)) map.set(opp, { opponent: opp, inns: 0, runs: 0, notOuts: 0, best: 0 });
    const e = map.get(opp);
    e.inns++;
    e.runs += parseInt(inn.runs) || 0;
    if (inn.notOut) e.notOuts++;
    const r = parseInt(inn.runs) || 0;
    if (r > e.best) e.best = r;
  });
  return [...map.values()].map(e => {
    const denom = e.inns - e.notOuts;
    e.avg = denom > 0 ? (e.runs / denom).toFixed(1) : (e.runs > 0 ? 'N/O' : '—');
    return e;
  }).sort((a, b) => b.inns - a.inns);
}

export function computeOpponentBowlingStats(history) {
  if (!history || !history.length) return [];
  const map = new Map();
  history.forEach(inn => {
    const opp = (inn.opponent || '').trim();
    if (!opp) return;
    if (!map.has(opp)) map.set(opp, { opponent: opp, inns: 0, wickets: 0, runs: 0, best: 0 });
    const e = map.get(opp);
    e.inns++;
    e.wickets += parseInt(inn.wickets) || 0;
    e.runs += parseInt(inn.runs) || 0;
    const w = parseInt(inn.wickets) || 0;
    if (w > e.best) e.best = w;
  });
  return [...map.values()].map(e => {
    e.avg = e.wickets > 0 ? (e.runs / e.wickets).toFixed(1) : '—';
    return e;
  }).sort((a, b) => b.inns - a.inns);
}
