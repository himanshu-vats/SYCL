# SYCL Season Insight Dashboard

Cricket analytics dashboard for the **Seattle Youth Cricket League (SYCL)**. Fetches live data from Firebase/Firestore (synced from CricClubs) and displays standings, batting/bowling stats, player profiles, team profiles, and match results across all divisions.

**Live URL:** https://sycl-blue.vercel.app  
**Repo:** https://github.com/himanshu-vats/SYCL  
**Vercel project:** sycl (team: himanshu-vats)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18.2 + Vite 5.4, deployed as SPA from `dist/` |
| Styling | Single CSS file (`src/styles.css`), CSS variables for theming |
| Backend | 8 Vercel serverless functions in `api/` (Node.js, CommonJS) |
| Database | Firebase Firestore (via `lib/firebase.js`) |
| Deployment | Vercel — auto-deploys on push to `main` |
| Admin | `public/admin.html` — CDN-based, login-gated, served at `/:slug/admin` |

---

## Project Structure

```
/
├── src/
│   ├── main.jsx                    Entry point — mounts App, imports styles.css
│   ├── App.jsx                     Root — SYCLDashboard + FeedbackModal
│   ├── styles.css                  All CSS (1021 lines, CSS variables for theming)
│   ├── constants.js                POINTS, RANK_CLASS, RANK_MEDAL, ACHIEVEMENTS
│   ├── components/
│   │   ├── SYCLDashboard.jsx       Main orchestrator — data fetching, routing, state
│   │   ├── NavBar.jsx              Persistent top nav with tab bar + breadcrumbs
│   │   ├── SeasonOverview.jsx      Home tab — season progress, upcoming, results, stars
│   │   ├── ScheduleView.jsx        All fixtures with division filter + WhatsApp share
│   │   ├── StandingsView.jsx       Points table with form guide + streak badges
│   │   ├── ResultsView.jsx         Completed match results with score display
│   │   ├── BattingView.jsx         Batting leaderboard with leader cards
│   │   ├── BowlingView.jsx         Bowling leaderboard with leader cards
│   │   ├── RankingsView.jsx        Fantasy points rankings with podium
│   │   ├── PlayerProfilePage.jsx   Full-screen player page (stats, form curve, benchmarks,
│   │   │                           dismissal profile, achievements, match-by-match strip)
│   │   ├── TeamProfilePage.jsx     Full-screen team page (results, fixtures, roster)
│   │   ├── DrilldownPanel.jsx      Floating overlay for quick player/team stats
│   │   ├── PlayerPanel.jsx         Quick stats panel (used inside DrilldownPanel)
│   │   ├── TeamPanel.jsx           Quick team panel (used inside DrilldownPanel)
│   │   ├── FormCurve.jsx           SVG sparkline for batting/bowling form
│   │   ├── FeedbackModal.jsx       Feedback modal — POSTs to /api/feedback
│   │   ├── LandingPage.jsx         Multi-league landing page (lists all leagues)
│   │   └── shared/
│   │       ├── SortableTh.jsx      Sortable table header with direction indicator
│   │       ├── FormGuide.jsx       W/L/A pill row
│   │       ├── StreakBadge.jsx     Current win/loss streak badge
│   │       ├── LeaderCard.jsx      Stat leader highlight card
│   │       ├── LeaderSection.jsx   Row of LeaderCards for a stat
│   │       ├── NextMatchCard.jsx   Next fixture card for a team
│   │       └── ResultStrip.jsx     Latest result banner
│   └── utils/
│       ├── schedule.js             getLeagueSlug, parseSchedule, parseDate, isAM
│       ├── standings.js            computeBalance, computeStandings
│       ├── aggregation.js          aggregateBatting, aggregateBowling, aggregateRankings
│       ├── insights.js             Percentile benchmarks, player archetypes
│       ├── innings.js              Per-match innings history, best innings/spell, streaks
│       ├── milestones.js           getNearestMilestones, boundary distribution, dismissals
│       └── form.js                 computeFormGuide, computeStreak, sortRows
├── api/                            Vercel serverless functions (CommonJS, require)
│   ├── schedule.js                 GET — returns full league data from Firestore
│   ├── leagues.js                  GET — lists all league slugs with metadata
│   ├── feedback.js                 POST — saves feedback to Firestore
│   ├── refresh.js                  POST — admin refresh trigger
│   ├── standings.js                POST — recomputes standings
│   ├── sync-all.js                 POST — full sync from CricClubs scraped data
│   ├── sync-stats.js               POST — syncs batting/bowling/rankings stats
│   └── synced-matches.js           GET — lists synced match IDs for a league
├── lib/
│   └── firebase.js                 Firebase Admin SDK init (CommonJS)
├── public/
│   └── admin.html                  Admin panel (source file, Vite copies to dist/)
├── test/
│   └── sycl.test.js                Unit tests for utility functions (node, no framework)
├── index.html                      Vite HTML entry point (minimal shell)
├── vite.config.js                  Vite config — React plugin, outDir: dist
├── vercel.json                     Build config + rewrites for SPA + admin routing
└── package.json                    React 18.2, Vite 5.4, firebase-admin
```

