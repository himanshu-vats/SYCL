import { aggregateBatting, aggregateBowling } from '../utils/aggregation.js';
import { computeBattingBenchmark, computeBowlingBenchmark, getBattingArchetype, getBowlingArchetype } from '../utils/insights.js';
import { getPlayerInningsHistory, computeBestBattingInnings, computeBestBowlingSpell, detectCurrentStreak, computeOpponentBattingStats, computeOpponentBowlingStats, formatMatchDate, computeMatchChartData, computePlayerRadar, computeImpactRating, computeRollingAverage } from '../utils/innings.js';
import { getNearestMilestones, computeBoundaryDistribution, computeDismissalProfile } from '../utils/milestones.js';
import { ACHIEVEMENTS } from '../constants.js';
import FormCurve from './FormCurve.jsx';
import { ImpactRatingCard, RunsWicketsChart, FormTrendChart, PlayerRadarChart } from './PlayerCharts.jsx';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export default function PlayerProfilePage({ name, batting, bowling, rankings, playerInnings, onClose, onTeamDrilldown }) {
  const batRows = batting ? Object.entries(batting).filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([div, rows]) => Array.isArray(rows) ? rows.filter(r => String(r.player||'').toLowerCase() === name.toLowerCase()).map(r => ({...r, _div:div})) : []) : [];
  const bowlRows = bowling ? Object.entries(bowling).filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([div, rows]) => Array.isArray(rows) ? rows.filter(r => String(r.player||'').toLowerCase() === name.toLowerCase()).map(r => ({...r, _div:div})) : []) : [];
  const rankRows = rankings ? Object.entries(rankings).filter(([k]) => k !== 'updatedAt' && k !== 'combined')
    .flatMap(([div, rows]) => Array.isArray(rows) ? rows.filter(r => String(r.player||'').toLowerCase() === name.toLowerCase()).map(r => ({...r, _div:div})) : []) : [];

  const teams = [...new Set([...batRows, ...bowlRows].map(r => r.team).filter(Boolean))];
  const bat = aggregateBatting(batRows)[0] || null;
  const bowl = aggregateBowling(bowlRows)[0] || null;
  const rankTotals = rankRows.reduce((a,r) => ({ total: a.total + (Number(r.total)||0), batting: a.batting + (Number(r.batting)||0), bowling: a.bowling + (Number(r.bowling)||0), mom: Math.max(a.mom, Number(r.mom)||0) }), {total:0,batting:0,bowling:0,mom:0});

  const primaryBatRow = batRows.length === 0 ? null
    : batRows.reduce((a,b) => (parseInt(b.inns)||0) > (parseInt(a.inns)||0) ? b : a);
  const primaryBowlRow = bowlRows.length === 0 ? null
    : bowlRows.reduce((a,b) => (parseInt(b.inns)||0) > (parseInt(a.inns)||0) ? b : a);

  const battingBenchmark = primaryBatRow
    ? computeBattingBenchmark(batting?.[primaryBatRow._div], name)
    : null;
  const bowlingBenchmark = primaryBowlRow
    ? computeBowlingBenchmark(bowling?.[primaryBowlRow._div], name)
    : null;

  const battingArchetype = primaryBatRow ? getBattingArchetype(primaryBatRow, battingBenchmark) : null;
  const bowlingArchetype = primaryBowlRow ? getBowlingArchetype(primaryBowlRow, bowlingBenchmark) : null;

  const battingHistory = getPlayerInningsHistory(playerInnings || [], name, 'bat');
  const bowlingHistory = getPlayerInningsHistory(playerInnings || [], name, 'bowl');
  const bestBattingInnings = computeBestBattingInnings(playerInnings || [], name);
  const bestBowlingSpell   = computeBestBowlingSpell(playerInnings || [], name);
  const battingStreak = detectCurrentStreak(battingHistory, 'bat');
  const bowlingStreak = detectCurrentStreak(bowlingHistory, 'bowl');
  const battingVsOpps = computeOpponentBattingStats(battingHistory).slice(0, 5);
  const bowlingVsOpps = computeOpponentBowlingStats(bowlingHistory).slice(0, 5);
  const hasMatchData = battingHistory.length > 0 || bowlingHistory.length > 0;
  const primary = bowlingHistory.length > battingHistory.length ? 'bowling' : 'batting';

  const milestones = getNearestMilestones(bat, bowl, rankTotals);
  const boundaryDist = computeBoundaryDistribution(bat);
  const donutData = boundaryDist ? [
    { name: 'Fours', value: boundaryDist.fourRuns, color: '#1565c0', pct: boundaryDist.fourPct },
    { name: 'Sixes', value: boundaryDist.sixRuns, color: '#7b1fa2', pct: boundaryDist.sixPct },
    { name: 'Running', value: boundaryDist.runningRuns, color: '#9ca3af', pct: boundaryDist.runningPct },
  ].filter(d => d.value > 0) : [];
  const dismissalProfile = computeDismissalProfile(battingHistory);

  const matchChartData = computeMatchChartData(battingHistory, bowlingHistory);
  const playerRadar = computePlayerRadar(bat, bowl, battingHistory, bowlingHistory);
  const impactRating = computeImpactRating(bat, bowl, battingBenchmark, bowlingBenchmark);

  const splitAvg = (inns) => {
    const runs = inns.reduce((s,i) => s + (parseInt(i.runs)||0), 0);
    const dism = inns.filter(i => !i.notOut).length;
    if (!inns.length) return '—';
    return dism === 0 ? runs + '*' : (runs / dism).toFixed(1);
  };
  const wonBatInns  = battingHistory.filter(i => i.result && /\bwon\b|\bwin\b/i.test(i.result));
  const lostBatInns = battingHistory.filter(i => i.result && /\blo(?:s[st])\b/i.test(i.result));
  const winSplit = (wonBatInns.length + lostBatInns.length >= 3) ? {
    won:  { inns: wonBatInns.length,  avg: splitAvg(wonBatInns),  runs: wonBatInns.reduce((s,i)=>s+(parseInt(i.runs)||0),0) },
    lost: { inns: lostBatInns.length, avg: splitAvg(lostBatInns), runs: lostBatInns.reduce((s,i)=>s+(parseInt(i.runs)||0),0) },
  } : null;

  const earnedAchievements = ACHIEVEMENTS.filter(a => a.check(bat, bowl, rankTotals)).map(a => ({ ...a, earned: true }));
  const lockedAchievements = ACHIEVEMENTS.filter(a => !a.check(bat, bowl, rankTotals) && a.hint).slice(0, 4).map(a => ({ ...a, earned: false, hintText: typeof a.hint === 'function' ? a.hint(bat, bowl, rankTotals) : null }));

  const spotlightLines = [];
  if (bowl && parseFloat(bowl.econ) <= 6.0 && parseFloat(bowl.overs) >= 5) spotlightLines.push(`Economy Rate Expert — Conceding only ${bowl.econ} runs/over!`);
  if (bat && bat.sixes >= 5) spotlightLines.push(`Boundary Blaster — ${bat.sixes} sixes and counting!`);
  if (bat && parseInt(bat.hs) >= 50) spotlightLines.push(`Half-Century Hero — Hit a brilliant ${bat.hs}!`);
  if (bat && bat.inns >= 5 && parseFloat(bat.avg) >= 25) spotlightLines.push(`Consistent Performer — Averaging ${bat.avg} runs per innings`);
  if (bowl && bowl.wickets >= 10) spotlightLines.push(`Wicket Machine — ${bowl.wickets} wickets this season!`);
  if (bowl && bowl.fiveW >= 1) spotlightLines.push(`Five-For Legend — Claimed a 5-wicket haul!`);
  if (bowl && bowl.maidens >= 3) spotlightLines.push(`Maiden Master — ${bowl.maidens} maiden overs bowled!`);
  if (spotlightLines.length === 0) spotlightLines.push(`Keep going — every match makes you better!`);

  const spotlight = spotlightLines.slice(0, 2).join(' ');

  const battingSection = !bat ? null : (
    <div className="profile-section">
      <div style={{fontSize: 13, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', color: 'var(--text-muted)'}}>Batting</div>
      <div className="mega-stat">{bat.hs}</div>
      <div className="mega-stat-lbl">Highest Score</div>
      {milestones.filter(m => m.id.startsWith('runs') || m.id.startsWith('hs') || m.id.startsWith('sixes')).length > 0 && (
        <div className="smart-milestones">
          {milestones.filter(m => m.id.startsWith('runs') || m.id.startsWith('hs') || m.id.startsWith('sixes')).slice(0,3).map(m => (
            <div key={m.id} className="smart-milestone">
              <div className="sm-header">
                <span className="sm-emoji">{m.emoji}</span>
                <span className="sm-label">{m.label}</span>
                <span className="sm-remaining">{m.remaining} more {m.unit} to go</span>
              </div>
              <div className="milestone-bar">
                <div className="milestone-bar-fill" style={{width:`${m.pct}%`}} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="stat-tile-grid">
        {[
          ['Runs', bat.runs, 'Total runs scored this season'],
          ['Average', bat.avg, 'Runs per dismissal (excluding not-outs)'],
          ['Strike Rate', bat.sr, 'Runs scored per 100 balls faced'],
          ['Fours', bat.fours, 'Boundary 4s hit'],
          ['Sixes', bat.sixes, 'Boundary 6s hit'],
          ['Boundary %', bat.boundaryPct, 'Percent of runs from 4s and 6s']
        ].map(([l,v,desc]) => (
          <div key={l} className="stat-tile" title={desc}>
            <div className="stat-tile-val">{v??'—'}</div>
            <div className="stat-tile-lbl">{l}</div>
          </div>
        ))}
      </div>
      {boundaryDist && donutData.length > 0 && (
        <div className="boundary-dist">
          <div className="boundary-dist-title">Where Your Runs Come From</div>
          <div className="donut-wrapper">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  stroke="none"
                  label={({ cx, cy, midAngle, outerRadius, name, payload }) => {
                    const RADIAN = Math.PI / 180;
                    const r = outerRadius + 28;
                    const x = cx + r * Math.cos(-midAngle * RADIAN);
                    const y = cy + r * Math.sin(-midAngle * RADIAN);
                    return (
                      <text x={x} y={y} fill="#1a1a1a" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight={500}>
                        {name} {payload.pct}%
                      </text>
                    );
                  }}
                  labelLine={({ cx, cy, midAngle, outerRadius }) => {
                    const RADIAN = Math.PI / 180;
                    const startR = outerRadius + 4;
                    const endR = outerRadius + 22;
                    const x1 = cx + startR * Math.cos(-midAngle * RADIAN);
                    const y1 = cy + startR * Math.sin(-midAngle * RADIAN);
                    const x2 = cx + endR * Math.cos(-midAngle * RADIAN);
                    const y2 = cy + endR * Math.sin(-midAngle * RADIAN);
                    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#888" strokeWidth={1} />;
                  }}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v} runs`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">{boundaryDist.total}</div>
          </div>
          <div className="boundary-legend">
            {donutData.map(d => (
              <span key={d.name} className="bd-item" style={{'--bd-color': d.color}}>
                {d.name}: {d.value} runs
              </span>
            ))}
          </div>
          <div className="insight-text">{boundaryDist.insight}</div>
        </div>
      )}
      {battingHistory.length >= 2 && (
        <>
          <FormCurve innings={battingHistory} statKey="runs" label="runs" />
          {battingHistory.length >= 4 && (
            <FormTrendChart battingHistory={battingHistory} bowlingHistory={[]} />
          )}
          {battingStreak && (
            <div className={`streak-pill streak-${battingStreak.type}`}>
              <span>{battingStreak.emoji}</span> {battingStreak.label}
            </div>
          )}
        </>
      )}
      {battingVsOpps.length > 0 && (
        <div className="opp-block">
          <div className="opp-title">Vs Opponents</div>
          <div className="opp-rows">
            {battingVsOpps.map(o => (
              <div key={o.opponent} className="opp-row">
                <div className="opp-name">{o.opponent}</div>
                <div className="opp-stats">
                  <span>{o.inns} inns</span>
                  <span>·</span>
                  <span>avg <strong>{o.avg}</strong></span>
                  <span>·</span>
                  <span>best <strong>{o.best}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {dismissalProfile && (
        <div className="dismissal-profile">
          <div className="dismissal-profile-title">How You Get Out</div>
          <div className="dismissal-bars">
            {dismissalProfile.items.map(item => (
              <div key={item.type} className="dismissal-row">
                <span className="dismissal-emoji">{item.emoji}</span>
                <span className="dismissal-type">{item.type}</span>
                <div className="dismissal-bar-wrap">
                  <div className="dismissal-bar-fill" style={{width:`${item.pct}%`}} />
                </div>
                <span className="dismissal-count">{item.count}×</span>
              </div>
            ))}
          </div>
          <div className="insight-text">{dismissalProfile.insight}</div>
        </div>
      )}
      {winSplit && (
        <div className="win-split">
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Batting Average by Match Result
          </div>
          <div className="win-split-grid">
            <div className="win-split-col win-col">
              <div className="win-split-badge">When Team Wins</div>
              <div className="win-split-avg">{winSplit.won.avg}</div>
              <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>batting avg</div>
              <div className="win-split-meta">{winSplit.won.inns} inns · {winSplit.won.runs} runs</div>
            </div>
            <div className="win-split-col loss-col">
              <div className="win-split-badge">When Team Loses</div>
              <div className="win-split-avg">{winSplit.lost.avg}</div>
              <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>batting avg</div>
              <div className="win-split-meta">{winSplit.lost.inns} inns · {winSplit.lost.runs} runs</div>
            </div>
          </div>
          {(() => {
            const wA = parseFloat(winSplit.won.avg), lA = parseFloat(winSplit.lost.avg);
            if (!isNaN(wA) && !isNaN(lA) && wA > 0 && lA > 0) {
              if (wA >= lA * 1.3) return <div className="insight-text">You lift when the team needs it most — your average in wins ({winSplit.won.avg}) is noticeably higher. Keep bringing that big-match energy!</div>;
              if (lA >= wA * 1.3) return <div className="insight-text">You&apos;re a fighter! You actually score more when the team is under pressure ({winSplit.lost.avg} avg vs {winSplit.won.avg}). A true match-saver in the making!</div>;
            }
            return <div className="insight-text">Consistent performer — you deliver in both winning and losing matches. That reliability is priceless!</div>;
          })()}
        </div>
      )}
      {battingBenchmark && (
        <div className="benchmark-block">
          <div className="benchmark-title">Where you stand in {battingBenchmark.division} <span className="benchmark-meta">({battingBenchmark.totalPlayers} batters)</span></div>
          {[
            ['Runs',         battingBenchmark.runs],
            ['Average',      battingBenchmark.avg],
            ['Strike Rate',  battingBenchmark.sr],
            ['Boundary %',   battingBenchmark.boundaryPct],
            ['Sixes',        battingBenchmark.sixes],
          ].map(([label, stat]) => stat.pct == null ? null : (
            <div key={label} className="benchmark-row">
              <div className="benchmark-row-label">{label}</div>
              <div className="benchmark-bar-wrap">
                <div className="benchmark-bar-fill" style={{width: `${stat.pct}%`, background: stat.pct >= 75 ? 'var(--clr-ok)' : stat.pct >= 50 ? 'var(--accent)' : 'var(--z-300)'}} />
              </div>
              <div className="benchmark-row-val">{stat.pct >= 50 ? `Top ${Math.max(1, 100 - stat.pct)}%` : `${stat.pct}%ile`}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const bowlingSection = !bowl ? null : (
    <div className="profile-section">
      <div style={{fontSize: 13, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', color: 'var(--text-muted)'}}>Bowling</div>
      <div className="mega-stat">{bowl.bbf}</div>
      <div className="mega-stat-lbl">Best Figures</div>
      {milestones.filter(m => m.id.startsWith('wkts')).length > 0 && (
        <div className="smart-milestones">
          {milestones.filter(m => m.id.startsWith('wkts')).map(m => (
            <div key={m.id} className="smart-milestone">
              <div className="sm-header">
                <span className="sm-emoji">{m.emoji}</span>
                <span className="sm-label">{m.label}</span>
                <span className="sm-remaining">{m.remaining} more {m.unit} to go</span>
              </div>
              <div className="milestone-bar">
                <div className="milestone-bar-fill" style={{width:`${m.pct}%`}} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="stat-tile-grid">
        {[
          ['Wickets', bowl.wickets, 'Total wickets taken'],
          ['Economy', bowl.econ, 'Runs conceded per over'],
          ['Average', bowl.avg, 'Runs conceded per wicket'],
          ['Maidens', bowl.maidens, 'Overs where no runs were conceded'],
          ['Dots %', bowl.dotPct, 'Percent of balls that were dot balls'],
          ['Extras / Over', bowl.extrasPer6, 'Wides + no-balls per over']
        ].map(([l,v,desc]) => (
          <div key={l} className="stat-tile" title={desc}>
            <div className="stat-tile-val">{v??'—'}</div>
            <div className="stat-tile-lbl">{l}</div>
          </div>
        ))}
      </div>
      {bowlingHistory.length >= 2 && (
        <>
          <FormCurve innings={bowlingHistory} statKey="wickets" label="wkts" />
          {bowlingStreak && (
            <div className={`streak-pill streak-${bowlingStreak.type}`}>
              <span>{bowlingStreak.emoji}</span> {bowlingStreak.label}
            </div>
          )}
        </>
      )}
      {bowlingVsOpps.length > 0 && (
        <div className="opp-block">
          <div className="opp-title">Vs Opponents</div>
          <div className="opp-rows">
            {bowlingVsOpps.map(o => (
              <div key={o.opponent} className="opp-row">
                <div className="opp-name">{o.opponent}</div>
                <div className="opp-stats">
                  <span>{o.inns} spells</span>
                  <span>·</span>
                  <span><strong>{o.wickets}</strong> wkts</span>
                  <span>·</span>
                  <span>best <strong>{o.best}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {bowlingBenchmark && (
        <div className="benchmark-block">
          <div className="benchmark-title">Where you stand in {bowlingBenchmark.division} <span className="benchmark-meta">({bowlingBenchmark.totalPlayers} bowlers)</span></div>
          {[
            ['Wickets', bowlingBenchmark.wickets],
            ['Economy', bowlingBenchmark.econ],
            ['Maidens', bowlingBenchmark.maidens],
          ].map(([label, stat]) => stat.pct == null ? null : (
            <div key={label} className="benchmark-row">
              <div className="benchmark-row-label">{label}</div>
              <div className="benchmark-bar-wrap">
                <div className="benchmark-bar-fill" style={{width: `${stat.pct}%`, background: stat.pct >= 75 ? 'var(--clr-ok)' : stat.pct >= 50 ? 'var(--accent)' : 'var(--z-300)'}} />
              </div>
              <div className="benchmark-row-val">{stat.pct >= 50 ? `Top ${Math.max(1, 100 - stat.pct)}%` : `${stat.pct}%ile`}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="player-page">
      <div className="player-hero">
        <div className="player-name-lg">{name}</div>
        <div className="player-meta">
          {teams.length > 0 && <span>{teams.map((t, i) => <span key={t}>{i > 0 ? ', ' : ''}<span className="clickable" onClick={() => { onClose(); onTeamDrilldown({type:'team',name:t}); }}>{t}</span></span>)}</span>}
        </div>
      </div>

      <div className="headline-pills">
        {primary === 'bowling' ? (
          <div className="headline-pill">
            <div className="headline-pill-val">{bowl?.wickets || 0}</div>
            <div className="headline-pill-lbl">Wickets</div>
          </div>
        ) : (
          <div className="headline-pill">
            <div className="headline-pill-val">{bat?.runs || 0}</div>
            <div className="headline-pill-lbl">Runs</div>
          </div>
        )}
        {primary === 'bowling' ? (
          <div className="headline-pill">
            <div className="headline-pill-val">{bat?.runs || 0}</div>
            <div className="headline-pill-lbl">Runs</div>
          </div>
        ) : (
          <div className="headline-pill">
            <div className="headline-pill-val">{bowl?.wickets || 0}</div>
            <div className="headline-pill-lbl">Wickets</div>
          </div>
        )}
        <div className="headline-pill">
          <div className="headline-pill-val">{bat?.matches || bowl?.matches || battingHistory.length || bowlingHistory.length || 0}</div>
          <div className="headline-pill-lbl">Matches</div>
        </div>
      </div>

      {spotlight && <div className="spotlight-banner"><div className="spotlight-title">Spotlight</div><div className="spotlight-text">{spotlight}</div></div>}

      {impactRating && impactRating.score > 0 && (
        <div className="profile-section impact-rating-section">
          <div className="section-label">Season Impact Rating</div>
          <ImpactRatingCard score={impactRating.score} label={impactRating.label} trend={impactRating.trend} />
        </div>
      )}

      {(battingArchetype || bowlingArchetype) && (bat || bowl) && (
        <div className="profile-section">
          <div style={{fontSize: 13, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', color: 'var(--text-muted)'}}>Your Style</div>
          <div className="archetype-grid">
            {bat && battingArchetype && (
              <div className="archetype-card">
                <div className="archetype-emoji">{battingArchetype.emoji}</div>
                <div className="archetype-content">
                  <div className="archetype-kind">Batting</div>
                  <div className="archetype-label">{battingArchetype.label}</div>
                  <div className="archetype-desc">{battingArchetype.desc}</div>
                </div>
              </div>
            )}
            {bowl && bowlingArchetype && (
              <div className="archetype-card">
                <div className="archetype-emoji">{bowlingArchetype.emoji}</div>
                <div className="archetype-content">
                  <div className="archetype-kind">Bowling</div>
                  <div className="archetype-label">{bowlingArchetype.label}</div>
                  <div className="archetype-desc">{bowlingArchetype.desc}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {(bat || bowl) && playerRadar && (
        <div className="profile-section">
          <div className="section-label">Player Profile Radar</div>
          <PlayerRadarChart radar={playerRadar} />
        </div>
      )}

      {(bestBattingInnings || bestBowlingSpell) && (
        <div className="profile-section">
          <div style={{fontSize: 13, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', color: 'var(--text-muted)'}}>Career Highlights</div>
          <div className="highlight-grid">
            {bestBattingInnings && (
              <div className="highlight-card">
                <div className="highlight-badge">🌟 Best Innings</div>
                <div className="highlight-stat">
                  {bestBattingInnings.runs}{bestBattingInnings.notOut ? '*' : ''}
                  {bestBattingInnings.balls > 0 && <span className="highlight-stat-meta"> ({bestBattingInnings.balls})</span>}
                </div>
                <div className="highlight-context">
                  {bestBattingInnings.team && bestBattingInnings.opponent && (
                    <div>vs <strong>{bestBattingInnings.opponent}</strong></div>
                  )}
                  {(bestBattingInnings.fours || bestBattingInnings.sixes) ? (
                    <div className="highlight-meta">
                      {bestBattingInnings.fours > 0 && `${bestBattingInnings.fours}×4`}
                      {bestBattingInnings.fours > 0 && bestBattingInnings.sixes > 0 && ' · '}
                      {bestBattingInnings.sixes > 0 && `${bestBattingInnings.sixes}×6`}
                      {bestBattingInnings._sr > 0 && ` · SR ${bestBattingInnings._sr.toFixed(0)}`}
                    </div>
                  ) : null}
                  <div className="highlight-date">{formatMatchDate(bestBattingInnings.date)}</div>
                </div>
              </div>
            )}
            {bestBowlingSpell && (
              <div className="highlight-card">
                <div className="highlight-badge">🎯 Best Spell</div>
                <div className="highlight-stat">
                  {bestBowlingSpell.wickets}/{bestBowlingSpell.runs}
                  <span className="highlight-stat-meta"> ({bestBowlingSpell.overs})</span>
                </div>
                <div className="highlight-context">
                  {bestBowlingSpell.opponent && (
                    <div>vs <strong>{bestBowlingSpell.opponent}</strong></div>
                  )}
                  <div className="highlight-meta">
                    {bestBowlingSpell.maidens > 0 && `${bestBowlingSpell.maidens} maiden${bestBowlingSpell.maidens>1?'s':''}`}
                    {bestBowlingSpell.maidens > 0 && bestBowlingSpell._econ < 99 && ' · '}
                    {bestBowlingSpell._econ < 99 && `Econ ${bestBowlingSpell._econ.toFixed(1)}`}
                  </div>
                  <div className="highlight-date">{formatMatchDate(bestBowlingSpell.date)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {primary === 'bowling' ? <>{bowlingSection}{battingSection}</> : <>{battingSection}{bowlingSection}</>}

      {(earnedAchievements.length > 0 || lockedAchievements.length > 0) && <div className="profile-section">
        <div style={{fontSize: 13, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', color: 'var(--text-muted)'}}>Achievements</div>
        <div className="achievements-grid">
          {earnedAchievements.map(a => <div key={a.id} className={`achievement-card earned tier-${a.tier}`}>
            <div className="achievement-emoji">{a.emoji}</div>
            <div className="achievement-label">{a.label}</div>
          </div>)}
          {lockedAchievements.map(a => <div key={a.id} className="achievement-card locked">
            <div className="achievement-emoji" style={{opacity: 0.4}}>{a.emoji}</div>
            <div className="achievement-label">{a.label}</div>
            {a.hintText && <div className="achievement-hint">{a.hintText}</div>}
          </div>)}
        </div>
      </div>}

      {matchChartData.length >= 3 && (
        <div className="profile-section">
          <div className="section-label">Match-by-Match Performance</div>
          <RunsWicketsChart data={matchChartData} />
        </div>
      )}

      {hasMatchData && (
        <div className="profile-section">
          <div style={{fontSize:13,fontWeight:700,marginBottom:12,textTransform:'uppercase',color:'var(--text-muted)'}}>Match by Match</div>
          <div className="story-strip">
            {(battingHistory.length > 0 ? [...battingHistory].reverse() : [...bowlingHistory].reverse()).slice(0, 15).map((inn, idx) => {
              const isBat = inn.role === 'bat';
              const won  = inn.result && /\bwon\b|\bwin\b/i.test(inn.result);
              const lost = inn.result && /\blo(?:s[st])\b/i.test(inn.result);
              return (
                <div key={idx} className={`story-card${won ? ' story-win' : lost ? ' story-loss' : ''}`}>
                  <div className="story-opp">{inn.opponent || 'vs ?'}</div>
                  {isBat
                    ? <div className="story-score">{inn.runs ?? '—'}{inn.notOut ? '*' : ''}</div>
                    : <div className="story-score">{inn.wickets}/{inn.runs}</div>
                  }
                  <div className="story-meta">
                    {isBat
                      ? (inn.balls > 0 ? `${inn.balls}b` : '') + (inn.fours > 0 ? ` ${inn.fours}×4` : '') + (inn.sixes > 0 ? ` ${inn.sixes}×6` : '')
                      : `${inn.overs || '?'} ov${inn.maidens > 0 ? ` ${inn.maidens}m` : ''}`
                    }
                  </div>
                  <div className="story-date">{formatMatchDate(inn.date)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
