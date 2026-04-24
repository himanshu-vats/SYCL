/**
 * SYCL Dashboard — Automated Tests
 * Run: node test/sycl.test.js
 *
 * Tests are grouped into suites. Each test is self-contained vanilla Node.js
 * (no test framework needed). Add tests here as new features are built.
 */

// ── Tiny test runner ──────────────────────────────────────────────────────────
let _passed = 0, _failed = 0, _suite = '';
function suite(name) { _suite = name; console.log(`\n  ${name}`); }
function test(label, fn) {
  try { fn(); console.log(`    ✓ ${label}`); _passed++; }
  catch(e) { console.error(`    ✗ ${label}\n      ${e.message}`); _failed++; }
}
function expect(val) {
  return {
    toBe: (exp) => { if (val !== exp) throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`); },
    toEqual: (exp) => { if (JSON.stringify(val) !== JSON.stringify(exp)) throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`); },
    toBeTruthy: () => { if (!val) throw new Error(`Expected truthy, got ${JSON.stringify(val)}`); },
    toBeFalsy: () => { if (val) throw new Error(`Expected falsy, got ${JSON.stringify(val)}`); },
    toContain: (item) => { if (!val.includes(item)) throw new Error(`Expected ${JSON.stringify(val)} to contain ${JSON.stringify(item)}`); },
    toBeGreaterThan: (n) => { if (val <= n) throw new Error(`Expected ${val} > ${n}`); },
    toBeNull: () => { if (val !== null) throw new Error(`Expected null, got ${JSON.stringify(val)}`); },
    toHaveLength: (n) => { if (val.length !== n) throw new Error(`Expected length ${n}, got ${val.length}`); },
  };
}

// ── Helpers extracted from index.html (keep in sync) ──────────────────────────
function parseDate(s) {
  if (!s) return null;
  const p = s.split('/');
  if (p.length === 3) return new Date(parseInt(p[2]), parseInt(p[0])-1, parseInt(p[1]));
  return new Date(s);
}

function isAM(time) {
  if (!time) return null;
  const t = time.toUpperCase();
  if (t.includes('AM')) return true;
  if (t.includes('PM')) return false;
  return null;
}

const POINTS = { win: 2, abandoned: 1, forfeit_winner: 2 };

function computeBalance(matches, teams) {
  const s = {};
  teams.forEach(t => { s[t] = { home:0, away:0, am:0, pm:0, umpire:0, games:0 }; });
  matches.forEach(m => {
    if (s[m.team1]) { s[m.team1].home++; s[m.team1].games++; }
    if (s[m.team2]) { s[m.team2].away++; s[m.team2].games++; }
    const a = isAM(m.time);
    if (a===true)  { if(s[m.team1]) s[m.team1].am++; if(s[m.team2]) s[m.team2].am++; }
    else if (a===false) { if(s[m.team1]) s[m.team1].pm++; if(s[m.team2]) s[m.team2].pm++; }
    if (m.umpire1 && s[m.umpire1]) s[m.umpire1].umpire++;
    if (m.umpire2 && s[m.umpire2]) s[m.umpire2].umpire++;
  });
  return s;
}

function computeStandings(matches, teams) {
  const s = {};
  teams.forEach(t => { s[t] = { played:0, won:0, lost:0, abandoned:0, forfeited:0, points:0 }; });
  matches.forEach(m => {
    const res = (m.result||'').toLowerCase(), winner = (m.winner||'').trim(), status = (m.status||'').toLowerCase();
    if (!res && !winner && !status) return;
    if (res.includes('abandon') || status.includes('abandon') || res.includes('no result')) {
      if(s[m.team1]){s[m.team1].played++;s[m.team1].abandoned++;s[m.team1].points+=POINTS.abandoned;}
      if(s[m.team2]){s[m.team2].played++;s[m.team2].abandoned++;s[m.team2].points+=POINTS.abandoned;}
      return;
    }
    if (res.includes('forfeit')) {
      if (winner) {
        if(s[winner]){s[winner].played++;s[winner].won++;s[winner].points+=POINTS.forfeit_winner;}
        const loser=winner===m.team1?m.team2:m.team1;
        if(s[loser]){s[loser].played++;s[loser].forfeited++;}
      }
      return;
    }
    let w = winner;
    if (!w && res) {
      if (res.includes(m.team1.toLowerCase())) w=m.team1;
      else if (res.includes(m.team2.toLowerCase())) w=m.team2;
    }
    if (w) {
      const loser=w===m.team1?m.team2:m.team1;
      if(s[w]){s[w].played++;s[w].won++;s[w].points+=POINTS.win;}
      if(s[loser]){s[loser].played++;s[loser].lost++;}
    }
  });
  return Object.entries(s).map(([team,d])=>({team,...d})).sort((a,b)=>b.points-a.points||b.won-a.won||a.lost-b.lost);
}