---

## Data Flow

```
CricClubs website
    → Sync bookmarklet (in admin panel) scrapes fixture/stats data
    → POST /api/sync-all  (requires X-Admin-Password header)
    → Firestore: leagues/{slug} document + playerInnings subcollection

Browser loads https://sycl-blue.vercel.app/{slug}
    → SYCLDashboard fetches GET /api/schedule?league={slug}
    → Firestore returns: { matches, standings, batting, bowling,
                          rankings, results, playerInnings,
                          leagueName, season, updatedAt }
    → React renders all tab views from this single response
```

---

## URL Routing

The app uses URL path + hash for navigation (no React Router):

| URL pattern | What renders |
|---|---|
| `/` | Redirects to most recently updated league |
| `/{slug}` | SYCLDashboard — defaults to SeasonOverview tab |
| `/{slug}#player=Name` | PlayerProfilePage for that player |
| `/{slug}#team=Name` | TeamProfilePage for that team |
| `/{slug}/admin` | Admin panel (admin.html) |

---

## Environment Variables (set on Vercel)

```
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY      (with \n for newlines)
ADMIN_PASSWORD            (gates /api/refresh and admin panel login)
```

---

## Local Development

```bash
# Install
npm install

# Frontend only (no API — data won't load)
npm run dev

# Full stack with API functions
vercel dev       # requires: vercel link (one-time), .env.local with Firebase creds

# Build check
npm run build

# Unit tests
npm test
```

`.env.local` format:
```
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
ADMIN_PASSWORD=...
```

---

## Key Domain Rules

- **Divisions (ordered):** Emerging Stars, U11A, U11B, U13A, U13B, U15A, U15B
- **Points:** Win=2, Abandoned=1 each, Forfeit winner=2 forfeit loser=0, Loss=0
- **Oregon teams:** Restricted to PM (afternoon) slots only
- **Ground availability:** Some grounds are day-specific (e.g. CKMS = Sunday only)
- **CricClubs:** League = SYCLYouth, clubId = 10669
- **CricClubs exports** contain ALL matches (past + future), not just upcoming ones
- **Home team** (Team 1) handles field setup

---

## Deployment

Every push to `main` triggers a Vercel build:
1. `npm install`
2. `npm run build` → Vite bundles `src/` → `dist/`
3. Vercel serves `dist/` as static + `api/` as serverless functions

**Important:** `api/` files use CommonJS (`require`). Do NOT add `"type": "module"` to `package.json` — it breaks the API functions.

**Admin page:** Edit `public/admin.html` (not root `admin.html` — that was removed). Vite copies it to `dist/admin.html` on build.

---

## Test Suite

`test/sycl.test.js` — vanilla Node.js, no framework:
- Covers: `parseDate`, `isAM`, `computeBalance`, `computeStandings`, `scanIssues`
- **Known issue:** The "index.html structure" and "admin.html structure" test suites are obsolete post-Vite migration (checked for functions in the old monolithic index.html). They also use `require('fs')` which breaks without `"type": "module"`. Needs updating to check `src/` files instead.
