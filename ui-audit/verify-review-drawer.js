import { launchChrome, createPage, captureScreenshot } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'verification_hod');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setAuth(cdp, authData) {
  const expr = `
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('campusflow_token', ${JSON.stringify(authData.token)});
    localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(authData.user))});
    localStorage.setItem('campusflow_role', ${JSON.stringify(authData.role)});
  `;
  await cdp.send('Runtime.evaluate', { expression: expr });
}

async function run() {
  const authTokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit', 'auth-tokens.json'), 'utf8'));
  const hodAuth = authTokens.hod;

  console.log('Testing HOD review drawers and TG verification status...');
  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    await setAuth(cdp, hodAuth);

    // 1. Test Attendance Considerations review drawer (showing TG status)
    console.log('1. Navigating to /hod/considerations...');
    await cdp.send('Page.navigate', { url: `${APP_BASE}/hod/considerations` });
    await sleep(2500);

    // Click "Review" button on the first pending item
    console.log('Opening Review drawer in Considerations...');
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const reviewBtn = document.querySelector('.hod-btn-review');
        if (reviewBtn) reviewBtn.click();
      })()`
    });
    await sleep(600);

    // Capture screenshot of the Considerations review drawer
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'hod-considerations-review-drawer.png'), { width: 1440, height: 900 });
    console.log('Saved considerations review drawer screenshot!');

    // Close the drawer
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const closeBtn = document.querySelector('.hod-drawer-header button') || document.querySelector('.hod-drawer-backdrop');
        if (closeBtn) closeBtn.click();
      })()`
    });
    await sleep(400);

    // 2. Test TG Recommendations review drawer (now slidable Screen 7 drawer!)
    console.log('2. Navigating to /hod/tg-recommendations...');
    await cdp.send('Page.navigate', { url: `${APP_BASE}/hod/tg-recommendations` });
    await sleep(2500);

    // Click "Review" button on the TG recommendation item
    console.log('Opening Review drawer in TG Recommendations...');
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const reviewBtn = document.querySelector('.hod-btn-review');
        if (reviewBtn) reviewBtn.click();
      })()`
    });
    await sleep(600);

    // Capture screenshot of the TG recommendations review drawer
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'hod-tg-recommendations-review-drawer.png'), { width: 1440, height: 900 });
    console.log('Saved TG recommendations review drawer screenshot!');

    console.log('All verification captures completed successfully!');
  } finally {
    process.exit(0);
  }
}

run();
