export function getLeagueSlug() {
  const parts = window.location.pathname.split('/').filter(p => p && p !== 'admin');
  return parts[0] || null;
}

export function parseSchedule(raw) {
  let headerIdx = -1;
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const row = raw[i].map(c => String(c || "").toLowerCase());
    if (row.some(c => c.includes("division")) && row.some(c => c.includes("team"))) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return null;
  const headers = raw[headerIdx].map(h => String(h || "").trim());
  const colMap = {};
  const knownCols = {
    "#": ["#","no","number"], series: ["series"], division: ["division"],
    matchType: ["match type","matchtype","type"], date: ["date"], time: ["time"],
    team1: ["team one","team 1","team1","teamone"], team2: ["team two","team 2","team2","teamtwo"],
    ground: ["ground","venue"], umpire1: ["umpire one","umpire 1","umpire1"],
    umpire2: ["umpire two","umpire 2","umpire2"], result: ["result","match result"],
    winner: ["winner"], status: ["status"],
  };
  headers.forEach((h, i) => {
    const hl = h.toLowerCase().replace(/[*()\/\\0-9.]/g, "").trim();
    for (const [key, aliases] of Object.entries(knownCols)) {
      if (aliases.some(a => hl === a || hl.includes(a))) { if (!colMap[key]) colMap[key] = i; }
    }
  });
  const matches = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row[colMap.division] || !row[colMap.team1] || !row[colMap.team2]) continue;
    const div = String(row[colMap.division]).trim();
    const t1 = String(row[colMap.team1]).trim();
    const t2 = String(row[colMap.team2]).trim();
    if (!div || !t1 || !t2) continue;
    let dateStr = "";
    const rawDate = row[colMap.date];
    if (rawDate instanceof Date) {
      dateStr = `${String(rawDate.getMonth()+1).padStart(2,"0")}/${String(rawDate.getDate()).padStart(2,"0")}/${rawDate.getFullYear()}`;
    } else if (typeof rawDate === "number") {
      const d = new Date((rawDate - 25569) * 86400000);
      dateStr = `${String(d.getUTCMonth()+1).padStart(2,"0")}/${String(d.getUTCDate()).padStart(2,"0")}/${d.getUTCFullYear()}`;
    } else { dateStr = String(rawDate || "").trim(); }
    matches.push({
      id: row[colMap["#"]] || i, division: div,
      matchType: colMap.matchType !== undefined ? String(row[colMap.matchType]||"").trim() : "",
      date: dateStr, time: String(row[colMap.time]||"").trim(), team1: t1, team2: t2,
      ground: colMap.ground !== undefined ? String(row[colMap.ground]||"").trim() : "",
      umpire1: colMap.umpire1 !== undefined ? String(row[colMap.umpire1]||"").trim() : "",
      umpire2: colMap.umpire2 !== undefined ? String(row[colMap.umpire2]||"").trim() : "",
      result: colMap.result !== undefined ? String(row[colMap.result]||"").trim() : "",
      winner: colMap.winner !== undefined ? String(row[colMap.winner]||"").trim() : "",
      status: colMap.status !== undefined ? String(row[colMap.status]||"").trim() : "",
    });
  }
  return { matches, divisions: [...new Set(matches.map(m => m.division))], colMap };
}

export function parseDate(s) {
  if (!s) return null;
  const p = s.split("/");
  if (p.length === 3) return new Date(parseInt(p[2]), parseInt(p[0])-1, parseInt(p[1]));
  return new Date(s);
}

export function isAM(time) {
  if (!time) return null;
  const t = time.toUpperCase();
  if (t.includes("AM")) return true;
  if (t.includes("PM")) return false;
  return null;
}
