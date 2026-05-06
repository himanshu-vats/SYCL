export function parseInningsDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// result strings are always "[WinnerTeam] won by X" — check if player's own team is the winner
export function didTeamWin(inn) {
  if (!inn.result || !inn.team) return null;
  return inn.result.trim().toLowerCase().startsWith(inn.team.trim().toLowerCase());
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
    const won = didTeamWin(inn) === true;
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
    const won = didTeamWin(inn) === true;
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

export function computeMatchChartData(battingHistory, bowlingHistory) {
  const map = new Map();
  const makeKey = (opp, date) => `${(opp||'').trim()}|${date||''}`;
  const oversToBalls = ov => { const p = String(ov||0).split('.'); return (parseInt(p[0]||0)*6) + parseInt(p[1]||0); };

  (battingHistory||[]).forEach(inn => {
    const k = makeKey(inn.opponent, inn.date);
    if (!map.has(k)) map.set(k, { opponent: inn.opponent, date: inn.date, runs: 0, wickets: 0, econ: null, win: null });
    const e = map.get(k);
    e.runs = Math.max(e.runs, parseInt(inn.runs)||0);
    if (inn.result) e.win = didTeamWin(inn);
  });

  (bowlingHistory||[]).forEach(inn => {
    const k = makeKey(inn.opponent, inn.date);
    if (!map.has(k)) map.set(k, { opponent: inn.opponent, date: inn.date, runs: 0, wickets: 0, econ: null, win: null });
    const e = map.get(k);
    e.wickets += parseInt(inn.wickets)||0;
    const balls = oversToBalls(inn.overs);
    if (balls > 0) e.econ = Math.round((inn.runs * 6 / balls) * 10) / 10;
    if (e.win === null && inn.result) e.win = didTeamWin(inn);
  });

  return [...map.values()]
    .sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return da - db;
    })
    .slice(-15)
    .map(e => ({
      label: (e.opponent || '?').slice(0, 8),
      runs: e.runs,
      wickets: e.wickets,
      econ: e.econ,
      win: e.win,
    }));
}

export function computeImpactRating(bat, bowl, battingBenchmark, bowlingBenchmark) {
  if (!bat && !bowl) return { score: 0, label: 'No Data', trend: 'stable' };

  let batContrib = 0;
  if (bat) {
    const runs = parseInt(bat.runs) || 0;
    const avg = parseFloat(bat.avg) || 0;
    const sr = parseFloat(bat.sr) || 0;
    batContrib = Math.min(50, (runs / 200) * 40 + (avg / 50) * 30 + (sr / 200) * 30);
  }

  let bowlContrib = 0;
  if (bowl) {
    const wickets = parseInt(bowl.wickets) || 0;
    const econ = parseFloat(bowl.econ) || 0;
    const maidens = parseInt(bowl.maidens) || 0;
    bowlContrib = Math.min(50, (wickets / 20) * 40 + ((12 - Math.min(econ, 12)) / 12) * 40 + (maidens / 10) * 20);
  }

  const score = Math.max(0, Math.min(100, Math.round(batContrib + bowlContrib)));

  let label;
  if (score <= 30) label = 'Developing';
  else if (score <= 50) label = 'Contributor';
  else if (score <= 70) label = 'Key Player';
  else if (score <= 85) label = 'Star';
  else label = 'Elite';

  let trend = 'stable';

  return { score, label, trend };
}

export function computePlayerRadar(bat, bowl, battingHistory, bowlingHistory) {
  let attack = 0;
  if (bat) {
    const sr = parseFloat(bat.sr) || 0;
    const sixes = parseInt(bat.sixes) || 0;
    attack = Math.min(100, (sr / 200) * 50 + (sixes / 10) * 50);
  }

  let defense = 0;
  if (bat) {
    const avg = parseFloat(bat.avg) || 0;
    defense = Math.min(100, (avg / 40) * 100);
  } else if (bowl) {
    const econ = parseFloat(bowl.econ) || 0;
    defense = Math.min(100, Math.max(0, (1 - Math.min(econ, 12) / 12) * 100));
  }

  let consistency = 0;
  const last5 = (battingHistory||[]).slice(-5);
  if (last5.length >= 2) {
    const runs = last5.map(i => parseInt(i.runs) || 0);
    const mean = runs.reduce((s, v) => s + v, 0) / runs.length;
    const variance = runs.reduce((s, v) => s + (v - mean) ** 2, 0) / runs.length;
    const stddev = Math.sqrt(variance);
    consistency = Math.max(0, 100 - stddev * 2);
  }

  const impactResult = computeImpactRating(bat, bowl, null, null);

  let allround = 0;
  if (bat && bowl) {
    allround = Math.round((attack + defense) / 2);
  }

  const clamp = v => Math.max(0, Math.min(100, Math.round(v)));

  return {
    attack: clamp(attack),
    defense: clamp(defense),
    consistency: clamp(consistency),
    impact: clamp(impactResult.score),
    allround: clamp(allround),
  };
}

export function computeRollingAverage(history, statKey, n = 3) {
  if (!history || history.length < n) return [];
  const result = [];
  for (let i = n - 1; i < history.length; i++) {
    const window = history.slice(i - n + 1, i + 1);
    const sum = window.reduce((s, inn) => s + (parseInt(inn[statKey]) || 0), 0);
    result.push({
      match: i + 1,
      value: Math.round(sum / window.length * 10) / 10,
      label: history[i].opponent || '?',
    });
  }
  return result;
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
