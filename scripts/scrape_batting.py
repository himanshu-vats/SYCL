"""
Scrape ALL SYCL batting records from CricClubs.

Strategy: "All Series" caps at 200. Per-series pages have no cap.
We fetch each series individually, deduplicate by player+team, and
sum their stats to get true all-time totals.

Usage:
    python3 scrape_batting.py              # saves batting_records.xlsx
    python3 scrape_batting.py --csv        # saves batting_records.csv instead
"""

import requests
from bs4 import BeautifulSoup
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
import csv
import time
import sys
import argparse
from collections import defaultdict

CLUB_ID = "10669"
BASE_URL = "https://cricclubs.com"

# All series IDs from the dropdown on the page
SERIES = [
    (218, "2026 SYCL Spring"),
    (209, "test_series"),
    (173, "2025 SYCL Fall"),
    (167, "2025 Franchise Cup"),
    (166, "2025 SYCL Summer Season 2"),
    (163, "2025 SYPL"),
    (159, "2025 SYCL Summer"),
    (158, "2025 SYCL Memorial Day National Tournament"),
    (157, "2025 SYCL Champions League JR"),
    (156, "2025 SYCL Champions League"),
    (149, "2025 SYCL Spring"),
    (130, "2024 SYCL Fall T20"),
    (122, "2024 SYCL Fall"),
    (110, "2024 SYCL Summer"),
    (102, "2024 SYCL Spring T20 Dhamaka"),
    (101, "2024 SYCL Practice"),
    (94,  "2024 SYCL Spring"),
    (87,  "2023 SYCL Fall"),
    (83,  "2023 SYCL Summer"),
    (82,  "2023 SYCL Spring 3"),
    (74,  "2023 SYCL SPRING 2"),
    (53,  "2023 Practice"),
    (52,  "2022 Dads Prac Series"),
    (44,  "2022 SYPL"),
    (36,  "2022 Summer SYCL"),
    (35,  "Practice Matches"),
    (45,  "2022 Fall SYCL"),
    (25,  "2022 Spring SYCL"),
    (24,  "SEAPOR Cup"),
    (19,  "SYCL Summer 2021"),
    (14,  "SYCL Spring 2021"),
    (11,  "PRESEASAN"),
    (10,  "Practice matches"),
    (9,   "2019 FALL U11"),
    (7,   "2019 Fall U13"),
    (6,   "2019 Fall U15"),
    (5,   "2019 Spring Div B"),
    (4,   "2019 Spring U15"),
    (3,   "2019 Spring U11"),
    (1,   "2019 Spring U13"),
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

COLS = ["#", "Player", "Team", "Mat", "Inns", "NO", "Runs",
        "4s", "6s", "50s", "100s", "HS", "SR", "Avg", "Points"]


def fetch_series(league_id, series_name):
    url = f"{BASE_URL}/SYCLYouth/battingRecords.do?league={league_id}&clubId={CLUB_ID}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
    except Exception as e:
        print(f"  ✗ {series_name}: {e}")
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    table = soup.find("table", id="webrecordtable") or soup.find("table", class_="playersData")
    if not table:
        print(f"  ✗ {series_name}: no table found")
        return []

    rows = []
    for tr in table.find("tbody").find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 14:
            continue
        player = tds[1].get_text(strip=True)
        team   = tds[2].get_text(strip=True)
        row = {
            "Player":  player,
            "Team":    team,
            "Series":  series_name,
            "Mat":     _int(tds[3]),
            "Inns":    _int(tds[4]),
            "NO":      _int(tds[5]),
            "Runs":    _int(tds[6]),
            "4s":      _int(tds[7]),
            "6s":      _int(tds[8]),
            "50s":     _int(tds[9]),
            "100s":    _int(tds[10]),
            "HS":      _hs(tds[11]),
            "SR":      _float(tds[12]),
            "Avg":     _float(tds[13]),
            "Points":  _int(tds[14]) if len(tds) > 14 else 0,
        }
        rows.append(row)

    print(f"  ✓ {series_name}: {len(rows)} players")
    return rows


def _int(td):
    try:
        return int(td.get_text(strip=True).replace(",", ""))
    except:
        return 0


def _float(td):
    try:
        return float(td.get_text(strip=True))
    except:
        return 0.0


def _hs(td):
    """Highest score — keep as string to preserve '*' not-out marker."""
    return td.get_text(strip=True)


def aggregate(all_rows):
    """
    Aggregate per-series rows into per-player career totals.
    Key = (player_name_lower, team_name_lower).
    """
    agg = defaultdict(lambda: {
        "Player": "", "Team": "", "Mat": 0, "Inns": 0, "NO": 0,
        "Runs": 0, "4s": 0, "6s": 0, "50s": 0, "100s": 0,
        "HS_num": 0, "HS_not_out": False, "Points": 0,
    })

    for row in all_rows:
        key = (row["Player"].lower().strip(), row["Team"].lower().strip())
        a = agg[key]
        a["Player"] = row["Player"]
        a["Team"]   = row["Team"]
        a["Mat"]   += row["Mat"]
        a["Inns"]  += row["Inns"]
        a["NO"]    += row["NO"]
        a["Runs"]  += row["Runs"]
        a["4s"]    += row["4s"]
        a["6s"]    += row["6s"]
        a["50s"]   += row["50s"]
        a["100s"]  += row["100s"]
        a["Points"] += row["Points"]

        # Track highest score
        hs_str = row["HS"]
        not_out = hs_str.endswith("*")
        try:
            hs_val = int(hs_str.rstrip("*"))
        except:
            hs_val = 0
        if hs_val > a["HS_num"]:
            a["HS_num"] = hs_val
            a["HS_not_out"] = not_out

    results = []
    for a in agg.values():
        dism = a["Inns"] - a["NO"]
        avg = round(a["Runs"] / dism, 2) if dism > 0 else (
            f"{a['Runs']}*" if a["Runs"] > 0 else "—"
        )
        hs = f"{a['HS_num']}{'*' if a['HS_not_out'] else ''}" if a["HS_num"] > 0 else "—"
        results.append({
            "Player":  a["Player"],
            "Team":    a["Team"],
            "Mat":     a["Mat"],
            "Inns":    a["Inns"],
            "NO":      a["NO"],
            "Runs":    a["Runs"],
            "4s":      a["4s"],
            "6s":      a["6s"],
            "50s":     a["50s"],
            "100s":    a["100s"],
            "HS":      hs,
            "SR":      "—",   # balls not tracked by CricClubs stats page
            "Avg":     avg,
            "Points":  a["Points"],
        })

    results.sort(key=lambda r: r["Runs"], reverse=True)
    for i, r in enumerate(results, 1):
        r["#"] = i
    return results


def save_xlsx(rows, path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Batting Records"

    header_fill = PatternFill("solid", fgColor="0F2A1A")
    header_font = Font(bold=True, color="FFFFFF", size=11)
    accent_fill = PatternFill("solid", fgColor="E8F5E9")

    col_keys = ["#", "Player", "Team", "Mat", "Inns", "NO", "Runs",
                "4s", "6s", "50s", "100s", "HS", "SR", "Avg", "Points"]
    ws.append(col_keys)
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    for i, row in enumerate(rows, 2):
        ws.append([row.get(k, "") for k in col_keys])
        if i % 2 == 0:
            for cell in ws[i]:
                cell.fill = accent_fill
        # Bold player name
        ws.cell(i, 2).font = Font(bold=True)

    # Column widths
    widths = [4, 28, 28, 6, 6, 5, 7, 5, 5, 5, 6, 6, 7, 7, 8]
    for col, w in enumerate(widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = w

    # Freeze header row
    ws.freeze_panes = "A2"
    # Auto-filter
    ws.auto_filter.ref = ws.dimensions

    wb.save(path)
    print(f"\nSaved: {path}  ({len(rows)} players)")


def save_csv(rows, path):
    col_keys = ["#", "Player", "Team", "Mat", "Inns", "NO", "Runs",
                "4s", "6s", "50s", "100s", "HS", "SR", "Avg", "Points"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=col_keys, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nSaved: {path}  ({len(rows)} players)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", action="store_true", help="Save as CSV instead of Excel")
    parser.add_argument("--out", default=None, help="Output filename")
    args = parser.parse_args()

    out_path = args.out or ("batting_records.csv" if args.csv else "batting_records.xlsx")

    print(f"Fetching {len(SERIES)} series from CricClubs...\n")
    all_rows = []
    for league_id, name in SERIES:
        rows = fetch_series(league_id, name)
        all_rows.extend(rows)
        time.sleep(0.4)   # be polite to the server

    print(f"\nTotal raw rows collected: {len(all_rows)}")
    print("Aggregating into career totals...")
    final = aggregate(all_rows)
    print(f"Unique players: {len(final)}")

    if args.csv:
        save_csv(final, out_path)
    else:
        save_xlsx(final, out_path)


if __name__ == "__main__":
    main()
