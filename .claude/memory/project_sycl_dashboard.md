---
name: SYCL Season Insight — Project Overview
description: Core facts about the SYCL cricket dashboard — what it is, live URL, tech stack, deployment model
type: project
originSessionId: bdadb7a6-bd81-42f2-b44b-5263cb545e61
---
**SYCL Season Insight** is a cricket analytics web dashboard for the **Seattle Youth Cricket League**. It fetches live season data from Firebase Firestore (synced from CricClubs) and shows standings, batting/bowling leaderboards, player profiles, team profiles, and match results across all age divisions.

**Live URL:** https://sycl-blue.vercel.app  
**Repo:** https://github.com/himanshu-vats/SYCL (branch: main, auto-deploys to Vercel)  
**Vercel project ID:** prj_yJb8dTDWIgkmbbfOrs0ZvE6iPTlR

## Tech Stack
- **Frontend:** React 18.2 + Vite 5.4 — built SPA served from `dist/`
- **Styling:** `src/styles.css` (1021 lines, CSS custom properties for theming)
- **Backend:** 8 Vercel serverless functions in `api/` — Node.js CommonJS (`require`)
- **Database:** Firebase Firestore via `lib/firebase.js` (Firebase Admin SDK)
- **Admin panel:** `public/admin.html` — CDN-based, login-gated, served at `/{slug}/admin`

## Critical constraint
`api/` files use CommonJS (`require`, `module.exports`). **Never add `"type": "module"` to package.json** — it breaks all API functions. Vite handles `src/` as ESM independently.

## Divisions (ordered)
Emerging Stars, U11A, U11B, U13A, U13B, U15A, U15B

## Points system
Win=2, Abandoned=1 each, Forfeit winner=2 forfeit loser=0, Loss=0

## CricClubs details
- League: SYCLYouth, clubId: 10669
- URL: https://cricclubs.com/SYCLYouth/fixtures.do?clubId=10669
- Exports contain ALL matches (past + future), not just upcoming

## Environment variables (on Vercel)
FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, ADMIN_PASSWORD
