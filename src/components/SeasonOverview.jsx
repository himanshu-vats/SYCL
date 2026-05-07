import { useState, useMemo } from 'react';
import { aggregateBatting, aggregateBowling } from '../utils/aggregation.js';
import AiSummaryBlock from './AiSummaryBlock.jsx';

const DIV_ORDER = ["U11A","U11B","U13A","U13B","U15A","U15B","Emerging Stars"];

export default function SeasonOverview({ data, lastRefresh, onDrilldown, onGoToDivision }) {
  const { matches = [], results, batting, bowling, rankings, standings } = data;
  const today = new Date(); today.setHours(0,0,0,0);
  const parseD = s => { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d; };
  const fmtDate = d => {
    if (!d) return '';
    const dt = parseD(d);
    return dt ? dt.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) : d;
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter,  setTeamFilter]  = useState('');

  const allDivisions = useMemo(() => {
    const divs = [...new Set(matches.map(m => m.division).filter(Boolean))];
    return divs.sort((a, b) => {
      const ai = DIV_ORDER.indexOf(a), bi = DIV_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [matches]);

  const allResults  = results?.matches || [];
  const completed   = allResults.length;
  const total       = matches.length;
  const pct         = total > 0 ? Math.round(completed / total * 100) : 0;

  const allBatters = useMemo(() => {
    if (!batting) return [];
    const flat = Object.entries(batting).filter(([k]) => k !== 'updatedAt' && k !== 'combined')
      .flatMap(([, rows]) => Array.isArray(rows) ? rows : []);
    return aggregateBatting(flat);
  }, [batting]);

  const allBowlers = useMemo(() => {
    if (!bowling) return [];
    const flat = Object.entries(bowling).filter(([k]) => k !== 'updatedAt' && k !== 'combined')
      .flatMap(([, rows]) => Array.isArray(rows) ? rows : []);
    return aggregateBowling(flat);
  }, [bowling]);

  const seasonTotals = useMemo(() => ({
    runs:     allBatters.reduce((s, r) => s + (parseInt(r.runs)    || 0), 0),
    wickets:  allBowlers.reduce((s, r) => s + (parseInt(r.wickets) || 0), 0),
    sixes:    allBatters.reduce((s, r) => s + (parseInt(r.sixes)   || 0), 0),
    hundreds: allBatters.reduce((s, r) => s + (parseInt(r.hundreds)|| 0), 0),
    fiveW:    allBowlers.reduce((s, r) => s + (parseInt(r.fiveW)   || 0), 0),
  }), [allBatters, allBowlers]);

  const topBatter = useMemo(() => [...allBatters].sort((a,b) => (parseInt(b.runs)||0)-(parseInt(a.runs)||0))[0]||null, [allBatters]);
  const topBowler = useMemo(() => [...allBowlers].sort((a,b) => (parseInt(b.wickets)||0)-(parseInt(a.wickets)||0))[0]||null, [allBowlers]);
  const topEcon   = useMemo(() => [...allBowlers].filter(b=>(parseInt(b.mat)||0)>=3).sort((a,b)=>(parseFloat(a.econ)||99)-(parseFloat(b.econ)||99))[0]||null, [allBowlers]);

  const allTeams = useMemo(() => {
    const t = new Set();
    matches.forEach(m => { if (m.team1) t.add(m.team1); if (m.team2) t.add(m.team2); });
    return [...t].sort();
  }, [matches]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const seen = new Set();
    const out = [];
    allBatters.forEach(r => {
      if (r.player?.toLowerCase().includes(q) && !seen.has(r.player)) {
        seen.add(r.player);
        out.push({ name: r.player, team: r.team, stat: `${r.runs} runs` });
      }
    });
    allBowlers.forEach(r => {
      if (r.player?.toLowerCase().includes(q) && !seen.has(r.player)) {
        seen.add(r.player);
        out.push({ name: r.player, team: r.team, stat: `${r.wickets} wkts` });
      }
    });
    return out.slice(0, 8);
  }, [searchQuery, allBatters, allBowlers]);

  const filteredDivisions = useMemo(() => {
    if (!teamFilter) return allDivisions;
    return allDivisions.filter(div => {
      const dm = matches.filter(m => m.division === div);
      const teams = [...new Set(dm.flatMap(m => [m.team1, m.team2]).filter(Boolean))];
      return teams.includes(teamFilter);
    });
  }, [allDivisions, teamFilter, matches]);

  // Recent results (last 6, all divs)
  const recentResults = useMemo(() =>
    [...allResults].sort((a,b) => { const da=parseD(a.date),db=parseD(b.date); return da&&db ? db-da : 0; }).slice(0,6),
    [allResults]);

  // Upcoming (next 6, all divs)
  const upcoming = useMemo(() =>
    matches.filter(m => { const d=parseD(m.date); return d&&d>=today&&!m.result&&!m.winner; })
      .sort((a,b) => { const da=parseD(a.date),db=parseD(b.date); return da&&db ? da-db : 0; }).slice(0,6),
    [matches]);

  // Per-division helpers
  const divProgress = div => {
    const dm = matches.filter(m => m.division === div);
    const dr = allResults.filter(m => m.division === div);
    return { total: dm.length, done: dr.length, pct: dm.length > 0 ? Math.round(dr.length/dm.length*100) : 0 };
  };
  const divLeader = div => {
    const raw = standings?.[div];
    const rows = Array.isArray(raw) ? raw : (raw?.rows || []);
    return rows[0] || null;
  };
  const divNext = div => {
    return matches.filter(m => m.division===div && !m.result && !m.winner)
      .filter(m => { const d=parseD(m.date); return d&&d>=today; })
      .sort((a,b) => { const da=parseD(a.date),db=parseD(b.date); return da&&db?da-db:0; })[0] || null;
  };

  const goDiv = div => onGoToDivision(div, 'overview');

  return (
    <div className="home-page">

      {/* ── AI Summary ── */}
      <AiSummaryBlock type="overview" summaryKey="season" />

      {/* ── Search ── */}
      <div className="home-search-row">
        <div className="home-search-wrap">
          <span className="ov-search-icon">🔍</span>
          <input className="ov-search-input" type="text" placeholder="Find a player…"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          {searchQuery && <button className="ov-search-clear" onClick={() => setSearchQuery('')}>✕</button>}
          {searchResults.length > 0 && (
            <div className="ov-search-dropdown">
              {searchResults.map((r,i) => (
                <div key={i} className="ov-search-result"
                  onClick={() => { onDrilldown({type:'player',name:r.name}); setSearchQuery(''); }}>
                  <span className="ov-search-result-name">{r.name}</span>
                  <span className="ov-search-result-team">{r.team}</span>
                  <span className="ov-search-result-stat">{r.stat}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <select className="ov-team-select" value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
          <option value="">All Teams</option>
          {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {teamFilter && <button className="ov-filter-clear" onClick={() => setTeamFilter('')}>✕</button>}
      </div>

      {/* ── Season stats strip ── */}
      <div className="home-stats-strip">
        {[
          { val: `${completed}/${total}`, lbl: 'Played', accent: true },
          { val: `${pct}%`,               lbl: 'Done' },
          { val: seasonTotals.runs.toLocaleString(), lbl: 'Runs' },
          { val: seasonTotals.wickets,     lbl: 'Wkts' },
          { val: seasonTotals.sixes,       lbl: '6s' },
          seasonTotals.hundreds > 0 && { val: seasonTotals.hundreds, lbl: '100s' },
          seasonTotals.fiveW    > 0 && { val: seasonTotals.fiveW,    lbl: '5-fers' },
        ].filter(Boolean).map((s,i) => (
          <div key={i} className={`hss-item${s.accent?' hss-item-accent':''}`}>
            <span className="hss-val">{s.val}</span>
            <span className="hss-lbl">{s.lbl}</span>
          </div>
        ))}
      </div>

      {/* ── Division Grid ── */}
      <div className="home-section-hd">Divisions</div>
      <div className="home-div-grid">
        {filteredDivisions.map(div => {
          const prog   = divProgress(div);
          const leader = divLeader(div);
          const next   = divNext(div);
          return (
            <div key={div} className="hdc" onClick={() => goDiv(div)}>
              <div className="hdc-top">
                <span className="hdc-name">{div}</span>
                <span className="hdc-prog">{prog.done}/{prog.total}</span>
              </div>
              <div className="hdc-bar"><div className="hdc-bar-fill" style={{width:`${prog.pct}%`}}/></div>
              {leader && (
                <div className="hdc-leader">
                  <span className="hdc-leader-icon">🏆</span>
                  <span className="hdc-leader-name">{leader.team}</span>
                  <span className="hdc-leader-pts">{leader.pts} pts</span>
                </div>
              )}
              {next && (
                <div className="hdc-next">
                  <span className="hdc-next-date">{fmtDate(next.date)}</span>
                  <span className="hdc-next-teams">{next.team1} vs {next.team2}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Activity row ── */}
      <div className="home-activity-row">
        <div className="home-activity-col">
          <div className="home-section-hd">Recent Results</div>
          {recentResults.length === 0 && <div className="home-empty">No results yet</div>}
          {recentResults.map((r,i) => (
            <div key={i} className="home-result-row">
              <span className="home-result-div">{r.division}</span>
              <span className="home-result-text">{r.result || `${r.team1} vs ${r.team2}`}</span>
            </div>
          ))}
        </div>
        <div className="home-activity-col">
          <div className="home-section-hd">Upcoming</div>
          {upcoming.length === 0 && <div className="home-empty">No upcoming matches</div>}
          {upcoming.map((m,i) => (
            <div key={i} className="home-result-row" style={{flexWrap:'wrap',gap:4}}>
              <span className="home-result-div">{m.division}</span>
              <span className="home-result-text">{m.team1} vs {m.team2} · {fmtDate(m.date)}{m.time ? ` ${m.time}` : ''}</span>
              <button
                className="prematch-btn"
                onClick={() => onDrilldown({type:'match', matchId:m.id, team1:m.team1, team2:m.team2, date:m.date, division:m.division})}
                title="AI Match Preview & Prediction"
              >⚡ Predict</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Season Stars ── */}
      {(topBatter || topBowler || topEcon) && <>
        <div className="home-section-hd">Season Stars</div>
        <div className="home-stars-row">
          {topBatter && (
            <div className="home-star-card" onClick={() => onDrilldown({type:'player',name:topBatter.player})}>
              <div className="hsc-emoji">🏏</div>
              <div className="hsc-label">Top Scorer</div>
              <div className="hsc-name">{topBatter.player}</div>
              <div className="hsc-team">{topBatter.team}</div>
              <div className="hsc-stat">{topBatter.runs} runs · avg {topBatter.avg}</div>
            </div>
          )}
          {topBowler && (
            <div className="home-star-card" onClick={() => onDrilldown({type:'player',name:topBowler.player})}>
              <div className="hsc-emoji">🎯</div>
              <div className="hsc-label">Top Wicket-Taker</div>
              <div className="hsc-name">{topBowler.player}</div>
              <div className="hsc-team">{topBowler.team}</div>
              <div className="hsc-stat">{topBowler.wickets} wkts · econ {topBowler.econ}</div>
            </div>
          )}
          {topEcon && topEcon.player !== topBowler?.player && (
            <div className="home-star-card" onClick={() => onDrilldown({type:'player',name:topEcon.player})}>
              <div className="hsc-emoji">🔒</div>
              <div className="hsc-label">Best Economy</div>
              <div className="hsc-name">{topEcon.player}</div>
              <div className="hsc-team">{topEcon.team}</div>
              <div className="hsc-stat">econ {topEcon.econ} · {topEcon.wickets} wkts</div>
            </div>
          )}
        </div>
      </>}

    </div>
  );
}
