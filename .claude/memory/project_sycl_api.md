---
name: SYCL — API & Backend
description: All 8 Vercel serverless functions, Firestore data model, admin panel, and sync pipeline
type: project
originSessionId: bdadb7a6-bd81-42f2-b44b-5263cb545e61
---
## API Endpoints (`api/` — all CommonJS, all use lib/firebase.js)

| File | Method | Path | Purpose |
|---|---|---|---|
| schedule.js | GET | /api/schedule?league={slug} | Returns full league data from Firestore |
| leagues.js | GET | /api/leagues | Lists all leagues with metadata (name, season, counts, updatedAt) |
| feedback.js | POST | /api/feedback | Saves feedback doc to Firestore |
| refresh.js | POST | /api/refresh | Admin trigger for data refresh |
| standings.js | POST | /api/standings | Recomputes standings |
| sync-all.js | POST | /api/sync-all | Full sync — receives scraped CricClubs data, writes to Firestore |
| sync-stats.js | POST | /api/sync-stats | Syncs batting/bowling/rankings stats |
| synced-matches.js | GET | /api/synced-matches?league={slug} | Lists synced match IDs |

All endpoints have CORS headers (`Access-Control-Allow-Origin: *`).

## Firestore Data Model

```
leagues/
  {slug}/                        (e.g. "SYCL-Spring-2026")
    leagueName: string
    season: string
    matches: [...]               full schedule array
    standings: { [div]: [...] }
    batting:   { [div]: [...], updatedAt }
    bowling:   { [div]: [...], updatedAt }
    rankings:  { [div]: [...], updatedAt }
    results:   { matches: [...], updatedAt }
    updatedAt: ISO string
    matchCount, completedCount, divisionCount, teamCount  (for landing page)
    playerInnings/               (SUBCOLLECTION — one doc per matchId)
      {matchId}/
        innings: [...]           per-player innings records for that match
```

**Why subcollection for playerInnings:** Firestore has a 1MB per-document limit. When matches × players × stats grew large, the monolithic doc hit this limit. Subcollection sidesteps it.

## lib/firebase.js

```js
const admin = require('firebase-admin');
// Initialises Firebase Admin SDK from env vars
// Exports: { db }
```

Used by all API functions via `const { db } = require('../lib/firebase')`.

## Admin Panel (`public/admin.html`)

- CDN-based (no build) — served at `/{slug}/admin` via Vercel rewrite
- Login-gated with `ADMIN_PASSWORD` env var
- Key sections:
  - **Sync from CricClubs** — bookmarklet that scrapes CricClubs, POSTs to /api/sync-all
  - **Upload Excel** — fallback xlsx upload
  - **Edit Fixtures** — inline editable table with sort/filter, save to Firestore
  - **Propagate to CricClubs** — shows changed fixtures, links to CricClubs update pages
  - **H/A Balance** — home/away/AM/PM balance table
  - **Pairings Matrix** — round-robin coverage grid
  - **Issues** — automated schedule issue scanner

**Editing admin.html:** Edit `public/admin.html` — this is the only source copy. The root `admin.html` was deleted. Vite copies it to `dist/admin.html` on build.

## Sync Pipeline

```
CricClubs fixtures page
  → Admin clicks "Sync All" bookmarklet in admin panel
  → Bookmarklet scrapes CricClubs DOM (fixture IDs, match data)
  → POST /api/sync-all { matches, stats, ... }
  → sync-all.js writes to Firestore leagues/{slug}
  → Dashboard picks up on next fetch (60s CDN cache on schedule endpoint)
```
