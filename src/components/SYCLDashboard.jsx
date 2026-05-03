import { useState, useEffect, useCallback, useMemo } from 'react';
import { getLeagueSlug } from '../utils/schedule.js';
import NavBar from './NavBar.jsx';
import PlayerProfilePage from './PlayerProfilePage.jsx';
import TeamProfilePage from './TeamProfilePage.jsx';
import SeasonOverview from './SeasonOverview.jsx';
import ScheduleView from './ScheduleView.jsx';
import StandingsView from './StandingsView.jsx';
import ResultsView from './ResultsView.jsx';
import BattingView from './BattingView.jsx';
import BowlingView from './BowlingView.jsx';
import RankingsView from './RankingsView.jsx';
import DrilldownPanel from './DrilldownPanel.jsx';

export default function SYCLDashboard({ onFeedback }) {
  const [data, setData] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('sycl_theme') || 'light'; } catch { return 'light'; }
  });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [drilldown, setDrilldown] = useState(null);
  const [playerPage, setPlayerPage] = useState(() => {
    try {
      const h = window.location.hash;
      if (h.startsWith('#player=')) return decodeURIComponent(h.slice(8));
    } catch {}
    return null;
  });
  const [teamPage, setTeamPage] = useState(() => {
    try {
      const h = window.location.hash;
      if (h.startsWith('#team=')) return decodeURIComponent(h.slice(6));
    } catch {}
    return null;
  });

  const handleDrilldown = useCallback((d) => {
    if (d.type === 'player') {
      setPlayerPage(d.name);
      try { window.location.hash = 'player=' + encodeURIComponent(d.name); } catch {}
    } else if (d.type === 'team') {
      setTeamPage(d.name);
      try { window.location.hash = 'team=' + encodeURIComponent(d.name); } catch {}
    } else {
      setDrilldown(d);
    }
  }, []);

  const closeDrilldown = useCallback(() => setDrilldown(null), []);

  const closePlayerPage = useCallback(() => {
    setPlayerPage(null);
    try { window.location.hash = ''; history.replaceState(null, '', window.location.pathname + window.location.search); } catch {}
  }, []);

  const closeTeamPage = useCallback(() => {
    setTeamPage(null);
    try { window.location.hash = ''; history.replaceState(null, '', window.location.pathname + window.location.search); } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('sycl_theme', theme); } catch {}
  }, [theme]);

  const loadData = useCallback((bustCache, slug) => {
    setLoading(true);
    const leagueParam = slug ? `league=${encodeURIComponent(slug)}&` : '';
    const url = bustCache ? `/api/schedule?${leagueParam}_t=${Date.now()}` : `/api/schedule${slug ? `?league=${encodeURIComponent(slug)}` : ''}`;
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.matches?.length) {
          const divisions = [...new Set(d.matches.map(m => m.division))];
          setData(prev => {
            const next = { matches: d.matches, divisions, standings: d.standings || {}, batting: d.batting || null, bowling: d.bowling || null, rankings: d.rankings || null, results: d.results || null, playerInnings: Array.isArray(d.playerInnings) ? d.playerInnings : [], leagueName: d.leagueName, season: d.season };
            if (!prev) setSelectedDivision('combined');
            return next;
          });
          setLastRefresh(d.updatedAt);
          if (d.leagueName) document.title = `${d.leagueName}${d.season ? ` · ${d.season}` : ''} · Season Dashboard`;
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const slug = useMemo(() => getLeagueSlug(), []);

  useEffect(() => {
    if (!slug) {
      fetch('/api/leagues')
        .then(r => r.json())
        .then(leagues => {
          const entries = Object.entries(leagues || {});
          if (!entries.length) return;
          entries.sort((a, b) => new Date(b[1].updatedAt || 0) - new Date(a[1].updatedAt || 0));
          window.location.href = '/' + entries[0][0];
        })
        .catch(() => {});
      return;
    }
    loadData(false, slug);
  }, [slug, loadData]);

  const divOrder = ["Emerging Stars","U11A","U11B","U13A","U13B","U15A","U15B"];
  const sortedDivs = useMemo(() => {
    if (!data) return [];
    return [...data.divisions].sort((a, b) => {
      const ai = divOrder.indexOf(a), bi = divOrder.indexOf(b);
      return (ai===-1?99:ai)-(bi===-1?99:bi);
    });
  }, [data]);

  const handleTabClick = useCallback((tab) => {
    setActiveTab(tab);
    if (selectedDivision === 'combined' && !['overview','batting','bowling','rankings'].includes(tab)) {
      setSelectedDivision(sortedDivs[0] || null);
    }
    if (tab === 'overview') setSelectedDivision('combined');
  }, [selectedDivision, sortedDivs]);

  if (!slug) return (
    <NavBar slug={null} onFeedback={onFeedback} />
  );

  if (playerPage) return (
    <>
      <NavBar slug={slug} leagueName={data?.leagueName} season={data?.season}
              activeTab={activeTab} onTabClick={handleTabClick}
              playerName={playerPage} onClosePlayer={closePlayerPage}
              loading={loading} onRefresh={() => loadData(true, slug)}
              theme={theme} onThemeToggle={() => setTheme(t => t==='light'?'dark':'light')}
              onFeedback={onFeedback} />
      <PlayerProfilePage name={playerPage} batting={data?.batting} bowling={data?.bowling}
              rankings={data?.rankings} playerInnings={data?.playerInnings}
              onClose={closePlayerPage} onTeamDrilldown={handleDrilldown} />
    </>
  );

  if (teamPage) return (
    <>
      <NavBar slug={slug} leagueName={data?.leagueName} season={data?.season}
              activeTab={activeTab} onTabClick={handleTabClick}
              teamName={teamPage} onCloseTeam={closeTeamPage}
              loading={loading} onRefresh={() => loadData(true, slug)}
              theme={theme} onThemeToggle={() => setTheme(t => t==='light'?'dark':'light')}
              onFeedback={onFeedback} />
      {data
        ? <TeamProfilePage name={teamPage} data={data} onClose={closeTeamPage} onDrilldown={handleDrilldown} />
        : <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:320}}><div style={{fontSize:13,color:'var(--text-muted)'}}>Loading…</div></div>
      }
    </>
  );

  return (
    <div className="app">
      <NavBar slug={slug} leagueName={data?.leagueName} season={data?.season}
              activeTab={activeTab} onTabClick={handleTabClick}
              loading={loading} onRefresh={() => loadData(true, slug)}
              theme={theme} onThemeToggle={() => setTheme(t => t==='light'?'dark':'light')}
              onFeedback={onFeedback} />

      {!data ? (
        <div className="content-wrap" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:320}}>
          {loading
            ? <div className="loading-text" style={{fontSize:13,color:"var(--text-muted)"}}>Loading…</div>
            : <div style={{textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:14}}>🏏</div>
                <div style={{fontSize:16,fontWeight:700,color:"var(--text-secondary)",marginBottom:6}}>No schedule data yet</div>
                <button className="small-btn" style={{marginTop:16}} onClick={() => loadData(true)}>Try again</button>
              </div>
          }
        </div>
      ) : (
        <div className="content-wrap">
          {activeTab !== 'overview' && (
            <div className="division-bar">
              {activeTab !== 'standings' && (
                <button className={`div-btn ${selectedDivision==="combined"?"active":""}`}
                  onClick={()=>setSelectedDivision("combined")}>
                  All
                </button>
              )}
              {sortedDivs.map(d => (
                <button key={d} className={`div-btn ${selectedDivision===d?"active":""}`}
                  onClick={()=>setSelectedDivision(d)}>
                  {d}
                </button>
              ))}
            </div>
          )}

          <>
            {activeTab==="overview"  && <SeasonOverview  data={data} lastRefresh={lastRefresh} onDrilldown={handleDrilldown} onTabClick={handleTabClick} onDivision={setSelectedDivision} />}
            {selectedDivision && activeTab==="schedule"  && <ScheduleView  matches={data.matches} division={selectedDivision} onDrilldown={handleDrilldown}/>}
            {selectedDivision && activeTab==="standings" && <StandingsView matches={data.matches} division={selectedDivision} standings={data.standings} results={data.results} onDrilldown={handleDrilldown}/>}
            {activeTab==="results"   && <ResultsView  results={data.results}   division={selectedDivision} onDrilldown={handleDrilldown}/>}
            {activeTab==="batting"   && <BattingView  batting={data.batting}   division={selectedDivision} onDrilldown={handleDrilldown}/>}
            {activeTab==="bowling"   && <BowlingView  bowling={data.bowling}   division={selectedDivision} onDrilldown={handleDrilldown}/>}
            {activeTab==="rankings"  && <RankingsView rankings={data.rankings} division={selectedDivision} onDrilldown={handleDrilldown}/>}
          </>
        </div>
      )}

      {data && <DrilldownPanel drilldown={drilldown} data={data} onClose={closeDrilldown} onDrilldown={handleDrilldown}/>}
    </div>
  );
}
