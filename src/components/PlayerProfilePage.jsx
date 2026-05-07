import { useState, useEffect } from 'react';
import AiSummaryBlock from './AiSummaryBlock.jsx';
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

  const allBattingRows = batting ? Object.entries(batting).filter(([k])=>k!=='updatedAt'&&k!=='combined').flatMap(([,rows])=>Array.isArray(rows)?rows:[]) : [];
  const allBowlingRows = bowling ? Object.entries(bowling).filter(([k])=>k!=='updatedAt'&&k!=='combined').flatMap(([,rows])=>Array.isArray(rows)?rows:[]) : [];

  const battingBenchmark = primaryBatRow
    ? computeBattingBenchmark(batting?.[primaryBatRow._div], name, allBattingRows)
    : null;
  const bowlingBenchmark = primaryBowlRow
    ? computeBowlingBenchmark(bowling?.[primaryBowlRow._div], name, allBowlingRows)
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
  const wonBatInns  = battingHistory.filter(i => i.result && i.result.trim().toLowerCase().startsWith((i.team||'').trim().toLowerCase()) && i.team);
  const lostBatInns = battingHistory.filter(i => i.result && i.team && !i.result.trim().toLowerCase().startsWith(i.team.trim().toLowerCase()));
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

  // ── Head-to-Head Player Comparison ──
  const [comparePlayer, setComparePlayer] = useState(null);
  const [compareSearch, setCompareSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState(bat ? 'batting' : bowl ? 'bowling' : 'history');

  const allPlayers = [...new Set([
    ...Object.values(batting||{}).flatMap(rows => Array.isArray(rows) ? rows.map(r=>r.player) : []),
    ...Object.values(bowling||{}).flatMap(rows => Array.isArray(rows) ? rows.map(r=>r.player) : []),
  ])].filter(p => p && p.toLowerCase() !== name.toLowerCase()).sort();

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/compare=([^&]+)/);
    if (match) {
      const decoded = decodeURIComponent(match[1]);
      if (decoded !== comparePlayer) setComparePlayer(decoded);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (comparePlayer === null) {
      const hash = window.location.hash;
      if (hash.includes('compare=')) {
        const clean = hash.replace(/&?compare=[^&]+/g, '').replace(/^#/, '');
        history.replaceState(null, '', clean ? `#${clean}` : window.location.pathname);
      }
      return;
    }
    const hash = window.location.hash;
    const base = hash.replace(/&?compare=[^&]+/g, '').replace(/^#/, '');
    const newHash = base ? `#${base}&compare=${encodeURIComponent(comparePlayer)}` : `#compare=${encodeURIComponent(comparePlayer)}`;
    if (hash !== newHash) history.replaceState(null, '', newHash);
  }, [comparePlayer]);

  const cmpBatRows = batting ? Object.entries(batting).filter(([k])=>k!=='updatedAt'&&k!=='combined')
    .flatMap(([div,rows])=>Array.isArray(rows)?rows.filter(r=>r.player?.toLowerCase()===comparePlayer?.toLowerCase()).map(r=>({...r,_div:div})):[]) : [];
  const cmpBowlRows = bowling ? Object.entries(bowling).filter(([k])=>k!=='updatedAt'&&k!=='combined')
    .flatMap(([div,rows])=>Array.isArray(rows)?rows.filter(r=>r.player?.toLowerCase()===comparePlayer?.toLowerCase()).map(r=>({...r,_div:div})):[]) : [];
  const cmpBat = aggregateBatting(cmpBatRows)[0] || null;
  const cmpBowl = aggregateBowling(cmpBowlRows)[0] || null;
  const cmpTeams = [...new Set([...cmpBatRows,...cmpBowlRows].map(r=>r.team).filter(Boolean))];

  const getPlayerDivision = (p) => {
    for (const [div, rows] of Object.entries(batting || {})) {
      if (div === 'updatedAt' || div === 'combined') continue;
      if (Array.isArray(rows) && rows.some(r => r.player?.toLowerCase() === p.toLowerCase())) return div;
    }
    for (const [div, rows] of Object.entries(bowling || {})) {
      if (div === 'updatedAt' || div === 'combined') continue;
      if (Array.isArray(rows) && rows.some(r => r.player?.toLowerCase() === p.toLowerCase())) return div;
    }
    return null;
  };

  const filteredPlayers = compareSearch
    ? allPlayers.filter(p => p.toLowerCase().includes(compareSearch.toLowerCase()))
    : allPlayers;

  const primaryDivision = primaryBatRow?._div || primaryBowlRow?._div || null;
  const sortedFilteredPlayers = primaryDivision
    ? [...filteredPlayers].sort((a, b) => {
        const aDiv = getPlayerDivision(a);
        const bDiv = getPlayerDivision(b);
        if (aDiv === primaryDivision && bDiv !== primaryDivision) return -1;
        if (bDiv === primaryDivision && aDiv !== primaryDivision) return 1;
        return 0;
      })
    : filteredPlayers;

  const tabs = [
    ...(bat ? [{ id: 'batting', label: 'Batting' }] : []),
    ...(bowl ? [{ id: 'bowling', label: 'Bowling' }] : []),
    { id: 'history', label: 'Highlights' },
    { id: 'compare', label: 'Compare' },
  ];

  // ── Player photo ──────────────────────────────────────────────
  const [photoUrl,    setPhotoUrl]    = useState(null);
  const [photoState,  setPhotoState]  = useState('idle'); // idle | loading | done | none
  const league = window.location.pathname.split('/').filter(Boolean)[0] || '';

  useEffect(() => {
    // Silent check — show photo automatically if already cached
    fetch(`/api/player-photo?league=${encodeURIComponent(league)}&name=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(d => {
        if (d.photoUrl) { setPhotoUrl(d.photoUrl); setPhotoState('done'); }
        else setPhotoState('idle');
      })
      .catch(() => setPhotoState('idle'));
  }, [name, league]);

  const loadPhoto = () => {
    setPhotoState('loading');
    fetch(`/api/player-photo?league=${encodeURIComponent(league)}&name=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(d => {
        if (d.photoUrl) { setPhotoUrl(d.photoUrl); setPhotoState('done'); }
        else setPhotoState('none');
      })
      .catch(() => setPhotoState('none'));
  };

  return (
    <div className="player-page">
      <div className="player-hero">
        <div className="player-hero-row">
          {/* Photo avatar */}
          <div className="player-avatar-wrap">
            {photoState === 'done' && photoUrl
              ? <img className="player-avatar" src={photoUrl} alt={name} />
              : <div className="player-avatar-placeholder">
                  {name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                </div>
            }
            {photoState === 'idle' && (
              <button className="player-avatar-load" onClick={loadPhoto} title="Load profile photo">📷</button>
            )}
            {photoState === 'loading' && (
              <div className="player-avatar-loading">…</div>
            )}
          </div>
          <div className="player-hero-info">
            <div className="player-name-lg">{name}</div>
            <div className="player-meta">
              {teams.length > 0 && <span>{teams.map((t, i) => <span key={t}>{i > 0 ? ', ' : ''}<span className="clickable" onClick={() => { onClose(); onTeamDrilldown({type:'team',name:t}); }}>{t}</span></span>)}</span>}
            </div>
            {spotlight && <div className="player-spotlight">{spotlight}</div>}
          </div>
        </div>
      </div>

      <div style={{padding:'0 16px 8px'}}>
        <AiSummaryBlock type="player" summaryKey={name} />
      </div>

      <div className="headline-pills">
        {bat && <>
          <div className="headline-pill">
            <div className="headline-pill-val">{bat.runs ?? '—'}</div>
            <div className="headline-pill-lbl">Runs</div>
          </div>
          <div className="headline-pill">
            <div className="headline-pill-val">{bat.avg ?? '—'}</div>
            <div className="headline-pill-lbl">Avg</div>
          </div>
          <div className="headline-pill">
            <div className="headline-pill-val">{bat.sr ?? '—'}</div>
            <div className="headline-pill-lbl">SR</div>
          </div>
        </>}
        {bowl && <>
          <div className="headline-pill">
            <div className="headline-pill-val">{bowl.wickets ?? '—'}</div>
            <div className="headline-pill-lbl">Wickets</div>
          </div>
          <div className="headline-pill">
            <div className="headline-pill-val">{bowl.econ ?? '—'}</div>
            <div className="headline-pill-lbl">Econ</div>
          </div>
        </>}
        <div className="headline-pill">
          <div className="headline-pill-val">{bat?.matches || bowl?.matches || battingHistory.length || bowlingHistory.length || 0}</div>
          <div className="headline-pill-lbl">Matches</div>
        </div>
      </div>

      {(battingArchetype || bowlingArchetype) && (bat || bowl) && (
        <div className="archetype-strip">
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

      <div className="profile-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`profile-tab-btn${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Batting Tab ── */}
      {activeTab === 'batting' && bat && (
        <div className="tab-body">
          <div className="stat-tile-grid">
            {[
              ['Runs', bat.runs, 'Total runs scored this season'],
              ['Average', bat.avg, 'Runs per dismissal'],
              ['Strike Rate', bat.sr, 'Runs per 100 balls faced'],
              ['Fours', bat.fours, 'Boundary 4s hit'],
              ['Sixes', bat.sixes, 'Boundary 6s hit'],
              ['Boundary %', bat.boundaryPct, 'Percent of runs from 4s and 6s'],
            ].map(([l, v, desc]) => (
              <div key={l} className="stat-tile" title={desc}>
                <div className="stat-tile-val">{v ?? '—'}</div>
                <div className="stat-tile-lbl">{l}</div>
              </div>
            ))}
          </div>

          {milestones.filter(m => m.id.startsWith('runs') || m.id.startsWith('hs') || m.id.startsWith('sixes')).length > 0 && (
            <div className="smart-milestones">
              {milestones.filter(m => m.id.startsWith('runs') || m.id.startsWith('hs') || m.id.startsWith('sixes')).slice(0, 2).map(m => (
                <div key={m.id} className="smart-milestone">
                  <div className="sm-header">
                    <span className="sm-emoji">{m.emoji}</span>
                    <span className="sm-label">{m.label}</span>
                    <span className="sm-remaining">{m.remaining} more {m.unit} to go</span>
                  </div>
                  <div className="milestone-bar"><div className="milestone-bar-fill" style={{width:`${m.pct}%`}} /></div>
                </div>
              ))}
            </div>
          )}

          <div className="tab-2col">
            <div>
              {battingHistory.length >= 2 && (
                <div className="tab-subsection">
                  <div className="section-sublabel">Form</div>
                  <FormCurve innings={battingHistory} statKey="runs" label="runs" />
                  {battingStreak && <div className={`streak-pill streak-${battingStreak.type}`}><span>{battingStreak.emoji}</span> {battingStreak.label}</div>}
                </div>
              )}
              {winSplit && (
                <div className="win-split tab-subsection">
                  <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Avg by Result</div>
                  <div className="win-split-grid">
                    <div className="win-split-col win-col">
                      <div className="win-split-badge">In Wins</div>
                      <div className="win-split-avg">{winSplit.won.avg}</div>
                      <div className="win-split-meta">{winSplit.won.inns} inns · {winSplit.won.runs} runs</div>
                    </div>
                    <div className="win-split-col loss-col">
                      <div className="win-split-badge">In Losses</div>
                      <div className="win-split-avg">{winSplit.lost.avg}</div>
                      <div className="win-split-meta">{winSplit.lost.inns} inns · {winSplit.lost.runs} runs</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div>
              {boundaryDist && donutData.length > 0 && (
                <div className="boundary-dist tab-subsection">
                  <div className="boundary-dist-title">Runs Breakdown</div>
                  <div className="donut-wrapper">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={donutData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" stroke="none">
                          {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => [`${v} runs`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-center">{boundaryDist.total}</div>
                  </div>
                  <div className="boundary-legend">
                    {donutData.map(d => <span key={d.name} className="bd-item" style={{'--bd-color': d.color}}>{d.name} {d.pct}%</span>)}
                  </div>
                </div>
              )}
              {dismissalProfile && (
                <div className="dismissal-profile tab-subsection">
                  <div className="dismissal-profile-title">How You Get Out</div>
                  <div className="dismissal-bars">
                    {dismissalProfile.items.map(item => (
                      <div key={item.type} className="dismissal-row">
                        <span className="dismissal-emoji">{item.emoji}</span>
                        <span className="dismissal-type">{item.type}</span>
                        <div className="dismissal-bar-wrap"><div className="dismissal-bar-fill" style={{width:`${item.pct}%`}} /></div>
                        <span className="dismissal-count">{item.count}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {battingVsOpps.length > 0 && (
            <div className="opp-block">
              <div className="opp-title">Vs Opponents</div>
              <div className="opp-rows">
                {battingVsOpps.map(o => (
                  <div key={o.opponent} className="opp-row">
                    <div className="opp-name">{o.opponent}</div>
                    <div className="opp-stats">
                      <span>{o.inns} inns</span><span>·</span>
                      <span>avg <strong>{o.avg}</strong></span><span>·</span>
                      <span>best <strong>{o.best}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {battingBenchmark && (
            <div className="benchmark-block">
              <div className="benchmark-title">Where you stand in {battingBenchmark.division} <span className="benchmark-meta">({battingBenchmark.totalPlayers} batters)</span></div>
              {[
                ['Runs', battingBenchmark.runs],
                ['Average', battingBenchmark.avg],
                ['Strike Rate', battingBenchmark.sr],
                ['Boundary %', battingBenchmark.boundaryPct],
                ['Sixes', battingBenchmark.sixes],
              ].map(([label, stat]) => stat.pct == null ? null : (
                <div key={label} className="benchmark-row">
                  <div className="benchmark-row-label">{label}</div>
                  <div className="benchmark-bar-wrap">
                    <div className="benchmark-bar-fill" style={{width:`${stat.pct}%`, background: stat.pct >= 75 ? 'var(--clr-ok)' : stat.pct >= 50 ? 'var(--accent)' : 'var(--z-300)'}} />
                  </div>
                  <div className="benchmark-row-val">{stat.pct >= 50 ? `Top ${Math.max(1, 100 - stat.pct)}%` : `${stat.pct}%ile`}</div>
                </div>
              ))}
              {battingBenchmark.compare && (
                <div className="compare-table">
                  <div className="compare-title">How you compare — batting</div>
                  <table className="compare-grid">
                    <thead><tr><th></th><th>You</th><th>Team<br/><span className="compare-sub">{battingBenchmark.team}</span></th><th>Division<br/><span className="compare-sub">{battingBenchmark.division}</span></th><th>League</th></tr></thead>
                    <tbody>
                      {[
                        ['Avg', battingBenchmark.avg.value, battingBenchmark.compare.team.batAvg, battingBenchmark.compare.division.batAvg, battingBenchmark.compare.league.batAvg, true],
                        ['SR', battingBenchmark.sr.value, battingBenchmark.compare.team.sr, battingBenchmark.compare.division.sr, battingBenchmark.compare.league.sr, true],
                        ['Runs', battingBenchmark.runs.value, battingBenchmark.compare.team.runs, battingBenchmark.compare.division.runs, battingBenchmark.compare.league.runs, true],
                      ].map(([label, you, team, div, league, higherBetter]) => (
                        <tr key={label}>
                          <td className="compare-label">{label}</td>
                          <td className="compare-you">{you ?? '—'}</td>
                          {[team, div, league].map((v, i) => {
                            const delta = v != null && you != null ? (higherBetter ? you - v : v - you) : null;
                            const cls = delta == null ? '' : delta > 0 ? 'compare-better' : delta < 0 ? 'compare-worse' : '';
                            return <td key={i} className={`compare-avg ${cls}`}>{v ?? '—'}{delta != null && delta !== 0 ? <span className="compare-delta">{delta > 0 ? ` ▲${Math.abs(Math.round(delta*10)/10)}` : ` ▼${Math.abs(Math.round(delta*10)/10)}`}</span> : null}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Bowling Tab ── */}
      {activeTab === 'bowling' && bowl && (
        <div className="tab-body">
          <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:12}}>
            <div className="mega-stat">{bowl.bbf}</div>
            <div className="mega-stat-lbl">Best Figures</div>
          </div>

          <div className="stat-tile-grid">
            {[
              ['Wickets', bowl.wickets, 'Total wickets taken'],
              ['Economy', bowl.econ, 'Runs conceded per over'],
              ['Average', bowl.avg, 'Runs conceded per wicket'],
              ['Maidens', bowl.maidens, 'Overs with no runs'],
              ['Dots %', bowl.dotPct, 'Percent dot balls'],
              ['Extras/Over', bowl.extrasPer6, 'Wides + no-balls per over'],
            ].map(([l, v, desc]) => (
              <div key={l} className="stat-tile" title={desc}>
                <div className="stat-tile-val">{v ?? '—'}</div>
                <div className="stat-tile-lbl">{l}</div>
              </div>
            ))}
          </div>

          {milestones.filter(m => m.id.startsWith('wkts')).length > 0 && (
            <div className="smart-milestones">
              {milestones.filter(m => m.id.startsWith('wkts')).map(m => (
                <div key={m.id} className="smart-milestone">
                  <div className="sm-header">
                    <span className="sm-emoji">{m.emoji}</span>
                    <span className="sm-label">{m.label}</span>
                    <span className="sm-remaining">{m.remaining} more {m.unit} to go</span>
                  </div>
                  <div className="milestone-bar"><div className="milestone-bar-fill" style={{width:`${m.pct}%`}} /></div>
                </div>
              ))}
            </div>
          )}

          <div className="tab-2col">
            <div>
              {bowlingHistory.length >= 2 && (
                <div className="tab-subsection">
                  <div className="section-sublabel">Form</div>
                  <FormCurve innings={bowlingHistory} statKey="wickets" label="wkts" />
                  {bowlingStreak && <div className={`streak-pill streak-${bowlingStreak.type}`}><span>{bowlingStreak.emoji}</span> {bowlingStreak.label}</div>}
                </div>
              )}
            </div>
            <div>
              {bowlingVsOpps.length > 0 && (
                <div className="opp-block tab-subsection">
                  <div className="opp-title">Vs Opponents</div>
                  <div className="opp-rows">
                    {bowlingVsOpps.map(o => (
                      <div key={o.opponent} className="opp-row">
                        <div className="opp-name">{o.opponent}</div>
                        <div className="opp-stats">
                          <span>{o.inns} spells</span><span>·</span>
                          <span><strong>{o.wickets}</strong> wkts</span><span>·</span>
                          <span>best <strong>{o.best}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

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
                    <div className="benchmark-bar-fill" style={{width:`${stat.pct}%`, background: stat.pct >= 75 ? 'var(--clr-ok)' : stat.pct >= 50 ? 'var(--accent)' : 'var(--z-300)'}} />
                  </div>
                  <div className="benchmark-row-val">{stat.pct >= 50 ? `Top ${Math.max(1, 100 - stat.pct)}%` : `${stat.pct}%ile`}</div>
                </div>
              ))}
              {bowlingBenchmark.compare && (
                <div className="compare-table">
                  <div className="compare-title">How you compare — bowling</div>
                  <table className="compare-grid">
                    <thead><tr><th></th><th>You</th><th>Team<br/><span className="compare-sub">{bowlingBenchmark.team}</span></th><th>Division<br/><span className="compare-sub">{bowlingBenchmark.division}</span></th><th>League</th></tr></thead>
                    <tbody>
                      {[
                        ['Wkts', bowlingBenchmark.wickets.value, bowlingBenchmark.compare.team.wickets, bowlingBenchmark.compare.division.wickets, bowlingBenchmark.compare.league.wickets, true],
                        ['Econ', bowlingBenchmark.econ.value, bowlingBenchmark.compare.team.econ, bowlingBenchmark.compare.division.econ, bowlingBenchmark.compare.league.econ, false],
                      ].map(([label, you, team, div, league, higherBetter]) => (
                        <tr key={label}>
                          <td className="compare-label">{label}</td>
                          <td className="compare-you">{you ?? '—'}</td>
                          {[team, div, league].map((v, i) => {
                            const delta = v != null && you != null ? (higherBetter ? you - v : v - you) : null;
                            const cls = delta == null ? '' : delta > 0 ? 'compare-better' : delta < 0 ? 'compare-worse' : '';
                            return <td key={i} className={`compare-avg ${cls}`}>{v ?? '—'}{delta != null && delta !== 0 ? <span className="compare-delta">{delta > 0 ? ` ▲${Math.abs(Math.round(delta*10)/10)}` : ` ▼${Math.abs(Math.round(delta*10)/10)}`}</span> : null}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Highlights Tab ── */}
      {activeTab === 'history' && (
        <div className="tab-body">
          {impactRating && impactRating.score > 0 && (
            <div className="tab-subsection">
              <div className="section-sublabel">Season Impact Rating</div>
              <ImpactRatingCard score={impactRating.score} label={impactRating.label} trend={impactRating.trend} />
            </div>
          )}

          <div className="tab-2col">
            {(bat || bowl) && playerRadar && (
              <div>
                <div className="section-sublabel">Player Radar</div>
                <PlayerRadarChart radar={playerRadar} />
              </div>
            )}
            {(bestBattingInnings || bestBowlingSpell) && (
              <div>
                <div className="section-sublabel">Career Highlights</div>
                <div className="highlight-grid">
                  {bestBattingInnings && (
                    <div className="highlight-card">
                      <div className="highlight-badge">🌟 Best Innings</div>
                      <div className="highlight-stat">
                        {bestBattingInnings.runs}{bestBattingInnings.notOut ? '*' : ''}
                        {bestBattingInnings.balls > 0 && <span className="highlight-stat-meta"> ({bestBattingInnings.balls}b)</span>}
                      </div>
                      <div className="highlight-context">
                        {bestBattingInnings.opponent && <div>vs <strong>{bestBattingInnings.opponent}</strong></div>}
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
                        {bestBowlingSpell.opponent && <div>vs <strong>{bestBowlingSpell.opponent}</strong></div>}
                        <div className="highlight-meta">
                          {bestBowlingSpell.maidens > 0 && `${bestBowlingSpell.maidens} maiden${bestBowlingSpell.maidens > 1 ? 's' : ''}`}
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
          </div>

          {(earnedAchievements.length > 0 || lockedAchievements.length > 0) && (
            <div className="tab-subsection">
              <div className="section-sublabel">Achievements</div>
              <div className="achievements-grid">
                {earnedAchievements.map(a => (
                  <div key={a.id} className={`achievement-card earned tier-${a.tier}`}>
                    <div className="achievement-emoji">{a.emoji}</div>
                    <div className="achievement-label">{a.label}</div>
                  </div>
                ))}
                {lockedAchievements.map(a => (
                  <div key={a.id} className="achievement-card locked">
                    <div className="achievement-emoji" style={{opacity: 0.4}}>{a.emoji}</div>
                    <div className="achievement-label">{a.label}</div>
                    {a.hintText && <div className="achievement-hint">{a.hintText}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchChartData.length >= 3 && (
            <div className="tab-subsection">
              <div className="section-sublabel">Match-by-Match Performance</div>
              <RunsWicketsChart data={matchChartData} />
            </div>
          )}

          {battingHistory.length >= 4 && (
            <div className="tab-subsection">
              <FormTrendChart battingHistory={battingHistory} bowlingHistory={[]} />
            </div>
          )}

          {hasMatchData && (
            <div className="tab-subsection">
              <div className="section-sublabel">Match Log</div>
              <div className="story-strip">
                {(battingHistory.length > 0 ? [...battingHistory].reverse() : [...bowlingHistory].reverse()).slice(0, 15).map((inn, idx) => {
                  const isBat = inn.role === 'bat';
                  const won = inn.result && inn.team && inn.result.trim().toLowerCase().startsWith(inn.team.trim().toLowerCase());
                  const lost = inn.result && /\blo(?:s[st])\b/i.test(inn.result);
                  return (
                    <div key={idx} className={`story-card${won ? ' story-win' : lost ? ' story-loss' : ''}`}>
                      <div className="story-opp">{inn.opponent || 'vs ?'}</div>
                      {isBat
                        ? <div className="story-score">{inn.runs ?? '—'}{inn.notOut ? '*' : ''}</div>
                        : <div className="story-score">{inn.wickets}/{inn.runs}</div>}
                      <div className="story-meta">
                        {isBat
                          ? (inn.balls > 0 ? `${inn.balls}b` : '') + (inn.fours > 0 ? ` ${inn.fours}×4` : '') + (inn.sixes > 0 ? ` ${inn.sixes}×6` : '')
                          : `${inn.overs || '?'} ov${inn.maidens > 0 ? ` ${inn.maidens}m` : ''}`}
                      </div>
                      <div className="story-date">{formatMatchDate(inn.date)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Compare Tab ── */}
      {activeTab === 'compare' && (
        <div className="tab-body">
          {!showSearch && !comparePlayer && (
            <button className="compare-trigger" onClick={() => setShowSearch(true)}>⚔ Compare with another player →</button>
          )}
          {showSearch && !comparePlayer && (
            <div style={{position:'relative'}}>
              <input
                className="compare-search-input"
                type="text"
                placeholder="Search player..."
                value={compareSearch}
                onChange={e => setCompareSearch(e.target.value)}
                autoFocus
              />
              {compareSearch && sortedFilteredPlayers.length > 0 && (
                <div className="compare-dropdown">
                  {sortedFilteredPlayers.map(p => {
                    const div = getPlayerDivision(p);
                    return (
                      <div key={p} className="ov-search-result" onClick={() => { setComparePlayer(p); setShowSearch(false); setCompareSearch(''); }}>
                        <span className="ov-search-result-name">{p}</span>
                        {div && <span className="ov-search-result-team" style={{marginLeft:'auto'}}>{div}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              {compareSearch && sortedFilteredPlayers.length === 0 && (
                <div className="compare-dropdown" style={{padding:'12px',textAlign:'center',color:'var(--text-muted)'}}>No players found</div>
              )}
              <button className="small-btn" style={{marginTop:8}} onClick={() => { setShowSearch(false); setCompareSearch(''); }}>Cancel</button>
            </div>
          )}
          {comparePlayer && (
            <div className="compare-panel">
              <div className="compare-panel-header">
                <div style={{color:'var(--accent)'}}>
                  <div style={{fontSize:16,fontWeight:800}}>{name}</div>
                  {teams.length > 0 && <div style={{fontSize:11,color:'var(--text-muted)'}}>{teams.join(', ')}</div>}
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:16,fontWeight:800}}>{comparePlayer}</div>
                  {cmpTeams.length > 0 && <div style={{fontSize:11,color:'var(--text-muted)'}}>{cmpTeams.join(', ')}</div>}
                </div>
              </div>
              <table className="compare-grid" style={{marginTop:0}}>
                <thead>
                  <tr>
                    <th>Stat</th>
                    <th style={{color:'var(--accent)'}}>{name.split(' ').pop()}</th>
                    <th>{comparePlayer.split(' ').pop()}</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows = [
                      ['Matches', bat?.mat || bowl?.mat, cmpBat?.mat || cmpBowl?.mat, true],
                      ['Runs', bat?.runs, cmpBat?.runs, true],
                      ['Batting Avg', bat?.avg, cmpBat?.avg, true],
                      ['Strike Rate', bat?.sr, cmpBat?.sr, true],
                      ['Wickets', bowl?.wickets, cmpBowl?.wickets, true],
                      ['Economy', bowl?.econ, cmpBowl?.econ, false],
                      ['Best Figures', bowl?.bbf, cmpBowl?.bbf, false],
                    ];
                    return rows.map(([label, v1, v2, higherBetter]) => {
                      if (v1 == null && v2 == null) return null;
                      const n1 = v1 != null ? parseFloat(v1) : NaN;
                      const n2 = v2 != null ? parseFloat(v2) : NaN;
                      const c1Better = !isNaN(n1) && !isNaN(n2) ? (higherBetter ? n1 > n2 : n1 < n2) : false;
                      const c2Better = !isNaN(n1) && !isNaN(n2) ? (higherBetter ? n2 > n1 : n2 < n1) : false;
                      const c1Equal = !isNaN(n1) && !isNaN(n2) && n1 === n2;
                      return (
                        <tr key={label}>
                          <td className="compare-label">{label}</td>
                          <td className={`compare-you${c1Better && !c1Equal ? ' compare-winner' : ''}`}>{v1 ?? '—'}</td>
                          <td className={`compare-avg${c2Better && !c1Equal ? ' compare-winner' : ''}`}>{v2 ?? '—'}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
              <div style={{display:'flex', gap:8, marginTop:12}}>
                <button className="small-btn" onClick={() => setShowSearch(true)}>🔄 Change player</button>
                <button className="small-btn" onClick={() => { setComparePlayer(null); setCompareSearch(''); }}>✕ Clear</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
