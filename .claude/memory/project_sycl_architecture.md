---
name: SYCL — Frontend Architecture & Component Tree
description: Complete component tree, utility module map, URL routing, and data flow for the Vite+React frontend
type: project
originSessionId: bdadb7a6-bd81-42f2-b44b-5263cb545e61
---
## Component Tree

```
App (src/App.jsx)
├── SYCLDashboard (src/components/SYCLDashboard.jsx)
│   ├── NavBar — top nav bar, tab row, player/team breadcrumb
│   ├── [when #player=Name in hash]
│   │   └── PlayerProfilePage — full-screen player analytics
│   ├── [when #team=Name in hash]
│   │   └── TeamProfilePage — full-screen team page
│   ├── [default: activeTab state]
│   │   ├── SeasonOverview — home tab (progress bar, upcoming, stars)
│   │   ├── ScheduleView — fixtures list with division filter
│   │   ├── StandingsView — points table with form guides
│   │   ├── ResultsView — completed match results
│   │   ├── BattingView — batting leaderboard + leader cards
│   │   ├── BowlingView — bowling leaderboard + leader cards
│   │   └── RankingsView — fantasy points table + podium
│   └── DrilldownPanel — floating overlay (quick player/team stats)
│       ├── PlayerPanel
│       └── TeamPanel
└── FeedbackModal — feedback form, POSTs to /api/feedback
```

**Shared components** (`src/components/shared/`):
SortableTh, FormGuide, StreakBadge, LeaderCard, LeaderSection, NextMatchCard, ResultStrip

**Standalone:** LandingPage (lists all leagues, not used inside SYCLDashboard)

## URL Routing (no React Router — uses window.location)

| URL | What renders |
|---|---|
| `/` | Redirects to most recently updated league via /api/leagues |
| `/{slug}` | SYCLDashboard, defaults to SeasonOverview tab |
| `/{slug}#player=Name` | PlayerProfilePage (set on player click, cleared on back) |
| `/{slug}#team=Name` | TeamProfilePage |
| `/{slug}/admin` | admin.html (Vercel rewrite) |

## Data Flow

1. `SYCLDashboard` calls `getLeagueSlug()` (reads `window.location.pathname`)
2. Fetches `GET /api/schedule?league={slug}`
3. Response shape:
```js
{
  matches: [...],        // all fixtures (schedule)
  standings: { [div]: [...] },
  batting:   { [div]: [...], updatedAt },
  bowling:   { [div]: [...], updatedAt },
  rankings:  { [div]: [...], updatedAt },
  results:   { matches: [...], updatedAt },
  playerInnings: [...], // per-match innings data (from subcollection)
  leagueName, season, updatedAt
}
```
4. All tab views receive slices of this as props — no further API calls from children

## Utility Modules (`src/utils/`)

| File | Exports |
|---|---|
| schedule.js | getLeagueSlug, parseSchedule, parseDate, isAM |
| standings.js | computeBalance, computeStandings |
| aggregation.js | parseBBF, addOvers, aggregateBatting, aggregateBowling, aggregateRankings |
| insights.js | rowBoundaryPct, percentileHigher, percentileLower, median, computeBattingBenchmark, computeBowlingBenchmark, getBattingArchetype, getBowlingArchetype |
| innings.js | parseInningsDate, getPlayerInningsHistory, computeBestBattingInnings, computeBestBowlingSpell, formatMatchDate, detectCurrentStreak, computeOpponentBattingStats, computeOpponentBowlingStats |
| milestones.js | getNearestMilestones, computeBoundaryDistribution, categorizeDismissal, computeDismissalProfile |
| form.js | computeFormGuide, computeStreak, sortRows |

## Build

```bash
npm run build   # vite build → dist/
# Output: dist/index.html, dist/assets/index-*.js (~248KB), dist/assets/index-*.css (~42KB), dist/admin.html
```

Vite copies everything from `public/` into `dist/`. So `public/admin.html` → `dist/admin.html`.

## Key patterns

- All tab views use the same pattern: receive data as props, local sort/filter state
- "Combined" division = aggregate across all divisions (aggregation.js functions handle this)
- Player navigation: click name → `handleDrilldown({type:'player', name})` → sets playerPage state + window.location.hash
- Team navigation: same pattern with teamPage state
- Theme: stored in localStorage as 'sycl_theme', applied as `data-theme` attribute on `<html>`
