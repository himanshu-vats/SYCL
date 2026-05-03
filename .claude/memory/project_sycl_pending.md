---
name: SYCL — Known Issues & Pending Work
description: Active bugs, technical debt, and next steps as of the Vite migration (May 2026)
type: project
originSessionId: bdadb7a6-bd81-42f2-b44b-5263cb545e61
---
## Recently Completed (this session)
- Migrated from monolithic 4375-line `index.html` (CDN React + Babel Standalone) to Vite 5 + React 18 component architecture
- 41 files created: 19 components, 7 utility modules, 1 CSS file, entry points
- Fixed post-deploy bugs: removed `"type": "module"` (broke API CommonJS), added `public/admin.html` (fix admin 404)
- Production verified at https://sycl-blue.vercel.app

## Known Issues / Pending Work

### 1. Test suite is broken and outdated
**File:** `test/sycl.test.js`  
**Problem:**
- `require('fs')` on line 276 crashes when running (worked before because old package.json had no `"type": "module"`; now it works again since that was removed, but the tests are still wrong)
- The "index.html structure" suite checks for function definitions inside the old monolithic `index.html` — those are gone, they now live in `src/` files
- The "admin.html structure" suite checks for specific functions in root `admin.html` which was deleted

**Fix needed:**
- Update "index.html structure" tests to check `src/components/*.jsx` or remove them
- Update "admin.html structure" tests to check `public/admin.html`
- Consider importing utils from `src/utils/` instead of maintaining inline copies

### 2. PlayerPanel and TeamPanel may be redundant
**Files:** `src/components/PlayerPanel.jsx`, `src/components/TeamPanel.jsx`  
**Problem:** These are quick-stats panels used inside `DrilldownPanel`. `PlayerProfilePage` and `TeamProfilePage` are the full-page versions. There may be overlap in logic. No immediate action needed but worth reviewing if either set of components is updated.

### 3. LandingPage component is unused
**File:** `src/components/LandingPage.jsx`  
**Problem:** This component (lists all leagues) exists but is never rendered. `SYCLDashboard` redirects to the most recent league instead of showing a landing page. Either wire it up or remove it.

### 4. Vite CJS deprecation warning
**Symptom:** `The CJS build of Vite's Node API is deprecated` on `npm run build`  
**Cause:** `package.json` no longer has `"type": "module"`, so Vite falls back to its CommonJS build  
**Fix:** Add `"type": "module"` back BUT rename all `api/*.js` files to `api/*.cjs` first so Vercel treats them as CommonJS. Medium effort, not urgent.

### 5. `design-review.js` is a stale dev script
**File:** `design-review.js` (root)  
**Problem:** A 218-line Node.js CSS analysis script from an earlier session. Not part of the app. Safe to delete if desired.

## Build & Deploy Status
- `npm run build` — clean, 61 modules, ~248KB JS, ~42KB CSS
- `npm test` — utility tests pass; structure tests are stale (see issue #1)
- Production deploy: https://sycl-blue.vercel.app — verified working post-migration
