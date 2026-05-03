import { POINTS } from '../constants.js';
import { isAM } from './schedule.js';

export function computeBalance(matches, teams) {
  const s = {};
  teams.forEach(t => { s[t] = { home:0, away:0, am:0, pm:0, umpire:0, games:0 }; });
  matches.forEach(m => {
    if (s[m.team1]) { s[m.team1].home++; s[m.team1].games++; }
    if (s[m.team2]) { s[m.team2].away++; s[m.team2].games++; }
    const a = isAM(m.time);
    if (a===true) { if(s[m.team1]) s[m.team1].am++; if(s[m.team2]) s[m.team2].am++; }
    else if (a===false) { if(s[m.team1]) s[m.team1].pm++; if(s[m.team2]) s[m.team2].pm++; }
    if (m.umpire1 && s[m.umpire1]) s[m.umpire1].umpire++;
    if (m.umpire2 && s[m.umpire2]) s[m.umpire2].umpire++;
  });
  return s;
}

export function computeStandings(matches, teams) {
  const s = {};
  teams.forEach(t => { s[t] = { played:0, won:0, lost:0, abandoned:0, forfeited:0, points:0 }; });
  matches.forEach(m => {
    const res = (m.result||"").toLowerCase(), winner = (m.winner||"").trim(), status = (m.status||"").toLowerCase();
    if (!res && !winner && !status) return;
    if (res.includes("abandon") || status.includes("abandon") || res.includes("no result")) {
      if(s[m.team1]){s[m.team1].played++;s[m.team1].abandoned++;s[m.team1].points+=POINTS.abandoned;}
      if(s[m.team2]){s[m.team2].played++;s[m.team2].abandoned++;s[m.team2].points+=POINTS.abandoned;}
      return;
    }
    if (res.includes("forfeit")) {
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