function scanIssues(matches) {
  const issues = [];
  const add = (level,div,title,detail,ids) => issues.push({level,div,title,detail,matchIds:ids||[]});
  const byDiv = {};
  matches.forEach(m => { if(!byDiv[m.division]) byDiv[m.division]=[]; byDiv[m.division].push(m); });
  Object.entries(byDiv).forEach(([div,dms]) => {
    const teams=[...new Set(dms.flatMap(m=>[m.team1,m.team2]))];
    const teamSet=new Set(teams);
    const pairCount={};
    dms.forEach(m=>{const k=[m.team1,m.team2].sort().join('|||');if(!pairCount[k])pairCount[k]=[];pairCount[k].push(m);});
    Object.entries(pairCount).forEach(([pair,ms])=>{
      if(ms.length>1){const n=pair.split('|||');add('error',div,'Duplicate matchup',`${n[0]} vs ${n[1]} scheduled ${ms.length}x`,ms.map(m=>m.id));}
    });
    const tdg={};
    dms.forEach(m=>{[m.team1,m.team2].forEach(t=>{const k=`${t}|||${m.date}`;if(!tdg[k])tdg[k]=[];tdg[k].push(m);});});
    Object.entries(tdg).forEach(([k,ms])=>{
      if(ms.length>1){const[team,date]=k.split('|||');add('error',div,'Double-booked team',`${team} plays ${ms.length} games on ${date}`,ms.map(m=>m.id));}
    });
    dms.forEach(m=>{
      [m.umpire1,m.umpire2].forEach(u=>{
        if(u&&(u===m.team1||u===m.team2)) add('error',div,'Self-umpiring',`${u} umpires own match #${m.id}`,[m.id]);
      });
    });
    const stats=computeBalance(dms,teams);
    Object.entries(stats).forEach(([team,s])=>{
      if(Math.abs(s.home-s.away)>=3) add('warn',div,'Home/Away imbalance',`${team}: ${s.home}H / ${s.away}A`);
      if(Math.abs(s.am-s.pm)>=3) add('warn',div,'AM/PM imbalance',`${team}: ${s.am}AM / ${s.pm}PM`);
    });
  });
  return issues;
}

// ── Test data ─────────────────────────────────────────────────────────────────
const TEAMS = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
const mkMatch = (id, t1, t2, opts={}) => ({
  id: String(id), division: opts.div||'U11A',
  date: opts.date||'04/26/2026', time: opts.time||'9:00 AM',
  team1: t1, team2: t2,
  ground: opts.ground||'Field 1',
  umpire1: opts.u1||'', umpire2: opts.u2||'',
  result: opts.result||'', winner: opts.winner||'', status: opts.status||'',
});

// ── Suites ────────────────────────────────────────────────────────────────────

suite('parseDate');
test('parses MM/DD/YYYY', () => {
  const d = parseDate('04/26/2026');
  expect(d.getFullYear()).toBe(2026);
  expect(d.getMonth()).toBe(3); // April = 3
  expect(d.getDate()).toBe(26);
});
test('returns null for empty string', () => expect(parseDate('')).toBeNull());
test('returns null for null', () => expect(parseDate(null)).toBeNull());

suite('isAM');
test('9:00 AM is AM', () => expect(isAM('9:00 AM')).toBe(true));
test('1:00 PM is not AM', () => expect(isAM('1:00 PM')).toBe(false));
test('empty time returns null', () => expect(isAM('')).toBeNull());
test('case insensitive', () => expect(isAM('9:00 am')).toBe(true));

suite('computeBalance');
test('counts home/away correctly', () => {
  const ms = [mkMatch(1,'Alpha','Bravo'), mkMatch(2,'Bravo','Alpha')];
  const s = computeBalance(ms, ['Alpha','Bravo']);
  expect(s['Alpha'].home).toBe(1);
  expect(s['Alpha'].away).toBe(1);
  expect(s['Bravo'].home).toBe(1);
  expect(s['Bravo'].away).toBe(1);
});
test('counts AM/PM slots', () => {
  const ms = [
    mkMatch(1,'Alpha','Bravo',{time:'9:00 AM'}),
    mkMatch(2,'Alpha','Charlie',{time:'1:00 PM'}),
  ];
  const s = computeBalance(ms, ['Alpha','Bravo','Charlie']);
  expect(s['Alpha'].am).toBe(1);
  expect(s['Alpha'].pm).toBe(1);
  expect(s['Bravo'].am).toBe(1);
  expect(s['Charlie'].pm).toBe(1);
});
test('counts umpire duties', () => {
  const ms = [mkMatch(1,'Alpha','Bravo',{u1:'Charlie'})];
  const s = computeBalance(ms, ['Alpha','Bravo','Charlie']);
  expect(s['Charlie'].umpire).toBe(1);
});
test('ignores unknown teams', () => {
  const ms = [mkMatch(1,'Alpha','Bravo',{u1:'Unknown'})];
  const s = computeBalance(ms, ['Alpha','Bravo']);
  expect(s['Alpha'].umpire).toBe(0);
});

