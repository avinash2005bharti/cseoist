import { launchChrome, createPage, captureScreenshot } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'verified_tg');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setAuth(cdp, authData) {
  const expr = `
    localStorage.setItem('campusflow_token', ${JSON.stringify(authData.token)});
    localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(authData.user))});
    localStorage.setItem('campusflow_role', ${JSON.stringify(authData.role)});
  `;
  await cdp.send('Runtime.evaluate', { expression: expr });
}

async function main() {
  const authTokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit', 'auth-tokens.json'), 'utf8'));
  const tgAuth = authTokens.tg;

  console.log('Capturing verified TG views...');
  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    await setAuth(cdp, tgAuth);

    // 1. Desktop TG Dashboard (1440x900) -> Screen 5
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send('Emulation.setVisibleSize', { width: 1440, height: 900 });
    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg` });
    await sleep(2500);
    // 1. Desktop TG Dashboard (1440x900) -> Screen 5
    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg` });
    await sleep(2500);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'screen-5-desktop.png'), { width: 1440, height: 900 });
    console.log('Saved screen-5-desktop.png');

    // 2. Mobile TG Dashboard (375x812) -> Screen 6
    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg` });
    await sleep(2500);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'screen-6-mobile.png'), { width: 375, height: 812 });
    console.log('Saved screen-6-mobile.png');

    // 3. Desktop TG Requests with Review Drawer Opened (1440x900) -> Screen 7
    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg/requests` });
    await sleep(2500);
    // Click the Review button on the first pending application card
    const clickRes1 = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.review-action-btn') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Review');
          if (btn) {
            btn.click();
            return 'Clicked review button';
          }
          return 'Review button not found';
        })()
      `,
      returnByValue: true
    });
    console.log('Desktop drawer trigger:', clickRes1.result.value);
    await sleep(1200);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'screen-7-desktop-drawer.png'), { width: 1440, height: 900 });
    console.log('Saved screen-7-desktop-drawer.png');

    // 4. Mobile TG Requests with Bottom Sheet Review Drawer Opened (375x812) -> Screen 8
    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg/requests` });
    await sleep(2500);
    // Click the Review button on the first application
    const clickRes2 = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.review-action-btn') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Review');
          if (btn) {
            btn.click();
            return 'Clicked review button';
          }
          return 'Review button not found';
        })()
      `,
      returnByValue: true
    });
    console.log('Mobile sheet trigger:', clickRes2.result.value);
    await sleep(1200);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'screen-8-mobile-sheet.png'), { width: 375, height: 812 });
    console.log('Saved screen-8-mobile-sheet.png');

    cdp.close();
    console.log('All verification captures completed successfully!');
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

main().catch(console.error);
