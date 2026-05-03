export function rowBoundaryPct(r) {
  const runs = parseInt(r.runs) || 0;
  if (runs <= 0) return 0;
  return Math.round(((parseInt(r.fours)||0)*4 + (parseInt(r.sixes)||0)*6) / runs * 100);
}

export function percentileHigher(values, playerVal) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b);
  let below = 0;
  for (const v of sorted) if (v < playerVal) below++; else break;
  return Math.round(below / sorted.length * 100);
}

export function percentileLower(values, playerVal) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b);
  let above = 0;
  for (let i = sorted.length - 1; i >= 0; i--) if (sorted[i] > playerVal) above++; else break;
  return Math.round(above / sorted.length * 100);
}

export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a,b) => a-b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function computeBattingBenchmark(divisionRows, playerName) {
  const eligible = (divisionRows || []).filter(r => (parseInt(r.inns)||0) > 0);
  if (eligible.length < 5) return null;

  const player = eligible.find(r => String(r.player||'').toLowerCase() === playerName.toLowerCase());
  if (!player) return null;

  const playerRuns = parseInt(player.runs) || 0;
  const playerAvg  = parseFloat(player.avg) || 0;
  const playerSr   = parseFloat(player.sr) || 0;
  const playerSixes = parseInt(player.sixes) || 0;
  const playerBoundaryPct = rowBoundaryPct(player);

  return {
    division: player._div || '',
    totalPlayers: eligible.length,
    runs:    { value: playerRuns,  pct: percentileHigher(eligible.map(r => parseInt(r.runs)||0),     playerRuns) },
    avg:     { value: playerAvg,   pct: percentileHigher(eligible.map(r => parseFloat(r.avg)||0),    playerAvg) },
    sr:      { value: playerSr,    pct: percentileHigher(eligible.map(r => parseFloat(r.sr)||0),     playerSr) },
    sixes:   { value: playerSixes, pct: percentileHigher(eligible.map(r => parseInt(r.sixes)||0),    playerSixes) },
    boundaryPct: { value: playerBoundaryPct, pct: percentileHigher(eligible.map(rowBoundaryPct), playerBoundaryPct) },
    medianAvg: median(eligible.map(r => parseFloat(r.avg)||0)),
    medianSr:  median(eligible.map(r => parseFloat(r.sr)||0)),
    medianBoundaryPct: median(eligible.map(rowBoundaryPct)),
  };
}

export function computeBowlingBenchmark(divisionRows, playerName) {
  const eligible = (divisionRows || []).filter(r => (parseInt(r.inns)||0) > 0 && (parseFloat(r.overs)||0) > 0);
  if (eligible.length < 5) return null;

  const player = eligible.find(r => String(r.player||'').toLowerCase() === playerName.toLowerCase());
  if (!player) return null;

  const playerWkts = parseInt(player.wickets) || 0;
  const playerEcon = parseFloat(player.econ) || 0;
  const playerMaidens = parseInt(player.maidens) || 0;

  return {
    division: player._div || '',
    totalPlayers: eligible.length,
    wickets: { value: playerWkts,    pct: percentileHigher(eligible.map(r => parseInt(r.wickets)||0),  playerWkts) },
    econ:    { value: playerEcon,    pct: percentileLower (eligible.map(r => parseFloat(r.econ)||0),   playerEcon) },
    maidens: { value: playerMaidens, pct: percentileHigher(eligible.map(r => parseInt(r.maidens)||0),  playerMaidens) },
    medianWickets: median(eligible.map(r => parseInt(r.wickets)||0)),
    medianEcon:    median(eligible.map(r => parseFloat(r.econ)||0)),
  };
}

export function getBattingArchetype(playerStats, benchmark) {
  if (!playerStats || (parseInt(playerStats.inns)||0) < 5) {
    return { label: 'Just Starting', emoji: '🌱', desc: 'Building your story — every match counts.' };
  }
  if (!benchmark) return null;
  const avg = parseFloat(playerStats.avg) || 0;
  const sr  = parseFloat(playerStats.sr)  || 0;
  const highAvg = avg >= benchmark.medianAvg;
  const highSr  = sr  >= benchmark.medianSr;

  if (highAvg && highSr)   return { label: 'Star Performer',  emoji: '🌟', desc: 'Above-median in both runs AND tempo. Rare combo.' };
  if (highAvg && !highSr)  return { label: 'The Anchor',      emoji: '🛡️', desc: 'You build innings and steady the chase.' };
  if (!highAvg && highSr)  return { label: 'Boundary Hitter', emoji: '💥', desc: 'Quick-scoring impact player. Bigs cameos.' };
  return { label: 'Developing', emoji: '🌱', desc: 'On the path — every match builds your foundation.' };
}

export function getBowlingArchetype(playerStats, benchmark) {
  if (!playerStats || (parseFloat(playerStats.overs)||0) < 5) {
    return { label: 'Just Starting', emoji: '🌱', desc: 'Building your craft — keep bowling those overs.' };
  }
  if (!benchmark) return null;
  const econ = parseFloat(playerStats.econ) || 99;
  const wkts = parseInt(playerStats.wickets) || 0;
  const lowEcon = econ <= benchmark.medianEcon;
  const highWkts = wkts >= benchmark.medianWickets;

  if (lowEcon && highWkts)   return { label: 'Match Winner',  emoji: '🎯', desc: 'You restrict runs AND take wickets. Devastating.' };
  if (lowEcon && !highWkts)  return { label: 'The Defender',  emoji: '🛡️', desc: 'Tight lines, building pressure for breakthroughs.' };
  if (!lowEcon && highWkts)  return { label: 'Wicket Hunter', emoji: '⚡', desc: 'Goes for runs but gets the big breakthroughs.' };
  return { label: 'Developing', emoji: '🌱', desc: 'On the path — every spell sharpens your craft.' };
}
