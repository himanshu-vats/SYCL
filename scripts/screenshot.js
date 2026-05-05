const { chromium } = require('playwright');
const { execSync } = require('child_process');

const LEAGUE_PATH = '/SYCL-Spring-2026';

function getLatestVercelUrl() {
  try {
    const url = execSync('npx vercel ls 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
    return url + LEAGUE_PATH;
  } catch {
    return null;
  }
}

const ESPN_URL = 'https://www.espncricinfo.com';

async function screenshot(page, url, outputPath) {
  console.log(`Capturing: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`Saved: ${outputPath}`);
}

(async () => {
  const mode = process.argv[2] || 'sycl';
  const customUrl = process.argv[3];

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  if (mode === 'compare') {
    const syclUrl = customUrl || getLatestVercelUrl() || `http://localhost:5173${LEAGUE_PATH}`;
    await screenshot(page, syclUrl, '/tmp/sycl-latest.png');
    await screenshot(page, ESPN_URL, '/tmp/espn-reference.png');
    console.log('\nBoth screenshots ready for comparison.');
  } else {
    const url = customUrl || getLatestVercelUrl() || `http://localhost:5173${LEAGUE_PATH}`;
    await screenshot(page, url, '/tmp/sycl-latest.png');
  }

  await browser.close();
})();