suite('computeStandings');
test('win adds 2 points', () => {
  const ms = [mkMatch(1,'Alpha','Bravo',{winner:'Alpha'})];
  const st = computeStandings(ms, ['Alpha','Bravo']);
  const alpha = st.find(s=>s.team==='Alpha');
  expect(alpha.points).toBe(2);
  expect(alpha.won).toBe(1);
});
test('abandoned adds 1 point each', () => {
  const ms = [mkMatch(1,'Alpha','Bravo',{result:'Match abandoned'})];
  const st = computeStandings(ms, ['Alpha','Bravo']);
  expect(st.find(s=>s.team==='Alpha').points).toBe(1);
  expect(st.find(s=>s.team==='Bravo').points).toBe(1);
});
test('forfeit winner gets 2, loser gets 0', () => {
  const ms = [mkMatch(1,'Alpha','Bravo',{result:'forfeit',winner:'Alpha'})];
  const st = computeStandings(ms, ['Alpha','Bravo']);
  expect(st.find(s=>s.team==='Alpha').points).toBe(2);
  expect(st.find(s=>s.team==='Bravo').forfeited).toBe(1);
});
test('standings sorted by points then wins', () => {
  const ms = [
    mkMatch(1,'Alpha','Bravo',{winner:'Alpha'}),
    mkMatch(2,'Alpha','Charlie',{winner:'Alpha'}),
    mkMatch(3,'Bravo','Charlie',{winner:'Bravo'}),
  ];
  const st = computeStandings(ms, ['Alpha','Bravo','Charlie']);
  expect(st[0].team).toBe('Alpha');
  expect(st[1].team).toBe('Bravo');
});
test('no result match is ignored', () => {
  const ms = [mkMatch(1,'Alpha','Bravo')];
  const st = computeStandings(ms, ['Alpha','Bravo']);
  expect(st.find(s=>s.team==='Alpha').played).toBe(0);
});

suite('scanIssues — duplicates');
test('detects duplicate matchup', () => {
  const ms = [mkMatch(1,'Alpha','Bravo'), mkMatch(2,'Alpha','Bravo')];
  const issues = scanIssues(ms);
  expect(issues.filter(i=>i.title==='Duplicate matchup')).toHaveLength(1);
  expect(issues[0].level).toBe('error');
});
test('no issue for unique matchups', () => {
  const ms = [mkMatch(1,'Alpha','Bravo'), mkMatch(2,'Alpha','Charlie')];
  const issues = scanIssues(ms).filter(i=>i.title==='Duplicate matchup');
  expect(issues).toHaveLength(0);
});

suite('scanIssues — double booking');
test('detects team playing twice on same day', () => {
  const ms = [
    mkMatch(1,'Alpha','Bravo',{date:'04/26/2026'}),
    mkMatch(2,'Alpha','Charlie',{date:'04/26/2026'}),
  ];
  const issues = scanIssues(ms).filter(i=>i.title==='Double-booked team');
  expect(issues.length).toBeGreaterThan(0);
});
test('no issue for same team on different days', () => {
  const ms = [
    mkMatch(1,'Alpha','Bravo',{date:'04/26/2026'}),
    mkMatch(2,'Alpha','Charlie',{date:'05/03/2026'}),
  ];
  const issues = scanIssues(ms).filter(i=>i.title==='Double-booked team');
  expect(issues).toHaveLength(0);
});

suite('scanIssues — self-umpiring');
test('detects team umpiring own match', () => {
  const ms = [mkMatch(1,'Alpha','Bravo',{u1:'Alpha'})];
  const issues = scanIssues(ms).filter(i=>i.title==='Self-umpiring');
  expect(issues).toHaveLength(1);
});
test('no issue when different team umpires', () => {
  const ms = [mkMatch(1,'Alpha','Bravo',{u1:'Charlie'})];
  const issues = scanIssues(ms).filter(i=>i.title==='Self-umpiring');
  expect(issues).toHaveLength(0);
});

