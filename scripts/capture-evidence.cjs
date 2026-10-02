const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FRONTEND_URL = 'http://repocall-frontend-678503489298.s3-website.us-east-1.amazonaws.com/';
const SCREENSHOTS_DIR = path.join(__dirname, 'docs', 'screenshots');

async function captureEvidenceScreenshot() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('Navigating to landing page...');
  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1000);
  
  // Start analysis
  console.log('Starting analysis...');
  await page.fill('input[type="url"]', 'https://github.com/axios/axios');
  await page.click('button:has-text("Recover Context")');
  
  // Wait for analysis to complete
  console.log('Waiting for analysis to complete...');
  await page.waitForSelector('text=Resume in 5 minutes', { timeout: 180000 });
  await page.waitForTimeout(2000);
  
  // Screenshot 4: Evidence and next actions (scroll down)
  console.log('Scrolling to evidence section...');
  await page.evaluate(() => {
    const headings = document.querySelectorAll('h2');
    for (const h of headings) {
      if (h.textContent.includes('Evidence')) {
        h.scrollIntoView({ behavior: 'smooth' });
        break;
      }
    }
  });
  await page.waitForTimeout(1000);
  
  await page.screenshot({ 
    path: path.join(SCREENSHOTS_DIR, '04-evidence.png'),
    fullPage: true 
  });
  console.log('✓ 04-evidence.png captured');

  await browser.close();
  console.log('Evidence screenshot captured!');
}

captureEvidenceScreenshot().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});