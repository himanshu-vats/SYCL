/**
 * CricClubs All-Series Bowling Export — Per-Series Detail
 *
 * HOW TO USE:
 * 1. Go to https://cricclubs.com/SYCLYouth/allBowlingRecords.do?league=all&clubId=10669
 *    while logged in
 * 2. Open DevTools: F12 → Console tab
 * 3. Paste this entire script and press Enter
 * 4. Wait ~2 minutes while it fetches each series
 * 5. SYCL_bowling_by_series.csv downloads automatically
 *
 * OUTPUT: One row per player per series.
 * Columns: #, Player, Team, Series, Year, AgeGroup,
 *          Mat, Inns, Overs, Runs, Wkts, BBF, Mdns, Dots,
 *          Econ, Avg, SR, HatTrick, 4w, 5w, Wides, Nb, Points
 *
 * Excel tips after opening:
 *  - PivotTable → rows=Player, values=Sum(Wkts)   → career wickets
 *  - Filter Year=2026                              → current season
 *  - Filter AgeGroup=U13                           → one division
 *  - Sort by Econ ascending                        → most economical bowlers
 */

(async function() {
  const CLUB_ID = "10669";
  const BASE    = "https://cricclubs.com/SYCLYouth";

  const SERIES = [
    [218,"2026 SYCL Spring"],[209,"test_series"],[173,"2025 SYCL Fall"],
    [167,"2025 Franchise Cup"],[166,"2025 SYCL Summer Season 2"],[163,"2025 SYPL"],
    [159,"2025 SYCL Summer"],[158,"2025 SYCL Memorial Day National Tournament"],
    [157,"2025 SYCL Champions League JR"],[156,"2025 SYCL Champions League"],
    [149,"2025 SYCL Spring"],[130,"2024 SYCL Fall T20"],[122,"2024 SYCL Fall"],
    [110,"2024 SYCL Summer"],[102,"2024 SYCL Spring T20 Dhamaka"],[101,"2024 SYCL Practice"],
    [94,"2024 SYCL Spring"],[87,"2023 SYCL Fall"],[83,"2023 SYCL Summer"],
    [82,"2023 SYCL Spring 3"],[74,"2023 SYCL SPRING 2"],[53,"2023 Practice"],
    [52,"2022 Dads Prac Series"],[44,"2022 SYPL"],[36,"2022 Summer SYCL"],
    [35,"Practice Matches"],[45,"2022 Fall SYCL"],[25,"2022 Spring SYCL"],
    [24,"SEAPOR Cup"],[19,"SYCL Summer 2021"],[14,"SYCL Spring 2021"],
    [11,"PRESEASAN"],[10,"Practice matches"],[9,"2019 FALL U11"],
    [7,"2019 Fall U13"],[6,"2019 Fall U15"],[5,"2019 Spring Div B"],
    [4,"2019 Spring U15"],[3,"2019 Spring U11"],[1,"2019 Spring U13"],
  ];

  function extractYear(name) {
    const m = name.match(/\b(20\d{2})\b/);
    return m ? m[1] : "—";
  }

  function extractAgeGroup(name) {
    const n = name.toUpperCase();
    if (n.includes("U11")) return "U11";
    if (n.includes("U13")) return "U13";
    if (n.includes("U15")) return "U15";
    if (n.includes("U19")) return "U19";
    if (n.includes("SYPL") || n.includes("YOUTH")) return "Youth";
    if (n.includes("WOMEN") || n.includes("SIREN")) return "Women";
    if (n.includes("DAD") || n.includes("PRAC")) return "Practice";
    return "Open";
  }

  // Clean BBF: "&nbsp;4/&nbsp;4" → "4/4"
  function cleanBBF(raw) {
    return raw.replace(/ /g, "").replace(/\s+/g, "").trim();
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function parseTable(html, seriesName) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const table = doc.getElementById("webrecordtable") ||
                  doc.querySelector("table.playersData");
    if (!table) return [];

    const year     = extractYear(seriesName);
    const ageGroup = extractAgeGroup(seriesName);
    const rows = [];

    for (const tr of table.querySelectorAll("tbody tr")) {
      const tds = tr.querySelectorAll("td");
      if (tds.length < 13) continue;

      const txt = i => tds[i]?.textContent.trim() || "";
      const num = i => parseFloat(txt(i)) || 0;
      const int = i => parseInt(txt(i)) || 0;

      const wkts = int(7);
      const runs = int(6);
      const overs = txt(5);

      // Compute Avg if not already provided cleanly
      const avgRaw = parseFloat(txt(12)) || 0;
      const avg = avgRaw > 0 ? avgRaw : (wkts > 0 ? +(runs / wkts).toFixed(2) : "—");

      rows.push({
        player:    txt(1),
        team:      txt(2),
        series:    seriesName,
        year,
        ageGroup,
        mat:       int(3),
        inns:      int(4),
        overs,
        runs,
        wkts,
        bbf:       cleanBBF(txt(8)),
        mdns:      int(9),
        dots:      int(10),
        econ:      num(11),
        avg,
        sr:        num(13),
        hatTrick:  tds.length > 14 ? int(14) : 0,
        w4:        tds.length > 15 ? int(15) : 0,
        w5:        tds.length > 16 ? int(16) : 0,
        wides:     tds.length > 17 ? int(17) : 0,
        nb:        tds.length > 18 ? int(18) : 0,
        points:    tds.length > 19 ? int(19) : 0,
      });
    }
    return rows;
  }

  // ── Fetch all series ──
  const allRows = [];
  let done = 0;
  console.log(`Fetching ${SERIES.length} series (bowling)...`);

  for (const [leagueId, name] of SERIES) {
    try {
      const url = `${BASE}/bowlingRecords.do?divisions=all&league=${leagueId}&clubId=${CLUB_ID}`;
      const resp = await fetch(url, { credentials: "include" });
      const html = await resp.text();
      const rows = parseTable(html, name);
      allRows.push(...rows);
      console.log(`✓ [${++done}/${SERIES.length}] ${name}: ${rows.length} players`);
    } catch(e) {
      console.warn(`✗ ${name}: ${e.message}`);
      done++;
    }
    await sleep(300);
  }

  // ── Sort: Player A→Z, then Year newest→oldest ──
  allRows.sort((a, b) => {
    const nc = a.player.localeCompare(b.player, undefined, { sensitivity: "base" });
    if (nc !== 0) return nc;
    return (b.year || "0").localeCompare(a.year || "0");
  });

  // ── Build CSV ──
  const q = v => `"${String(v).replace(/"/g, '""')}"`;

  const headers = [
    "#", "Player", "Team", "Series", "Year", "AgeGroup",
    "Mat", "Inns", "Overs", "Runs", "Wkts", "BBF",
    "Mdns", "Dots", "Econ", "Avg", "SR",
    "HatTrick", "4w", "5w", "Wides", "Nb", "Points"
  ];

  const csvRows = [headers.join(",")];
  allRows.forEach((r, i) => {
    csvRows.push([
      i + 1,
      q(r.player), q(r.team), q(r.series),
      r.year, q(r.ageGroup),
      r.mat, r.inns, q(r.overs), r.runs, r.wkts, q(r.bbf),
      r.mdns, r.dots, r.econ, r.avg, r.sr,
      r.hatTrick, r.w4, r.w5, r.wides, r.nb, r.points
    ].join(","));
  });

  // ── Download ──
  const csv  = "﻿" + csvRows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href     = URL.createObjectURL(blob);
  link.download = "SYCL_bowling_by_series.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log(`\n✅ Done! ${allRows.length} rows across ${SERIES.length} series.`);
  console.log(`📥 Downloaded: SYCL_bowling_by_series.csv`);
  console.log(`\nExcel tips:`);
  console.log(`  • PivotTable → rows=Player, values=Sum(Wkts)   → career wickets`);
  console.log(`  • Filter Year=2026                             → current season`);
  console.log(`  • Filter AgeGroup=U11                          → one division`);
  console.log(`  • Filter 5w >= 1                               → five-for heroes`);
  console.log(`  • Sort Econ ascending → most economical bowlers`);
})();
