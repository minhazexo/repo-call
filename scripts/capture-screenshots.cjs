const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FRONTEND_URL = 'http://repocall-frontend-678503489298.s3-website.us-east-1.amazonaws.com/';
const API_URL = 'https://j5n58xfskf.execute-api.us-east-1.amazonaws.com/';
const SCREENSHOTS_DIR = path.join(__dirname, 'docs', 'screenshots');

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('Navigating to landing page...');
  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1000);
  
  // Screenshot 1: Landing page
  await page.screenshot({ 
    path: path.join(SCREENSHOTS_DIR, '01-landing.png'),
    fullPage: true 
  });
  console.log('✓ 01-landing.png captured');

  // Screenshot 2: Loading state
  console.log('Starting analysis for loading screenshot...');
  await page.fill('input[type="url"]', 'https://github.com/axios/axios');
  await page.click('button:has-text("Recover Context")');
  
  // Wait for loading skeleton to appear
  await page.waitForSelector('.skeleton-bar', { timeout: 10000 });
  await page.waitForTimeout(1500);
  
  await page.screenshot({ 
    path: path.join(SCREENSHOTS_DIR, '02-loading.png'),
    fullPage: true 
  });
  console.log('✓ 02-loading.png captured');

  // Wait for analysis to complete
  console.log('Waiting for analysis to complete...');
  await page.waitForSelector('text=Resume in 5 minutes', { timeout: 180000 });
  await page.waitForTimeout(2000);
  
  // Screenshot 3: Dashboard top (overview + resume briefing)
  await page.screenshot({ 
    path: path.join(SCREENSHOTS_DIR, '03-dashboard.png'),
    fullPage: true 
  });
  console.log('✓ 03-dashboard.png captured');

  // Screenshot 4: Evidence and next actions (scroll down)
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
  console.log('All frontend screenshots captured!');
}

captureScreenshots().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});