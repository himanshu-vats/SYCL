const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://sycl-blue.vercel.app';
const LEAGUE = '/SYCL-Spring-2026';
const OUT_DIR = '/tmp/validate';

fs.mkdirSync(OUT_DIR, { recursive: true });

let stepNum = 0;
async function step(page, label) {
  stepNum++;
  const file = path.join(OUT_DIR, `${String(stepNum).padStart(2, '0')}-${label.replace(/\s+/g, '-')}.png`);
  await page.screenshot({ path: file });
  console.log(`  [${stepNum}] ${label} → ${file}`);
  return file;
}

async function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  PASS: ${message}`);
  }
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // ── Test 1: Root redirects to league ──
  console.log('\n[Test] Root redirect');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
  await step(page, 'root-redirect');
  await assert(page.url().includes('/sycl-'), 'Root / redirects to a league URL');

  // ── Test 2: League page loads with nav tabs ──
  console.log('\n[Test] League page');
  await page.goto(BASE_URL + LEAGUE, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await step(page, 'league-home');
  await assert(await page.isVisible('text=Standings'), 'Standings tab visible');
  await assert(await page.isVisible('text=Batting'), 'Batting tab visible');
  await assert(await page.isVisible('text=Bowling'), 'Bowling tab visible');

  // ── Test 3: Tab navigation ──
  console.log('\n[Test] Tab navigation');
  await page.click('text=Standings');
  await page.waitForTimeout(1000);
  await step(page, 'standings-tab');
  await assert(await page.isVisible('table'), 'Standings table rendered');

  await page.click('text=Batting');
  await page.waitForTimeout(1000);
  await step(page, 'batting-tab');

  await page.click('text=Results');
  await page.waitForTimeout(1000);
  await step(page, 'results-tab');

  // ── Test 4: Admin link ──
  console.log('\n[Test] Admin link');
  await page.goto(BASE_URL + LEAGUE, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.click('text=Admin');
  await page.waitForTimeout(2000);
  await step(page, 'admin-page');
  await assert(page.url().includes('/admin'), 'Admin link navigates to /admin');
  await assert(await page.isVisible('text=Sign in'), 'Admin login form visible');

  // ── Test 5: Mobile viewport ──
  console.log('\n[Test] Mobile layout');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE_URL + LEAGUE, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1500);
  await step(page, 'mobile-home');

  await browser.close();

  console.log(`\nDone. Screenshots in ${OUT_DIR}/`);
  console.log('Files:');
  fs.readdirSync(OUT_DIR).sort().forEach(f => console.log(`  ${OUT_DIR}/${f}`));
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
