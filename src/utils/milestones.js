export function getNearestMilestones(bat, bowl, rankTotals) {
  const runs    = bat?.runs || 0;
  const sixes   = bat?.sixes || 0;
  const hs      = parseInt(bat?.hs) || 0;
  const wickets = bowl?.wickets || 0;

  const all = [
    { id:'hs50',    label:'Half-Century Hero',  emoji:'🏆', current: hs,      target: 50,  unit: 'runs in one innings' },
    { id:'runs50',  label:'50 Run Club',         emoji:'⭐', current: runs,    target: 50,  unit: 'runs' },
    { id:'runs100', label:'Century Season',      emoji:'💯', current: runs,    target: 100, unit: 'runs' },
    { id:'runs200', label:'200 Run Star',        emoji:'🌟', current: runs,    target: 200, unit: 'runs' },
    { id:'runs300', label:'Triple Century Crew', emoji:'👑', current: runs,    target: 300, unit: 'runs' },
    { id:'sixes5',  label:'Boundary Blaster',    emoji:'💥', current: sixes,   target: 5,   unit: 'sixes' },
    { id:'sixes10', label:'Six Machine',         emoji:'🚀', current: sixes,   target: 10,  unit: 'sixes' },
    { id:'wkts5',   label:'5 Wicket Club',       emoji:'⚡', current: wickets, target: 5,   unit: 'wickets' },
    { id:'wkts10',  label:'10 Wicket Hero',      emoji:'🔥', current: wickets, target: 10,  unit: 'wickets' },
    { id:'wkts20',  label:'20 Wicket Legend',    emoji:'👑', current: wickets, target: 20,  unit: 'wickets' },
  ];

  return all
    .filter(m => m.current < m.target && m.current >= 0)
    .map(m => ({
      ...m,
      pct: Math.round(m.current / m.target * 100),
      remaining: m.target - m.current,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);
}

export function computeBoundaryDistribution(bat) {
  if (!bat) return null;
  const runs  = parseInt(bat.runs) || 0;
  const fours = parseInt(bat.fours) || 0;
  const sixes = parseInt(bat.sixes) || 0;
  if (runs < 10) return null;

  const fourRuns   = fours * 4;
  const sixRuns    = sixes * 6;
  const boundaryRuns = fourRuns + sixRuns;
  const runningRuns  = Math.max(0, runs - boundaryRuns);
  const total = runs;

  const pct = (n) => total > 0 ? Math.round(n / total * 100) : 0;
  const fourPct    = pct(fourRuns);
  const sixPct     = pct(sixRuns);
  const runningPct = Math.max(0, 100 - fourPct - sixPct);
  const boundaryPct = fourPct + sixPct;

  let insight;
  if (boundaryPct >= 90) {
    insight = sixPct >= 35
      ? `You're a six machine — ${sixes} sixes already! When you connect, the ball goes far. 🚀`
      : `Pure boundary hitter — ${boundaryPct}% of your runs come from the rope! 🎯`;
  } else if (boundaryPct >= 65) {
    insight = `Big-shot batter — ${boundaryPct}% of your runs come from boundaries. Smart shot selection!`;
  } else if (boundaryPct >= 35) {
    insight = `Smart cricket — you balance boundaries (${boundaryPct}%) with running between the wickets. That's mature batting!`;
  } else {
    insight = `You build innings the classic way — ${runningPct}% of your runs come from singles and twos. Hard work pays off!`;
  }

  return {
    fourRuns, sixRuns, runningRuns, total,
    fourPct, sixPct, runningPct, boundaryPct,
    fours, sixes,
    insight,
  };
}

export function categorizeDismissal(text) {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  if (!t || /not out|did not bat|retired/i.test(t)) return null;
  if (/c\s*&\s*b|caught and bowled/i.test(t)) return 'caught & bowled';
  if (/^c\b|^ct\b|caught/i.test(t)) return 'caught';
  if (/^st\b|stumped/i.test(t)) return 'stumped';
  if (/lbw/i.test(t)) return 'lbw';
  if (/run out|ro\b/i.test(t)) return 'run out';
  if (/^b\b|bowled/i.test(t)) return 'bowled';
  return 'other';
}

export function computeDismissalProfile(history) {
  if (!history || !history.length) return null;
  const counts = new Map();
  let total = 0;
  history.forEach(inn => {
    const cat = categorizeDismissal(inn.dismissal);
    if (!cat) return;
    counts.set(cat, (counts.get(cat) || 0) + 1);
    total++;
  });
  if (total === 0) return null;

  const items = [...counts.entries()]
    .map(([type, count]) => ({ type, count, pct: Math.round(count / total * 100) }))
    .sort((a, b) => b.count - a.count);

  const TYPE_META = {
    'caught':           { emoji:'🥊', tip:'Try keeping the ball low — half your dismissals are catches!' },
    'caught & bowled':  { emoji:'🥊', tip:'Watch the bowler\'s follow-through, hit through cleaner gaps!' },
    'bowled':           { emoji:'🎯', tip:'Watch the ball longer — bowled means it beat your defense!' },
    'lbw':              { emoji:'🦵', tip:'Get your foot to the pitch of the ball, not across it!' },
    'run out':          { emoji:'🏃', tip:'Communicate with your partner — run-outs are the sneakiest dismissals!' },
    'stumped':          { emoji:'🧤', tip:'Stay grounded against the spinners — stumped means you stepped out!' },
    'other':            { emoji:'❓', tip:'Mixed dismissals — keep working on every part of your game!' },
  };

  const top = items[0];
  let insight;
  if (total < 3) {
    insight = `You're hard to get out — only ${total} dismissal${total>1?'s':''} all season! That's the mark of a real batter. 🛡️`;
  } else if (top.pct >= 50) {
    insight = (TYPE_META[top.type] || TYPE_META.other).tip;
  } else {
    insight = `Your dismissals are spread across ${items.length} types — that means bowlers can't predict you. Keep them guessing! 🎩`;
  }

  return {
    items: items.map(i => ({ ...i, emoji: (TYPE_META[i.type] || TYPE_META.other).emoji })),
    total,
    insight,
  };
}