suite('scanIssues — H/A balance');
test('flags team with 3+ more home than away', () => {
  const ms = [
    mkMatch(1,'Alpha','Bravo'), mkMatch(2,'Alpha','Charlie'), mkMatch(3,'Alpha','Delta'),
  ];
  const issues = scanIssues(ms).filter(i=>i.title==='Home/Away imbalance');
  expect(issues.length).toBeGreaterThan(0);
});

suite('index.html structure');
const fs = require('fs');
const indexHtml = fs.readFileSync('/workspaces/SYCL/index.html','utf8');
test('ScheduleView is defined', () => expect(indexHtml).toContain('function ScheduleView('));
test('StandingsView is defined', () => expect(indexHtml).toContain('function StandingsView('));
test('IssuesView is defined', () => expect(indexHtml).toContain('function IssuesView('));
test('computeBalance is defined', () => expect(indexHtml).toContain('function computeBalance('));
test('computeStandings is defined', () => expect(indexHtml).toContain('function computeStandings('));
test('BalanceView is NOT in index.html (moved to admin)', () => expect(indexHtml.includes('function BalanceView(')).toBeFalsy());
test('PairingsView is NOT in index.html (moved to admin)', () => expect(indexHtml.includes('function PairingsView(')).toBeFalsy());
test('tabs array has no balance or pairings', () => {
  const tabsLine = indexHtml.split('\n').find(l => l.includes('const tabs'));
  expect(tabsLine).toBeTruthy();
  expect(tabsLine.includes('"balance"')).toBeFalsy();
  expect(tabsLine.includes('"pairings"')).toBeFalsy();
});
test('auto-fetches /api/schedule on load', () => expect(indexHtml).toContain('fetch("/api/schedule")'));
test('theme stored in localStorage', () => expect(indexHtml).toContain("localStorage.setItem('sycl_theme'"));

suite('admin.html structure');
const adminHtml = fs.readFileSync('/workspaces/SYCL/admin.html','utf8');
test('login screen exists', () => expect(adminHtml).toContain('id="loginScreen"'));
test('admin shell exists', () => expect(adminHtml).toContain('id="adminShell"'));
test('balance section exists', () => expect(adminHtml).toContain('id="section-balance"'));
test('pairings section exists', () => expect(adminHtml).toContain('id="section-pairings"'));
test('renderBalance function exists', () => expect(adminHtml).toContain('function renderBalance('));
test('renderPairings function exists', () => expect(adminHtml).toContain('function renderPairings('));
test('change tracking: _changedIds defined', () => expect(adminHtml).toContain('_changedIds'));
test('change tracking: markChanged function exists', () => expect(adminHtml).toContain('function markChanged('));
test('export changed only button exists', () => expect(adminHtml).toContain('exportFixtures(true)'));
test('balance div filter has no All Divisions default', () => {
  const balanceSection = adminHtml.slice(adminHtml.indexOf('id="section-balance"'));
  expect(balanceSection.slice(0, 500).includes('All divisions')).toBeFalsy();
});
test('pairings div filter has no All Divisions default', () => {
  const pairingsSection = adminHtml.slice(adminHtml.indexOf('id="section-pairings"'));
  expect(pairingsSection.slice(0, 500).includes('All divisions')).toBeFalsy();
});
test('bookmarklet link exists', () => expect(adminHtml).toContain('id="bookmarkletLink"'));

suite('api/schedule.js');
const scheduleApi = fs.readFileSync('/workspaces/SYCL/api/schedule.js','utf8');
test('requires GIST_ID env var', () => expect(scheduleApi).toContain('GIST_ID'));
test('requires GITHUB_TOKEN env var', () => expect(scheduleApi).toContain('GITHUB_TOKEN'));
test('sets cache-control header', () => expect(scheduleApi).toContain('Cache-Control'));
test('sets CORS header', () => expect(scheduleApi).toContain('Access-Control-Allow-Origin'));

suite('api/refresh.js');
const refreshApi = fs.readFileSync('/workspaces/SYCL/api/refresh.js','utf8');
test('checks admin password', () => expect(refreshApi).toContain('ADMIN_PASSWORD'));
test('handles OPTIONS preflight', () => expect(refreshApi).toContain("OPTIONS"));
test('rejects non-POST methods', () => expect(refreshApi).toContain('Method not allowed'));
test('requires matches array', () => expect(refreshApi).toContain('No match data provided'));
test('sets CORS header', () => expect(refreshApi).toContain('Access-Control-Allow-Origin'));

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n  ${'─'.repeat(50)}`);
if (_failed === 0) {
  console.log(`  ✅ All ${_passed} tests passed\n`);
} else {
  console.log(`  ❌ ${_failed} failed, ${_passed} passed (${_passed+_failed} total)\n`);
  process.exit(1);
}
