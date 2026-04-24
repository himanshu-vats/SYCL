# SYCL Schedule Dashboard

Schedule management tool for the Seattle Youth Cricket League. Upload a CricClubs schedule export to view balance metrics, pairings, standings, and detect scheduling issues across all divisions.

## Features

- **Balance Dashboard** — Per-team home/away, AM/PM, and umpire counts with color-coded imbalance scoring
- **Schedule View** — All matches grouped by date with AM/PM badges
- **Pairings Matrix** — Visual grid showing which teams have played each other
- **Standings** — Points table (2 pts win, 1 pt abandoned, 2 pts forfeit winner)
- **Issues Scanner** — Auto-detects duplicates, double-bookings, self-umpiring, ground conflicts, balance problems
- **Light/Dark theme** — Toggle in header

## Setup

### 1. Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name it `sycl-dashboard`
3. Set to **Public** (required for free Vercel hosting)
4. Check **"Add a README file"** — uncheck this, we have our own
5. Click **Create repository**
6. Upload these files to the repo (drag and drop works)

### 2. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select `sycl-dashboard`
4. Framework preset: **Other**
5. Click **Deploy**
6. Done. You'll get a URL like `sycl-dashboard.vercel.app`

Every push to `main` auto-deploys.

### 3. Edit from anywhere

Option A: **GitHub.dev** — Open your repo on GitHub, press `.` (period key) to launch a full VS Code editor in the browser. Edit, commit, push. Vercel auto-deploys.

Option B: **GitHub Codespaces** — From your repo, click Code > Codespaces > New codespace. Full dev environment in the cloud.

## Usage

1. Export schedule from CricClubs (Schedule > Export)
2. Open the dashboard URL
3. Upload the `.xlsx` file
4. Select division tabs to view data
5. Click Issues button to scan for problems across all divisions

## Project Structure

```
index.html    — The entire app (single file, no build step)
README.md     — This file
vercel.json   — Vercel deployment config
```

## For Future Maintainers

This tool is developed iteratively via a Claude AI project that holds the full context of SYCL scheduling rules, constraints, and history. When you need to add new logic (new division formats, solver features, etc.), open that project, describe what you need, and Claude will generate updated code to push here.

The scheduling rules and constraints are documented in the Claude project's memory. Key things to know:
- CricClubs exports contain ALL matches (past + future), not just upcoming ones
- Home team (Team 1) handles field setup
- Oregon-based teams are restricted to afternoon slots only
- Some grounds have day-specific availability (CKMS = Sunday only, etc.)
- CricClubs has no bulk edit — only bulk upload for new matches
