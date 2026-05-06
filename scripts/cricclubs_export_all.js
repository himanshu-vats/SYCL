/**
 * CricClubs Batting Export — Per-Series, Clean Data
 *
 * HOW TO USE:
 * 1. Go to https://cricclubs.com/SYCLYouth/allBattingRecords.do?league=all&clubId=10669
 *    while logged in
 * 2. Open DevTools: F12 → Console tab
 * 3. Paste this entire script and press Enter
 * 4. Wait ~2–3 minutes
 * 5. SYCL_batting_by_series.csv downloads automatically
 *
 * WHAT CHANGED vs old version:
 *  - Removed ~19 "phantom" series (Champions League variants, practice/registration
 *    series, 2019 series) that return duplicate template data instead of real records
 *  - For series that hit the 200-player server cap, the script automatically
 *    fetches each division (U11A, U11B, etc.) separately to get all players
 *  - Rows with Mat=0 or single-letter team names (malformed) are filtered out
 *  - Final deduplication removes any remaining identical stat-lines across series
 */

(async function () {
  const CLUB_ID = "10669";
  const BASE = "https://cricclubs.com/SYCLYouth";

  // Only real competitive series with actual per-series batting records.
  // Removed: test_series, Champions League variants, Summer Season 2,
  //          Practice series, Dads Prac, SYPL-registration, SEAPOR Cup,
  //          PRESEASAN, all 2019 series — these all return phantom template data.
  const SERIES = [
    [218, "2026 SYCL Spring"],
    [173, "2025 SYCL Fall"],
    [167, "2025 Franchise Cup"],
    [163, "2025 SYPL"],
    [159, "2025 SYCL Summer"],
    [158, "2025 SYCL Memorial Day National Tournament"],
    [149, "2025 SYCL Spring"],
    [130, "2024 SYCL Fall T20"],
    [122, "2024 SYCL Fall"],
    [110, "2024 SYCL Summer"],
    [102, "2024 SYCL Spring T20 Dhamaka"],
    [94,  "2024 SYCL Spring"],
    [87,  "2023 SYCL Fall"],
    [83,  "2023 SYCL Summer"],
    [74,  "2023 SYCL SPRING 2"],
    [53,  "2023 Practice"],
    [36,  "2022 Summer SYCL"],
    [45,  "2022 Fall SYCL"],
    [25,  "2022 Spring SYCL"],
    [19,  "SYCL Summer 2021"],
    [14,  "SYCL Spring 2021"],
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

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Extract division sub-league IDs from the page dropdown.
  // Returns an array of numeric IDs, or null if no division select found.
  async function getDivisionIds(leagueId) {
    try {
      const resp = await fetch(
        `${BASE}/battingRecords.do?league=${leagueId}&clubId=${CLUB_ID}`,
        { credentials: "include" }
      );
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, "text/html");

      // CricClubs division dropdown — try several known selectors
      const sel =
        doc.querySelector("select#divisionId") ||
        doc.querySelector("select[name='divisionId']") ||
        [...doc.querySelectorAll("select")].find(s =>
          [...s.querySelectorAll("option")].some(o =>
            /U11|U13|U15|U19|Emerging/i.test(o.textContent)
          )
        );

      if (!sel) return null;

      const ids = [...sel.querySelectorAll("option")]
        .map(o => o.value.trim())
        .filter(v => v && v !== "" && v !== "all" && /^\d+$/.test(v));

      return ids.length > 1 ? ids : null;
    } catch (_) {
      return null;
    }
  }

  function parseTable(html, seriesName) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const table =
      doc.getElementById("webrecordtable") ||
      doc.querySelector("table.playersData");
    if (!table) return [];

    const year = extractYear(seriesName);
    const ageGroup = extractAgeGroup(seriesName);
    const rows = [];

    for (const tr of table.querySelectorAll("tbody tr")) {
      const tds = tr.querySelectorAll("td");
      if (tds.length < 14) continue;

      const player = tds[1].textContent.trim();
      const team   = tds[2].textContent.trim();

      // Drop malformed rows: blank name, single-char team (e.g. "A"), Mat=0
      if (!player || player.length < 2) continue;
      if (!team   || team.length   <= 1) continue;

      const mat = parseInt(tds[3].textContent) || 0;
      if (mat === 0) continue;

      const inns  = parseInt(tds[4].textContent) || 0;
      const no    = parseInt(tds[5].textContent) || 0;
      const runs  = parseInt(tds[6].textContent.replace(/,/g, "")) || 0;
      const dism  = inns - no;
      const avg   = dism > 0
        ? (runs / dism).toFixed(2)
        : (runs > 0 ? "N/O" : "0");
      const sr    = parseFloat(tds[12].textContent) || "—";

      rows.push({
        player, team,
        series: seriesName,
        year, ageGroup,
        mat, inns, no, runs,
        fours:    parseInt(tds[7].textContent)  || 0,
        sixes:    parseInt(tds[8].textContent)  || 0,
        fifties:  parseInt(tds[9].textContent)  || 0,
        hundreds: parseInt(tds[10].textContent) || 0,
        hs:       tds[11].textContent.trim()    || "—",
        sr, avg,
        points: tds.length > 14 ? (parseInt(tds[14].textContent) || 0) : 0,
      });
    }
    return rows;
  }

  // Fetch one series. If the response hits the 200-row server cap,
  // automatically re-fetch each division sub-league separately.
  async function fetchSeries(leagueId, seriesName) {
    // First pass: divisions=all
    const url = `${BASE}/battingRecords.do?divisions=all&league=${leagueId}&clubId=${CLUB_ID}`;
    const resp = await fetch(url, { credentials: "include" });
    const html = await resp.text();
    const rows = parseTable(html, seriesName);

    if (rows.length < 200) return rows; // All data retrieved

    // Hit the cap — try per-division
    console.log(`  ⚠ ${seriesName}: 200-cap hit, querying divisions individually…`);
    await sleep(400);

    const divIds = await getDivisionIds(leagueId);
    if (!divIds) {
      console.log(`    (no division dropdown found, keeping 200 rows)`);
      return rows;
    }

    console.log(`    Found ${divIds.length} divisions: ${divIds.join(", ")}`);
    const divRows = [];

    for (const divId of divIds) {
      await sleep(350);
      try {
        const dr = await fetch(
          `${BASE}/battingRecords.do?league=${divId}&clubId=${CLUB_ID}`,
          { credentials: "include" }
        );
        const dh = await dr.text();
        const pr = parseTable(dh, seriesName);
        divRows.push(...pr);
      } catch (_) { /* skip failed division */ }
    }

    if (divRows.length === 0) return rows; // fallback

    // Deduplicate within this series (player+team should appear once)
    const seen = new Set();
    return divRows.filter(r => {
      const k = `${r.player}|${r.team}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // ── Fetch all series ──────────────────────────────────────────────
  const allRows = [];
  let done = 0;
  console.log(`Fetching ${SERIES.length} real series (phantom series removed)…`);

  for (const [leagueId, name] of SERIES) {
    try {
      const rows = await fetchSeries(leagueId, name);
      allRows.push(...rows);
      console.log(`✓ [${++done}/${SERIES.length}] ${name}: ${rows.length} players`);
    } catch (e) {
      console.warn(`✗ ${name}: ${e.message}`);
      done++;
    }
    await sleep(300);
  }

  // ── Global deduplication ──────────────────────────────────────────
  // If a player+team has the exact same core stats in multiple series
  // it's phantom template data — keep only the highest-ID (most recent) series.
  const statKey = r =>
    `${r.player}|${r.team}|${r.mat}|${r.inns}|${r.no}|${r.runs}|${r.fours}|${r.sixes}`;

  const groups = {};
  for (const r of allRows) {
    const k = statKey(r);
    (groups[k] = groups[k] || []).push(r);
  }

  const deduped = [];
  let phantomCount = 0;
  for (const group of Object.values(groups)) {
    if (group.length === 1) {
      deduped.push(group[0]);
    } else {
      // Keep the entry from the highest series year
      group.sort((a, b) => (b.year || "0").localeCompare(a.year || "0"));
      deduped.push(group[0]);
      phantomCount += group.length - 1;
    }
  }

  if (phantomCount > 0)
    console.log(`  Removed ${phantomCount} phantom duplicate entries`);

  // ── Sort: Player A→Z, then Year newest→oldest ─────────────────────
  deduped.sort((a, b) => {
    const nc = a.player.localeCompare(b.player, undefined, { sensitivity: "base" });
    if (nc !== 0) return nc;
    return (b.year || "0").localeCompare(a.year || "0");
  });

  // ── Build CSV ─────────────────────────────────────────────────────
  const q = v => `"${String(v).replace(/"/g, '""')}"`;

  const headers = [
    "#", "Player", "Team", "Series", "Year", "AgeGroup",
    "Mat", "Inns", "NO", "Runs", "4s", "6s", "50s", "100s", "HS", "SR", "Avg", "Points",
  ];

  const csvRows = [headers.join(",")];
  deduped.forEach((r, i) => {
    csvRows.push([
      i + 1,
      q(r.player), q(r.team), q(r.series),
      r.year, q(r.ageGroup),
      r.mat, r.inns, r.no, r.runs,
      r.fours, r.sixes, r.fifties, r.hundreds,
      q(r.hs), r.sr, r.avg, r.points,
    ].join(","));
  });

  // ── Download ──────────────────────────────────────────────────────
  const csv  = "﻿" + csvRows.join("\n");  // BOM for Excel UTF-8
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href     = URL.createObjectURL(blob);
  link.download = "SYCL_batting_by_series.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log(`\n✅ Done! ${deduped.length} clean rows across ${SERIES.length} series.`);
  console.log(`📥 Downloaded: SYCL_batting_by_series.csv`);
  console.log(`\nExcel tips:`);
  console.log(`  • PivotTable → rows=Player, values=Sum(Runs)  → career totals`);
  console.log(`  • Filter Year=2026                            → current season`);
  console.log(`  • Filter AgeGroup=U13                         → one division`);
})();
